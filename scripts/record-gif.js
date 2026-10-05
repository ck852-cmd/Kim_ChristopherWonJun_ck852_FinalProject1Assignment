#!/usr/bin/env node
/* ==========================================================================
   Gaze Field: record the 10-second GIF teaser
   --------------------------------------------------------------------------
     npm install            once (Puppeteer, driving your installed Chrome)
     npm run record-gif     writes gifs/gaze-field-teaser.gif

   Options
     --seed=N        record this seed instead of searching for one
     --dry           search and report, but record nothing
     --keep-frames   keep the captured PNG frames (in gifs/.frames)
     --verbose       print where each scatter, comet and collision happens

   Needs Google Chrome (or CHROME_PATH pointing at a Chrome/Chromium binary)
   and ffmpeg on the PATH (brew install ffmpeg).

   How it works
   1. Serves this folder on a local port and opens it in headless Chrome at
      1280×720. Math.random is replaced by a seeded generator and the page's
      own animation loop is stopped, so this script steps the simulation
      itself, 60 steps a second: a run with the same seed is the same every
      time.
   2. Skips the opening and arranges the scene: the three largest clumps
      are A and B, on one line across the screen, and C near the top. Other
      clumps on the eye's first sweep, or too close to A, B or C, move to
      open space. Then they all flock for a few seconds, A, B and C held in
      place and the eye blind, so nothing scatters yet.
   3. Moves the cursor along PATH. The eye sweeps A, then pauses, so the
      arrows fade out while A fuses into a comet. It moves on, so they fade
      back in, sweeps B, and turns back along the top past C.
   4. A comet flies the way its fusing cloud drifts and bounces with a small
      random turn, so where the comets meet varies from seed to seed. Seeds
      are dry-run until one shows two scatters, two comets, a collision by
      COLLIDE_BY clear of the edges, and the arrows fading out and back in.
      That seed is recorded, and the recording is checked the same way.
   5. The canvas is captured every third step (20 fps), and ffmpeg builds the
      GIF in two passes (a palette, then the frames through it) at 800 px
      wide. If it comes out over 10 MB, it steps down the width, then the
      frame rate.
   ========================================================================== */

'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawnSync } = require('child_process');
const puppeteer = require('puppeteer-core');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'gifs', 'gaze-field-teaser.gif');
const FRAMES_DIR = path.join(ROOT, 'gifs', '.frames');

const VIEW = { width: 1280, height: 720 }; // captured size; the GIF is scaled down from it
const SECONDS = 10;
const STEP_HZ = 60;           // simulation steps per second, as in the browser
const FPS = 20;               // GIF frames per second (a frame every third step)
const SIZES = [[800, 20], [720, 20], [640, 20], [640, 15]]; // [width, fps], tried in turn to stay under MAX_BYTES
const MAX_BYTES = 10 * 1000 * 1000; // 10 MB, as Finder counts it
const PREWARM = 4;            // seconds the clumps flock before the recording starts
const MAX_SEEDS = 150;        // seeds to try before giving up
const COLLIDE_BY = 8;         // the firework must happen by this second, so its burst and gathering show
const EDGE_MARGIN = 1.2;      // … and this far inside the screen's edges (units), so none of it is cut off

/* The scene, in world units: the screen is about 12.1 × 6.8 units, with
   0,0 at the centre and y pointing down. */
const LINE_Y = 0.55; // the line A and B sit on, along the eye's first sweep
const SCENE = {
  A: [-3.4, LINE_Y],
  B: [-0.4, LINE_Y],
  C: [-2.0, -2.35],
};
// Other clumps are moved out of these (and away from A, B and C), so they
// cannot merge with A or B or get in the way of the first sweep.
const KEEP_CLEAR = [
  { x0: -6.2, x1: 0.8, y0: LINE_Y - 0.8, y1: LINE_Y + 0.8 }, // the sweep along the line
  { cx: 3.6, cy: LINE_Y, r: 1.2 },                            // open space on the right, where comets cross
];
const CAST_CLEARANCE = 0.9; // gap kept between A, B or C and any other clump (units)

/* The cursor's path: [seconds, x, y]. The cursor glides smoothly through
   each point; two points in the same place hold it still. */
