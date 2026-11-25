"""Sincroniza o vídeo com a narração gravada (ou gerada).

Coloque a narração em `narracao/`, de um destes jeitos (qualquer formato que o ffmpeg leia):
  - um arquivo por cena, com o número ou o id da cena no nome: 1_gancho.m4a, 2_apresentacao.wav...
  - um arquivo único com a narração inteira (nome sem número na frente): o script alinha o
    roteiro todo às pausas da fala e corta nas fronteiras entre as cenas.

O script:
  - corta o silêncio do começo e do fim de cada arquivo;
  - acha as pausas da fala e encaixa cada legenda no trecho certo;
  - estica a cena quando a fala é mais longa que o roteiro e encolhe quando sobra tempo (até 60%);
  - grava `timeline.narrado.json` (o timeline.json original não é alterado)
    e `out/narracao.wav` (a narração inteira já posicionada no tempo do vídeo).

Rodar: python3 audio/sync_narration.py   (depois: ./build.sh --narracao)
"""
import glob
import json
import os
import re
import subprocess
import sys
import wave

import numpy as np

SR = 48000
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRAME = 0.02  # 20 ms


def load(path):
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
        check=True, capture_output=True,
    ).stdout
    return np.frombuffer(raw, dtype="<f4").astype(np.float64)


def frames_rms(x):
    n = int(FRAME * SR)
    m = len(x) // n
    return np.sqrt(np.mean(x[: m * n].reshape(m, n) ** 2, axis=1) + 1e-12)


def speech_mask(x):
    r = frames_rms(x)
    floor = np.percentile(r, 10)
    thr = max(floor * 3.0, np.max(r) * 0.05)
    voiced = r > thr
    # fecha buraquinhos menores que 80 ms (consoantes)
    v = voiced.copy()
    gap = int(0.08 / FRAME)
    i = 0
    while i < len(v):
        if not v[i]:
            j = i
            while j < len(v) and not v[j]:
                j += 1
            if 0 < i and j < len(v) and (j - i) <= gap:
                v[i:j] = True
            i = j
        else:
            i += 1
    return v


def pauses(v, min_len=0.11):
    """lista de (início, fim) em segundos das pausas internas"""
    out = []
    i = 0
    first = np.argmax(v)
    last = len(v) - np.argmax(v[::-1]) - 1
    i = first
    while i <= last:
        if not v[i]:
            j = i
            while j <= last and not v[j]:
                j += 1
            if (j - i) * FRAME >= min_len:
                out.append((i * FRAME, j * FRAME))
            i = j
        else:
            i += 1
    return out, first * FRAME, (last + 1) * FRAME


def weight(t):
    return len(re.sub(r"\s", "", t.replace("*", ""))) + 3


