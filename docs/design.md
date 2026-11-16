# Design — Tríade

Visual calmo e claro. **Verde-pinho** = ações principais e consultório. **Âmbar** = tudo que é supervisão. As telas em `docs/referencia-telas/` mostram como isso se aplica.

## Cores

| Token | Hex | Uso |
|---|---|---|
| `bg` | `#F4F5F2` | Fundo da página, fundos de itens dentro de cards |
| `surface` | `#FFFFFF` | Cards, menu lateral |
| `border` | `#E2E5E0` | Bordas de cards e do menu |
| `border-soft` | `#EEF0ED` | Divisórias de lista e de tabela |
| `input-border` | `#C9CFC9` | Bordas de campos |
| `ink` | `#18211D` | Texto principal |
| `ink-2` | `#3D4641` | Texto secundário, itens de menu |
| `muted` | `#5A635E` | Rótulos, datas, ajuda |
| `pine` | `#1E5A48` | Botão principal, links, item ativo |
| `pine-dark` | `#143D31` | Hover de links |
| `pine-soft` | `#E6F0EC` | Fundo de item ativo e chip "ok" |
| `ocre` | `#9A5512` | Bordas e destaques de supervisão |
| `ocre-text` | `#8A4B0F` | Texto em âmbar (contraste AA) |
| `ocre-soft` | `#FBEFE1` | Fundo de chips e cards de supervisão |
| `chip-neutral` | `#EEF0ED` / texto `#47504B` | Chips neutros |

Todas as combinações de texto acima passam contraste AA.

## Tipografia (Google Fonts)

- **Manrope** 600–800: títulos (`h1` 30px/700, `h2` 17–20px/700, números grandes 24–44px/800).
- **Inter** 400–600: todo o resto (texto 15px, apoio 13–14px, chips 12px/600).

## Forma e espaço

- Grade de 4px. Padding de card 24px; espaço entre cards 24px; entre itens de lista 8–10px.
- Raio: 10px (botões, campos, itens), 12–14px (cards), 999px (chips).
- Alvos de toque de no mínimo 44px (botões, itens de menu, linhas de checkbox).
- Sem sombras pesadas nem gradientes; separação por borda de 1px.

## Componentes

- **Menu lateral:** logo, rótulo da seção em caixa alta pequena, itens com 44px de altura; item ativo com fundo `pine-soft` (no menu do supervisor, `ocre-soft`). No plano grátis, a seção "Seu consultório" mostra itens bloqueados (ícone de cadeado) e um card de convite para o plano Essencial. No celular, o menu vai para o topo.
- **Card:** `surface`, borda `border`, raio 14px. Card de supervisão no início leva borda superior de 4px `ocre`.
- **Chip de status:** ok (`pine-soft`/`pine`), atenção (`ocre-soft`/`ocre-text`), neutro (`chip-neutral`).
- **Botões:** primário (fundo `pine`, texto branco); secundário (branco, borda `#D5DAD5`); de supervisão (branco, borda `ocre`, texto `ocre-text`).
- **Tabela:** cabeçalho em caixa alta 12px `muted`; linhas com divisória `border-soft`; dentro de um contêiner com rolagem horizontal no celular.
- **Comparação lado a lado** (levar caso): trechos removidos marcados com fundo `ocre-soft` no original e as trocas com fundo `pine-soft` na versão do supervisor.

## Tailwind

```js
// tailwind.config.js (trecho)
theme: {
  extend: {
    colors: {
      bg: '#F4F5F2', surface: '#FFFFFF', border: '#E2E5E0', 'border-soft': '#EEF0ED',
      ink: { DEFAULT: '#18211D', 2: '#3D4641' }, muted: '#5A635E',
      pine: { DEFAULT: '#1E5A48', dark: '#143D31', soft: '#E6F0EC' },
      ocre: { DEFAULT: '#9A5512', text: '#8A4B0F', soft: '#FBEFE1' },
    },
    fontFamily: {
      display: ['Manrope', 'Inter', 'sans-serif'],
      sans: ['Inter', 'system-ui', 'sans-serif'],
    },
  },
}
```
