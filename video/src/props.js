// Objetos e cenários de papel.

// balão de fala com rabinho na borda de baixo
function bubblePath(x, y, w, h, r, tip, baseX, baseW = 46) {
  const b1 = Math.max(x + r + 4, Math.min(x + w - r - 4 - baseW, baseX - baseW / 2));
  const b2 = b1 + baseW;
  return `M${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h - r}Q${x + w} ${y + h} ${x + w - r} ${y + h}H${b2}L${tip[0]} ${tip[1]}L${b1} ${y + h}H${x + r}Q${x} ${y + h} ${x} ${y + h - r}V${y + r}Q${x} ${y} ${x + r} ${y}Z`;
}
// balão com texto. parts: [{t, c}] para colorir trechos
function bubble(x, y, w, h, tip, baseX, parts, o = {}) {
  const size = o.size || 60;
  let tx = '';
  const fam = "'Fredoka'";
  const spans = parts.map((p) => `<tspan fill="${p.c || C.ink}">${esc(p.t)}</tspan>`).join('');
  tx = `<text x="${x + w / 2}" y="${y + h / 2 + (o.dy || 2)}" font-family="${fam}" font-weight="${o.weight || 600}" font-size="${size}" text-anchor="middle" dominant-baseline="central">${spans}</text>`;
  return piece(bubblePath(x, y, w, h, o.r || 46, tip, baseX), { fill: o.fill || '#FFFFFF', seed: o.seed || 301, depth: 5, inner: tx });
}

// ponto de interrogação de papel
function questionMark(cx, cy, s = 1, col = C.coral, seed = 310) {
  const pts = [];
  for (let a = 195; a <= 400; a += 9) {
    const r = (a * Math.PI) / 180;
    pts.push([Math.cos(r) * 52, -44 + Math.sin(r) * 52]);
  }
  pts.push([14, 18], [4, 34], [2, 52]);
  return g(`translate(${cx} ${cy}) scale(${s})`,
    piece(thick(pts, 34), { fill: col, seed, depth: 6 }) + piece(E(2, 100, 20, 20), { fill: col, seed: seed + 1, depth: 6 }));
}

// sofá visto de frente. Retorna {back, front} para encaixar pessoas no meio
function sofa(cx, y, w, col, o = {}) {
  const x = cx - w / 2;
  const dark = shade(col, -0.18);
  let back = piece(R(x + 46, y - 270, w - 92, 300, 60), { fill: col, seed: (o.seed || 320) });
  if (o.buttons) {
    for (let i = 0; i < 5; i++) back += `<circle cx="${x + 140 + i * (w - 280) / 4}" cy="${y - 150}" r="7" fill="${shade(col, -0.3)}"/>`;
  }
  back += piece(R(x + 76, y - 22, (w - 152) / 2 + 4, 92, 26), { fill: shade(col, 0.1), seed: (o.seed || 320) + 1 });
  back += piece(R(cx - 2, y - 22, (w - 152) / 2 + 4, 92, 26), { fill: shade(col, 0.1), seed: (o.seed || 320) + 2 });
  back += piece(R(x + 30, y + 54, w - 60, 86, 22), { fill: dark, seed: (o.seed || 320) + 3 });
  back += piece(P([[x + 70, y + 136], [x + 100, y + 136], [x + 94, y + 172], [x + 76, y + 172]]), { fill: C.brown, seed: (o.seed || 320) + 4 });
  back += piece(P([[x + w - 100, y + 136], [x + w - 70, y + 136], [x + w - 76, y + 172], [x + w - 94, y + 172]]), { fill: C.brown, seed: (o.seed || 320) + 5 });
  const front = piece(R(x, y - 130, 104, 252, 46), { fill: shade(col, 0.04), seed: (o.seed || 320) + 6 }) +
    piece(R(x + w - 104, y - 130, 104, 252, 46), { fill: shade(col, 0.04), seed: (o.seed || 320) + 7 });
  return { back, front };
}

