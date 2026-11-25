// Personagens de papel recortado: marionetes com cabeça, tronco, braços articulados e pernas.
// Coordenadas locais: (0,0) = base do pescoço. Cabeça centrada em (0,-80).

const SKIN = { a: '#F6C7A6', b: '#C98A5E', c: '#F2D4BC', d: '#E7B18B' };

// direção de um membro: ângulo 0 = para baixo; positivo = para fora do corpo
function limbDir(a, side) {
  const r = (a * Math.PI) / 180;
  return [side * Math.sin(r), Math.cos(r)];
}

// linha grossa -> forma fechada (para ganchos, interrogação etc.)
function thick(pts, w) {
  const L = [], Rr = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    L.push([p[0] - dy * w / 2, p[1] + dx * w / 2]);
    Rr.push([p[0] + dy * w / 2, p[1] - dx * w / 2]);
  }
  return P(L.concat(Rr.reverse()).map((p) => [p[0].toFixed(1), p[1].toFixed(1)]));
}

// ---------- rosto ----------
function eyes(o, ink = C.ink) {
  const [lx, ly] = o.look || [0, 0];
  const mode = o.eyes || 'open';
  const ex = 27, ey = 2;
  let s = '';
  for (const side of [-1, 1]) {
    const x = side * ex + lx, y = ey + ly;
    if (mode === 'open') {
      s += `<ellipse cx="${x}" cy="${y}" rx="8.5" ry="10" fill="${ink}"/><circle cx="${x + 2.5}" cy="${y - 3.5}" r="2.8" fill="#fff"/>`;
    } else if (mode === 'happy') {
      s += line(`M${x - 11} ${y + 4}Q${x} ${y - 10} ${x + 11} ${y + 4}`, ink, 5);
    } else if (mode === 'closed') {
      s += line(`M${x - 11} ${y - 1}Q${x} ${y + 9} ${x + 11} ${y - 1}`, ink, 5);
    } else if (mode === 'wide') {
      s += `<circle cx="${side * ex}" cy="${ey - 2}" r="15" fill="#fff" stroke="${ink}" stroke-width="3.5"/><circle cx="${side * ex + lx * 0.6}" cy="${ey - 2 + ly * 0.6}" r="5.5" fill="${ink}"/>`;
    } else if (mode === 'squint') {
      s += `<ellipse cx="${x}" cy="${y + 2}" rx="9" ry="5" fill="${ink}"/>`;
      s += line(`M${side * ex - 13} ${ey - 5}L${side * ex + 13} ${ey - 5}`, ink, 4);
    } else if (mode === 'side') {
      s += `<ellipse cx="${x}" cy="${y}" rx="8.5" ry="10" fill="${ink}"/>`;
    }
  }
  return s;
}
function brows(o, ink = C.ink, col) {
  const b = o.brows;
  if (!b) return '';
  const c = col || ink;
  const w = o.browW || 5;
  const by = -24;
  if (b === 'normal') return line(`M-38 ${by}Q-27 ${by - 6} -16 ${by}`, c, w) + line(`M16 ${by}Q27 ${by - 6} 38 ${by}`, c, w);
  if (b === 'up') return line(`M-38 ${by - 10}Q-27 ${by - 18} -16 ${by - 10}`, c, w) + line(`M16 ${by - 10}Q27 ${by - 18} 38 ${by - 10}`, c, w);
  if (b === 'angry') return line(`M-40 ${by - 8}L-14 ${by + 2}`, c, w + 1) + line(`M14 ${by + 2}L40 ${by - 8}`, c, w + 1);
  if (b === 'worried') return line(`M-40 ${by + 1}L-15 ${by - 8}`, c, w) + line(`M15 ${by - 8}L40 ${by + 1}`, c, w);
  if (b === 'skeptic') return line(`M-40 ${by - 2}L-14 ${by + 1}`, c, w + 1) + line(`M14 ${by - 12}Q27 ${by - 20} 40 ${by - 12}`, c, w + 1);
  return '';
}
function mouth(o, ink = C.ink) {
  const m = o.mouth || 'smile';
  const y = 40;
  const dark = '#7B2E36';
  if (m === 'smile') return line(`M-20 ${y - 2}Q0 ${y + 16} 20 ${y - 2}`, ink, 5);
  if (m === 'big') return `<path d="M-24 ${y - 4}Q0 ${y + 34} 24 ${y - 4}Z" fill="${dark}" stroke="${ink}" stroke-width="3.5" stroke-linejoin="round"/><path d="M-11 ${y + 12}Q0 ${y + 5} 11 ${y + 12}Q0 ${y + 20} -11 ${y + 12}Z" fill="#F08A8A"/>`;
  if (m === 'flat') return line(`M-15 ${y + 5}L15 ${y + 5}`, ink, 5);
  if (m === 'o') return `<ellipse cx="0" cy="${y + 6}" rx="9" ry="12" fill="${dark}" stroke="${ink}" stroke-width="3.5"/>`;
  if (m === 'frown') return line(`M-17 ${y + 12}Q0 ${y - 2} 17 ${y + 12}`, ink, 5);
  if (m === 'smirk') return line(`M-16 ${y + 7}Q4 ${y + 12} 20 ${y}`, ink, 5);
  if (m === 'awkward') return `<path d="M-22 ${y}Q0 ${y + 4} 22 ${y}L20 ${y + 12}Q0 ${y + 16} -20 ${y + 12}Z" fill="#fff" stroke="${ink}" stroke-width="3.5" stroke-linejoin="round"/>` + line(`M-7 ${y + 1}L-7 ${y + 14}M7 ${y + 1}L7 ${y + 14}`, ink, 2.5);
  if (m === 'wavy') return line(`M-20 ${y + 6}Q-10 ${y - 2} 0 ${y + 6}Q10 ${y + 14} 20 ${y + 6}`, ink, 5);
  if (m === 'none') return '';
  return '';
}

