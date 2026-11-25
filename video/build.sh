#!/usr/bin/env bash
# Gera tudo do zero: textura, eventos de som, áudio, vídeo com e sem legenda, SRT e capa.
#   ./build.sh            -> vídeo completo (≈10 min)
#   ./build.sh --rapido   -> só a versão com legenda
#   ./build.sh --narracao -> versão narrada, a partir dos áudios em narracao/ (um por cena)
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p out

if [ "${1:-}" = "--narracao" ]; then
  python3 audio/sync_narration.py
  node render.mjs --meta --timeline timeline.narrado.json
  python3 audio/make_audio.py --narracao out/narracao.wav
  node render.mjs --video out/base_narrado.mp4 --timeline timeline.narrado.json
  ffmpeg -hide_banner -loglevel error -y -i out/base_narrado.mp4 -i out/mix_narrado.wav \
    -c:v copy -c:a aac -b:a 192k -ar 48000 -shortest -movflags +faststart out/ato-falho_reels_narrado.mp4
  rm -f out/base_narrado.mp4
  echo "pronto: out/ato-falho_reels_narrado.mp4"
  exit 0
fi

[ -f assets/paper_grain.png ] || python3 assets/make_texture.py
node render.mjs --meta
python3 audio/make_audio.py

node render.mjs --video out/base_legendas.mp4
ffmpeg -hide_banner -loglevel error -y -i out/base_legendas.mp4 -i out/mix.wav \
  -c:v copy -c:a aac -b:a 192k -ar 48000 -shortest -movflags +faststart out/ato-falho_reels.mp4

if [ "${1:-}" != "--rapido" ]; then
  node render.mjs --video out/base_sem_legenda.mp4 --no-captions
  ffmpeg -hide_banner -loglevel error -y -i out/base_sem_legenda.mp4 -i out/mix.wav \
    -c:v copy -c:a aac -b:a 192k -ar 48000 -shortest -movflags +faststart out/ato-falho_reels_sem-legenda.mp4
fi

# capa (quadro com o balão e os círculos)
ffmpeg -hide_banner -loglevel error -y -ss 2.2 -i out/ato-falho_reels.mp4 -frames:v 1 out/capa.png
rm -f out/base_*.mp4
echo "pronto: out/ato-falho_reels.mp4"
