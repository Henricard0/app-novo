"""Sintetiza a trilha (marimba + baixo + chocalho) e os efeitos sonoros do vídeo.

Lê out/sfx_events.json (gerado por `node render.mjs --meta`) e grava:
  out/music.wav   trilha sozinha
  out/sfx.wav     efeitos sozinhos
  out/mix.wav     trilha + efeitos (o que vai no MP4)
Tudo é gerado aqui (sem samples externos). Rodar: python3 audio/make_audio.py
"""
import json
import os
import wave

import numpy as np

SR = 48000
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "out")
rng = np.random.default_rng(7)

MUSIC_RMS_DB = -30.0  # trilha baixa: a narração entra por cima
SFX_PEAK_DB = -8.0


def tt(d):
    return np.arange(int(d * SR)) / SR


def db(x):
    return 10 ** (x / 20)


def band(x, lo=None, hi=None):
    """filtro por FFT (passa-faixa ideal com bordas suaves)"""
    n = len(x)
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(n, 1 / SR)
    m = np.ones_like(f)
    if lo:
        m *= 1 / (1 + (lo / np.maximum(f, 1)) ** 4)
    if hi:
        m *= 1 / (1 + (f / hi) ** 4)
    return np.fft.irfft(X * m, n)


def env_ad(n, a=0.005, d=0.1):
    t = np.arange(n) / SR
    e = np.exp(-t / d)
    na = max(1, int(a * SR))
    e[:na] *= np.linspace(0, 1, na)
    return e


def norm(x, peak=1.0):
    m = np.max(np.abs(x)) or 1
    return x / m * peak


def noise(d):
    return rng.standard_normal(int(d * SR))


def grains(d, rate, lo, hi, gdur=0.004, shape=None):
    """chiado granular (papel amassando/rasgando)"""
    n = int(d * SR)
    y = np.zeros(n)
    count = int(d * rate)
    for _ in range(count):
        p = rng.random()
        if shape is not None and rng.random() > shape(p):
            continue
        i = int(p * (n - 1))
        gl = int(gdur * SR * (0.5 + rng.random()))
        g = rng.standard_normal(gl) * np.exp(-np.arange(gl) / (gl / 3)) * (0.3 + rng.random())
        j = min(n, i + gl)
        y[i:j] += g[: j - i]
    return band(y, lo, hi)


def sweep_tone(f0, f1, d, curve="exp"):
    t = tt(d)
    if curve == "exp":
        f = f0 * (f1 / f0) ** (t / d)
    else:
        f = f0 + (f1 - f0) * (t / d)
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


# ---------------------------------------------------------------- efeitos
def sfx_pop(pitch=1.0, big=False, small=False):
    d = 0.16 if big else 0.09
    f0, f1 = (620, 170) if big else ((1300, 520) if small else (950, 330))
    y = sweep_tone(f0 * pitch, f1 * pitch, d) * env_ad(int(d * SR), 0.002, d / 3.2)
    click = noise(0.01) * env_ad(int(0.01 * SR), 0.0005, 0.0015)
    y[: len(click)] += band(click, 2000, None) * 0.4
    if big:
        thump = np.sin(2 * np.pi * 90 * tt(0.2)) * env_ad(int(0.2 * SR), 0.002, 0.05)
        y = np.concatenate([y, np.zeros(len(thump) - len(y))]) + thump * 0.8
    return norm(y, 0.8 if small else 1.0)


def sfx_swoosh(d=0.42, lo=600, hi=4200):
    n = int(d * SR)
    t = np.arange(n) / SR
    base = noise(d)
    lowp = band(base, lo, lo * 3)
    highp = band(base, hi / 2, hi)
    k = t / d
    y = lowp * (1 - k) + highp * k
    e = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 1.6
    crinkle = 1 + 0.5 * band(noise(d), 20, 120) / (np.std(band(noise(d), 20, 120)) * 3)
    y = y * e * crinkle + grains(d, 900, 2500, 9000, 0.002) * e * 0.25
    return norm(y, 0.9)