const PATH = [
  [0.0, -5.6, LINE_Y],
  [1.0, -3.6, LINE_Y],   // sweep A: it scatters, then fuses into a comet
  [1.4, -3.1, LINE_Y],
  [3.0, -3.1, LINE_Y],   // pause: the arrows fade out
  [3.7, -1.6, LINE_Y],   // move on (they fade back in) and sweep B
  [4.3, 0.2, LINE_Y],
  [5.0, 1.0, -1.0],      // turn up …
  [5.8, 0.0, -2.2],      // … and back along the top, sweeping C
  [6.8, -1.6, -2.4],
  [8.0, -3.6, -1.9],
  [9.0, -4.6, -0.6],
  [10.0, -3.8, 0.9],
];

/* ── The cursor path ──────────────────────────────────────────────────── */

// Smooth through the points (cubic Hermite); still at the ends and at holds.
function cursorAt(t) {
  const n = PATH.length;
  if (t <= PATH[0][0]) return PATH[0].slice(1);
  if (t >= PATH[n - 1][0]) return PATH[n - 1].slice(1);
  let i = 0;
  while (PATH[i + 1][0] < t) i++;
  const [t0, x0, y0] = PATH[i];
  const [t1, x1, y1] = PATH[i + 1];
  const h = t1 - t0;
  const u = (t - t0) / h;
  const [mx0, my0] = tangent(i);
  const [mx1, my1] = tangent(i + 1);
  const h00 = 2 * u ** 3 - 3 * u ** 2 + 1;
  const h10 = u ** 3 - 2 * u ** 2 + u;
  const h01 = -2 * u ** 3 + 3 * u ** 2;
  const h11 = u ** 3 - u ** 2;
  return [
    h00 * x0 + h10 * h * mx0 + h01 * x1 + h11 * h * mx1,
    h00 * y0 + h10 * h * my0 + h01 * y1 + h11 * h * my1,
  ];
}

function tangent(i) {
  const p = PATH[i];
  const a = PATH[i - 1];
  const b = PATH[i + 1];
  const same = (q) => q && q[1] === p[1] && q[2] === p[2];
  if (!a || !b || same(a) || same(b)) return [0, 0];
  return [(b[1] - a[1]) / (b[0] - a[0]), (b[2] - a[2]) / (b[0] - a[0])];
}

// The cursor's position at every step from first to last (flat x, y pairs).
function cursorSteps(first, last) {
  const out = [];
  for (let k = first; k < last; k++) out.push(...cursorAt((k + 1) / STEP_HZ));
  return out;
}

/* ── In the page ──────────────────────────────────────────────────────── */