function windowFrame(x, y, w, h, t) {
  let s = piece(R(x - 14, y - 14, w + 28, h + 28, 10), { fill: '#FFFFFF', seed: 330 });
  s += piece(R(x, y, w, h, 6), { fill: '#9ED8F0', seed: 331, depth: 0 });
  const cx = (t * 14) % (w + 200);
  s += g(`translate(${-60 + cx * 0.4} 0)`, piece(E(x + 80, y + 70, 46, 22), { fill: '#fff', seed: 332, depth: 0 }) + piece(E(x + 112, y + 58, 34, 24), { fill: '#fff', seed: 333, depth: 0 }));
  s += piece(E(x + w - 60, y + 60, 30), { fill: '#FFE07A', seed: 334, depth: 0 });
  s += piece(R(x + w / 2 - 7, y, 14, h, 3), { fill: '#FFFFFF', seed: 335, depth: 2 });
  s += piece(R(x, y + h / 2 - 7, w, 14, 3), { fill: '#FFFFFF', seed: 336, depth: 2 });
  s += piece(`M${x - 30} ${y - 30}H${x + 60}Q${x + 30} ${y + h / 2} ${x + 50} ${y + h + 40}H${x - 30}Z`, { fill: C.pink, seed: 337 });
  s += piece(`M${x + w + 30} ${y - 30}H${x + w - 60}Q${x + w - 30} ${y + h / 2} ${x + w - 50} ${y + h + 40}H${x + w + 30}Z`, { fill: C.pink, seed: 338 });
  return s;
}

function pictureFrame(x, y, w, h, col = C.mustard) {
  let s = piece(R(x, y, w, h, 6), { fill: col, seed: 340 });
  s += piece(R(x + 16, y + 16, w - 32, h - 32, 2), { fill: '#FFF4DE', seed: 341, depth: 0 });
  s += piece(P([[x + 24, y + h - 24], [x + w * 0.38, y + h * 0.36], [x + w * 0.6, y + h - 24]]), { fill: C.teal, seed: 342, depth: 2 });
  s += piece(P([[x + w * 0.42, y + h - 24], [x + w * 0.66, y + h * 0.46], [x + w - 24, y + h - 24]]), { fill: C.leaf, seed: 343, depth: 2 });
  s += piece(E(x + w * 0.74, y + h * 0.3, 18), { fill: C.coral, seed: 344, depth: 2 });
  return s;
}

function plant(x, y, t, s = 1) {
  let leaves = '';
  const L = [[-50, -120, -30], [0, -150, 0], [48, -118, 30], [-28, -80, -50], [30, -84, 48]];
  L.forEach((l, i) => {
    leaves += g(`rotate(${l[2] + sway(t, 2.5, 0.35, i)} 0 0)`, piece(E(0, l[1] / 2 - 10, 26, -l[1] / 2), { fill: i % 2 ? C.leaf : shade(C.leaf, -0.12), seed: 350 + i }));
  });
  const pot = piece(P([[-62, 0], [62, 0], [48, 110], [-48, 110]]), { fill: '#E08A5C', seed: 356 }) + piece(R(-70, -10, 140, 32, 8), { fill: '#EC9B6D', seed: 357 });
  return g(`translate(${x} ${y}) scale(${s})`, leaves + pot);
}

function lamp(x, y) {
  return piece(R(x - 6, y - 300, 12, 300, 4), { fill: C.ink, seed: 360 }) + piece(E(x, y + 4, 60, 14), { fill: C.ink, seed: 361 }) +
    piece(P([[x - 70, y - 300], [x + 70, y - 300], [x + 46, y - 400], [x - 46, y - 400]]), { fill: C.mustard, seed: 362 });
}

