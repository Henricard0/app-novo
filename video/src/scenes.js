// As 6 cenas do roteiro. Cada cena: draw(t, ctx) -> svg, sfx(ctx) -> eventos de som, enter -> transição.
// ctx.cue('id') devolve o início (em s, relativo à cena) da legenda com aquele id,
// então as animações acompanham as legendas (e a narração, quando sincronizada).

const SCENES = {};

// ======================= SALA (cenas 1 e 5) =======================
// o sofá e o casal são desenhados em coordenadas "originais" e ampliados por ROOM_Z
const ROOM_Z = 1.14;
// converte um ponto das coordenadas do sofá para o palco
const roomPt = (x, y) => [540 + (x - 540) * ROOM_Z, 1135 + (y - 1135) * ROOM_Z];
function livingRoom(t, ela, pedro, extraBehind = '', extraFront = '') {
  let s = sheetBg('#FFE2B4', 11);
  for (let i = 0; i < 10; i++) s += `<rect x="${i * 120 + 34}" y="0" width="46" height="1130" fill="#FFF1D2" opacity=".6"/>`;
  s += piece(R(-20, 1128, 1120, 830, 0), { fill: '#EDBE90', seed: 12, depth: 0, amp: 3, step: 30 });
  for (let i = 0; i < 6; i++) s += line(`M-20 ${1250 + i * 125}H1100`, '#DFAA7B', 4);
  s += piece(R(-20, 1108, 1120, 30, 0), { fill: '#FFFFFF', seed: 14, depth: 3, amp: 2, step: 30 });
  s += windowFrame(735, 245, 225, 250, t);
  s += pictureFrame(120, 262, 210, 160);
  s += lamp(1000, 1118);
  s += plant(84, 1008, t, 0.9);
  s += piece(E(540, 1222, 480, 70), { fill: C.salmon, seed: 13, inner: `<ellipse cx="540" cy="1222" rx="430" ry="52" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="5" stroke-dasharray="14 12"/>` });
  s += extraBehind;
  const sf = sofa(540, 1000, 850, C.teal, { seed: 320 });
  s += g(scaleAt(ROOM_Z, 540, 1135), shadow(sf.back + person(ela) + person(pedro) + sf.front) + extraFront);
  return s;
}

// ======================= CENA 1 — GANCHO =======================
SCENES.gancho = {
  enter: null,
  beats() { return { turn: 0.1, bubble: 0.4, freeze: 0.95, circ1: 1.3, circ2: 1.75, sweat: 2.3 }; },
  draw(t, x) {
    const B = this.beats();
    const tf = Math.min(t, B.freeze);
    const frozen = t >= B.freeze;
    const turn = ease.inOut(prog(tf, B.turn, B.turn + 0.28));
    const talking = tf >= B.bubble;
    const ela = {
      ...ELA, x: 385, y: 800, sitting: true,
      faceShift: 12 * turn, headRot: 8 * turn + sway(tf, 1.2, 0.5), lean: 4 * turn,
      eyes: talking ? 'happy' : 'open', look: [4 * turn, 0], mouth: talking ? 'big' : 'smile', brows: 'normal',
      arms: { l: [10, -50], r: [10 + 18 * turn, -50 - 28 * turn] },
    };
    const pedro = {
      ...PEDRO, x: 695, y: 800, sitting: true, faceShift: -8, headRot: -3 + sway(tf, 1.2, 0.45, 1),
      eyes: frozen ? 'wide' : 'open', look: [-6, 0], mouth: frozen ? 'flat' : 'smile', brows: frozen ? 'up' : 'normal',
      arms: { l: [10, -50], r: [10, -50] }, chest: g('translate(0 64)', nameTag('Pedro')),
    };
    // corações que sobem e congelam no ar
    let hearts = '';
    [[480, 0.15, 0.9], [560, 0.32, 0.7]].forEach(([hx, t0, sc], i) => {
      if (tf > t0) {
        const p = tf - t0;
        hearts += heart(hx + Math.sin(p * 5 + i) * 14, 640 - p * 190, sc * Math.min(1, p * 5), i ? C.pink : C.coral, 500 + i);
      }
    });
    // balão
    // balão (coordenadas da sala, antes da ampliação ROOM_Z)
    const bx = 128, by = 402, bw = 510, bh = 132;
    const size = 56;
    const pre = 'Te amo, ', nm = 'Lucas!';
    const wPre = measure(pre, size), wNm = measure(nm, size);
    const tx0 = bx + bw / 2 - (wPre + wNm) / 2;
    const lucasCx = tx0 + wPre + wNm / 2, lucasCy = by + bh / 2 + 2;
    const bub = bubble(bx, by, bw, bh, [424, 598], 396, [{ t: pre }, { t: nm, c: C.coral }], { size, r: 40 });
    let front = hearts + popIn(t, B.bubble, 396, 540, shadow(bub), 0.3);
    front += markerCircle(lucasCx, lucasCy, wNm / 2 + 20, 44, prog(t, B.circ1, B.circ1 + 0.35));
    front += markerCircle(695, 864, 104, 66, prog(t, B.circ2, B.circ2 + 0.35));
    front += shockLines(695, 712, 112, ease.out(prog(t, B.freeze, B.freeze + 0.18)));
    front += popIn(t, B.sweat, 792, 650, sweat(792, 650, 1.3), 0.3);
    // câmera: empurrãozinho depois do congelamento
    const z = 1 + 0.07 * ease.out(prog(t, B.freeze, B.freeze + 0.22)) + 0.03 * prog(t, B.freeze + 0.22, x.dur);
    let s = g(scaleAt(z, 560, 760), livingRoom(tf, ela, pedro, '', front));
    if (frozen) {
      s += `<rect width="1080" height="1920" fill="#5C7FD6" opacity="0.08"/>`;
      const fl = 1 - prog(t, B.freeze, B.freeze + 0.12);
      if (fl > 0) s += `<rect width="1080" height="1920" fill="#fff" opacity="${(fl * 0.45).toFixed(2)}"/>`;
    }
    return s;
  },
  sfx(x) {
    const B = this.beats();
    return [
      { t: 0, name: 'music_start' },
      { t: B.bubble, name: 'pop' },
      { t: B.freeze, name: 'music_stop' },
      { t: B.freeze - 0.03, name: 'scratch' },
      { t: B.circ1, name: 'marker' },
      { t: B.circ2, name: 'marker' },
      { t: B.sweat, name: 'popSmall', gain: 0.6 },
    ];
  },
};

