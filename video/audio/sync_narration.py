"""Sincroniza o vídeo com a narração gravada (ou gerada).

Coloque um arquivo de áudio por cena em `narracao/`, com o número ou o id da cena no nome:
  narracao/1_gancho.m4a, narracao/2_apresentacao.wav, ... (qualquer formato que o ffmpeg leia)

O script:
  - corta o silêncio do começo e do fim de cada arquivo;
  - acha as pausas da fala e encaixa cada legenda no trecho certo;
  - estica a cena quando a fala é mais longa que o tempo do roteiro;
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


def pauses(v, min_len=0.16):
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


def align(captions, s0, s1, ps):
    """devolve o início (s, relativo ao arquivo) de cada legenda"""
    w = np.array([weight(c["t"]) for c in captions], dtype=float)
    # tempo "falado" (sem pausas) acumulado
    total_pause = sum(b - a for a, b in ps)
    voiced = (s1 - s0) - total_pause

    def voiced_to_real(v):
        t = s0
        acc = 0.0
        for a, b in ps:
            seg = a - t
            if acc + seg >= v:
                return t + (v - acc)
            acc += seg
            t = b
        return t + (v - acc)

    starts = [s0]
    used = set()
    cum = np.cumsum(w)[:-1] / w.sum()
    for k, f in enumerate(cum):
        est = voiced_to_real(f * voiced)
        best = None
        if re.search(r"[,.:;?!]\s*\**\s*$", captions[k]["t"]):
            for idx, (a, b) in enumerate(ps):
                if idx in used:
                    continue
                if abs((a + b) / 2 - est) < 0.7 and (best is None or abs((a + b) / 2 - est) < abs(sum(ps[best]) / 2 - est)):
                    best = idx
        if best is not None:
            used.add(best)
            st = ps[best][1]
        else:
            st = est
        starts.append(max(st, starts[-1] + 0.25))
    return starts


def find_file(i, sid):
    files = glob.glob(os.path.join(ROOT, "narracao", "*"))
    for f in sorted(files):
        name = os.path.basename(f).lower()
        if re.match(rf"0*{i}[_\-. ]", name) or sid in name:
            return f
    return None


def main():
    tl = json.load(open(os.path.join(ROOT, "timeline.json")))
    breath = tl["breath"]
    t_scene = 0.0
    placed = []
    for i, sc in enumerate(tl["scenes"], 1):
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
        sc["dur"] = round(max(old, need), 2)
        starts = align(sc["captions"], s0, s1, ps)
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
    if not glob.glob(os.path.join(ROOT, "narracao", "*")):
        sys.exit("coloque os áudios da narração em narracao/ (um por cena)")
    main()
