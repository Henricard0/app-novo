"""Narração de TESTE com voz sintética (Piper, pt-BR), só para conferir ritmo e sincronia.

Gera narracao/<n>_<cena>.wav (uma por cena) e, ao lado, um .json com o início de cada frase,
que o sync_narration.py usa como âncora exata das legendas.

Uso: python3 audio/tts_piper.py <pasta-do-modelo> [velocidade]
  <pasta-do-modelo> contém pt-br-edresson-low.onnx e .onnx.json
  (https://github.com/rhasspy/piper/releases/download/v0.0.2/voice-pt-br-edresson-low.tar.gz)
  velocidade: length_scale do Piper (padrão 0.85; menor = mais rápido)
"""
import json
import os
import sys
import wave

import numpy as np
from piper import PiperVoice, SynthesisConfig

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GAP = 0.3  # pausa entre frases (s)


def trim(x, sr, thr=0.02):
    idx = np.where(np.abs(x) > thr)[0]
    if not len(idx):
        return x
    a = max(0, idx[0] - int(0.03 * sr))
    b = min(len(x), idx[-1] + int(0.06 * sr))
    return x[a:b]


def main():
    mdir = sys.argv[1]
    speed = float(sys.argv[2]) if len(sys.argv) > 2 else 0.85
    voice = PiperVoice.load(os.path.join(mdir, "pt-br-edresson-low.onnx"), config_path=os.path.join(mdir, "pt-br-edresson-low.onnx.json"))
    cfg = SynthesisConfig(length_scale=speed)
    tl = json.load(open(os.path.join(ROOT, "timeline.json")))
    os.makedirs(os.path.join(ROOT, "narracao"), exist_ok=True)
    for n, sc in enumerate(tl["scenes"], 1):
        # frases = sequências de legendas até um ponto final / interrogação / exclamação
        sentences, cur = [], []
        for c in sc["captions"]:
            cur.append(c["t"].replace("*", ""))
            if cur[-1].strip()[-1:] in ".?!":
                sentences.append(" ".join(cur))
                cur = []
        if cur:
            sentences.append(" ".join(cur))
        parts, starts, t, sr = [], [], 0.0, None
        for i, s in enumerate(sentences):
            audio = np.concatenate([ch.audio_float_array for ch in voice.synthesize(s, syn_config=cfg)])
            sr = voice.config.sample_rate
            audio = trim(audio, sr)
            if i:
                parts.append(np.zeros(int(GAP * sr)))
                t += GAP
                starts.append(round(t, 3))
            parts.append(audio)
            t += len(audio) / sr
        x = np.concatenate(parts)
        base = os.path.join(ROOT, "narracao", f"{n}_{sc['id']}")
        with wave.open(base + ".wav", "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(sr)
            w.writeframes((np.clip(x, -1, 1) * 32767).astype("<i2").tobytes())
        json.dump({"frases": starts}, open(base + ".json", "w"))
        print(f"{base}.wav: {len(x) / sr:.1f}s, {len(sentences)} frases")


if __name__ == "__main__":
    main()
