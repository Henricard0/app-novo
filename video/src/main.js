// Monta a linha do tempo, desenha o quadro do tempo T, legendas e transições.

const DEFS = `<defs>
<filter id="shadow" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="9" stdDeviation="8" flood-color="#4a3420" flood-opacity=".26"/></filter>
<filter id="shadowL" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="18" stdDeviation="16" flood-color="#4a3420" flood-opacity=".34"/></filter>
<filter id="sheet" x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="0" dy="0" stdDeviation="22" flood-color="#2a1a0a" flood-opacity=".4"/></filter>
</defs>`;

const params = new URLSearchParams(location.search);
let SHOW_CAPTIONS = params.get('captions') !== '0';

function captionWeight(t) {
  const plain = t.replace(/\*/g, '').trim();
  let w = plain.replace(/\s/g, '').length + 4;
  const last = plain.slice(-1);
  if (/[.?!]/.test(last)) w += 8;
  else if (last === ':') w += 6;
  else if (last === ',') w += 4;
  return w;
}

function computeTimeline(tl) {
  let t = 0;
  const scenes = [];
  for (const sc of tl.scenes) {
    const dur = sc.dur, breath = tl.breath;
    const w0 = sc.lead != null ? sc.lead : 0.15, w1 = dur - breath;
    const weights = sc.captions.map((c) => captionWeight(c.t));
    const total = weights.reduce((a, b) => a + b, 0);
    let acc = 0;
    const cues = {}, captions = [];
    sc.captions.forEach((c, i) => {
      const st = c.start != null ? c.start : w0 + (w1 - w0) * (acc / total);
      acc += weights[i];
      captions.push({ start: st, text: c.t, id: c.id, i });
      if (c.id) cues[c.id] = st;
    });
    captions.forEach((c, i) => { c.end = sc.captions[i].end != null ? sc.captions[i].end : (i < captions.length - 1 ? captions[i + 1].start : dur); });
    scenes.push({ id: sc.id, start: t, end: t + dur, dur, breath, cues, captions });
    t += dur;
  }
  return { scenes, total: t, fps: tl.fps };
}

const TLC = computeTimeline(window.TIMELINE);

function ctxFor(sc) {
  return {
    dur: sc.dur,
    breath: sc.breath,
    end: sc.dur - sc.breath,
    cue: (id) => {
      if (!(id in sc.cues)) throw new Error('cue não encontrada: ' + sc.id + '.' + id);
      return sc.cues[id];
    },
    captions: sc.captions,
  };
}

function drawScene(i, t) {
  const sc = TLC.scenes[i];
  return SCENES[sc.id].draw(Math.max(0, t), ctxFor(sc));
}

const TRANS = 0.62;
function compose(T) {
  let i = TLC.scenes.findIndex((s) => T >= s.start && T < s.end);
  if (i < 0) i = TLC.scenes.length - 1;
  const sc = TLC.scenes[i];
  const t = T - sc.start;
  const cur = drawScene(i, t);
  const kind = SCENES[sc.id].enter;
  if (i === 0 || !kind || t >= TRANS) return cur;
  const prevSc = TLC.scenes[i - 1];
  const prev = drawScene(i - 1, prevSc.dur - 1 / 30);
  const p = t / TRANS;
  if (kind === 'peelLeft') {
    const e = ease.in(p) * 0.25 + ease.inOut(p) * 0.75;
    return cur + `<g filter="url(#sheet)" transform="translate(${-e * 1300} ${e * 140}) rotate(${-e * 10} 1080 1920)">${prev}</g>`;
  }
  if (kind === 'peelUp') {
    const e = ease.inOut(p);
    return cur + `<g filter="url(#sheet)" transform="translate(${e * 120} ${-e * 2100}) rotate(${e * 6} 0 0)">${prev}</g>`;
  }
  if (kind === 'slideUp') {
    const e = ease.out(p);
    return prev + `<g filter="url(#sheet)" transform="translate(0 ${(1 - e) * 2050}) rotate(${(1 - e) * -5} 540 1920)">${cur}</g>`;
  }
  if (kind === 'slideLeft') {
    const e = ease.out(p);
    return prev + `<g filter="url(#sheet)" transform="translate(${(1 - e) * 1250} ${(1 - e) * 60}) rotate(${(1 - e) * 6} 0 1920)">${cur}</g>`;
  }
  return cur;
}