def align(captions, s0, s1, ps, verbose=False, forced=None, kinds_override=None):
    """devolve o início (s, relativo ao arquivo) de cada legenda.

    1) estima onde cada fronteira entre legendas cai, pelo tamanho do texto (só o tempo falado);
    2) casa as fronteiras com pontuação às pausas da fala, num alinhamento global em ordem
       (programação dinâmica): ponto final pesa mais que vírgula;
    3) as fronteiras sem pausa são distribuídas entre os pontos casados, pelo tamanho do texto.
    """
    n = len(captions)
    w = np.array([weight(c["t"]) for c in captions], dtype=float)
    total_pause = sum(b - a for a, b in ps)
    voiced = (s1 - s0) - total_pause

    def voiced_to_real(v):
        t, acc = s0, 0.0
        for a, b in ps:
            seg = a - t
            if acc + seg >= v:
                return t + (v - acc)
            acc += seg
            t = b
        return t + (v - acc)

    cum = np.cumsum(w)[:-1] / w.sum()
    est = [voiced_to_real(f * voiced) for f in cum]  # fronteira k: entre legenda k e k+1
    kind = []
    for k in range(n - 1):
        end = captions[k]["t"].replace("*", "").strip()[-1:]
        kind.append(3.0 if end in ".?!" else 2.0 if end in ":;" else 1.2 if end == "," else 0.0)
    for k, v in (kinds_override or {}).items():
        kind[k] = v
    C = [(a + b) / 2 for a, b in ps]
    INF = 1e18

    def plain_dp(B, est, P):
        """casa fronteiras B (em ordem) com as pausas de índice P (em ordem)"""
        m, q = len(B), len(P)
        dp = np.full((m + 1, q + 1), INF)
        bt = np.zeros((m + 1, q + 1), dtype=int)
        dp[0, :] = np.arange(q + 1) * 0.25
        for j in range(1, m + 1):
            dp[j, 0] = dp[j - 1, 0] + kind[B[j - 1]]
            for i in range(1, q + 1):
                d = est[B[j - 1]] - C[P[i - 1]]
                kb = kind[B[j - 1]]
                plen = ps[P[i - 1]][1] - ps[P[i - 1]][0]
                # fim de frase/cena pede pausa de verdade; pausas longas são preferidas
                min_len = 0.25 if kb >= 5 else 0.2 if kb >= 3 else 0.15 if kb >= 2 else 0.0
                ok = abs(d) < 3.5 and plen >= min_len
                mc = d * d - 0.6 * kb * min(plen, 0.6) if ok else INF
                opts = [dp[j - 1, i] + kind[B[j - 1]], dp[j, i - 1] + 0.25, dp[j - 1, i - 1] + mc]
                k = int(np.argmin(opts))
                dp[j, i], bt[j, i] = opts[k], k
        out = {}
        j, i = m, q
        while j > 0 and i > 0:
            if bt[j, i] == 2:
                out[B[j - 1]] = ps[P[i - 1]][1]
                j, i = j - 1, i - 1
            elif bt[j, i] == 0:
                j -= 1
            else:
                i -= 1
        return out

    def dp_match(B, est, fixed):
        """casa as fronteiras B com as pausas, trecho a trecho entre as âncoras já fixadas"""
        out = dict(fixed)
        pts = [(-1, s0)] + sorted(fixed.items()) + [(n - 1, s1)]
        for (ka, ta), (kb, tb) in zip(pts[:-1], pts[1:]):
            Bs = [k for k in B if ka < k < kb and k not in fixed]
            P = [i for i, (pa, pb) in enumerate(ps) if pa > ta + 0.05 and pb < tb - 0.05]
            if Bs and P:
                out.update(plain_dp(Bs, est, P))
        return out

    def interpolate(anchors):
        pts = [(-1, s0)] + sorted(anchors.items()) + [(n - 1, s1)]
        e = list(est)
        for (ka, ta), (kb, tb) in zip(pts[:-1], pts[1:]):
            seg_w = w[ka + 1 : kb + 1].sum()
            acc = 0.0
            for k in range(ka + 1, kb):
                acc += w[k]
                e[k] = ta + (tb - ta) * acc / seg_w
            if kb < n - 1:
                e[kb] = tb
        return e

    # 1ª passada: só pontos finais e dois-pontos (âncoras fortes)
    strong = [k for k in range(n - 1) if kind[k] >= 3]
    if forced and len(forced) == len(strong):
        # início de cada frase conhecido (narração gerada frase a frase)
        fixed = dict(zip(strong, forced))
        anchors = dp_match([k for k in range(n - 1) if kind[k] >= 2], interpolate(fixed), fixed)
    else:
        if forced:
            print(f"   aviso: {len(forced)} marcas de frase para {len(strong)} frases; usando só as pausas")
        anchors = dp_match([k for k in range(n - 1) if kind[k] >= 2], est, {})
    # 2ª passada: vírgulas, com a estimativa corrigida pelas âncoras fortes
    est = interpolate(anchors)
    anchors = dp_match([k for k in range(n - 1) if kind[k] > 0], est, anchors)
    # descarta âncoras que deixariam uma legenda curta demais para o texto
    rate = (s1 - s0) / w.sum()
    changed = True
    while changed:
        changed = False
        pts = [(-1, s0)] + sorted(anchors.items()) + [(n - 1, s1)]
        for (ka, ta), (kb, tb) in zip(pts[:-1], pts[1:]):
            expect = w[ka + 1 : kb + 1].sum() * rate
            if tb - ta < 0.5 * expect:
                drop = min([x for x in (ka, kb) if x in anchors and not (forced and x in strong and len(forced) == len(strong))], key=lambda x: kind[x], default=None)
                if drop is not None:
                    del anchors[drop]
                    changed = True
                    break
    # monta as fronteiras: âncoras + distribuição proporcional entre elas
    pts = [(-1, s0)] + sorted(anchors.items()) + [(n - 1, s1)]
    starts = [s0] + [None] * (n - 1)
    for (ka, ta), (kb, tb) in zip(pts[:-1], pts[1:]):
        seg_w = w[ka + 1 : kb + 1]
        acc = 0.0
        for k in range(ka + 1, kb):
            acc += w[k]
            starts[k + 1] = ta + (tb - ta) * acc / seg_w.sum()
        if kb < n - 1:
            starts[kb + 1] = tb
    for k in range(1, n):
        starts[k] = max(starts[k], starts[k - 1] + 0.25)
    if verbose:
        for k, c in enumerate(captions):
            tag = "*" if (k - 1) in anchors else " "
            print(f"   {starts[k]:6.2f}{tag} {c['t']}")
    return starts


def find_file(i, sid):
    files = glob.glob(os.path.join(ROOT, "narracao", "*"))
    for f in sorted(files):
        name = os.path.basename(f).lower()
        if name.endswith(".json"):
            continue
        if re.match(rf"0*{i}[_\-. ]", name) or sid in name:
            return f
    return None


AUDIO_EXT = (".wav", ".mp3", ".m4a", ".aac", ".ogg", ".flac", ".opus", ".webm", ".mp4")


def audio_files():
    return sorted(f for f in glob.glob(os.path.join(ROOT, "narracao", "*")) if f.lower().endswith(AUDIO_EXT))