// ======================= CENA 2 — FREUD =======================
SCENES.apresentacao = {
  enter: 'peelLeft',
  draw(t, x) {
    const rise = ease.outBack(prog(t, 0.28, 0.85));
    const tSign = x.cue('atofalho') - 0.25;
    const tq = x.cue('quasenunca'), td = x.cue('distracao');
    const shakeK = t > td && t < td + 1.0 ? Math.sin((t - td) * 17) * 7 * (1 - prog(t, td, td + 1.0)) : 0;
    const blink = (t > 2.05 && t < 2.17) || (t > 4.4 && t < 4.52);
    let s = sheetBg('#CDEBDC', 21);
    // papel de parede com losangos
    let wp = '';
    for (let yy = 80; yy < 1060; yy += 120) for (let xx = (yy / 120) % 2 ? 60 : 0; xx < 1100; xx += 120) wp += `<path d="M${xx} ${yy - 14}L${xx + 14} ${yy}L${xx} ${yy + 14}L${xx - 14} ${yy}Z" fill="#E4F5EC"/>`;
    s += wp;
    s += shelf(806, 300, 250, 840);
    s += pictureFrame(60, 760, 170, 130, C.coral);
    const fy = 905 + (1 - rise) * 800;
    const fr = {
      ...FREUD, x: 600, y: fy, s: 1.5, legs: false,
      headRot: sway(t, 1.5, 0.4) + shakeK, eyes: blink ? 'closed' : 'open', look: [-2, 0],
      brows: t > tq ? 'skeptic' : 'normal',
      arms: { l: [150, 15], r: [16, -46] },
      extraHead: cigar(14, 46, 10),
    };
    const hand = personHand(fr, -1);
    const sx = hand[0] - 6, sTopY = hand[1] - 150;
    const sp = popS(t, tSign, 0.4);
    let signSvg = '';
    if (sp > 0.001) signSvg = g(scaleAt(sp, hand[0], hand[1]) + ` rotate(${-4 + sway(t, 1.5, 0.5)} ${hand[0]} ${hand[1]})`, sign(sx, sTopY - 100, 540, 200, 'ATO FALHO', { stick: 180, size: 88 }));
    s += shadow(signSvg + person(fr));
    // fumaça (posição da ponta do charuto)
    const hr = ((fr.headRot) * Math.PI) / 180;
    const lx = 14 + 62 * Math.cos(0.17), ly = 46 + 62 * Math.sin(0.17) - 96;
    const tipX = fr.x + (lx * Math.cos(hr) - (ly + 8) * Math.sin(hr)) * fr.s;
    const tipY = fr.y + (-8 + lx * Math.sin(hr) + (ly + 8) * Math.cos(hr)) * fr.s;
    if (rise > 0.9) s += smoke(tipX + 4, tipY - 6, t);
    // mesa
    let desk = piece(R(70, 1160, 940, 200, 10), { fill: '#A9713F', seed: 23 });
    desk += piece(R(120, 1192, 380, 90, 8), { fill: '#B98049', seed: 24, depth: 2 }) + piece(R(580, 1192, 380, 90, 8), { fill: '#B98049', seed: 25, depth: 2 });
    desk += `<circle cx="310" cy="1237" r="9" fill="#7A4E2A"/><circle cx="770" cy="1237" r="9" fill="#7A4E2A"/>`;
    desk += piece(R(40, 1120, 1000, 50, 12), { fill: '#C9905B', seed: 22 });
    desk += piece(R(90, 1062, 190, 32, 4), { fill: C.teal, seed: 26 }) + piece(R(102, 1032, 170, 32, 4), { fill: C.mustard, seed: 27 }) + piece(R(86, 1090, 200, 32, 4), { fill: C.coral, seed: 28 });
    desk += piece(R(380, 1040, 360, 84, 8), { fill: C.navy, seed: 29, inner: text(560, 1082, 'Sigmund Freud', { size: 44, fill: '#F6D27A', weight: 600 }) });
    desk += piece(R(830, 1050, 100, 72, 14), { fill: '#FFFFFF', seed: 30 }) + `<path d="M930 1068q30 4 0 34" fill="none" stroke="#fff" stroke-width="10"/>`;
    s += shadow(desk);
    return s;
  },
  sfx(x) {
    return [
      { t: 0.32, name: 'boing' },
      { t: 0.5, name: 'music_start' },
      { t: x.cue('atofalho') - 0.25, name: 'pop' },
      { t: x.cue('distracao'), name: 'rustle', gain: 0.5 },
    ];
  },
};

