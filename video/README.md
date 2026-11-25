# Ato falho — Reels em papel recortado

Vídeo vertical 1080×1920, 30 fps, 60 s, feito a partir do roteiro
"Ato falho: quando a palavra errada diz a verdade". Tudo é gerado por código:
as cenas são SVG animado (estilo papel recortado), renderizadas quadro a quadro no
Chromium e codificadas com ffmpeg. A trilha e os efeitos são sintetizados em Python
(sem samples externos).

## Gerar

```bash
./build.sh            # tudo (~10 min): vídeo com e sem legenda, áudio, SRT e capa
./build.sh --rapido   # só a versão com legenda (~5 min)
```

Requisitos: Node 18+, Playwright com Chromium, Python 3 com numpy e Pillow, ffmpeg.

Saídas em `out/`:

| arquivo | o que é |
|---|---|
| `ato-falho_reels.mp4` | vídeo final com legendas, trilha e efeitos |
| `ato-falho_reels_sem-legenda.mp4` | mesmo vídeo sem legendas (para legendar no editor depois da narração) |
| `legendas.srt` | legendas com os tempos atuais |
| `music.wav`, `sfx.wav` | trilha e efeitos separados, para mixar com a narração |
| `capa.png` | quadro para capa do Reels |

## Ajustar à narração gravada

Todos os tempos ficam em `timeline.json`:

- `dur` de cada cena: mude e tudo dentro dela (animações, legendas, efeitos) se reorganiza.
- Cada legenda aceita `"start"` (segundos desde o início da cena) para sincronizar com a fala.
  Sem `start`, o tempo é distribuído pelo tamanho do texto.
- As animações estão presas às legendas com `id` (ex.: o rasgo da tira acontece na legenda
  `ganha`), então acertar as legendas já acerta a animação.
- `*palavra*` destaca a palavra em coral na legenda.

Depois de editar, rode `./build.sh` de novo.

### Sincronização automática com a narração

1. Grave um áudio por cena e coloque em `narracao/`, com o número da cena no nome
   (`1_gancho.m4a`, `2_apresentacao.m4a`, …, `6_cta.m4a`). Qualquer formato que o ffmpeg leia.
2. Rode `./build.sh --narracao`.

Para um teste sem gravação, `audio/tts_piper.py` gera a narração com uma voz sintética
(Piper, pt-BR) frase a frase e grava, ao lado de cada áudio, um `.json` com o início de cada
frase. Quando esse arquivo existe, as frases viram âncoras exatas das legendas.

O script corta os silêncios, encaixa cada legenda nas pausas da fala, estica a cena quando a
fala passa do tempo do roteiro e abaixa a trilha (cerca de 8 dB) onde há voz. Sai
`out/ato-falho_reels_narrado.mp4` e `out/legendas_narrado.srt`. O `timeline.json` original
não é alterado: os tempos ajustados vão para `timeline.narrado.json`.

Para ver um instante sem renderizar o vídeo: `node render.mjs --stills 12.5,40` (PNGs em
`out/stills/`) ou abra `index.html?t=12.5` no navegador.

## Estrutura

- `src/paper.js`: bordas de tesoura, espessura de papelão, etiquetas, easing
- `src/chars.js`: marionetes (casal, Freud, bonequinhos)
- `src/props.js`: objetos (sofá, balões, calendário, chaves, livro…)
- `src/scenes.js`: as 6 cenas, transições e eventos de som
- `src/main.js`: linha do tempo, legendas e composição do quadro
- `audio/make_audio.py`: trilha (marimba, baixo, chocalho) e efeitos
- `audio/sync_narration.py`: encaixa cenas e legendas na narração e abaixa a trilha sob a voz
- `audio/tts_piper.py`: narração de teste com voz sintética
- `fonts/`: Fredoka e Patrick Hand (Google Fonts, licença SIL Open Font License)