def sfx_scratch():
    d = 0.5
    t = tt(d)
    # velocidade do "disco" indo e voltando
    spd = np.interp(t, [0, 0.08, 0.17, 0.27, 0.36, 0.5], [0.1, 1.8, -0.3, 1.5, -0.2, 0.0])
    f = 180 + 520 * np.abs(spd)
    tone = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * 0.35 + np.sin(2 * np.pi * np.cumsum(f * 2) / SR) * 0.3
    nz = noise(d)
    hiss = band(nz, 1200, 6000) * np.abs(spd)
    y = band(tone, 150, 3500) * np.abs(spd) + hiss * 0.8
    y *= env_ad(len(y), 0.004, 0.35)
    return norm(y, 1.0)


def sfx_marker():
    d = 0.34
    t = tt(d)
    y = band(noise(d), 2500, 7500)
    am = 0.6 + 0.4 * np.sin(2 * np.pi * 22 * t + rng.random() * 6) + 0.2 * band(noise(d), 5, 60) * 20
    squeak = np.sin(2 * np.pi * np.cumsum(1900 + 300 * np.sin(2 * np.pi * 7 * t)) / SR) * 0.15
    e = np.clip(np.minimum(t / 0.03, (d - t) / 0.06), 0, 1)
    return norm((y * np.clip(am, 0, 2) + squeak) * e, 0.55)


def sfx_boing():
    d = 0.55
    t = tt(d)
    f = 210 + 260 * (1 - np.exp(-t * 9)) + 70 * np.sin(2 * np.pi * 11 * t) * np.exp(-t * 5)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.3 * np.sin(2 * np.pi * np.cumsum(f * 2.01) / SR)
    return norm(y * env_ad(len(y), 0.004, 0.18), 0.8)


def sfx_rustle(d=0.5):
    t = tt(d)
    y = grains(d, 1600, 1200, 7000, 0.003)
    y *= np.sin(np.pi * t / d) ** 0.8
    return norm(y, 0.7)


def sfx_jingle():
    d = 0.7
    n = int(d * SR)
    y = np.zeros(n)
    for k in range(6):
        i = int((0.02 + rng.random() * 0.32) * SR)
        hd = 0.35
        ht = tt(hd)
        hit = np.zeros(len(ht))
        for f in [2900, 3700, 4900, 6300, 7700]:
            ff = f * (0.92 + rng.random() * 0.16)
            hit += np.sin(2 * np.pi * ff * ht + rng.random() * 6) * np.exp(-ht * (12 + rng.random() * 18)) * (0.4 + rng.random())
        hit *= 0.4 + rng.random() * 0.6
        j = min(n, i + len(hit))
        y[i:j] += hit[: j - i]
    thud = np.sin(2 * np.pi * 110 * tt(0.15)) * env_ad(int(0.15 * SR), 0.002, 0.04)
    y[: len(thud)] += thud * 0.6
    return norm(y, 0.75)


def sfx_fall():
    d = 0.6
    y = sweep_tone(1400, 500, d) * 0.25 + band(noise(d), 800, 3000) * 0.5
    t = tt(d)
    y *= np.sin(np.pi * t / d) ** 2
    return norm(y, 0.5)


def sfx_ding():
    d = 1.4
    t = tt(d)
    f = 1318.5
    y = np.sin(2 * np.pi * f * t) * np.exp(-t * 3) + 0.35 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 6) + 0.15 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t * 10)
    y *= env_ad(len(y), 0.002, 10)
    return norm(y, 0.6)


def sfx_flap():
    d = 0.3
    thump = np.sin(2 * np.pi * 85 * tt(d)) * env_ad(int(d * SR), 0.003, 0.06)
    flap = band(noise(d), 300, 2500) * env_ad(int(d * SR), 0.01, 0.05)
    creak = grains(0.25, 500, 600, 3000, 0.006)
    y = thump + flap * 0.6
    y[: len(creak)] += creak * 0.5
    return norm(y, 0.9)