// estante com livros coloridos
function shelf(x, y, w, h) {
  let s = piece(R(x, y, w, h, 8), { fill: '#A86F44', seed: 370 });
  s += piece(R(x + 14, y + 14, w - 28, h - 28, 4), { fill: '#7E5131', seed: 371, depth: 0 });
  const rows = 3, rh = (h - 28) / rows;
  const cols = [C.coral, C.teal, C.mustard, C.blue, C.lilac, C.leaf, C.pink, C.navy];
  const rnd = mulberry32(77);
  for (let r = 0; r < rows; r++) {
    let bx = x + 22;
    const by = y + 14 + (r + 1) * rh;
    while (bx < x + w - 50) {
      const bw = 22 + rnd() * 18, bh = rh * (0.62 + rnd() * 0.3);
      s += piece(R(bx, by - bh - 8, bw, bh, 3), { fill: cols[Math.floor(rnd() * cols.length)], seed: 372 + Math.floor(bx), depth: 2, amp: 1 });
      bx += bw + 4;
    }
    s += piece(R(x + 14, by - 10, w - 28, 14, 2), { fill: '#A86F44', seed: 380 + r, depth: 3 });
  }
  return s;
}

// placa de papelão num palito
function sign(cx, cy, w, h, str, o = {}) {
  let s = piece(CAP(cx, cy + h / 2 - 10, cx, cy + h / 2 + (o.stick || 330), 26), { fill: '#C08850', seed: 390 });
  let corr = '';
  for (let i = 1; i < 14; i++) corr += `<path d="M${cx - w / 2 + i * (w / 14)} ${cy - h / 2 + 8}V${cy + h / 2 - 8}" stroke="#B9844E" stroke-opacity=".25" stroke-width="3"/>`;
  s += piece(R(cx - w / 2, cy - h / 2, w, h, 10), { fill: '#DDAE72', seed: 391, depth: 6, edge: '#A8773F', inner: corr });
  s += text(cx, cy + 4, str, { size: o.size || 92, weight: 700, fill: o.color || C.ink, ls: 2 });
  return s;
}

// fumaça do charuto
function smoke(x, y, t) {
  let s = '';
  for (let i = 0; i < 4; i++) {
    const ph = (t * 0.55 + i / 4) % 1;
    const yy = y - ph * 210, xx = x + Math.sin(ph * 6 + i) * 18 + ph * 26;
    const r = 10 + ph * 26;
    const op = ph < 0.15 ? ph / 0.15 : 1 - (ph - 0.15) / 0.85;
    s += `<g opacity="${(op * 0.9).toFixed(2)}">` + piece(E(xx, yy, r, r * 0.86), { fill: '#E9EBF0', seed: 400 + i, depth: 0, rimOp: 0.6 }) + '</g>';
  }
  return s;
}

function cigar(x, y, rot = 8) {
  return g(`rotate(${rot} ${x} ${y})`, piece(R(x, y - 8, 62, 16, 7), { fill: '#8A5A3A', seed: 410, depth: 2 }) +
    piece(R(x + 14, y - 9, 10, 18, 2), { fill: C.coral, seed: 411, depth: 0 }) + piece(E(x + 62, y, 7, 8), { fill: '#FF9B3D', seed: 412, depth: 0 }));
}

// calendário de parede (folha do dia)
function calendar(x, y, w, h, t) {
  let s = piece(R(x, y, w, h, 12), { fill: '#FFFFFF', seed: 420 });
  s += piece(R(x, y, w, 70, 12), { fill: C.coral, seed: 421, depth: 0 });
  s += text(x + w / 2, y + 36, 'SEGUNDA', { size: 34, fill: '#fff', weight: 700, ls: 3 });
  s += `<circle cx="${x + 50}" cy="${y - 2}" r="9" fill="${C.ink}"/><circle cx="${x + w - 50}" cy="${y - 2}" r="9" fill="${C.ink}"/>`;
  s += text(x + w / 2, y + 140, '14', { size: 112, weight: 700, fill: C.ink });
  s += text(x + w / 2, y + 236, '9h', { size: 34, font: 'hand', fill: shade(C.ink, 0.3) });
  s += text(x + w / 2, y + 278, 'Reunião chata', { size: 46, font: 'hand', fill: C.ink });
  return s;
}
// círculo de caneta vermelha (desenhando-se)
function markerCircle(cx, cy, rx, ry, p, col = C.coral) {
  if (p <= 0) return '';
  const pts = [];
  const n = Math.max(2, Math.floor(60 * p));
  for (let i = 0; i <= n; i++) {
    const a = -1.9 + (i / 60) * Math.PI * 2.15;
    const k = 1 + 0.06 * Math.sin(i * 0.3);
    pts.push(`${(cx + Math.cos(a) * rx * k).toFixed(1)} ${(cy + Math.sin(a) * ry * k).toFixed(1)}`);
  }
  return `<path d="M${pts.join('L')}" fill="none" stroke="${col}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>`;
}