// ======================= CENA 3 — EXEMPLOS =======================
function cardBase(num, title, col, seed) {
  let s = piece(R(100, 262, 880, 996, 28), { fill: '#FFFDF6', seed, depth: 6, edge: '#DCCDB2' });
  s += piece(R(122, 284, 836, 98, 20), { fill: col, seed: seed + 1, depth: 0 });
  s += piece(E(190, 333, 36), { fill: '#FFFFFF', seed: seed + 2, depth: 3, inner: text(190, 336, num, { size: 46, weight: 700, fill: col }) });
  s += text(250, 336, title, { size: 54, weight: 700, fill: '#FFFFFF', anchor: 'start' });
  return s;
}
function cardFrame(id, bg, content) {
  return `<clipPath id="${id}"><rect x="126" y="398" width="828" height="836" rx="18"/></clipPath>` +
    `<rect x="126" y="398" width="828" height="836" rx="18" fill="${bg}"/>` +
    `<g clip-path="url(#${id})">${content}</g>`;
}
function dealt(t, t0, rot, inner) {
  if (t0 === null) return g(rotAt(rot, 540, 760), inner);
  const p = prog(t, t0, t0 + 0.55);
  const e = ease.outBack(p);
  const dx = (1 - e) * 1250, r = rot + (1 - p) * 26;
  return g(`translate(${dx} ${(1 - p) * -80}) ${rotAt(r, 540, 760)}`, inner);
}

function card1(tc, x) {
  let c = '';
  c += clock(262, 545, 76, 10, 40);
  c += text(262, 660, 'já é tarde!', { size: 34, font: 'hand', fill: C.coral });
  c += calendar(560, 430, 330, 330, tc);
  c += markerCircle(725, 712, 158, 36, prog(tc, x.cue('esquecer') + 0.9, x.cue('esquecer') + 1.3));
  // cama
  const br = 1 + 0.025 * Math.sin(tc * 3.2);
  let bed = piece(R(150, 860, 50, 330, 16), { fill: '#B07A48', seed: 601 });
  bed += piece(R(870, 960, 50, 230, 16), { fill: '#B07A48', seed: 602 });
  bed += piece(R(160, 1070, 750, 74, 20), { fill: '#FFFFFF', seed: 603 });
  bed += piece(E(272, 1040, 98, 38), { fill: '#FFFFFF', seed: 604 });
  bed += g(`translate(282 975) rotate(-12) scale(0.66)`, head({ skin: SKIN.d, hair: 'short', hairCol: '#4B2E22', eyes: 'closed', mouth: 'smile', seed: 605 }));
  bed += g(scaleAt(1, 620, 1100, br), piece('M330 1100C330 1020 380 985 470 990C560 995 640 1000 720 985C820 968 905 1010 905 1100Z', { fill: C.lilac, seed: 606, inner: `<path d="M360 1060Q600 1030 890 1060" fill="none" stroke="#fff" stroke-width="5" stroke-dasharray="16 12" opacity=".7"/>` }));
  c += shadow(bed);
  c += zzz(350, 880, tc);
  return cardFrame('clip1', '#DCEFFA', c);
}

function card2(tc, x, t2) {
  const tb = 0.75; // balão depois que a carta pousa
  const shocked = tc > tb + 0.55;
  let c = '';
  c += `<rect x="126" y="1130" width="828" height="110" fill="#F7CDBE"/>`;
  c += bunting(170, 910, 432, ['P', 'A', 'R', 'A', 'B', 'É', 'N', 'S'], tc);
  const rnd = mulberry32(9);
  for (let i = 0; i < 16; i++) {
    const cx = 150 + rnd() * 780, cy = 560 + rnd() * 520, col = [C.coral, C.teal, C.mustard, C.blue, C.purple][i % 5];
    c += `<rect x="${cx}" y="${cy + sway(tc, 6, 0.5, i)}" width="14" height="24" rx="3" fill="${col}" transform="rotate(${rnd() * 180 + tc * 40} ${cx} ${cy})" opacity=".85"/>`;
  }
  const giver = {
    skin: SKIN.a, hair: 'short', hairCol: '#8A4B2B', top: C.leaf, pants: '#4A5D9E', shoes: C.ink, seed: 611,
    x: 320, y: 880, s: 0.8, eyes: shocked ? 'wide' : 'happy', mouth: tc > tb && tc < tb + 0.55 ? 'big' : shocked ? 'awkward' : 'smile', brows: shocked ? 'worried' : 'normal',
    arms: { l: [14, -20], r: [62, 18] }, look: [4, 0], faceShift: 8,
  };
  const gh = personHand(giver, 1);
  const recv = {
    skin: SKIN.b, hair: 'long', hairCol: '#2D1E1A', top: C.mustard, pants: '#6B4A8C', shoes: C.ink, seed: 612,
    x: 780, y: 880, s: 0.8, eyes: shocked ? 'wide' : 'happy', mouth: shocked ? 'o' : 'smile', brows: shocked ? 'up' : 'normal',
    arms: shocked ? { l: [32, -150], r: [32, -150] } : { l: [12, -18], r: [12, -18] }, look: [-4, 0], faceShift: -8,
    hat: g('translate(-6 -150) rotate(-8)', piece('M-38 70L38 70L0 -40Z', { fill: C.blue, seed: 613, inner: '<path d="M-24 34L24 34M-12 0L12 0" stroke="#fff" stroke-width="9"/>' }) + piece(E(0, -44, 14), { fill: C.mustard, seed: 614 })),
  };
  c += shadow(person(giver) + person(recv) + g(`translate(${gh[0] + 24} ${gh[1] - 20}) rotate(-6)`, gift(0, 0, 110, 92)));
  if (shocked) c += popIn(tc, tb + 0.55, 392, 770, sweat(392, 770, 1.1), 0.25);
  c += popIn(tc, tb, 330, 700, shadow(bubble(140, 588, 520, 120, [336, 738], 330, [{ t: 'Meus pêsames!', c: C.ink }], { size: 58, seed: 615 })), 0.3);
  return cardFrame('clip2', '#FFE6DA', c);
}