def sfx_stretch():
    d = 0.5
    t = tt(d)
    y = grains(d, 1100, 900, 5000, 0.005, shape=lambda p: 0.3 + 0.7 * p)
    y *= np.minimum(1, t / 0.05) * np.minimum(1, (d - t) / 0.08)
    return norm(y, 0.55)


def sfx_tear():
    d = 0.55
    t = tt(d)
    y = grains(d, 5000, 1300, 9000, 0.002, shape=lambda p: 0.2 + 0.8 * p)
    y += band(noise(d), 2000, 7000) * 0.15 * (t / d)
    y *= np.minimum(1, (d - t) / 0.02)
    return norm(y, 1.0)


def sfx_drop():
    d = 0.3
    thump = np.sin(2 * np.pi * 120 * tt(d)) * env_ad(int(d * SR), 0.002, 0.05)
    slap = band(noise(d), 500, 5000) * env_ad(int(d * SR), 0.001, 0.025)
    return norm(thump + slap * 0.7, 0.9)


def sfx_flip():
    s = sfx_swoosh(0.2, 1500, 6000) * 0.7
    tick = band(noise(0.02), 2000, 8000) * env_ad(int(0.02 * SR), 0.0005, 0.004)
    y = np.concatenate([s, np.zeros(int(0.05 * SR))])
    i = int(0.17 * SR)
    y[i : i + len(tick)] += tick
    return norm(y, 0.8)


def sfx_thud():
    d = 0.35
    thump = np.sin(2 * np.pi * np.cumsum(np.linspace(150, 70, int(d * SR))) / SR) * env_ad(int(d * SR), 0.002, 0.07)
    click = band(noise(0.03), 1000, 6000) * env_ad(int(0.03 * SR), 0.0005, 0.006)
    thump[: len(click)] += click * 0.6
    return norm(thump, 1.0)


SFX = {
    "pop": lambda e: sfx_pop(e.get("pitch", 1.0)),
    "popSmall": lambda e: sfx_pop(e.get("pitch", 1.0), small=True),
    "popBig": lambda e: sfx_pop(e.get("pitch", 1.0), big=True),
    "swoosh": lambda e: sfx_swoosh(),
    "scratch": lambda e: sfx_scratch(),
    "marker": lambda e: sfx_marker(),
    "boing": lambda e: sfx_boing(),
    "rustle": lambda e: sfx_rustle(),
    "jingle": lambda e: sfx_jingle(),
    "fall": lambda e: sfx_fall(),
    "ding": lambda e: sfx_ding(),
    "flap": lambda e: sfx_flap(),
    "stretch": lambda e: sfx_stretch(),
    "tear": lambda e: sfx_tear(),
    "drop": lambda e: sfx_drop(),
    "flip": lambda e: sfx_flip(),
    "thud": lambda e: sfx_thud(),
}
SFX_GAIN = {"swoosh": 0.55, "rustle": 0.6, "marker": 0.8, "stretch": 0.7, "fall": 0.6, "popSmall": 0.8, "jingle": 0.8, "ding": 0.7, "scratch": 1.0}

# ---------------------------------------------------------------- trilha
BPM = 112
E8 = 60 / BPM / 2  # colcheia
BAR = E8 * 8


def midi(m):
    return 440 * 2 ** ((m - 69) / 12)


def marimba(f, vel=1.0, d=0.9):
    t = tt(d)
    y = np.sin(2 * np.pi * f * t) * np.exp(-t * 5.5)
    y += 0.28 * np.sin(2 * np.pi * f * 3.93 * t) * np.exp(-t * 28)
    y += 0.07 * np.sin(2 * np.pi * f * 9.2 * t) * np.exp(-t * 70)
    na = int(0.002 * SR)
    y[:na] *= np.linspace(0, 1, na)
    click = rng.standard_normal(int(0.006 * SR)) * np.exp(-np.arange(int(0.006 * SR)) / 40) * 0.05
    y[: len(click)] += click
    return y * vel


def glock(f, vel=1.0, d=1.4):
    t = tt(d)
    y = np.sin(2 * np.pi * f * t) * np.exp(-t * 2.5) + 0.3 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 7)
    na = int(0.001 * SR)
    y[:na] *= np.linspace(0, 1, na)
    return y * vel