// ---------- cabelos ----------
function hairBack(style, col) {
  if (style === 'bob') return piece('M-98 -4C-98 -74 -56 -112 0 -112C56 -112 98 -74 98 -4L102 74Q96 92 72 88L-72 88Q-96 92 -102 74Z', { fill: col, seed: 11 });
  if (style === 'long') return piece('M-96 -4C-96 -74 -56 -112 0 -112C56 -112 96 -74 96 -4L104 130Q90 150 60 140L-60 140Q-90 150 -104 130Z', { fill: col, seed: 12 });
  if (style === 'bun') return piece(E(0, -112, 36, 32), { fill: col, seed: 13 });
  return '';
}
function hairFront(style, col) {
  if (style === 'bob') return piece('M-84 -14C-84 -82 -44 -104 0 -104C48 -104 86 -80 86 -18C70 -44 46 -60 14 -58C-6 -44 -46 -34 -84 -14Z', { fill: col, seed: 21 });
  if (style === 'long') return piece('M-84 -14C-84 -82 -44 -104 0 -104C48 -104 86 -80 86 -18C66 -52 30 -64 2 -60C-30 -56 -60 -40 -84 -14Z', { fill: col, seed: 22 });
  if (style === 'short' || style === 'bun') return piece('M-82 -12C-84 -86 -42 -106 0 -106C44 -106 86 -88 82 -12C72 -46 48 -64 0 -66C-46 -66 -72 -46 -82 -12Z', { fill: col, seed: 23 });
  if (style === 'curly') {
    let s = '';
    const pts = [[-70, -38], [-58, -70], [-30, -92], [2, -98], [34, -92], [60, -72], [72, -40], [-44, -84], [18, -100]];
    pts.forEach((p, i) => { s += piece(E(p[0], p[1], 27, 25), { fill: col, seed: 40 + i, depth: 3 }); });
    s += piece('M-80 -20Q-84 -50 -66 -60L-62 -14Z', { fill: col, seed: 49 });
    s += piece('M80 -20Q84 -50 66 -60L62 -14Z', { fill: col, seed: 50 });
    return s;
  }
  if (style === 'freud') {
    return (
      piece('M-84 -8C-92 -40 -80 -64 -60 -70C-52 -50 -58 -26 -66 6Z', { fill: col, seed: 31 }) +
      piece('M84 -8C92 -40 80 -64 60 -70C52 -50 58 -26 66 6Z', { fill: col, seed: 32 }) +
      `<path d="M-30 -78Q-4 -94 26 -84" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="7" stroke-linecap="round"/>`
    );
  }
  if (style === 'bald') return `<path d="M-30 -78Q-4 -94 26 -84" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="7" stroke-linecap="round"/>`;
  return '';
}