function card3(tc, x) {
  let c = '';
  for (let yy = 430; yy < 1240; yy += 70) for (let xx = (yy / 70) % 2 ? 165 : 130; xx < 960; xx += 70) c += `<circle cx="${xx}" cy="${yy}" r="7" fill="#DCC8EA"/>`;
  c += `<rect x="126" y="1150" width="828" height="90" fill="#C9A98C"/>`;
  const kt0 = 0.7, kt1 = 1.3;
  const landed = tc > kt1;
  c += shadow(portrait(320, 585, tc, landed ? 9 : 0));
  c += line('M700 400L620 470M700 400L780 470', '#8A7A6A', 3) + `<circle cx="700" cy="398" r="7" fill="#8A7A6A"/>`;
  c += shadow(tag(700, 512, 330, 92, 'Casa do sogro', { font: 'hand', size: 52, fill: '#FFF6E0', rot: -3, seed: 621 }));
  // chaves caindo (atrás do sofá)
  if (tc > kt0) {
    const p = prog(tc, kt0, kt1);
    const ky = 300 + ease.in(p) * 640, kr = p * 560;
    c += g('', keys(640, ky, kr));
  }
  const sf = sofa(560, 1085, 700, '#A8708F', { buttons: true, seed: 622 });
  c += shadow(sf.back + sf.front);
  if (landed) {
    const k = popS(tc, kt1, 0.3), fade = 1 - prog(tc, kt1 + 0.5, kt1 + 1.1);
    if (fade > 0) [[600, 800, 0], [680, 790, 1], [645, 765, 2]].forEach(([sx, sy, i]) => {
      c += `<g opacity="${fade.toFixed(2)}">` + g(scaleAt(k, sx, sy), piece(P([[sx, sy - 22], [sx + 6, sy - 6], [sx + 22, sy], [sx + 6, sy + 6], [sx, sy + 22], [sx - 6, sy + 6], [sx - 22, sy], [sx - 6, sy - 6]]), { fill: C.mustard, seed: 630 + i, depth: 2 })) + '</g>';
    });
  }
  return cardFrame('clip3', '#EEE2F6', c);
}

SCENES.exemplos = {
  enter: 'slideUp',
  times(x) { return { t2: x.cue('trocar') - 0.45, t3: x.cue('perder') - 0.45 }; },
  draw(t, x) {
    const { t2, t3 } = this.times(x);
    let s = sheetBg('#F4DDBF', 31);
    let dots = '';
    for (let yy = 40; yy < 1920; yy += 64) for (let xx = (yy / 64) % 2 ? 32 : 0; xx < 1100; xx += 64) dots += `<circle cx="${xx}" cy="${yy}" r="4" fill="#E9CBA3"/>`;
    s += dots;
    const c1 = cardBase('1', 'Esquecer', C.blue, 640);
    const c2 = cardBase('2', 'Trocar palavras', C.coral, 650);
    const c3 = cardBase('3', 'Perder objetos', C.purple, 660);
    const cov2 = t > t2 + 0.55, cov3 = t > t3 + 0.55;
    s += shadow(dealt(t, null, -2.5, c1 + (cov2 ? '' : card1(t, x))), true);
    if (t > t2) s += shadow(dealt(t, t2, 2.2, c2 + (cov3 ? '' : card2(t - t2, x))), true);
    if (t > t3) s += shadow(dealt(t, t3, -1.4, c3 + card3(t - t3, x)), true);
    return s;
  },
  sfx(x) {
    const { t2, t3 } = this.times(x);
    return [
      { t: x.cue('esquecer') + 0.9, name: 'marker' },
      { t: t2, name: 'swoosh', gain: 0.8 },
      { t: t2 + 0.75, name: 'pop' },
      { t: t2 + 1.3, name: 'popSmall', gain: 0.6 },
      { t: t3, name: 'swoosh', gain: 0.8 },
      { t: t3 + 0.7, name: 'fall' },
      { t: t3 + 1.3, name: 'jingle' },
      { t: t3 + 1.32, name: 'ding', gain: 0.5 },
    ];
  },
};

// ======================= CENA 4 — EXPLICAÇÃO =======================
const HEAD_D = 'M300 1220L300 1010C230 960 200 860 205 740C210 520 330 380 520 370C680 362 790 450 805 580C810 620 815 650 830 690L880 770Q885 790 860 795L835 800Q850 815 845 830L825 840Q848 852 842 870Q838 905 815 925C790 950 740 960 700 965L690 1220Z';
const HAIR_D = 'M560 372C380 360 226 470 208 690C200 820 222 930 292 1004L312 980C278 900 268 800 276 700C290 548 380 458 560 444Z';
// janela (abertura da cabeça) em coordenadas da cabeça
const WIN = { x: 292, y: 474, w: 388, h: 422, shelf: 672, r: 64 };
// cabeça: coordenadas próprias -> palco
const HEADT = { x: -200, y: -184, s: 1.12 };
const headToStage = (p) => [HEADT.x + p[0] * HEADT.s, HEADT.y + p[1] * HEADT.s];