function clock(cx, cy, r, hh, mm) {
  let s = piece(E(cx, cy, r + 10), { fill: C.teal, seed: 430 }) + piece(E(cx, cy, r), { fill: '#FFFFFF', seed: 431, depth: 0 });
  const ha = ((hh % 12) + mm / 60) / 12 * 360, ma = mm / 60 * 360;
  s += line(`M${cx} ${cy}L${cx + Math.sin(ha * Math.PI / 180) * r * 0.5} ${cy - Math.cos(ha * Math.PI / 180) * r * 0.5}`, C.ink, 7);
  s += line(`M${cx} ${cy}L${cx + Math.sin(ma * Math.PI / 180) * r * 0.78} ${cy - Math.cos(ma * Math.PI / 180) * r * 0.78}`, C.ink, 5);
  s += `<circle cx="${cx}" cy="${cy}" r="6" fill="${C.coral}"/>`;
  return s;
}

function gift(cx, cy, w = 120, h = 100) {
  let s = piece(R(cx - w / 2, cy - h / 2, w, h, 6), { fill: C.purple, seed: 440 });
  s += piece(R(cx - 11, cy - h / 2, 22, h, 2), { fill: C.mustard, seed: 441, depth: 0 });
  s += piece(R(cx - w / 2 - 6, cy - h / 2 - 24, w + 12, 30, 6), { fill: shade(C.purple, 0.12), seed: 442 });
  s += piece(R(cx - 11, cy - h / 2 - 24, 22, 30, 2), { fill: C.mustard, seed: 443, depth: 0 });
  s += piece(E(cx - 24, cy - h / 2 - 36, 26, 16), { fill: C.mustard, seed: 444 }) + piece(E(cx + 24, cy - h / 2 - 36, 26, 16), { fill: C.mustard, seed: 445 });
  return s;
}

function cake(cx, y, t) {
  let s = piece(E(cx, y + 6, 130, 22), { fill: '#FFFFFF', seed: 450 });
  s += piece(R(cx - 104, y - 96, 208, 100, 18), { fill: '#F7D9A8', seed: 451 });
  s += piece('M' + (cx - 106) + ' ' + (y - 96) + 'H' + (cx + 106) + 'V' + (y - 60) + 'Q' + (cx + 86) + ' ' + (y - 34) + ' ' + (cx + 70) + ' ' + (y - 60) + 'Q' + (cx + 46) + ' ' + (y - 30) + ' ' + (cx + 24) + ' ' + (y - 60) + 'Q' + cx + ' ' + (y - 28) + ' ' + (cx - 22) + ' ' + (y - 60) + 'Q' + (cx - 46) + ' ' + (y - 32) + ' ' + (cx - 70) + ' ' + (y - 60) + 'Q' + (cx - 88) + ' ' + (y - 36) + ' ' + (cx - 106) + ' ' + (y - 60) + 'Z', { fill: C.pink, seed: 452 });
  s += piece(R(cx - 9, y - 170, 18, 76, 4), { fill: C.sky, seed: 453 });
  const f = 1 + 0.12 * Math.sin(t * 22);
  s += g(scaleAt(f, cx, y - 172), piece('M' + cx + ' ' + (y - 220) + 'Q' + (cx + 20) + ' ' + (y - 186) + ' ' + cx + ' ' + (y - 172) + 'Q' + (cx - 20) + ' ' + (y - 186) + ' ' + cx + ' ' + (y - 220) + 'Z', { fill: '#FFB23F', seed: 454, depth: 0 }));
  for (let i = 0; i < 5; i++) s += `<circle cx="${cx - 70 + i * 35}" cy="${y - 20}" r="6" fill="${[C.coral, C.teal, C.mustard, C.blue, C.purple][i]}"/>`;
  return s;
}