// ---------- cabeça ----------
function head(o) {
  const skin = o.skin || SKIN.a;
  const fs = o.faceShift || 0; // desloca o rosto (dá impressão de virar)
  let s = '';
  s += hairBack(o.hair, o.hairCol);
  s += piece(E(-80 + fs * 0.3, 8, 15, 19), { fill: skin, seed: 61 });
  s += piece(E(80 + fs * 0.3, 8, 15, 19), { fill: skin, seed: 62 });
  s += piece(E(0, 0, 82, 84), { fill: skin, seed: o.seed || 60 });
  let face = '';
  if (o.blush !== false) face += `<ellipse cx="-47" cy="30" rx="14" ry="8" fill="#F27C8E" opacity=".45"/><ellipse cx="47" cy="30" rx="14" ry="8" fill="#F27C8E" opacity=".45"/>`;
  face += eyes(o) + brows(o, C.ink, o.browCol);
  if (o.nose !== false) face += line('M-2 14Q6 22 -2 26', shade(skin, -0.35), 4);
  if (o.beard) {
    face += piece('M-74 4C-76 74 -42 126 0 134C42 126 76 74 74 4C58 34 34 50 0 50C-34 50 -58 34 -74 4Z', { fill: o.beard, seed: 71 });
    face += piece('M-38 38C-24 22 -8 26 0 32C8 26 24 22 38 38C26 48 10 48 0 42C-10 48 -26 48 -38 38Z', { fill: shade(o.beard, -0.06), seed: 72 });
  } else {
    face += mouth(o);
  }
  if (o.glasses) {
    face += `<g fill="#DDF1FF" fill-opacity=".45" stroke="${C.ink}" stroke-width="4.5"><circle cx="-28" cy="2" r="21"/><circle cx="28" cy="2" r="21"/></g>` + line('M-7 0Q0 -6 7 0', C.ink, 4) + line('M-49 -2L-78 -8M49 -2L78 -8', C.ink, 4);
  }
  s += g(fs ? `translate(${fs} 0)` : '', face);
  s += hairFront(o.hair, o.hairCol);
  if (o.bow) s += g('translate(58 -78) rotate(20)', piece('M0 0L-26 -16L-26 16Z', { fill: o.bow, seed: 81 }) + piece('M0 0L26 -16L26 16Z', { fill: o.bow, seed: 82 }) + piece(E(0, 0, 8), { fill: shade(o.bow, -0.1), seed: 83 }));
  if (o.hat) s += o.hat;
  if (o.extraHead) s += o.extraHead;
  return s;
}

// ---------- braço com dois segmentos ----------
function arm(side, a1, a2, o, sx = 72, sy = 26, L1 = 80, L2 = 74) {
  const col = o.top, skin = o.skin || SKIN.a;
  const W = 38;
  const sh = [side * sx, sy];
  const d1 = limbDir(a1, side), d2 = limbDir(a1 + a2, side);
  const el = [sh[0] + d1[0] * L1, sh[1] + d1[1] * L1];
  const hd = [el[0] + d2[0] * L2, el[1] + d2[1] * L2];
  const sleeve = o.sleeve || col;
  let s = piece(CAP(sh[0], sh[1], el[0], el[1], W), { fill: col, seed: 90 + side * 3, depth: 3 });
  s += piece(CAP(el[0], el[1], hd[0], hd[1], W - 3), { fill: sleeve, seed: 95 + side * 3, depth: 3 });
  s += piece(E(hd[0], hd[1], 20, 20), { fill: skin, seed: 99 + side, depth: 3 });
  return { svg: s, hand: hd, elbow: el };
}