// Runs before the page's own script: a seeded Math.random, and no animation loop.
function prelude(seed) {
  let s = seed >>> 0;
  Math.random = () => {
    s = (s + 0x6d2b79f5) >>> 0; // mulberry32
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  window.requestAnimationFrame = () => 0;
}

// Skips the opening, arranges the scene, lets the clumps flock and readies the run.
/* global finishIntro, resetSystem, update, render, eye, cursor, state, arrows, P, FLOCK, CONFIG, view */
function setup({ prewarm, scene, keepClear, clearance, start }) {
  const dt = 1 / 60;
  finishIntro();
  resetSystem();
  finishIntro();

  let cast = [];
  const inZone = (x, y, pad) => keepClear.some((z) => (z.r
    ? Math.hypot(x - z.cx, y - z.cy) < z.r + pad
    : x > z.x0 - pad && x < z.x1 + pad && y > z.y0 - pad && y < z.y1 + pad))
    || cast.some((c) => Math.hypot(x - c.x, y - c.y) < c.r + pad + clearance);
  const clumpOf = (members) => {
    let x = 0, y = 0;
    for (const i of members) { x += P.x[i]; y += P.y[i]; }
    x /= members.length;
    y /= members.length;
    let r = 0;
    for (const i of members) r = Math.max(r, Math.hypot(P.x[i] - x, P.y[i] - y));
    return { members, x, y, r };
  };
  const moveTo = (c, x, y) => {
    for (const i of c.members) {
      P.x[i] = P.lx[i] = P.x[i] + x - c.x;
      P.y[i] = P.ly[i] = P.y[i] + y - c.y;
    }
    c.x = x;
    c.y = y;
  };
  // any clump in the eye's way goes to the free spot farthest from the others
  const bw = view.halfW - 0.6;
  const bh = view.halfH - 0.55;
  const clearTheWay = (clumps, fixed) => {
    for (const c of clumps) {
      if (fixed.includes(c) || !inZone(c.x, c.y, c.r)) continue;
      let best = null;
      let bestScore = -Infinity;
      for (let t = 0; t < 80; t++) {
        const x = (Math.random() * 2 - 1) * bw;
        const y = (Math.random() * 2 - 1) * bh;
        let score = Infinity;
        for (const o of clumps) if (o !== c) score = Math.min(score, Math.hypot(x - o.x, y - o.y) - o.r - c.r);
        if (inZone(x, y, c.r)) score -= 10;
        if (score > bestScore) { bestScore = score; best = [x, y]; }
      }
      moveTo(c, ...best);
    }
  };

  // the clumps as seeded (each one's particles share a drift value), largest first
  const seeded = [];
  for (let i = 0, s = 0; i <= P.n; i++) {
    if (i === P.n || P.drift[i] !== P.drift[s]) {
      seeded.push(clumpOf(Array.from({ length: i - s }, (_, k) => s + k)));
      s = i;
    }
  }
  seeded.sort((a, b) => b.members.length - a.members.length);
  // the three largest are A, B and C
  cast = seeded.slice(0, 3);
  cast.forEach((c, k) => moveTo(c, ...scene['ABC'[k]]));
  clearTheWay(seeded, cast);

  // they all flock for a while, A, B and C held in place, the eye blind
  Object.assign(eye, { x: start[0], y: start[1], vx: 0, vy: 0, hx: 1, hy: 0, speed: 0 });
  cursor.targetPresence = 0;
  cursor.presence = 0;
  const reach = CONFIG.CONE_LENGTH;
  CONFIG.CONE_LENGTH = 0;
  for (let t = 0; t < prewarm; t += dt) {
    update(dt);
    cast.forEach((c, k) => moveTo(clumpOf(c.members), ...scene['ABC'[k]]));
  }
  CONFIG.CONE_LENGTH = reach;
  for (const c of cast) for (const i of c.members) P.vx[i] = P.vy[i] = 0; // still, so their comets fly straight

  // clumps that wandered into the eye's way while flocking move out of it
  const inCast = new Set(cast.flatMap((c) => c.members));
  const groups = new Map();
  for (let i = 0; i < P.n; i++) {
    if (P.mode[i] !== FLOCK || inCast.has(i)) continue;
    if (!groups.has(P.root[i])) groups.set(P.root[i], []);
    groups.get(P.root[i]).push(i);
  }
  cast = cast.map((c) => clumpOf(c.members));
  const others = [...groups.values()].map(clumpOf);
  clearTheWay(others.concat(cast), cast);
  state.clearTrails = true;

  // the cursor appears at the eye
  cursor.x = cursor.lastX = start[0];
  cursor.y = cursor.lastY = start[1];
  cursor.skipSample = true;

  // note what happens, and when
  const t0 = state.time;
  const log = { scatters: [], comets: [], collisions: [], vis: [] };
  const wrap = (name, list, where) => {
    const original = window[name];
    window[name] = function (...args) {
      list.push({ t: +(state.time - t0).toFixed(2), ...where(...args) });
      return original.apply(this, args);
    };
  };
  const centre = (members) => {
    let x = 0, y = 0;
    for (const i of members) { x += P.x[i]; y += P.y[i]; }
    return { x: +(x / members.length).toFixed(2), y: +(y / members.length).toFixed(2), n: members.length };
  };
  wrap('scatterClump', log.scatters, (members) => centre(members));
  wrap('formComet', log.comets, (g, cx, cy, mvx, mvy) => ({ x: +cx.toFixed(2), y: +cy.toFixed(2), n: g.members.length, heading: Math.round((Math.atan2(mvy, mvx) * 180) / Math.PI) }));
  wrap('disintegrate', log.collisions, (a, b) => ({ x: +((a.x + b.x) / 2).toFixed(2), y: +((a.y + b.y) / 2).toFixed(2), n: a.members.length + b.members.length }));

  window.__teaser = {
    log,
    // one step per cursor position; draw = render each step too
    run(points, draw) {
      for (let k = 0; k < points.length; k += 2) {
        cursor.x = points[k];
        cursor.y = points[k + 1];
        cursor.targetPresence = 1;
        update(dt);
        if (draw) render(dt);
        log.vis.push(+arrows.vis.toFixed(3));
      }
    },
    report() {
      const total = state.startCount + state.spawned;
      return { ...log, particles: P.n, conserved: P.n === total, halfW: view.halfW, halfH: view.halfH };
    },
  };
  const show = (c) => `${c.members.length} at ${c.x.toFixed(1)}, ${c.y.toFixed(1)}`;
  return `A ${show(cast[0])} · B ${show(cast[1])} · C ${show(cast[2])} · ${others.filter((c) => c.members.length >= CONFIG.MIN_CLUMP).length} other clumps`;
}

/* ── Running it ───────────────────────────────────────────────────────── */

function serve(root) {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.gif': 'image/gif', '.svg': 'image/svg+xml' };
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.join(root, url === '/' ? 'index.html' : url);
    if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
    fs.readFile(file, (err, data) => {
      if (err) return res.writeHead(404).end();
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

async function openRun(browser, url, seed) {
  const page = await browser.newPage();
  await page.setViewport({ ...VIEW, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(prelude, seed);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.GAZE_FIELD);
  const scene = await page.evaluate(setup, { prewarm: PREWARM, scene: SCENE, keepClear: KEEP_CLEAR, clearance: CAST_CLEARANCE, start: PATH[0].slice(1) });
  if (VERBOSE) console.log(`  seed ${seed} starts with ${scene}`);
  return page;
}

// Does this run show the whole cycle in time?
function judge(r) {
  const vis = r.vis;
  const at = (t) => vis[Math.min(vis.length - 1, Math.round(t * STEP_HZ))];
  const peak = (a, b) => Math.max(...vis.slice(a * STEP_HZ, b * STEP_HZ));
  const low = (a, b) => Math.min(...vis.slice(a * STEP_HZ, b * STEP_HZ));
  const hold = PATH.findIndex((p, i) => i > 0 && p[1] === PATH[i - 1][1] && p[2] === PATH[i - 1][2]);
  const [stop, go] = [PATH[hold - 1][0], PATH[hold][0]];
  const checks = {
    'two scatters': r.scatters.length >= 2,
    'two comets': r.comets.length >= 2,
    [`a collision by ${COLLIDE_BY} s, clear of the edges`]: r.collisions.some((c) => c.t <= COLLIDE_BY
      && Math.abs(c.x) <= r.halfW - EDGE_MARGIN && Math.abs(c.y) <= r.halfH - EDGE_MARGIN),
    'arrows in before the pause': peak(0, stop) > 0.98,
    'arrows out during the pause': low(stop, go + 0.2) < 0.01,
    'arrows back after it': peak(go, SECONDS) > 0.98 && at(SECONDS - 0.05) > 0.5,
    'particles conserved': r.conserved,
  };
  return { ok: Object.values(checks).every(Boolean), checks };
}

let VERBOSE = false;
function describe(r) {
  const where = (e) => (VERBOSE ? ` at ${e.x}, ${e.y} (${e.n}${e.heading !== undefined ? `, heading ${e.heading}°` : ''})` : '');
  const times = (list) => list.map((e) => `${e.t.toFixed(1)} s${where(e)}`).join(', ') || 'none';
  return `scatters ${times(r.scatters)} · comets ${times(r.comets)} · collisions ${times(r.collisions)}`;
}

async function findSeed(browser, url) {
  for (let seed = 1; seed <= MAX_SEEDS; seed++) {
    const page = await openRun(browser, url, seed);
    await page.evaluate((pts) => window.__teaser.run(pts, false), cursorSteps(0, SECONDS * STEP_HZ));
    const r = await page.evaluate(() => window.__teaser.report());
    await page.close();
    const { ok, checks } = judge(r);
    const missing = Object.keys(checks).filter((k) => !checks[k]);
    console.log(`  seed ${seed}: ${describe(r)}${ok ? '  ✓' : `  (missing: ${missing.join(', ')})`}`);
    if (ok) return seed;
  }
  throw new Error(`No seed in 1–${MAX_SEEDS} showed the whole cycle. Adjust SCENE or PATH at the top of this script.`);
}

async function record(browser, url, seed) {
  fs.rmSync(FRAMES_DIR, { recursive: true, force: true });
  fs.mkdirSync(FRAMES_DIR, { recursive: true });
  const page = await openRun(browser, url, seed);
  const per = STEP_HZ / FPS;
  const frames = SECONDS * FPS;
  for (let f = 0; f < frames; f++) {
    await page.evaluate((pts) => window.__teaser.run(pts, true), cursorSteps(f * per, (f + 1) * per));
    const png = await page.evaluate(() => document.getElementById('field').toDataURL('image/png'));
    fs.writeFileSync(path.join(FRAMES_DIR, `${String(f).padStart(4, '0')}.png`), Buffer.from(png.split(',')[1], 'base64'));
    if ((f + 1) % FPS === 0) process.stdout.write(`  ${(f + 1) / FPS} s`);
  }
  process.stdout.write('\n');
  const r = await page.evaluate(() => window.__teaser.report());
  await page.close();
  return r;
}

function ffmpeg(args) {
  const res = spawnSync('ffmpeg', ['-y', '-v', 'error', ...args], { stdio: 'inherit' });
  if (res.error) throw new Error('ffmpeg not found: install it (brew install ffmpeg) and run again.');
  if (res.status !== 0) throw new Error(`ffmpeg failed (exit ${res.status})`);
}

// Two passes: a palette from all the frames, then the frames through it.
function buildGif(width, fps) {
  const input = ['-framerate', String(FPS), '-i', path.join(FRAMES_DIR, '%04d.png')];
  const scale = `fps=${fps},scale=${width}:-2:flags=lanczos`;
  const palette = path.join(FRAMES_DIR, 'palette.png');
  ffmpeg([...input, '-vf', `${scale},palettegen=stats_mode=diff`, palette]);
  ffmpeg([...input, '-i', palette, '-lavfi', `${scale}[v];[v][1:v]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`, '-loop', '0', OUT]);
  return fs.statSync(OUT).size;
}

async function main() {
  const args = process.argv.slice(2);
  const seedArg = args.find((a) => a.startsWith('--seed='));
  const dry = args.includes('--dry');
  const keep = args.includes('--keep-frames');
  VERBOSE = args.includes('--verbose');

  const server = await serve(ROOT);
  const url = `http://127.0.0.1:${server.address().port}/`;
  const launch = { headless: true, args: ['--hide-scrollbars', '--mute-audio'] };
  if (process.env.CHROME_PATH) launch.executablePath = process.env.CHROME_PATH;
  else launch.channel = 'chrome';
  const browser = await puppeteer.launch(launch);

  try {
    let seed;
    if (seedArg) seed = Number(seedArg.split('=')[1]);
    else {
      console.log('Looking for a seed that shows the whole cycle:');
      seed = await findSeed(browser, url);
    }
    if (dry) {
      console.log(`Seed ${seed} would be recorded (dry run: nothing written).`);
      return;
    }

    console.log(`Recording seed ${seed} (${SECONDS} s at ${FPS} fps, ${VIEW.width}×${VIEW.height}):`);
    const r = await record(browser, url, seed);
    console.log(`  ${describe(r)}`);
    const { ok, checks } = judge(r);
    if (!ok) console.warn(`  Warning: this run is missing ${Object.keys(checks).filter((k) => !checks[k]).join(', ')}.`);

    for (const [width, fps] of SIZES) {
      const bytes = buildGif(width, fps);
      const mb = (bytes / 1e6).toFixed(1);
      if (bytes <= MAX_BYTES) {
        console.log(`Saved ${path.relative(ROOT, OUT)}: ${width} px wide, ${fps} fps, ${mb} MB.`);
        return;
      }
      console.log(`  ${width} px at ${fps} fps is ${mb} MB, over the limit; trying smaller.`);
    }
    throw new Error('Even the smallest GIF is over 10 MB.');
  } finally {
    await browser.close();
    server.close();
    if (!keep) fs.rmSync(FRAMES_DIR, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