// fundo de papel com borda irregular (aparece nas transições)
function sheetBg(col, seed = 1) {
  return piece(R(-14, -14, 1108, 1948, 0), { fill: col, seed, amp: 4, step: 40, depth: 0, rim: false });
}

function captionHTML(str) {
  return esc(str).replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

let _lastCapKey = '';
function renderCaption(T) {
  const el = document.getElementById('cap');
  if (!SHOW_CAPTIONS) { el.innerHTML = ''; return; }
  let i = TLC.scenes.findIndex((s) => T >= s.start && T < s.end);
  if (i < 0) i = TLC.scenes.length - 1;
  const sc = TLC.scenes[i];
  const t = T - sc.start;
  const c = sc.captions.find((c) => t >= c.start && t < c.end);
  if (!c) { el.innerHTML = ''; _lastCapKey = ''; return; }
  const key = sc.id + c.i;
  const h = captionHTML(c.text);
  if (key !== _lastCapKey) {
    el.innerHTML = `<div class="box"><div class="shadow"><span>${h}</span></div><div class="layer"><span class="bg">${h}</span></div><div class="layer top"><span class="fg">${h}</span></div></div>`;
    _lastCapKey = key;
  }
  const first = sc.start + c.start <= 0;
  const k = first ? 1 : ease.outBack(prog(t, c.start, c.start + 0.2));
  const rot = (c.i % 2 ? 1 : -1) * 1.2;
  const box = el.firstChild;
  box.style.transform = `scale(${0.6 + 0.4 * k}) rotate(${rot}deg)`;
  box.style.opacity = first ? '1' : Math.min(1, prog(t, c.start - 0.03, c.start + 0.06)).toFixed(2);
}

function renderFrame(T) {
  document.getElementById('svg').innerHTML = DEFS + compose(T);
  renderCaption(T);
  const [bx, by] = boil(T, 22, 5);
  document.getElementById('grain').style.transform = `translate(${bx.toFixed(0)}px, ${by.toFixed(0)}px)`;
}

function getSfx() {
  const out = [];
  TLC.scenes.forEach((sc) => {
    const list = SCENES[sc.id].sfx ? SCENES[sc.id].sfx(ctxFor(sc)) : [];
    list.forEach((e) => out.push({ ...e, t: +(sc.start + e.t).toFixed(3) }));
    if (SCENES[sc.id].enter && sc.start > 0) out.push({ t: +(sc.start + 0.02).toFixed(3), name: 'swoosh', gain: 0.9 });
  });
  return out.sort((a, b) => a.t - b.t);
}

function getSrt() {
  const fmt = (s) => {
    const ms = Math.round(s * 1000);
    const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), sec = Math.floor((ms % 60000) / 1000), r = ms % 1000;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(r).padStart(3, '0')}`;
  };
  let n = 1, out = '';
  TLC.scenes.forEach((sc) => sc.captions.forEach((c) => {
    out += `${n++}\n${fmt(sc.start + c.start)} --> ${fmt(sc.start + c.end)}\n${c.text.replace(/\*/g, '')}\n\n`;
  }));
  return out;
}

window.renderFrame = renderFrame;
window.getSfx = getSfx;
window.getSrt = getSrt;
window.TLC = TLC;
window.setCaptions = (v) => { SHOW_CAPTIONS = v; _lastCapKey = ''; };
// abrir index.html?t=12.5 no navegador mostra aquele instante
window.READY = document.fonts.ready.then(() => { renderFrame(parseFloat(params.get('t') || '0')); return true; });