// ---------- pessoa ----------
// o: { skin, hair, hairCol, top, pants, shoes, sitting, standing, legs:false,
//      eyes, look, mouth, brows, faceShift, headRot, lean, arms:{l:[a1,a2], r:[a1,a2]} | 'crossed',
//      chest (svg sobre o peito), hold (svg na mão direita), torsoExtra }
function person(o) {
  const skin = o.skin || SKIN.a;
  const top = o.top || C.coral;
  const pants = o.pants || C.navy;
  const shoes = o.shoes || C.ink;
  let s = '';
  // pernas
  if (o.sitting) {
    s += piece(CAP(-44, 232, -46, 328, 44), { fill: pants, seed: 101 });
    s += piece(CAP(44, 232, 46, 328, 44), { fill: pants, seed: 102 });
    s += piece(E(-54, 344, 36, 18), { fill: shoes, seed: 103 });
    s += piece(E(54, 344, 36, 18), { fill: shoes, seed: 104 });
  } else if (o.legs !== false) {
    s += piece(CAP(-40, 180, -44, 380, 48), { fill: pants, seed: 106 });
    s += piece(CAP(40, 180, 44, 380, 48), { fill: pants, seed: 107 });
    s += piece(E(-52, 394, 38, 19), { fill: shoes, seed: 108 });
    s += piece(E(52, 394, 38, 19), { fill: shoes, seed: 109 });
  }
  // parte de cima (inclina em torno do quadril)
  let up = '';
  const armsMode = o.arms || { l: [12, -18], r: [12, -18] };
  let armsBack = '', armsFront = '', hand = null;
  if (armsMode === 'crossed') {
    const la = arm(-1, 6, -98, o, 70, 26, 92, 104);
    const ra = arm(1, 6, -94, o, 70, 34, 92, 104);
    armsBack = la.svg; armsFront = ra.svg; hand = ra.hand;
  } else {
    const la = arm(-1, armsMode.l[0], armsMode.l[1], o);
    const ra = arm(1, armsMode.r[0], armsMode.r[1], o);
    armsFront = la.svg + ra.svg; hand = ra.hand;
    if (o.hold) armsFront += g(`translate(${ra.hand[0]} ${ra.hand[1]})`, o.hold);
  }
  up += piece(R(-20, -26, 40, 44, 10), { fill: shade(skin, -0.08), seed: 110 });
  up += piece('M-58 2Q-84 4 -86 32L-90 178Q-90 200 -68 200L68 200Q90 200 90 178L86 32Q84 4 58 2Q30 22 0 22Q-30 22 -58 2Z', { fill: top, seed: o.torsoSeed || 111 });
  if (o.collar) up += o.collar;
  if (o.torsoExtra) up += o.torsoExtra;
  if (o.chest) up += o.chest;
  if (o.sitting) {
    up += piece(R(-90, 170, 92, 80, 36), { fill: pants, seed: 105 });
    up += piece(R(-2, 170, 92, 80, 36), { fill: shade(pants, 0.04), seed: 112 });
  }
  if (armsMode === 'crossed') up += armsBack;
  const hr = o.headRot || 0;
  up += g(`translate(${o.headX || 0} ${o.headY || 0}) rotate(${hr} 0 -8) translate(0 -88)`, head(o));
  up += armsFront;
  s += g(o.lean ? `rotate(${o.lean} 0 200)` : '', up);
  return g(`translate(${o.x || 0} ${o.y || 0}) scale(${o.s || 1})`, s);
}

// crachá "Olá, eu sou ..."
function nameTag(name, w = 150, h = 92) {
  const x = -w / 2, y = -h / 2;
  return piece(R(x, y, w, h, 8), {
    fill: '#FFFFFF', seed: 121, depth: 3,
    inner: `<path d="M${x + 3} ${y + 3}H${x + w - 3}V${y + 26}H${x + 3}Z" fill="${C.coral}"/>` +
      text(0, y + 15, 'OLÁ, EU SOU', { size: 13, fill: '#fff', weight: 700, ls: 1 }) +
      text(0, y + 58, name, { size: 38, fill: C.ink, font: 'hand' }),
  });
}