def pluck_bass(f, vel=1.0, d=0.7):
    t = tt(d)
    y = (np.sin(2 * np.pi * f * t) + 0.45 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t * 4) + 0.15 * np.sin(2 * np.pi * 3 * f * t) * np.exp(-t * 8)) * np.exp(-t * 4.2)
    na = int(0.006 * SR)
    y[:na] *= np.linspace(0, 1, na)
    return y * vel


SHAKER = band(noise(0.09), 5000, 14000) * env_ad(int(0.09 * SR), 0.006, 0.025)
SNAP = band(noise(0.06), 1400, 4200) * env_ad(int(0.06 * SR), 0.001, 0.012) + np.sin(2 * np.pi * 1800 * tt(0.06)) * env_ad(int(0.06 * SR), 0.001, 0.008) * 0.3

# acordes: (baixo midi, notas da marimba midi)
CHORDS = [
    (48, [60, 64, 67, 72]),  # C
    (45, [57, 60, 64, 69]),  # Am
    (41, [57, 60, 65, 69]),  # F
    (43, [55, 59, 62, 67]),  # G
    (48, [60, 64, 67, 72]),  # C
    (40, [56, 59, 62, 64]),  # E7 (curioso)
    (45, [57, 60, 64, 69]),  # Am
    (43, [55, 59, 62, 65]),  # G7
]
PATTERN = [0, 2, 1, 3, 2, None, 3, 1]
MELODY = {0: 76, 3: 79, 8: 81, 11: 79, 16: 77, 20: 74, 24: 76, 27: 72}  # brilhinhos de glockenspiel (colcheias da frase)


def place(buf, y, t0, gain=1.0, pan=0.0):
    i = int(round(t0 * SR))
    if i >= buf.shape[0] or i + len(y) <= 0:
        return
    j = min(buf.shape[0], i + len(y))
    a = max(0, -i)
    l = np.cos((pan + 1) * np.pi / 4)
    r = np.sin((pan + 1) * np.pi / 4)
    buf[max(0, i) : j, 0] += y[a : j - i] * gain * l * 1.41
    buf[max(0, i) : j, 1] += y[a : j - i] * gain * r * 1.41


def music_section(dur, sparkle=True):
    buf = np.zeros((int((dur + 2) * SR), 2))
    nbars = int(np.ceil(dur / BAR)) + 1
    for b in range(nbars):
        bass, notes = CHORDS[b % len(CHORDS)]
        t0 = b * BAR
        place(buf, pluck_bass(midi(bass), 0.9), t0, 0.36)
        place(buf, pluck_bass(midi(bass + 7), 0.7), t0 + 4 * E8, 0.32)
        if b % 2 == 1:
            place(buf, pluck_bass(midi(bass + 12), 0.5), t0 + 7 * E8, 0.3)
        for k, idx in enumerate(PATTERN):
            if idx is None:
                continue
            vel = 1.0 if k in (0, 4) else 0.72
            place(buf, marimba(midi(notes[idx]), vel), t0 + k * E8 + (0.008 if k % 2 else 0), 0.32, pan=-0.25)
        for k in range(8):
            place(buf, SHAKER * (1.0 if k % 2 else 0.55), t0 + k * E8 + 0.01, 0.05, pan=0.35)
        place(buf, SNAP, t0 + 2 * E8, 0.07, pan=0.15)
        place(buf, SNAP, t0 + 6 * E8, 0.07, pan=0.15)
        if sparkle:
            for k in range(8):
                step = (b % 4) * 8 + k
                if step in MELODY and b % 8 >= 4:
                    place(buf, glock(midi(MELODY[step] + 12), 0.5), t0 + k * E8, 0.09, pan=0.3)
    return buf[: int(dur * SR)]


