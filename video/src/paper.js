// Utilidades do estilo "papel recortado": bordas irregulares, espessura de papelão,
// rótulos, easing e helpers de animação. Tudo é determinístico (mesmo t = mesmo quadro).

const SVGNS = 'http://www.w3.org/2000/svg';

// ---------- aleatório determinístico ----------
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// ---------- cores ----------
function hexToRgb(h) {
  h = h.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}
// amt < 0 escurece, amt > 0 clareia
function shade(hex, amt) {
  const [r, g, b] = hexToRgb(hex);
  if (amt < 0) return rgbToHex(r * (1 + amt), g * (1 + amt), b * (1 + amt));
  return rgbToHex(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt);
}
function mix(a, b, k) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex(A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k, A[2] + (B[2] - A[2]) * k);
}

// ---------- paleta ----------
const C = {
  ink: '#2A2F45',
  cream: '#FFF8EC',
  paper: '#FFFDF7',
  coral: '#F26B5B',
  salmon: '#FF9F8A',
  peach: '#FFD3BF',
  butter: '#FFE7A8',
  mustard: '#F5B83D',
  mint: '#BFE8D4',
  teal: '#2FB3A3',
  sky: '#BFE2F5',
  blue: '#5A8DEE',
  navy: '#34477A',
  lilac: '#D8C9F2',
  purple: '#8D6BD8',
  pink: '#F7A8C4',
  leaf: '#6CC48A',
  kraft: '#C99A62',
  brown: '#7A5236',
  grey: '#BFC3CC',
};

// ---------- formas (strings "d") ----------
function E(cx, cy, rx, ry = rx) {
  return `M${cx - rx} ${cy}A${rx} ${ry} 0 1 0 ${cx + rx} ${cy}A${rx} ${ry} 0 1 0 ${cx - rx} ${cy}Z`;
}
function R(x, y, w, h, r = 0) {
  r = Math.min(r, w / 2, h / 2);
  if (!r) return `M${x} ${y}H${x + w}V${y + h}H${x}Z`;
  return `M${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h - r}Q${x + w} ${y + h} ${x + w - r} ${y + h}H${x + r}Q${x} ${y + h} ${x} ${y + h - r}V${y + r}Q${x} ${y} ${x + r} ${y}Z`;
}
function P(pts) {
  return 'M' + pts.map((p) => p[0] + ' ' + p[1]).join('L') + 'Z';
}
// cápsula de (x1,y1) a (x2,y2) com espessura w
function CAP(x1, y1, x2, y2, w) {
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1;
  const nx = (-dy / L) * (w / 2), ny = (dx / L) * (w / 2);
  const r = w / 2;
  return `M${x1 + nx} ${y1 + ny}L${x2 + nx} ${y2 + ny}A${r} ${r} 0 0 0 ${x2 - nx} ${y2 - ny}L${x1 - nx} ${y1 - ny}A${r} ${r} 0 0 0 ${x1 + nx} ${y1 + ny}Z`;
}

// ---------- borda irregular ----------
let _measure = null;
function measurePath() {
  if (_measure) return _measure;
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('width', '0'); svg.setAttribute('height', '0');
  svg.style.position = 'absolute'; svg.style.left = '-9999px';
  _measure = document.createElementNS(SVGNS, 'path');
  svg.appendChild(_measure);
  document.body.appendChild(svg);
  return _measure;
}
const _roughCache = new Map();
// Converte qualquer caminho fechado (um subcaminho só) num polígono com bordas de tesoura.
function rough(d, seed = 1, amp = 1.6, step = 12) {
  const key = d + '|' + seed + '|' + amp + '|' + step;
  const hit = _roughCache.get(key);
  if (hit) return hit;
  const m = measurePath();
  m.setAttribute('d', d);
  const L = m.getTotalLength();
  const st = Math.max(2.5, Math.min(step, L / 14));
  const n = Math.max(10, Math.round(L / st));
  const rnd = mulberry32((seed * 9973 + 7) | 0);
  const k1 = 2 + Math.floor(rnd() * 3), k2 = 5 + Math.floor(rnd() * 5);
  const p1 = rnd() * 6.283, p2 = rnd() * 6.283;
  const a = Math.min(amp, L / 60 + 0.4);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const s = (i / n) * L;
    const p = m.getPointAtLength(s);
    const q = m.getPointAtLength(Math.min(L, s + 0.6));
    let tx = q.x - p.x, ty = q.y - p.y;
    const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
    const u = (i / n) * Math.PI * 2;
    const off = a * (0.55 * Math.sin(k1 * u + p1) + 0.35 * Math.sin(k2 * u + p2)) + a * 0.7 * (rnd() - 0.5);
    pts.push((p.x - ty * off).toFixed(1) + ' ' + (p.y + tx * off).toFixed(1));
  }
  const out = 'M' + pts.join('L') + 'Z';
  _roughCache.set(key, out);
  return out;
}