function dollAt(o, lx, ly) {
  // converte ponto local do boneco para coordenadas da cena
  const s = o.s || 1, r = ((o.rot || 0) * Math.PI) / 180;
  const k = ((-(o.lean || 0)) * Math.PI) / 180;
  let px = lx, py = ly;
  if (ly < 72) { const dx = px, dy = py - 70; px = dx * Math.cos(k) - dy * Math.sin(k); py = 70 + dx * Math.sin(k) + dy * Math.cos(k); }
  const dx = px, dy = py - 130;
  const qx = dx * Math.cos(r) - dy * Math.sin(r), qy = 130 + dx * Math.sin(r) + dy * Math.cos(r);
  return [o.x + qx * s, o.y + qy * s];
}

// tira de papel com texto, de A até B (texto sempre legível da esquerda pra direita)
function strip(A, B, str, col, seed, size = 30) {
  if (B[0] < A[0]) { const T = A; A = B; B = T; }
  const L = Math.hypot(B[0] - A[0], B[1] - A[1]);
  const ang = (Math.atan2(B[1] - A[1], B[0] - A[0]) * 180) / Math.PI;
  const base = 200;
  return g(`translate(${(A[0] + B[0]) / 2} ${(A[1] + B[1]) / 2}) rotate(${ang})`,
    g(`scale(${(L / base).toFixed(3)} 1)`, piece(R(-base / 2, -21, base, 42, 6), { fill: col, seed, depth: 4 })) + text(0, 2, str, { size, weight: 700, fill: C.ink, ls: 1 }));
}