def split_full(path, tl, verbose=False):
    """narração inteira num arquivo só: alinha o roteiro todo e corta nas fronteiras entre cenas"""
    x = load(path)
    v = speech_mask(x)
    ps, s0, s1 = pauses(v)
    caps, owner = [], []
    for si, sc in enumerate(tl["scenes"]):
        for c in sc["captions"]:
            caps.append(c)
            owner.append(si)
    override = {k: 5.0 for k in range(len(caps) - 1) if owner[k] != owner[k + 1]}
    starts = align(caps, s0, s1, ps, verbose, kinds_override=override)
    segs = []
    for si in range(len(tl["scenes"])):
        idx = [k for k in range(len(caps)) if owner[k] == si]
        a = starts[idx[0]]
        if idx[-1] + 1 < len(caps):
            nxt = starts[idx[-1] + 1]
            pe = [p for p in ps if abs(p[1] - nxt) < 1e-6]
            b = pe[0][0] if pe else nxt - 0.05
            cut = nxt - 0.02
        else:
            b, cut = s1, len(x) / SR
        segs.append((a, b, cut, [starts[k] - a for k in idx], len(ps)))
    return x, segs


def main():
    tl = json.load(open(os.path.join(ROOT, "timeline.json")))
    breath = tl["breath"]
    t_scene = 0.0
    placed = []
    files = audio_files()
    full = None
    if len(files) == 1 and not re.match(r"\d", os.path.basename(files[0])):
        print(f"arquivo único: {os.path.basename(files[0])} (cortando nas fronteiras entre cenas)")
        full = split_full(files[0], tl, verbose="-v" in sys.argv)
    for i, sc in enumerate(tl["scenes"], 1):
        if full:
            x, segs = full
            a, b, cut, rel, npaus = segs[i - 1]
            lead = sc.get("lead", 0.15)
            old = sc["dur"]
            need = lead + (b - a) + breath
            sc["dur"] = round(max(old * 0.6, need), 2)
            for c, r in zip(sc["captions"], rel):
                c["start"] = round(lead + r, 3)
            ia = max(0, int((a - 0.04) * SR))
            ib = min(len(x), int(min(b + 0.12, cut) * SR))
            placed.append((t_scene + lead - (a - ia / SR), x[ia:ib]))
            print(f"[{sc['id']}] fala {b - a:.1f}s ({a:.2f}-{b:.2f} no arquivo), cena {old:g}s -> {sc['dur']:g}s")
            t_scene += sc["dur"]
            continue
        f = find_file(i, sc["id"])
        if not f:
            print(f"[{sc['id']}] sem narração (mantém os tempos do roteiro)")
            placed.append(None)
            t_scene += sc["dur"]
            continue
        x = load(f)
        v = speech_mask(x)
        ps, s0, s1 = pauses(v)
        lead = sc.get("lead", 0.15)
        speech = s1 - s0
        need = lead + speech + breath
        old = sc["dur"]
        # a cena acompanha a fala: estica quando falta tempo e encolhe quando sobra
        # (até 60% do tempo do roteiro, para não atropelar as animações)
        sc["dur"] = round(max(old * 0.6, need), 2)
        side = os.path.splitext(f)[0] + ".json"
        forced = json.load(open(side)).get("frases") if os.path.exists(side) else None
        starts = align(sc["captions"], s0, s1, ps, verbose="-v" in sys.argv, forced=forced)
        for c, st in zip(sc["captions"], starts):
            c["start"] = round(lead + (st - s0), 3)
        a = max(0, int((s0 - 0.04) * SR))
        b = min(len(x), int((s1 + 0.12) * SR))
        placed.append((t_scene + lead - (s0 - a / SR), x[a:b]))
        print(f"[{sc['id']}] fala {speech:.1f}s, cena {old:g}s -> {sc['dur']:g}s, {len(ps)} pausas")
        t_scene += sc["dur"]

    total = sum(s["dur"] for s in tl["scenes"])
    track = np.zeros(int((total + 0.5) * SR))
    for p in placed:
        if p is None:
            continue
        t0, y = p
        i = int(round(t0 * SR))
        if i < 0:
            y, i = y[-i:], 0
        y = y[: len(track) - i]
        track[i : i + len(y)] += y
    # normaliza a voz (~ -18 dBFS RMS na fala)
    vr = frames_rms(track)
    sp = vr[vr > np.max(vr) * 0.05]
    if len(sp):
        track *= 10 ** (-18 / 20) / np.sqrt(np.mean(sp**2))
    peak = np.max(np.abs(track))
    if peak > 0.89:
        track *= 0.89 / peak

    tl["_leia"] = "Gerado por audio/sync_narration.py a partir dos arquivos em narracao/. Edite timeline.json, não este."
    json.dump(tl, open(os.path.join(ROOT, "timeline.narrado.json"), "w"), ensure_ascii=False, indent=1)
    os.makedirs(os.path.join(ROOT, "out"), exist_ok=True)
    with wave.open(os.path.join(ROOT, "out", "narracao.wav"), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(track, -1, 1) * 32767).astype("<i2").tobytes())
    print(f"ok: timeline.narrado.json e out/narracao.wav (vídeo com {total:.1f}s)")


if __name__ == "__main__":
    if not audio_files():
        sys.exit("coloque a narração em narracao/ (um arquivo por cena, ou um arquivo único com tudo)")
    main()