// ---------- peça de papel ----------
// d: caminho fechado. o: { fill, seed, amp, depth, edge, rim, stroke, sw, attr, inner }
function piece(d, o = {}) {
  const fill = o.fill || C.paper;
  const seed = o.seed != null ? o.seed : hashStr(d);
  const rd = o.raw ? d : rough(d, seed, o.amp != null ? o.amp : 1.6, o.step || 12);
  const depth = o.depth != null ? o.depth : 3.5;
  const edge = o.edge || shade(fill, -0.28);
  let s = `<g${o.attr ? ' ' + o.attr : ''}>`;
  if (depth) s += `<path d="${rd}" fill="${edge}" transform="translate(0 ${depth})"/>`;
  s += `<path d="${rd}" fill="${fill}"${o.stroke ? ` stroke="${o.stroke}" stroke-width="${o.sw || 3}" stroke-linejoin="round"` : ''}/>`;
  if (o.inner) s += o.inner;
  if (o.rim !== false) s += `<path d="${rd}" fill="none" stroke="#fff" stroke-opacity="${o.rimOp || 0.38}" stroke-width="${o.rimW || 2}"/>`;
  s += '</g>';
  return s;
}

// traço (linha aberta) desenhado com caneta, para bocas, sobrancelhas etc.
function line(d, color = C.ink, w = 5, extra = '') {
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
}

// ---------- texto ----------
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function text(x, y, str, o = {}) {
  const size = o.size || 40;
  const fam = o.font === 'hand' ? "'Patrick Hand'" : "'Fredoka'";
  const w = o.weight || (o.font === 'hand' ? 400 : 600);
  const anchor = o.anchor || 'middle';
  const ls = o.ls != null ? ` letter-spacing="${o.ls}"` : '';
  const tr = o.rot ? ` transform="rotate(${o.rot} ${x} ${y})"` : '';
  const stroke = o.stroke ? ` stroke="${o.stroke}" stroke-width="${o.sw || 6}" paint-order="stroke" stroke-linejoin="round"` : '';
  return `<text x="${x}" y="${y}" font-family="${fam}" font-weight="${w}" font-size="${size}" fill="${o.fill || C.ink}" text-anchor="${anchor}" dominant-baseline="central"${ls}${tr}${stroke}${o.op != null ? ` opacity="${o.op}"` : ''}>${esc(str)}</text>`;
}

// etiqueta de papel com texto centralizado
function tag(cx, cy, w, h, str, o = {}) {
  const body = piece(R(cx - w / 2, cy - h / 2, w, h, o.r != null ? o.r : 10), {
    fill: o.fill || C.paper, seed: o.seed, depth: o.depth != null ? o.depth : 4, amp: o.amp,
  });
  const t = text(cx, cy + (o.dy || 0), str, { size: o.size || h * 0.5, fill: o.color || C.ink, weight: o.weight, font: o.font, ls: o.ls });
  return g(o.rot ? `rotate(${o.rot} ${cx} ${cy})` : '', body + t);
}

// ---------- grupos e transformações ----------
function g(transform, inner, attr = '') {
  if (!transform && !attr) return inner;
  return `<g${transform ? ` transform="${transform}"` : ''}${attr ? ' ' + attr : ''}>${inner}</g>`;
}
function shadow(inner, strong = false) {
  return `<g filter="url(#${strong ? 'shadowL' : 'shadow'})">${inner}</g>`;
}
// escala em torno de um ponto
function scaleAt(s, x, y, sy = s) {
  return `translate(${x} ${y}) scale(${s} ${sy}) translate(${-x} ${-y})`;
}
function rotAt(a, x, y) {
  return `rotate(${a} ${x} ${y})`;
}

// ---------- tempo e easing ----------
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
function prog(t, a, b) { return b === a ? (t >= a ? 1 : 0) : clamp((t - a) / (b - a)); }
const ease = {
  linear: (x) => x,
  inOut: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  out: (x) => 1 - Math.pow(1 - x, 3),
  in: (x) => x * x * x,
  outBack: (x) => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
  outElastic: (x) => (x === 0 ? 0 : x === 1 ? 1 : Math.pow(2, -9 * x) * Math.sin((x * 10 - 0.75) * ((2 * Math.PI) / 3.2)) + 1),
  outBounce: (x) => {
    const n1 = 7.5625, d1 = 2.75;
    if (x < 1 / d1) return n1 * x * x;
    if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
    if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
    return n1 * (x -= 2.625 / d1) * x + 0.984375;
  },
};
// valor animado de a até b entre t0 e t1
function tween(t, t0, t1, a, b, fn = ease.inOut) { return a + (b - a) * fn(prog(t, t0, t1)); }
// escala de "pop" (0 -> 1 com exagero)
function popS(t, t0, dur = 0.35) { return t < t0 ? 0 : ease.outBack(prog(t, t0, t0 + dur)); }
// balanço suave
function sway(t, amp = 2, speed = 1, phase = 0) { return amp * Math.sin(t * speed * Math.PI * 2 + phase); }
// "boil" do stop-motion: muda a cada 3 quadros (10 vezes por segundo)
function boil(t, amp = 0.6, seed = 1) {
  const step = Math.floor(t * 10);
  const r = mulberry32(step * 131 + seed * 17);
  return [(r() - 0.5) * 2 * amp, (r() - 0.5) * 2 * amp];
}
// cria um elemento que aparece com pop centrado em (x,y)
function popIn(t, t0, x, y, inner, dur = 0.35) {
  const s = popS(t, t0, dur);
  if (s <= 0.001) return '';
  return g(scaleAt(s, x, y), inner);
}

// mede a largura de um texto (fonte já carregada)
let _mctx = null;
function measure(str, size, weight = 600, fam = 'Fredoka') {
  if (!_mctx) _mctx = document.createElement('canvas').getContext('2d');
  _mctx.font = `${weight} ${size}px ${fam}`;
  return _mctx.measureText(str).width;
}