SCENES.explicacao = {
  enter: 'slideLeft',
  beats(x) {
    const c = (id) => x.cue(id);
    return {
      open: c('funciona') + 0.1, consc: c('consciente'), incon: c('inconsciente'),
      n1: c('desejos'), n2: c('desejos') + 0.55, n3: c('incomodos'),
      wig: c('guardado'), bot: c('aparecer'), top: c('forcas'), strip: c('disputam'),
      pullTop: c('querdizer'), pullBot: c('outra'), tear: c('ganha') + 0.1,
      card: c('porisso') + 0.1, flip: c('mensagem'), book: c('ano') - 0.2, stamp: c('ano') + 0.3,
    };
  },
  draw(t, x) {
    const B = this.beats(x);
    const W = WIN;
    let s = sheetBg('#CFE8F6', 41);
    s += piece(E(450, 720, 470, 470), { fill: '#E2F2FB', seed: 42, depth: 0, amp: 3 });
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.3;
      s += piece(E(450 + Math.cos(a) * 540, 720 + Math.sin(a) * 580 + sway(t, 8, 0.2, i), 10 + (i % 3) * 5), { fill: ['#FFFFFF', C.mustard, C.pink][i % 3], seed: 43 + i, depth: 2 });
    }
    const intro = ease.outBack(prog(t, 0.25, 0.85));
    // ---------- cabeça (coordenadas da cabeça) ----------
    let h = '';
    h += piece(HEAD_D, { fill: '#F7C3A3', seed: 44, depth: 6, amp: 2.2 });
    h += piece(HAIR_D, { fill: '#6B3B2A', seed: 49, depth: 4 });
    h += `<circle cx="752" cy="606" r="13" fill="${C.ink}"/><circle cx="756" cy="601" r="4" fill="#fff"/>`;
    h += line('M724 572Q750 556 778 566', C.ink, 7);
    h += `<ellipse cx="742" cy="700" rx="24" ry="13" fill="#F27C8E" opacity=".45"/>`;
    h += line('M826 838Q836 842 846 836', C.ink, 4);
    const openP = ease.outBack(prog(t, B.open, B.open + 0.5));
    const consc = prog(t, B.consc, B.consc + 0.3), incon = prog(t, B.incon, B.incon + 0.3);
    // moldura de papelão da abertura
    h += piece(R(W.x - 14, W.y - 14, W.w + 28, W.h + 28, W.r + 10), { fill: '#C99A62', seed: 45, depth: 4, edge: '#9C7040' });
    let inn = '';
    inn += `<rect x="${W.x}" y="${W.y}" width="${W.w}" height="${W.shelf - W.y + 10}" fill="${mix('#E9D3AE', '#FFF4D2', consc)}"/>`;
    inn += `<rect x="${W.x}" y="${W.shelf + 10}" width="${W.w}" height="${W.y + W.h - W.shelf}" fill="${mix('#B48B5E', '#5B4D8E', incon)}"/>`;
    for (let i = 0; i < 7; i++) inn += `<path d="M${W.x + 30 + i * 56} ${W.shelf + 26}V${W.y + W.h}" stroke="#000" stroke-opacity=".06" stroke-width="18"/>`;
    inn += popIn(t, B.consc, 418, 512, tag(418, 512, 236, 46, 'CONSCIENTE', { fill: C.mustard, color: C.ink, size: 28, weight: 700, seed: 46, rot: -2 }));
    inn += popIn(t, B.incon, 428, 720, tag(428, 720, 262, 46, 'INCONSCIENTE', { fill: C.purple, color: '#FFFFFF', size: 28, weight: 700, seed: 47, rot: 2 }));
    if (consc > 0) inn += popIn(t, B.consc + 0.2, 626, 548, piece(E(626, 540, 24, 28), { fill: '#FFE27A', seed: 48 }) + piece(R(615, 564, 22, 18, 4), { fill: C.grey, seed: 58 }) + line('M626 496V482M594 508L584 498M658 508L668 498', '#F5B83D', 5));
    // papeizinhos guardados no inconsciente
    const wigA = t > B.wig ? Math.sin((t - B.wig) * 14) * 7 * Math.max(0.35, 1 - prog(t, B.wig, B.wig + 1.6)) : 0;
    const crumbs = [[318, 878, -14, C.pink], [652, 880, 18, C.leaf], [610, 770, -6, '#FFFFFF'], [400, 884, 8, C.sky]];
    crumbs.forEach((cb, i) => {
      if (incon > 0) inn += popIn(t, B.incon + 0.1 + i * 0.06, cb[0], cb[1], g(rotAt(cb[2] + wigA * (i % 2 ? 1 : -1), cb[0], cb[1]), piece(R(cb[0] - 22, cb[1] - 16, 44, 32, 4), { fill: cb[3], seed: 50 + i, depth: 2 })), 0.25);
    });
    const notes = [[B.n1, 560, 800, -7, 'desejos', C.pink], [B.n2, 584, 846, 5, 'lembranças', C.sky], [B.n3, 488, 876, -3, 'incômodos', C.mustard]];
    notes.forEach((n, i) => {
      const w = measure(n[4], 27) + 30;
      const jig = wigA * (i % 2 ? -1 : 1);
      inn += popIn(t, n[0], n[1], n[2], g(rotAt(n[3] + jig, n[1], n[2]), tag(n[1], n[2], w, 42, n[4], { fill: n[5], size: 27, weight: 600, seed: 55 + i })), 0.3);
    });
    // ---------- cabo de guerra ----------
    let pull = 0; // + = consciente puxando, - = inconsciente puxando
    if (t > B.pullTop && t < B.pullBot) pull = ease.inOut(prog(t, B.pullTop, B.pullTop + 0.35));
    if (t >= B.pullBot) pull = 1 - 2 * ease.inOut(prog(t, B.pullBot, B.pullBot + 0.35));
    const tug = t > B.strip && t < B.tear;
    const jitter = tug ? Math.sin(t * 26) * 3 : 0;
    const torn = t >= B.tear;
    const tp = prog(t, B.tear, B.tear + 0.45);
    const DS = 0.7;
    const topDoll = {
      x: 372 - pull * 8 + (torn ? 40 * ease.out(tp) : 0), y: W.shelf - 130 * DS, s: DS, col: C.blue, hairCol: '#2C211D',
      lean: torn ? 0 : 16 + pull * 6, rot: torn ? -72 * ease.out(tp) : 0,
      armsP: [[-12, 18, 44, 30], [12, 18, 52, 38]], face: torn ? `<ellipse cx="15" cy="-14" rx="6" ry="8" fill="${C.ink}"/>` : line('M6 -16L24 -16', C.ink, 3.5),
      legs: [[-10, 72, -40, 130], [12, 72, 22, 130]],
    };
    const hop = torn ? Math.abs(Math.sin(tp * Math.PI * 2)) * 30 * (1 - tp * 0.5) : 0;
    const botDoll = {
      x: 372 + Math.min(0, pull) * 8, y: W.y + W.h - 12 - 130 * DS - hop, s: DS, col: C.coral, hairCol: '#7A3B1E',
      lean: torn ? -2 : 16 - pull * 6,
      armsP: torn ? [[-12, 16, -26, -30], [12, 16, 34, -32]] : [[-12, 18, 44, 30], [12, 18, 52, 38]],
      face: torn ? `<path d="M4 -18Q15 -4 26 -18Z" fill="${C.ink}"/>` : line('M6 -16L24 -16', C.ink, 3.5),
      legs: [[-10, 72, -40, 130], [12, 72, 22, 130]],
    };
    const S = [646 + jitter * 0.5, W.shelf + 10 - pull * 34 + jitter];
    const aTop = dollAt(topDoll, 48, 34), aBot = dollAt(botDoll, 48, 34);
    let tugSvg = '';
    if (t > B.bot) tugSvg += popIn(t, B.bot, botDoll.x, botDoll.y + 60, doll(botDoll), 0.35);
    if (t > B.top) tugSvg += popIn(t, B.top, topDoll.x, topDoll.y + 60, doll(topDoll), 0.35);
    if (t > B.strip && !torn) {
      const sp = popS(t, B.strip, 0.3);
      tugSvg += g(scaleAt(sp, S[0], S[1]), strip(aTop, S, 'PEDRO', '#FFFFFF', 70) + strip(aBot, S, 'LUCAS', '#FFFFFF', 71));
      tugSvg += piece(E(aTop[0], aTop[1], 8), { fill: SKIN.c, seed: 72, depth: 2 }) + piece(E(aBot[0], aBot[1], 8), { fill: SKIN.c, seed: 73, depth: 2 });
    }
    let flying = '';
    if (torn) {
      // toco "PEDRO" fica na mão do boneco que caiu
      tugSvg += strip(aTop, [aTop[0] + 120, aTop[1] + 26 - 60 * ease.out(tp)], 'PEDRO', '#FFFFFF', 74, 26);
      // pedaço "LUCAS" voa até a boca (fora do recorte da janela)
      const fp = ease.inOut(prog(t, B.tear, B.tear + 0.32));
      if (fp < 1) {
        const px = S[0] + (836 - S[0]) * fp, py = S[1] + 40 + (838 - S[1] - 40) * fp - Math.sin(fp * Math.PI) * 50;
        flying += g(`translate(${px} ${py}) rotate(${-20 + fp * 20}) scale(${1 - fp * 0.6})`, strip([-85, 0], [85, 0], 'LUCAS', '#FFFFFF', 75));
      }
      const bp = prog(t, B.tear, B.tear + 0.8);
      if (bp < 1) for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        const bx = S[0] + Math.cos(a) * 80 * ease.out(bp), by = S[1] + Math.sin(a) * 64 * ease.out(bp) + bp * bp * 70;
        flying += `<rect x="${bx - 6}" y="${by - 4}" width="12" height="8" fill="#fff" stroke="#d8cfc0" stroke-width="1.5" transform="rotate(${i * 40 + bp * 300} ${bx} ${by})" opacity="${(1 - bp).toFixed(2)}"/>`;
      }
    }
    inn += tugSvg;
    h += `<clipPath id="winclip"><rect x="${W.x}" y="${W.y}" width="${W.w}" height="${W.h}" rx="${W.r}"/></clipPath>`;
    h += `<g clip-path="url(#winclip)">${inn}</g>`;
    // prateleira entre consciente e inconsciente
    h += piece(R(W.x - 8, W.shelf, W.w + 16, 20, 4), { fill: '#C99A62', seed: 59, depth: 3, edge: '#9C7040' });
    h += flying;
    // tampa: o pedaço da cabeça que abre pra cima como tampa de caixa
    const lid = 1 - 1.2 * openP;
    const lidCol = lid >= 0 ? '#F7C3A3' : '#C99A62';
    const hingeY = W.y - 14;
    if (lid > -0.9) h += g(`translate(0 ${hingeY}) scale(1 ${lid.toFixed(3)}) translate(0 ${-hingeY})`,
      piece(R(W.x - 14, W.y - 14, W.w + 28, W.h + 28, W.r + 10), { fill: lidCol, seed: 80, depth: lid >= 0 ? 0 : 4, edge: '#9C7040',
        inner: lid >= 0 ? `<rect x="${W.x - 2}" y="${W.y - 2}" width="${W.w + 4}" height="${W.h + 4}" rx="${W.r + 4}" fill="none" stroke="#D9967A" stroke-width="5" stroke-dasharray="18 12"/>` : '' }));
    s += shadow(g(`translate(${HEADT.x} ${HEADT.y + (1 - intro) * 900}) scale(${HEADT.s})`, h), true);
    // ---------- fora da cabeça (coordenadas do palco) ----------
    if (torn) {
      const bt = B.tear + 0.3;
      const fade = 1 - prog(t, B.card - 0.2, B.card + 0.1);
      const m = headToStage([836, 838]);
      if (fade > 0) s += `<g opacity="${fade.toFixed(2)}">` + popIn(t, bt, m[0] + 20, m[1], shadow(bubble(m[0] + 34, m[1] - 150, 270, 124, [m[0] + 8, m[1] - 4], m[0] + 70, [{ t: 'Lucas!', c: C.coral }], { size: 64, seed: 81 })), 0.3) + '</g>';
    }
    if (t > B.card) {
      const cy = tween(t, B.card, B.card + 0.45, 760, 1110, ease.outBounce);
      const fp = prog(t, B.flip, B.flip + 0.4);
      const sx = Math.abs(Math.cos(fp * Math.PI));
      const back = fp > 0.5;
      const cw = 520, ch = 164;
      const face = back
        ? piece(R(-cw / 2, -ch / 2, cw, ch, 18), { fill: C.teal, seed: 82, depth: 5, inner: text(44, 2, 'MENSAGEM', { size: 60, weight: 700, fill: '#FFFFFF', ls: 2 }) + piece(R(-cw / 2 + 28, -28, 68, 50, 6), { fill: '#FFFFFF', seed: 83, depth: 2, inner: line(`M${-cw / 2 + 30} -24L${-cw / 2 + 62} 2L${-cw / 2 + 94} -24`, C.teal, 4) }) })
        : piece(R(-cw / 2, -ch / 2, cw, ch, 18), { fill: '#FFFFFF', seed: 84, depth: 5, inner: text(0, 2, 'FALHA', { size: 76, weight: 700, fill: C.coral, ls: 4 }) });
      s += shadow(g(`translate(${440 - (t > B.book ? ease.inOut(prog(t, B.book, B.book + 0.5)) * 60 : 0)} ${cy}) rotate(-3) scale(${sx.toFixed(3)} 1)`, face), true);
    }
    if (t > B.book) {
      const p = ease.outBack(prog(t, B.book, B.book + 0.55));
      s += shadow(g(`translate(${(1 - p) * 700} 0) ${rotAt(7, 850, 960)}`, book(850, 960, 280, 380)), true);
      s += popIn(t, B.stamp, 730, 1110, stamp(730, 1110, 66, '1901', C.navy), 0.3);
    }
    return s;
  },
  sfx(x) {
    const B = this.beats(x);
    return [
      { t: B.open, name: 'flap' },
      { t: B.consc, name: 'pop' }, { t: B.incon, name: 'pop' },
      { t: B.n1, name: 'popSmall' }, { t: B.n2, name: 'popSmall' }, { t: B.n3, name: 'popSmall' },
      { t: B.wig, name: 'rustle', gain: 0.7 },
      { t: B.bot, name: 'pop' }, { t: B.top, name: 'pop' }, { t: B.strip, name: 'popSmall' },
      { t: B.pullTop, name: 'stretch' }, { t: B.pullBot, name: 'stretch' },
      { t: B.tear, name: 'tear' }, { t: B.tear + 0.3, name: 'pop' },
      { t: B.card, name: 'drop' }, { t: B.flip, name: 'flip' },
      { t: B.book, name: 'swoosh', gain: 0.7 }, { t: B.stamp, name: 'thud' },
    ];
  },
};