def reverb(buf, dec=1.1, wet=0.16):
    n = int(dec * SR)
    t = np.arange(n) / SR
    out = np.zeros_like(buf)
    for ch in range(2):
        ir = rng.standard_normal(n) * np.exp(-t * 5.5 / dec)
        ir = band(ir, 300, 7000)
        ir /= np.sqrt(np.sum(ir**2))
        L = len(buf) + n
        nfft = 1 << (L - 1).bit_length()
        wetsig = np.fft.irfft(np.fft.rfft(buf[:, ch], nfft) * np.fft.rfft(ir, nfft), nfft)[: len(buf)]
        out[:, ch] = buf[:, ch] + wetsig * wet
    return out


def fade(buf, t0, t1, a, b):
    i0, i1 = int(t0 * SR), int(t1 * SR)
    i1 = min(i1, len(buf))
    if i1 > i0:
        buf[i0:i1] *= np.linspace(a, b, i1 - i0)[:, None]


def build_music(meta):
    total = meta["total"]
    ev = meta["events"]
    buf = np.zeros((int(total * SR), 2))
    starts = [e["t"] for e in ev if e["name"] == "music_start"]
    stops = [e["t"] for e in ev if e["name"] == "music_stop"]
    ends = [e["t"] for e in ev if e["name"] == "music_end"]
    end_t = ends[0] if ends else total - 1
    # trechos: start -> próximo stop (ou fim)
    for s in starts:
        nxt = [x for x in stops + [end_t] if x > s]
        e = min(nxt) if nxt else total
        sec = music_section(e - s + 0.05)
        sec[-int(0.04 * SR):] *= np.linspace(1, 0, int(0.04 * SR))[:, None]
        if s > 0:
            sec[: int(0.08 * SR)] *= np.linspace(0, 1, int(0.08 * SR))[:, None]
        place_st(buf, sec, s)
    # final: arpejo + acorde
    fin = np.zeros((int(2.5 * SR), 2))
    for k, m in enumerate([72, 76, 79, 84]):
        place(fin, marimba(midi(m), 0.9, 1.4), k * E8 / 2, 0.34, pan=-0.2)
    place(fin, pluck_bass(midi(36), 1.0, 1.5), 0, 0.6)
    place(fin, pluck_bass(midi(48), 0.7, 1.5), 0, 0.3)
    place(fin, glock(midi(96), 0.6, 2.0), 2 * E8, 0.12, pan=0.3)
    place_st(buf, fin, end_t)
    buf = reverb(buf)
    for ch in range(2):
        buf[:, ch] = band(buf[:, ch], 45, None)
    fade(buf, total - 0.6, total, 1, 0)
    rms = np.sqrt(np.mean(buf[buf != 0] ** 2)) if np.any(buf) else 1
    return buf / rms * db(MUSIC_RMS_DB)


def place_st(buf, y, t0):
    i = int(round(t0 * SR))
    j = min(len(buf), i + len(y))
    if j > i:
        buf[i:j] += y[: j - i]


def build_sfx(meta):
    total = meta["total"]
    buf = np.zeros((int(total * SR), 2))
    for e in meta["events"]:
        name = e["name"]
        if name.startswith("music"):
            continue
        if name not in SFX:
            print("efeito desconhecido:", name)
            continue
        y = SFX[name](e) * SFX_GAIN.get(name, 1.0) * e.get("gain", 1.0)
        place(buf, y, e["t"], 1.0, pan=0.0)
    peak = np.max(np.abs(buf)) or 1
    return buf / peak * db(SFX_PEAK_DB)


def write_wav(path, buf):
    buf = np.clip(buf, -1, 1)
    data = (buf * 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())


def main():
    meta = json.load(open(os.path.join(OUT, "sfx_events.json")))
    music = build_music(meta)
    sfx = build_sfx(meta)
    mix = music + sfx
    peak = np.max(np.abs(mix))
    if peak > 0.95:
        mix *= 0.95 / peak
    write_wav(os.path.join(OUT, "music.wav"), music)
    write_wav(os.path.join(OUT, "sfx.wav"), sfx)
    write_wav(os.path.join(OUT, "mix.wav"), mix)
    print("ok: music.wav, sfx.wav, mix.wav  (pico da mixagem %.2f)" % min(peak, 0.95))


if __name__ == "__main__":
    main()
