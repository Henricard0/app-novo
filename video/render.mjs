// Renderiza o vídeo quadro a quadro com o Chromium (Playwright) e codifica com ffmpeg.
//
//   node render.mjs --stills 0.5,1.2,3          -> PNGs em out/stills/
//   node render.mjs --video out/base.mp4        -> vídeo sem áudio (com legendas)
//   node render.mjs --video out/x.mp4 --no-captions
//   node render.mjs --meta                      -> out/sfx_events.json e out/legendas.srt
//   opções: --workers 4  --from 10 --to 20 (segundos)  --timeline timeline.narrado.json
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const { chromium } = createRequire(import.meta.url)('playwright');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const flag = (k) => args.includes('--' + k);

// timeline.json -> src/timeline.gen.js (lido pela página)
const TL_FILE = opt('timeline', 'timeline.json');
const tl = JSON.parse(fs.readFileSync(path.join(ROOT, TL_FILE), 'utf8'));
fs.writeFileSync(path.join(ROOT, 'src/timeline.gen.js'), '// gerado por render.mjs a partir de timeline.json\nwindow.TIMELINE = ' + JSON.stringify(tl) + ';\n');
const FPS = tl.fps;
const TOTAL = tl.scenes.reduce((a, s) => a + s.dur, 0);
const captions = !flag('no-captions');

async function openPage(browser) {
  const page = await browser.newPage({ viewport: { width: tl.width, height: tl.height }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('[page error]', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.error('[console]', m.text()); });
  await page.goto('file://' + path.join(ROOT, 'index.html') + '?captions=' + (captions ? 1 : 0));
  await page.evaluate(() => window.READY);
  return page;
}

async function grab(page, T) {
  await page.evaluate((T) => window.renderFrame(T), T);
  return page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: tl.width, height: tl.height } });
}

async function stills(list) {
  const browser = await chromium.launch();
  const page = await openPage(browser);
  const dir = path.join(ROOT, 'out/stills');
  fs.mkdirSync(dir, { recursive: true });
  for (const T of list) {
    const buf = await grab(page, T);
    const f = path.join(dir, `t${T.toFixed(2).padStart(6, '0')}.png`);
    fs.writeFileSync(f, buf);
    console.log(f);
  }
  await browser.close();
}

function ffmpegSegment(file) {
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', String(FPS), file], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg ' + c)))));
  return { ff, done };
}

async function renderRange(f0, f1, file, label) {
  const browser = await chromium.launch();
  const page = await openPage(browser);
  const { ff, done } = ffmpegSegment(file);
  const t0 = Date.now();
  for (let f = f0; f < f1; f++) {
    const buf = await grab(page, f / FPS);
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if ((f - f0) % 150 === 0) console.log(`[${label}] quadro ${f}/${f1} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  }
  ff.stdin.end();
  await done;
  await browser.close();
}

async function video(out) {
  const from = Math.round(parseFloat(opt('from', '0')) * FPS);
  const to = Math.round(parseFloat(opt('to', String(TOTAL))) * FPS);
  const W = parseInt(opt('workers', '4'), 10);
  const tmp = path.join(ROOT, 'out/.seg');
  fs.mkdirSync(tmp, { recursive: true });
  const n = to - from, per = Math.ceil(n / W);
  const segs = [];
  const jobs = [];
  for (let w = 0; w < W; w++) {
    const a = from + w * per, b = Math.min(to, a + per);
    if (a >= b) break;
    const f = path.join(tmp, `seg${w}.mp4`);
    segs.push(f);
    jobs.push(renderRange(a, b, f, 'w' + w));
  }
  const t0 = Date.now();
  await Promise.all(jobs);
  const list = path.join(tmp, 'list.txt');
  fs.writeFileSync(list, segs.map((s) => `file '${s}'`).join('\n'));
  await new Promise((res, rej) => spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', out], { stdio: 'inherit' })
    .on('close', (c) => (c === 0 ? res() : rej(new Error('concat ' + c)))));
  console.log(`ok ${out} (${n} quadros em ${((Date.now() - t0) / 1000).toFixed(0)}s)`);
}

async function meta() {
  const browser = await chromium.launch();
  const page = await openPage(browser);
  const sfx = await page.evaluate(() => window.getSfx());
  const srt = await page.evaluate(() => window.getSrt());
  const scenes = await page.evaluate(() => window.TLC.scenes.map((s) => ({ id: s.id, start: s.start, end: s.end })));
  fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'out/sfx_events.json'), JSON.stringify({ total: TOTAL, scenes, events: sfx }, null, 1));
  fs.writeFileSync(path.join(ROOT, TL_FILE === 'timeline.json' ? 'out/legendas.srt' : 'out/legendas_narrado.srt'), srt);
  console.log('ok meta:', sfx.length, 'eventos de som');
  await browser.close();
}

if (opt('stills')) await stills(opt('stills').split(',').map(Number));
else if (opt('video')) await video(opt('video'));
else if (flag('meta')) await meta();
else console.log('use --stills, --video ou --meta');