// ======================= CENA 5 — EQUILÍBRIO =======================
SCENES.equilibrio = {
  enter: 'peelUp',
  draw(t, x) {
    const tn = x.cue('nemtodo') + 0.1, tq = x.cue('pergunta') + 0.15;
    const k = ease.outBack(prog(t, tn, tn + 0.3));
    const posed = t > tn;
    const ela = {
      ...ELA, x: 385, y: 800, sitting: true,
      faceShift: posed ? 6 : 4, headRot: posed ? -6 * k + sway(t, 1, 0.5) : sway(t, 1.2, 0.5), headY: posed ? 8 * k : 0,
      eyes: posed ? 'open' : 'open', look: posed ? [-5, -5] : [4, 0], mouth: posed ? 'awkward' : 'smile', brows: posed ? 'worried' : 'normal',
      arms: posed ? { l: [10 + 30 * k, -50 + 150 * k], r: [10 + 30 * k, -50 + 150 * k] } : { l: [10, -50], r: [10, -50] },
    };
    const pedro = {
      ...PEDRO, x: 695, y: 800, sitting: true, faceShift: -10, headRot: posed ? 4 : -3 + sway(t, 1, 0.45, 1), lean: posed ? -3 * k : 0,
      eyes: posed ? 'squint' : 'open', look: [-7, 0], mouth: posed ? 'frown' : 'flat', brows: posed ? 'angry' : 'normal',
      arms: posed ? 'crossed' : { l: [10, -50], r: [10, -50] }, chest: g('translate(0 64)', nameTag('Pedro')),
    };
    let front = '';
    if (posed) front += popIn(t, tn + 0.5, 300, 650, sweat(300, 650, 1.2), 0.25);
    const qs = popS(t, tq, 0.45);
    if (qs > 0) front += g(`rotate(${sway(t, 5, 0.6)} 540 430)`, g(scaleAt(qs, 540, 470), shadow(questionMark(540, 420, 1.6, C.coral), true)));
    return livingRoom(t, ela, pedro, '', front);
  },
  sfx(x) {
    return [
      { t: x.cue('nemtodo') + 0.1, name: 'rustle', gain: 0.6 },
      { t: x.cue('nemtodo') + 0.6, name: 'popSmall', gain: 0.6 },
      { t: x.cue('pergunta') + 0.15, name: 'popBig' },
    ];
  },
};

