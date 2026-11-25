"""Gera a textura de papel usada por cima de todo o vídeo (blend multiply).

Saída: assets/paper_grain.png (1200x2040, quase branco com fibras e pintinhas).
Rodar: python3 assets/make_texture.py
"""
import os
import numpy as np
from PIL import Image, ImageFilter

W, H = 1200, 2040
rng = np.random.default_rng(42)


def blur(arr, radius):
    img = Image.fromarray(np.clip(arr * 255, 0, 255).astype(np.uint8))
    img = img.filter(ImageFilter.GaussianBlur(radius))
    return np.asarray(img).astype(np.float32) / 255.0


# grão fino
fine = rng.random((H, W)).astype(np.float32)
fine = blur(fine, 0.6)

# manchas suaves (variação de tom do papel)
coarse = rng.random((H // 16, W // 16)).astype(np.float32)
coarse = np.asarray(
    Image.fromarray((coarse * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC)
).astype(np.float32) / 255.0
coarse = blur(coarse, 18)

# fibras: traços curtos e finos em direções aleatórias
fib = Image.new("L", (W, H), 0)
from PIL import ImageDraw

d = ImageDraw.Draw(fib)
for _ in range(5200):
    x, y = rng.random() * W, rng.random() * H
    ang = rng.random() * np.pi
    ln = 6 + rng.random() * 22
    x2, y2 = x + np.cos(ang) * ln, y + np.sin(ang) * ln
    d.line([(x, y), (x2, y2)], fill=int(60 + rng.random() * 90), width=1)
fib = np.asarray(fib.filter(ImageFilter.GaussianBlur(0.7))).astype(np.float32) / 255.0

# pintinhas escuras raras
specks = (rng.random((H, W)) > 0.9993).astype(np.float32)
specks = blur(specks, 0.8) * 3

val = (
    1.0
    - (fine - 0.5) * 0.10
    - (coarse - 0.5) * 0.10
    - fib * 0.10
    - np.clip(specks, 0, 1) * 0.25
)
val = np.clip(val, 0, 1)
# leve tom quente
rgb = np.stack([val, val * 0.992, val * 0.975], axis=-1)
out = os.path.join(os.path.dirname(__file__), "paper_grain.png")
Image.fromarray((rgb * 255).astype(np.uint8)).save(out, optimize=True)
print("ok", out)