function bunting(x1, x2, y, letters, t) {
  const n = letters.length;
  const w = (x2 - x1) / n;
  let s = line(`M${x1 - 20} ${y - 6}Q${(x1 + x2) / 2} ${y + 40} ${x2 + 20} ${y - 6}`, C.ink, 3);
  const cols = [C.coral, C.mustard, C.teal, C.blue, C.pink, C.leaf, C.purple, C.salmon];
  for (let i = 0; i < n; i++) {
    const cx = x1 + w * (i + 0.5);
    const u = (cx - x1) / (x2 - x1);
    const yy = y - 6 + 4 * u * (1 - u) * 46 * 0.98;
    const r = sway(t, 3, 0.6, i);
    s += g(rotAt(r, cx, yy), piece(P([[cx - w / 2 + 4, yy], [cx + w / 2 - 4, yy], [cx, yy + w * 1.05]]), { fill: cols[i % cols.length], seed: 460 + i }) +
      text(cx, yy + w * 0.36, letters[i], { size: w * 0.42, weight: 700, fill: '#fff' }));
  }
  return s;
}

function keys(cx, cy, rot = 0) {
  const gold = '#F3C64D', silver = '#C9CFD8';
  let s = g(`rotate(30 ${cx} ${cy})`, piece(R(cx - 7, cy + 8, 14, 72, 4), { fill: silver, seed: 470, depth: 2 }) + piece(P([[cx + 7, cy + 50], [cx + 22, cy + 50], [cx + 22, cy + 60], [cx + 14, cy + 60], [cx + 14, cy + 70], [cx + 7, cy + 70]]), { fill: silver, seed: 471, depth: 2 }) + piece(E(cx, cy + 6, 18), { fill: silver, seed: 472, depth: 2 }));
  s += g(`rotate(-28 ${cx} ${cy})`, piece(R(cx - 7, cy + 8, 14, 78, 4), { fill: gold, seed: 473, depth: 2 }) + piece(P([[cx - 7, cy + 52], [cx - 22, cy + 52], [cx - 22, cy + 62], [cx - 14, cy + 62], [cx - 14, cy + 74], [cx - 7, cy + 74]]), { fill: gold, seed: 474, depth: 2 }) + piece(E(cx, cy + 6, 18), { fill: gold, seed: 475, depth: 2 }));
  s += `<circle cx="${cx}" cy="${cy - 10}" r="22" fill="none" stroke="#8C95A3" stroke-width="7"/>`;
  return g(`rotate(${rot} ${cx} ${cy})`, s);
}

// retrato do sogro
function portrait(cx, cy, t, look = 0) {
  let s = piece(E(cx, cy, 128, 156), { fill: '#C9A04A', seed: 480 });
  s += piece(E(cx, cy, 104, 132), { fill: '#EADBC4', seed: 481, depth: 0 });
  s += piece(R(cx - 74, cy + 52, 148, 90, 40), { fill: '#5B5470', seed: 482, depth: 2 });
  s += piece(E(cx, cy - 6, 58, 64), { fill: SKIN.d, seed: 483, depth: 2 });
  s += piece('M-60 -8C-64 -28 -56 -40 -46 -44C-44 -28 -48 -16 -52 0Z', { fill: '#9A9AA3', seed: 484, depth: 2, attr: `transform="translate(${cx} ${cy})"` });
  s += piece('M60 -8C64 -28 56 -40 46 -44C44 -28 48 -16 52 0Z', { fill: '#9A9AA3', seed: 485, depth: 2, attr: `transform="translate(${cx} ${cy})"` });
  s += `<circle cx="${cx - 20 + look}" cy="${cy - 10}" r="6" fill="${C.ink}"/><circle cx="${cx + 20 + look}" cy="${cy - 10}" r="6" fill="${C.ink}"/>`;
  s += line(`M${cx - 36} ${cy - 30}L${cx - 10} ${cy - 22}M${cx + 10} ${cy - 22}L${cx + 36} ${cy - 30}`, C.ink, 6);
  s += piece(`M${cx - 44} ${cy + 22}Q${cx - 22} ${cy + 4} ${cx} ${cy + 14}Q${cx + 22} ${cy + 4} ${cx + 44} ${cy + 22}Q${cx + 22} ${cy + 30} ${cx} ${cy + 24}Q${cx - 22} ${cy + 30} ${cx - 44} ${cy + 22}Z`, { fill: '#6B6470', seed: 486, depth: 2 });
  s += tag(cx, cy + 176, 150, 46, 'SOGRO', { fill: '#C9A04A', color: '#5A3F12', size: 28, weight: 700, seed: 487 });
  return s;
}