// bonequinho simples (para o cabo de guerra)
function doll(o) {
  const col = o.col || C.blue, skin = o.skin || SKIN.c;
  const k = o.lean || 0; // inclinação para trás (graus)
  let s = '';
  // pernas
  const lg = o.legs || [[-14, 70, -30, 130], [14, 70, 26, 130]];
  lg.forEach((l, i) => { s += piece(CAP(l[0], l[1], l[2], l[3], 20), { fill: shade(col, -0.25), seed: 130 + i, depth: 2.5 }); });
  let up = '';
  up += piece(R(-26, 0, 52, 78, 18), { fill: col, seed: 133, depth: 3 });
  // braços: lista de [x1,y1,x2,y2]
  (o.armsP || [[-20, 14, 30, 34], [20, 14, 40, 40]]).forEach((a, i) => {
    up += piece(CAP(a[0], a[1], a[2], a[3], 16), { fill: shade(col, -0.08), seed: 135 + i, depth: 2.5 });
    up += piece(E(a[2], a[3], 9), { fill: skin, seed: 137 + i, depth: 2 });
  });
  up += piece(E(0, -30, 30, 30), { fill: skin, seed: 139, depth: 3 });
  up += `<circle cx="${8 + (o.lookX || 0)}" cy="-32" r="4.5" fill="${C.ink}"/><circle cx="${22 + (o.lookX || 0)}" cy="-32" r="4.5" fill="${C.ink}"/>`;
  up += o.face || line('M6 -16Q15 -10 24 -16', C.ink, 3.5);
  if (o.hairCol) up += piece('M-30 -36C-30 -62 -10 -66 4 -64C22 -64 32 -52 30 -40C16 -50 -4 -50 -30 -36Z', { fill: o.hairCol, seed: 141 });
  s += g(`rotate(${-k} 0 70)`, up);
  return g(`translate(${o.x} ${o.y}) scale(${o.s || 1}) ${o.flip ? 'scale(-1 1)' : ''} rotate(${o.rot || 0} 0 130)`, s);
}

// ---------- personagens do vídeo ----------
const ELA = { skin: SKIN.a, hair: 'bob', hairCol: '#6B3B2A', top: C.coral, pants: '#4A5D9E', shoes: '#3A2E2E', bow: C.mustard, seed: 201 };
const PEDRO = { skin: SKIN.b, hair: 'curly', hairCol: '#2C211D', top: C.blue, pants: '#33405F', shoes: '#2A2A2A', seed: 202,
  collar: piece('M-34 6Q0 40 34 6L24 2Q0 24 -24 2Z', { fill: '#FFFFFF', seed: 203, depth: 2 }) };
const FREUD = { skin: SKIN.c, hair: 'freud', hairCol: '#D6D6D2', top: '#3F3D52', seed: 204, beard: '#EEEBE4', glasses: true,
  brows: 'normal', browCol: '#B9B7B0', browW: 7, blush: false,
  collar: piece('M-36 2L0 70L36 2Q0 22 -36 2Z', { fill: '#FFFFFF', seed: 205, depth: 2 }) + piece('M-9 26L9 26L13 92L0 108L-13 92Z', { fill: C.coral, seed: 206, depth: 2 }) +
    piece('M-58 2L-6 96L-30 60L-52 56Z', { fill: '#504E66', seed: 207, depth: 2 }) + piece('M58 2L6 96L30 60L52 56Z', { fill: '#504E66', seed: 208, depth: 2 }) };

// posição da mão (coordenadas do palco) para encaixar objetos segurados
function personHand(o, side) {
  const a = o.arms && o.arms !== 'crossed' ? (side < 0 ? o.arms.l : o.arms.r) : [12, -18];
  const d1 = limbDir(a[0], side), d2 = limbDir(a[0] + a[1], side);
  let x = side * 72 + d1[0] * 80 + d2[0] * 74;
  let y = 26 + d1[1] * 80 + d2[1] * 74;
  if (o.lean) {
    const r = (o.lean * Math.PI) / 180, cx = 0, cy = 200;
    const dx = x - cx, dy = y - cy;
    x = cx + dx * Math.cos(r) - dy * Math.sin(r);
    y = cy + dx * Math.sin(r) + dy * Math.cos(r);
  }
  const s = o.s || 1;
  return [(o.x || 0) + x * s, (o.y || 0) + y * s];
}