// ======================= CENA 6 — CTA =======================
SCENES.cta = {
  enter: 'slideUp',
  layout() {
    // palavras recortadas: [texto, tamanho, cor do papel, cor do texto, linha]
    return [
      ['Qual', 84, C.paper, C.ink, 0], ['foi', 84, C.sky, C.ink, 0], ['o', 84, C.mint, C.ink, 0], ['seu', 84, C.pink, C.ink, 0],
      ['ato', 132, C.coral, '#FFFFFF', 1], ['falho', 132, C.navy, '#FFFFFF', 1],
      ['mais', 84, C.mint, C.ink, 2],
      ['constrangedor?', 92, C.paper, C.ink, 3],
    ];
  },
  times() {
    return this.layout().map((_, i) => 0.55 + i * 0.2);
  },
  draw(t, x) {
    let s = sheetBg('#FFD15E', 61);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      s += `<path d="M540 820L${540 + Math.cos(a) * 1400} ${820 + Math.sin(a) * 1400}L${540 + Math.cos(a + 0.2) * 1400} ${820 + Math.sin(a + 0.2) * 1400}Z" fill="#FFDA78" opacity=".55"/>`;
    }
    const L = this.layout(), T = this.times();
    const lineY = [470, 680, 880, 1050];
    const rows = [[], [], [], []];
    L.forEach((w, i) => rows[w[4]].push(i));
    const rnd = mulberry32(31);
    let words = '';
    rows.forEach((row, r) => {
      const ws = row.map((i) => measure(L[i][0], L[i][1], 700) + L[i][1] * 0.55);
      const gap = 18;
      const total = ws.reduce((a, b) => a + b, 0) + gap * (row.length - 1);
      let xx = 540 - total / 2;
      row.forEach((i, j) => {
        const [str, size, bg, fg] = L[i];
        const w = ws[j], h = size * 1.32;
        const cx = xx + w / 2, cy = lineY[r] + (rnd() - 0.5) * 14;
        const rot = (rnd() - 0.5) * 9 + sway(t, 1.2, 0.35, i);
        xx += w + gap;
        const inner = g(rotAt(rot, cx, cy), piece(R(cx - w / 2, cy - h / 2, w, h, 10), { fill: bg, seed: 700 + i, depth: 6, amp: 2.5 }) + text(cx, cy + 3, str, { size, weight: 700, fill: fg }));
        words += popIn(t, T[i], cx, cy, inner, 0.32);
      });
    });
    s += shadow(words, true);
    const th = T[T.length - 1] + 0.45;
    const hw = measure('@henricard__', 58, 600) + 130;
    s += popIn(t, th, 540, 1250, shadow(g(rotAt(-1.5, 540, 1250), piece(R(540 - hw / 2, 1205, hw, 92, 46), { fill: '#FFFFFF', seed: 760, depth: 5 }) +
      piece(bubblePath(540 - hw / 2 + 26, 1224, 62, 46, 16, [540 - hw / 2 + 40, 1282], 540 - hw / 2 + 48, 18), { fill: C.coral, seed: 761, depth: 2 }) +
      text(540 + 34, 1251, '@henricard__', { size: 58, weight: 600, fill: C.ink }))), 0.35);
    return s;
  },
  sfx(x) {
    const T = this.times();
    const ev = T.map((tt, i) => ({ t: tt, name: 'popSmall', gain: 0.75, pitch: 1 + i * 0.06 }));
    ev.push({ t: T[T.length - 1] + 0.45, name: 'ding' });
    ev.push({ t: x.dur - 1.3, name: 'music_end' });
    return ev;
  },
};