// livro
function book(cx, cy, w, h) {
  const x = cx - w / 2, y = cy - h / 2;
  let s = piece(R(x, y, w, h, 10), { fill: '#C7473B', seed: 490, depth: 10, edge: '#F5EBD8' });
  s += piece(R(x, y, 34, h, 8), { fill: '#A63A30', seed: 491, depth: 0 });
  s += piece(R(x + 56, y + 34, w - 84, 4, 1), { fill: '#F6C453', seed: 492, depth: 0, rim: false });
  s += text(cx + 16, y + 92, 'Psicopatologia', { size: 33, fill: '#FFF4DC', weight: 600 });
  s += text(cx + 16, y + 134, 'da vida', { size: 33, fill: '#FFF4DC', weight: 600 });
  s += text(cx + 16, y + 176, 'cotidiana', { size: 33, fill: '#FFF4DC', weight: 600 });
  s += piece(R(x + 56, y + 214, w - 84, 4, 1), { fill: '#F6C453', seed: 493, depth: 0, rim: false });
  s += text(cx + 16, y + h - 60, 'Sigmund Freud', { size: 26, fill: '#F6C453', weight: 500 });
  return s;
}

// selo redondo (ex.: 1901)
function stamp(cx, cy, r, str, col = C.navy) {
  return piece(E(cx, cy, r), { fill: col, seed: 495, depth: 4, inner: `<circle cx="${cx}" cy="${cy}" r="${r - 10}" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="6 6"/>` + text(cx, cy + 2, str, { size: r * 0.62, fill: '#fff', weight: 700 }) });
}

// letras "Z" do sono
function zzz(x, y, t) {
  let s = '';
  for (let i = 0; i < 3; i++) {
    const ph = (t * 0.45 + i / 3) % 1;
    const op = ph < 0.2 ? ph / 0.2 : 1 - (ph - 0.2) / 0.8;
    s += text(x + ph * 70 + Math.sin(ph * 7) * 10, y - ph * 170, 'Z', { size: 40 + ph * 40, weight: 700, fill: C.navy, op: op.toFixed(2), stroke: '#fff', sw: 6 });
  }
  return s;
}

function heart(cx, cy, s = 1, col = C.coral, seed = 500) {
  return g(`translate(${cx} ${cy}) scale(${s})`, piece('M0 18C-30 -4 -36 -24 -22 -34C-12 -40 -2 -34 0 -24C2 -34 12 -40 22 -34C36 -24 30 -4 0 18Z', { fill: col, seed, depth: 3 }));
}

// gotinha de suor
function sweat(cx, cy, s = 1) {
  return g(`translate(${cx} ${cy}) scale(${s})`, piece('M0 -22Q14 0 12 10Q8 22 0 22Q-8 22 -12 10Q-14 0 0 -22Z', { fill: '#9ED8F0', seed: 505, depth: 2 }));
}

// tracinhos de susto/ênfase
function shockLines(cx, cy, r, p, col = C.ink) {
  if (p <= 0) return '';
  let s = '';
  const angs = [-150, -120, -90, -60, -30];
  angs.forEach((a, i) => {
    const rad = (a * Math.PI) / 180;
    const r1 = r, r2 = r + 34 * p;
    s += line(`M${cx + Math.cos(rad) * r1} ${cy + Math.sin(rad) * r1}L${cx + Math.cos(rad) * r2} ${cy + Math.sin(rad) * r2}`, col, 6);
  });
  return s;
}
