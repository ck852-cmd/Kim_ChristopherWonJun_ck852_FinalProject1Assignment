'use strict';

/* ==========================================================================
   GAZE FIELD
   --------------------------------------------------------------------------
   A predator and its prey, drawn in starlight on a black field.

   Prey: clumps of star particles that flock (separation, alignment and
   cohesion) and wander slowly, hovering across the screen.
   Predator: a cosmic eye that follows the cursor. Its vision cone points the
   way it is moving, and it acts on clumps only.

   The life cycle
     1. A clump that enters the vision cone bursts outward, away from the eye:
        a soft firework, with short streaks and no flash.
     2. After SCATTER_TIME its particles pull back together and fuse into a
        single comet.
     3. Comets fly fast in straight lines, bounce off the screen edges and
        trail a glowing tail. A comet's size shows how many particles it holds.
     4. When two comets collide, a firework: a flash at the point of impact
        and every particle bursting out radially at high speed with a fading
        streak. They slow, and after BURST_TIME gather back into one new clump
        that resumes flocking.
     5. Particles are conserved: scattering, fusing and colliding never change
      the total. Only a click adds particles (a small new clump), up to
      MAX_PARTICLES.

   World space: 1 unit is 1/5.6 of the screen's short side; the origin is the
   centre of the screen. Speeds are in units per second.
   ========================================================================== */

const CONFIG = {
  /* Prey: clumps of particles that flock and wander ------------------------- */
  PARTICLE_COUNT: 2000,           // particles at the start; only clicks add more (up to MAX_PARTICLES)
  MAX_PARTICLES: 3000,            // the most there can ever be, for smooth performance: at the limit, clicks do nothing
  CLUMP_COUNT: 18,                // clumps at the start, of different sizes, spread across the screen
  CLUMP_SPEED: 0.5,               // top speed of a flocking particle (units / s): active, still far slower than comets
  SEPARATION_WEIGHT: 1.8,         // boids: keep a little room from close flockmates …
  ALIGNMENT_WEIGHT: 0.7,          // … match their velocity …
  COHESION_WEIGHT: 0.65,          // … and stay with the flock
  WANDER_WEIGHT: 0.6,             // the slow random current that carries clumps across the screen
  CLUMP_DRIFT_WEIGHT: 0.35,       // each clump's own random drift, so clumps head off in varied directions
  CLUMP_DRIFT_TURN: 0.2,          // how quickly each clump's drift direction wanders
  NEIGHBOR_RADIUS: 0.26,          // how far a particle sees its flockmates (units)
  SEPARATION_RADIUS: 0.06,        // flockmates closer than this push apart (units): big clumps stay airy
  MAX_NEIGHBORS: 40,              // most flockmates one particle considers, so dense spots stay cheap
  WANDER_SCALE: 1.5,              // how tight the wander current's swirls are: tighter swirls shear
                                  //   big clumps apart, broader ones let clumps drift together and merge
  WANDER_RATE: 0.05,              // how quickly the wander current changes
  CLUMP_COOLDOWN: 1,              // seconds a newly formed clump is safe from the eye

  /* Click to spawn ------------------------------------------------------------ */
  CLICK_CLUMP_SIZE: [30, 50],     // particles in a clump spawned by a click (a random size in this range)
  CLICK_COOLDOWN: 1,              // seconds a spawned clump is safe from the eye
  MIN_CLUMP: 3,                   // fewer particles than this are strays, not a clump: the eye ignores them

  /* Predator: the eye --------------------------------------------------------- */
  EYE_FOLLOW: 2.4,                // how tightly the eye follows the cursor (1 / s)
  EYE_MAX_SPEED: 4.5,             // the eye's top speed (units / s)
  CONE_ANGLE: 30,                 // full opening angle of the vision cone (degrees)
  CONE_LENGTH: 1.3,               // how far the eye sees (units)

  /* Firework: two comets collide ------------------------------------------- */
  BURST_SPEED: 5.5,               // how fast the collision flings every particle outward (units / s)
  BURST_TIME: 1.2,                // seconds they fly before gathering back into a new clump
  BURST_DRAG: 2.6,                // drag on bursting particles (1 / s): how quickly they slow down
  TRAIL_LENGTH: 0.13,             // a bursting particle's fading streak, in seconds of its motion
  BURST_SPREAD: 0.35,             // randomness of each particle's speed (± share) …
  BURST_JITTER: 0.3,              // … and of its angle (rad), so the burst looks organic, not a circle
  BURST_FLASH: 0.45,              // seconds the flash at the point of impact lasts
  GATHER_PULL: 5,                 // how hard the particles then pull back together into a clump (1 / s²)
  GATHER_TIME: 1.2,               // longest the gathering lasts before they become a clump anyway (s)

  /* The eye's scatter: the same burst, softer, with no flash, then a comet ---- */
  SCATTER_TIME: 1,                // seconds the particles fly apart before pulling back together
  SCATTER_FORCE: 2.2,             // their outward speed (units / s): well below BURST_SPEED
  SCATTER_DRAG: 2.4,              // how quickly the scatter slows (1 / s)
  SCATTER_TRAIL: 0.06,            // their shorter streaks (seconds of motion)
  FUSE_PULL: 7,                   // how hard they pull back to their centre (1 / s²)
  FUSE_TIME: 0.9,                 // longest the pull lasts before they fuse anyway (s)

  /* Comets -------------------------------------------------------------------- */
  COMET_SPEED: 3.2,               // comets fly this fast in straight lines (units / s)
  COMET_RADIUS: 0.012,            // collision radius per √(particles inside) (units)
  COMET_COOLDOWN: 0.8,            // seconds a new comet cannot collide
  COMET_TAIL: 1.1,                // tail length of a big comet (units)
  BOUNCE_JITTER: 8,               // degrees of random turn at each bounce, so paths never lock into a loop

  /* Comets come and go without a blink ---------------------------------------- */
  COMET_FADE_TIME: 0.5,           // seconds a colliding comet's glow takes to swell and fade away
  EMBER_COUNT: 24,                // sparks thrown off when a big comet disintegrates
  emberLife: [0.5, 1.2],          // seconds each spark lasts, shrinking and fading all the while
  emberSize: 0.55,                // a spark's size compared with a star
  emberScatter: 0.9,              // how fast sparks scatter outward (units / s)
  emberMax: 700,                  // most sparks alive at once
  starColourFade: 0.8,            // seconds a particle takes to lose its comet colours

  /* Opening: a drifting galaxy that awakens into the clumps ------------------ */
  INTRO_ENABLED: true,            // false skips the opening screen
  INTRO_DRIFT_SPEED: 1,           // how quickly the opening galaxy turns (1 = slowly)
  INTRO_TRANSFORM_TIME: 2.4,      // seconds each star takes to fly from the galaxy to its clump
  INTRO_STAGGER: 1.3,             // spread of departure times, inner galaxy first (seconds)
  INTRO_WAKE_DISTANCE: 12,        // pixels the pointer must travel to awaken the system
  INTRO_MIN_TIME: 1.2,            // seconds the opening shows before a movement can awaken it

  /* Look ------------------------------------------------------------------------ */
  BASE_MOTION: 1,                 // idle life: the opening galaxy's drift and the eye's saccades
  PARTICLE_SIZE: 0.011,           // particle radius (units)
  GLOW_STRENGTH: 0.85,            // glow around particles
  TRAIL_SECONDS: 0.28,            // how long a star trail lingers when calm
  TRAIL_ENERGY_MULTIPLIER: 1.2,   // how much cursor energy lengthens the trails
  trailPixelRatio: 1.5,           // resolution of the trail layer (lower = faster, softer)
  trailOpacity: 0.4,              // brightness of each new trail segment
  trailBlackPoint: 241,           // 255 = off; lower clears more of the faint trail floor
  starOpacity: 0.8,               // brightness of the star heads
  maxPixelRatio: 2,
  worldLong: 12.1,                // the visible world, in units, along the screen's long side …
  worldShort: 5.6,                // … and its short side
  flowScale: 0.85,                // the curl flow behind the opening drift and the wander current
  flowSpeed: 0.16,

  /* Vector field arrows (V): the eye's force, made visible ------------------ */
  ARROWS_ON: true,                // arrows enabled at start (V turns them off completely)
  ARROW_SPACING: 54,              // pixels between arrows
  ARROW_MAX_LENGTH: 44,           // longest arrow (pixels), where the eye's force is strongest
  ARROW_MIN_LENGTH: 16,           // shortest arrow (pixels), so even a weak force still reads as an arrow
  ARROW_WIDTH: 1.6,               // line thickness (pixels); the arrowheads scale with it
  ARROW_OPACITY: 0.85,            // opacity of the strongest arrows; where the eye's force is absent, they are invisible
  ARROW_FADE: 1,                  // seconds for the arrows to fade in once the cursor moves the eye, and out when it stops
  ARROW_RISE: 0.12,               // seconds for an arrow to grow when the eye's force arrives (quick, so a passing eye shows)
  ARROW_EASE: 0.45,               // seconds for an arrow to ease back down as the eye's force leaves it
  ARROW_WAKE_REACH: 1.5,          // units behind the eyeball at which its wake has faded to half

  /* Cursor ---------------------------------------------------------------------- */
  CURSOR_SPEED_SENSITIVITY: 0.3,  // higher → less cursor speed needed for full energy (the eye's glow)
  cursorSpeedSmoothing: 0.12,     // seconds; smooths the per-frame speed reading
  pointerFadeIn: 0.25,            // seconds
  pointerFadeOut: 1.4,            // seconds for presence to fade once the pointer leaves

  /* The eyeball: its look ----------------------------------------------------------- */
  EYEBALL_RADIUS: 0.44,           // the eyeball (units)
  IRIS_RADIUS: 0.24,              // the iris on its surface (units)
  eyePupil: 0.42,                 // pupil radius as a share of the iris
  EYE_MAX_TURN: 0.62,             // furthest the iris turns toward its heading (rad)
  EYE_STIFFNESS: 55,              // spring of the iris's turn when calm (1 / s²)
  EYE_SPEED_RESPONSE: 2.2,        // faster cursor → stiffer spring → quicker iris (×)
  EYE_DAMPING: 0.72,              // < 1 lets it overshoot slightly and settle, like a real eye
  EYE_GLOW: 0.35,                 // galactic glow when calm; cursor speed brightens it
  eyeSweepPeriod: 7,              // seconds for the iris's write seam to renew the whole iris
  eyeTextureSize: 320,            // resolution of the iris texture (pixels)
  eyeBrightness: 1.3,             // overall light of the iris
  eyeFlashEvery: [9, 15],         // seconds between moments when the iris thins to rings
  eyeFlashDuration: 0.5,

  colors: {
    stars: ['#ffffff', '#cfd6e8', '#f3d494', '#a9c3ff', '#c7a2ff'], // white, silver, gold, blue, violet
    starWeights: [0.3, 0.27, 0.27, 0.16, 0], // violet appears only in comet tails
    nucleus: '255, 236, 196',
    halo: '120, 150, 255',
    nebula: ['60, 80, 190', '120, 70, 170'],
    // the eye's light, from shadow to highlight: deep blue, silver, warm white
    iris: [
      [0, [0, 0, 0]],
      [0.14, [10, 12, 26]],
      [0.32, [62, 70, 118]],
      [0.52, [150, 157, 192]],
      [0.72, [214, 218, 234]],
      [0.9, [246, 244, 238]],
      [1, [255, 236, 196]],
    ],
    comet: { head: '255, 250, 236', dust: '255, 212, 128', ion: '104, 148, 255', violet: '188, 118, 255' },
    ui: '223, 227, 238',
    eyeGlow: '110, 140, 255',     // the eyeball's galactic glow and rim light
    field: '138, 164, 255',       // the vector field arrows: a soft blue, a little paler than the eye's glow
    photon: '255, 222, 160',      // gold glint round the pupil
  },
};

// Viewers who ask their system for less motion get calmer idle drift; the
// cursor, comets and eye still respond fully.
if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) CONFIG.BASE_MOTION = 0.4;

/* ==========================================================================
   Utilities
   ========================================================================== */

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted(weights, r) {
  let acc = 0;
  for (let i = 0; i < weights.length; i++) {
    acc += weights[i];
    if (r <= acc) return i;
  }
  return weights.length - 1;
}

// Cheap hash noise for the eye's texture: 0…1, and smooth −1…1 in 1D / 2D.
function hash1(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function vnoise1(x) {
  const i = Math.floor(x);
  const f = x - i;
  return lerp(hash1(i), hash1(i + 1), f * f * (3 - 2 * f)) * 2 - 1;
}

function vnoise2(x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const h = (a, b) => hash1(a * 57 + b * 113);
  const top = lerp(h(ix, iy), h(ix + 1, iy), ux);
  const bottom = lerp(h(ix, iy + 1), h(ix + 1, iy + 1), ux);
  return lerp(top, bottom, uy) * 2 - 1;
}

/* ==========================================================================
   Canvas and view
   ========================================================================== */

const canvas = document.getElementById('field');
const ctx = canvas.getContext('2d', { alpha: false });
const helpPanel = document.getElementById('help');
const statusEl = document.getElementById('status');

// Star trails live on their own layer, which fades a little every frame.
const trail = document.createElement('canvas');
const tctx = trail.getContext('2d');

const view = { w: 1, h: 1, dpr: 1, tdpr: 1, cell: 100, cx: 0, cy: 0, halfW: 5, halfH: 5, portrait: false };
let PX = 0.01; // one CSS pixel in world units

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, CONFIG.maxPixelRatio);
  view.w = w;
  view.h = h;
  view.dpr = dpr;
  canvas.width = Math.max(1, Math.round(w * dpr));
  canvas.height = Math.max(1, Math.round(h * dpr));

  view.tdpr = Math.min(dpr, CONFIG.trailPixelRatio);
  trail.width = Math.max(1, Math.round(w * view.tdpr));
  trail.height = Math.max(1, Math.round(h * view.tdpr));

  // The visible world: worldLong units along the screen's long side, worldShort along the short side.
  const portrait = h > w;
  const long = CONFIG.worldLong;
  const short = CONFIG.worldShort;
  view.cell = portrait ? Math.min(w / short, h / long) : Math.min(w / long, h / short);
  view.cx = w / 2;
  view.cy = h / 2;
  view.halfW = w / 2 / view.cell;
  view.halfH = h / 2 / view.cell;
  PX = 1 / view.cell;

  const turned = view.portrait !== portrait;
  view.portrait = portrait;
  // turned on its side during the opening: lay the clumps out afresh for the new shape
  if (turned && P.n && intro.phase === 'idle') {
    seedClumps();
    initIntro();
  }
  state.clearTrails = true;
}

function makeSprite(stops, size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, col] of stops) grad.addColorStop(o, col);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

/* ---- Sprites ---------------------------------------------------------------- */

const STAR_CORE = 0.3; // share of a star sprite's radius that is its bright core
let starSprites = [];
let starColours = [];
let nucleusSprite = null;
let haloSprite = null;
let cometHeadSprite = null;
let tailSprites = {};
let eyeGalaxy = null;

function buildSprites() {
  const g = CONFIG.GLOW_STRENGTH;
  starColours = CONFIG.colors.stars.map(hexToRgb);
  starSprites = starColours.map((c) =>
    makeSprite(
      [
        [0, 'rgba(255, 255, 255, 1)'],
        [STAR_CORE * 0.5, `rgba(${c}, 1)`],
        [STAR_CORE, `rgba(${c}, 0.55)`],
        [STAR_CORE * 1.8, `rgba(${c}, ${0.12 * g})`],
        [1, `rgba(${c}, 0)`],
      ],
      48
    )
  );
  const n = CONFIG.colors.nucleus;
  nucleusSprite = makeSprite([
    [0, 'rgba(255, 255, 255, 1)'],
    [0.1, `rgba(${n}, 0.9)`],
    [0.3, `rgba(${n}, 0.25)`],
    [0.65, `rgba(${n}, 0.05)`],
    [1, `rgba(${n}, 0)`],
  ]);
  const hl = CONFIG.colors.halo;
  haloSprite = makeSprite([
    [0, `rgba(${hl}, 0.18)`],
    [0.45, `rgba(${hl}, 0.06)`],
    [1, `rgba(${hl}, 0)`],
  ]);
  const cc = CONFIG.colors.comet;
  cometHeadSprite = makeSprite([
    [0, 'rgba(255, 255, 255, 1)'],
    [0.1, `rgba(${cc.head}, 0.95)`],
    [0.3, `rgba(${cc.dust}, 0.4)`],
    [0.65, `rgba(${cc.dust}, 0.08)`],
    [1, `rgba(${cc.dust}, 0)`],
  ]);
  eyeGalaxy = buildEyeGalaxy(512);
  tailSprites = {
    head: makeTailSprite(cc.head),
    dust: makeTailSprite(cc.dust),
    ion: makeTailSprite(cc.ion),
    violet: makeTailSprite(cc.violet),
  };
}

/* A comet tail as a soft fan of light: brightest at the head end (left),
   widening and fading toward the far end (right). */
function makeTailSprite(rgb) {
  const w = 256;
  const h = 64;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  const img = g.createImageData(w, h);
  const [r, gg, b] = rgb.split(',').map(Number);
  for (let x = 0; x < w; x++) {
    const t = x / (w - 1);
    const along = Math.pow(1 - t, 0.95) * smoothstep(0, 0.025, t);
    const width = 0.08 + 0.92 * Math.pow(t, 0.75);
    for (let y = 0; y < h; y++) {
      const dy = (y + 0.5 - h / 2) / (h / 2);
      const p = (y * w + x) * 4;
      img.data[p] = r;
      img.data[p + 1] = gg;
      img.data[p + 2] = b;
      img.data[p + 3] = Math.round(255 * along * Math.exp(-((dy / width) ** 2) * 3));
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

/* ==========================================================================
   Shared state
   ========================================================================== */

const state = {
  time: 0,
  paused: false,
  showVectors: CONFIG.ARROWS_ON, // V: the vector field arrows
  debug: false,          // D: the debug overlay
  cursorEnergy: 0,       // 0…1, the smoothed cursor speed (brightens the eye's glow)
  energy: 0,             // a lingering copy of it
  clearTrails: true,
};

const cursor = {
  x: 2.1, y: -0.55,      // world position
  lastX: 2.1, lastY: -0.55,
  speed: 0,              // smoothed speed, units / second
  presence: 0,           // 0 = gone … 1 = on the canvas
  targetPresence: 0,
  skipSample: true,
};

const FLOW = { x: 0, y: 0 };


/* A divergence-free "curl" flow from a layered stream function ψ(x, y, t):
   v = (∂ψ/∂y, −∂ψ/∂x). It swirls gently without sources or sinks. */
function flowAt(x, y, t, out) {
  const s = CONFIG.flowScale;
  const X = x * s;
  const Y = y * s;
  const T = t * CONFIG.flowSpeed;
  const a1 = X * 1.3 + T;
  const b1 = Y * 1.1 - T * 0.7;
  const a2 = (X * 0.7 - Y * 0.9) * 1.7 + T * 1.3;
  const sa = Math.sin(a1), ca = Math.cos(a1);
  const sb = Math.sin(b1), cb = Math.cos(b1);
  const c2 = Math.cos(a2);
  // ψ = sin(a1)·cos(b1) + 0.6·sin(a2)
  const dPsiDx = (1.3 * ca * cb + 0.6 * 1.7 * 0.7 * c2) * s;
  const dPsiDy = (-1.1 * sa * sb - 0.6 * 1.7 * 0.9 * c2) * s;
  out.x = dPsiDy;
  out.y = -dPsiDx;
}

/* ==========================================================================
   Cursor
   ========================================================================== */

/* Speed is measured once per frame from how far the cursor moved, and
   smoothed; presence eases in and out as the pointer arrives and leaves. */
function updateCursor(dt) {
  let mv = 0;
  if (cursor.skipSample) {
    cursor.skipSample = false; // a re-entry or touch-down jump is not speed
  } else {
    mv = Math.hypot(cursor.x - cursor.lastX, cursor.y - cursor.lastY) / Math.max(dt, 1 / 240);
  }
  cursor.lastX = cursor.x;
  cursor.lastY = cursor.y;
  cursor.speed += (Math.min(mv, 60) - cursor.speed) * (1 - Math.exp(-dt / CONFIG.cursorSpeedSmoothing));
  const pt = cursor.targetPresence > cursor.presence ? CONFIG.pointerFadeIn : CONFIG.pointerFadeOut;
  cursor.presence += (cursor.targetPresence - cursor.presence) * (1 - Math.exp(-dt / pt));
  const e = (1 - Math.exp(-cursor.speed * CONFIG.CURSOR_SPEED_SENSITIVITY)) * cursor.presence;
  state.cursorEnergy = e;
  const et = e > state.energy ? 0.18 : 2.4;
  state.energy += (e - state.energy) * (1 - Math.exp(-dt / et));
}


/* ==========================================================================
   The predator: an eye that follows the cursor
   --------------------------------------------------------------------------
   The eye chases the cursor as a critically damped spring, so it follows
   with a natural lag and never overshoots. Its vision cone points the way it
   is moving; when it stops, it keeps looking where it was going. It acts on
   clumps only, never on comets.
   ========================================================================== */

const eye = { x: 0, y: 0, vx: 0, vy: 0, hx: 1, hy: 0, speed: 0 };

function updateEye(dt) {
  const k = CONFIG.EYE_FOLLOW;
  const here = cursor.presence > 0.05;
  const steps = Math.max(1, Math.ceil(dt * 120));
  const h = dt / steps;
  for (let s = 0; s < steps; s++) {
    // with the pointer gone, it simply coasts to a stop where it is
    const tx = here ? cursor.x : eye.x;
    const ty = here ? cursor.y : eye.y;
    eye.vx += (k * k * (tx - eye.x) - 2 * k * eye.vx) * h;
    eye.vy += (k * k * (ty - eye.y) - 2 * k * eye.vy) * h;
    const sp = Math.hypot(eye.vx, eye.vy);
    if (sp > CONFIG.EYE_MAX_SPEED) {
      eye.vx *= CONFIG.EYE_MAX_SPEED / sp;
      eye.vy *= CONFIG.EYE_MAX_SPEED / sp;
    }
    eye.x += eye.vx * h;
    eye.y += eye.vy * h;
  }
  const m = CONFIG.EYEBALL_RADIUS * 0.6;
  eye.x = clamp(eye.x, -view.halfW + m, view.halfW - m);
  eye.y = clamp(eye.y, -view.halfH + m, view.halfH - m);
  eye.speed = Math.hypot(eye.vx, eye.vy);

  // its heading: the way it is moving, eased; held while it is still
  if (eye.speed > 0.12) {
    const t = 1 - Math.exp(-dt / 0.12);
    eye.hx += (eye.vx / eye.speed - eye.hx) * t;
    eye.hy += (eye.vy / eye.speed - eye.hy) * t;
    const hl = Math.hypot(eye.hx, eye.hy) || 1;
    eye.hx /= hl;
    eye.hy /= hl;
  }
}

// Is a point inside the vision cone? (cos = cos of half of CONE_ANGLE)
function inCone(x, y, cos) {
  const dx = x - eye.x;
  const dy = y - eye.y;
  const d2 = dx * dx + dy * dy;
  if (d2 > CONFIG.CONE_LENGTH * CONFIG.CONE_LENGTH) return false;
  const d = Math.sqrt(d2);
  if (d < CONFIG.EYEBALL_RADIUS) return true; // touching the eye
  return dx * eye.hx + dy * eye.hy >= cos * d;
}

/* ==========================================================================
   Particles
   --------------------------------------------------------------------------
   Every star lives in one set of flat arrays. Each is always in exactly one
   state, which is how the total is conserved:
     FLOCK      in a clump, flocking
     SCATTERED  bursting outward, then pulling back together (into a comet
                after the eye's scatter, into a clump after a firework)
     IN_COMET   carried inside a comet, hidden
   Positions are in world units, velocities in units per second.
   ========================================================================== */

const FLOCK = 0;
const SCATTERED = 1;
const IN_COMET = 2;

const P = { n: 0 };

// Arrays are sized for MAX_PARTICLES; P.n is how many exist right now.
function allocateParticles(n) {
  const cap = Math.max(n, CONFIG.MAX_PARTICLES);
  P.n = n;
  for (const k of ['x', 'y', 'vx', 'vy', 'ax', 'ay', 'lx', 'ly', 'size', 'bright', 'cool', 'cmix', 'drift', 'trail', 'tx', 'ty', 'gr', 'ga', 'gw', 'gd', 'gu', 'gc']) {
    P[k] = new Float32Array(cap);
  }
  P.col = new Uint8Array(cap);       // its own colour
  P.ccol = new Uint8Array(cap);      // the colour it glows with after being in a comet
  P.mode = new Uint8Array(cap);      // FLOCK, SCATTERED or IN_COMET
  P.group = new Int32Array(cap).fill(-1); // its scatter group or comet
  P.root = new Int32Array(cap);      // union-find parent: which clump it belongs to
  P.next = new Int32Array(cap);      // spatial grid chain
}

// A new particle's look: the same mix of star colours, sizes and brightness.
function dressParticle(i) {
  P.col[i] = pickWeighted(CONFIG.colors.starWeights, Math.random());
  P.size[i] = 0.6 + Math.pow(Math.random(), 3) * 1.5;
  P.bright[i] = 0.5 + 0.5 * Math.random();
}

/* Several clumps of different sizes, spread across the screen. Each is a
   sunflower-packed disc, about as tight as flocking holds a clump. Their
   positions are also where the opening galaxy sends its stars. */
function seedClumps() {
  const n = Math.min(CONFIG.PARTICLE_COUNT, CONFIG.MAX_PARTICLES);
  allocateParticles(n);
  state.startCount = n;
  state.spawned = 0;
  const k = Math.max(1, CONFIG.CLUMP_COUNT);

  // varied sizes, normalised to the total, none smaller than 2 % of it
  const w = [];
  for (let c = 0; c < k; c++) w.push(0.3 + Math.pow(Math.random(), 1.5) * 1.7);
  const sum = w.reduce((a, b) => a + b, 0);
  const min = Math.max(4, Math.floor(n * 0.02));
  const sizes = w.map((v) => Math.max(min, Math.round((v / sum) * n)));
  let excess = sizes.reduce((a, b) => a + b, 0) - n;
  sizes.sort((a, b) => b - a);
  for (let c = 0; excess !== 0; c = (c + 1) % k) {
    if (excess > 0 && sizes[c] > min) { sizes[c]--; excess--; }
    else if (excess < 0) { sizes[c]++; excess++; }
  }

  // centres: best-candidate sampling, so clumps start well apart
  const bw = view.halfW - 0.9;
  const bh = view.halfH - 0.7;
  const centres = [];
  for (let c = 0; c < k; c++) {
    let best = null;
    let bestD = -1;
    for (let t = 0; t < 30; t++) {
      const x = (Math.random() * 2 - 1) * bw;
      const y = (Math.random() * 2 - 1) * bh;
      let d = Math.hypot(x, y) - 1.2; // keep the middle, where the eye wakes, clear
      for (const q of centres) d = Math.min(d, Math.hypot(x - q.x, y - q.y));
      if (d > bestD) { bestD = d; best = { x, y }; }
    }
    centres.push(best);
  }

  let i = 0;
  sizes.forEach((size, c) => {
    const { x: cx, y: cy } = centres[c];
    const R = Math.sqrt(size) * CONFIG.SEPARATION_RADIUS * 0.55;
    const turn = Math.random() * TAU;
    const drift = Math.random() * 1000; // this clump's own drift
    for (let j = 0; j < size; j++, i++) {
      const r = R * Math.sqrt((j + 0.5) / size);
      const a = turn + j * 2.399963; // the golden angle
      P.x[i] = P.lx[i] = P.tx[i] = cx + r * Math.cos(a);
      P.y[i] = P.ly[i] = P.ty[i] = cy + r * Math.sin(a);
      P.vx[i] = P.vy[i] = 0;
      dressParticle(i);
      P.drift[i] = drift;
      P.mode[i] = FLOCK;
      P.group[i] = -1;
      P.cool[i] = CONFIG.CLUMP_COOLDOWN;
      P.cmix[i] = 0;
    }
  });
  state.clearTrails = true;
}

/* ── Spatial grid ─────────────────────────────────────────────────────────
   Flocking particles are binned into cells as large as their neighbour
   radius, so each one looks only at the nine cells around it. */
const grid = { size: 0.25, cols: 1, rows: 1, x0: 0, y0: 0, head: new Int32Array(1) };

function buildGrid(cell) {
  grid.size = cell;
  grid.x0 = -view.halfW - 2;
  grid.y0 = -view.halfH - 2;
  grid.cols = Math.max(1, Math.ceil((2 * view.halfW + 4) / cell));
  grid.rows = Math.max(1, Math.ceil((2 * view.halfH + 4) / cell));
  const cells = grid.cols * grid.rows;
  if (grid.head.length < cells) grid.head = new Int32Array(cells);
  grid.head.fill(-1, 0, cells);
  for (let i = 0; i < P.n; i++) {
    if (P.mode[i] !== FLOCK) continue;
    const c = cellIndex(P.x[i], P.y[i]);
    P.next[i] = grid.head[c];
    grid.head[c] = i;
  }
}

function cellIndex(x, y) {
  const cx = clamp(Math.floor((x - grid.x0) / grid.size), 0, grid.cols - 1);
  const cy = clamp(Math.floor((y - grid.y0) / grid.size), 0, grid.rows - 1);
  return cy * grid.cols + cx;
}

function find(a) {
  while (P.root[a] !== a) {
    P.root[a] = P.root[P.root[a]];
    a = P.root[a];
  }
  return a;
}

/* ── The slow wander current ──────────────────────────────────────────────
   The same swirling curl flow as the opening galaxy's drift, broader and
   slower. Nearby particles feel nearly the same push, so whole clumps
   wander together; across a big clump it differs, so big clumps can split. */
function wanderAt(x, y, out) {
  const k = CONFIG.WANDER_SCALE / CONFIG.flowScale;
  flowAt(x * k, y * k, (state.time * CONFIG.WANDER_RATE) / CONFIG.flowSpeed, out);
}

/* ── Clumps: boids ────────────────────────────────────────────────────────
   Each flocking particle steers by its neighbours within NEIGHBOR_RADIUS:
     separation  away from flockmates closer than SEPARATION_RADIUS
     alignment   toward their average velocity
     cohesion    toward their centre
   plus the wander current, each clump's own random drift and soft screen
   edges. Speeds are capped at
   CLUMP_SPEED and a light drag keeps them hovering rather than rushing.
   The same neighbour pairs link particles into clumps (union-find). */
const NEIGHBOR_ORDER = [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [-1, -1], [1, -1]];

function flock(dt) {
  const R = CONFIG.NEIGHBOR_RADIUS;
  const R2 = R * R;
  const S = CONFIG.SEPARATION_RADIUS;
  const S2 = S * S;
  const maxN = CONFIG.MAX_NEIGHBORS;
  const vmax = CONFIG.CLUMP_SPEED;
  const wSep = CONFIG.SEPARATION_WEIGHT * vmax * 4;
  const wAli = CONFIG.ALIGNMENT_WEIGHT * 1.5;
  const wCoh = CONFIG.COHESION_WEIGHT * 1.6;
  const wWan = CONFIG.WANDER_WEIGHT * vmax * 0.9;
  const wDrift = CONFIG.CLUMP_DRIFT_WEIGHT * vmax * 0.9;
  const turn = state.time * CONFIG.CLUMP_DRIFT_TURN;
  const bw = view.halfW - 0.35;
  const bh = view.halfH - 0.35;
  buildGrid(R);
  for (let i = 0; i < P.n; i++) P.root[i] = i;

  for (let i = 0; i < P.n; i++) {
    if (P.mode[i] !== FLOCK) continue;
    const xi = P.x[i];
    const yi = P.y[i];
    const gx = clamp(Math.floor((xi - grid.x0) / grid.size), 0, grid.cols - 1);
    const gy = clamp(Math.floor((yi - grid.y0) / grid.size), 0, grid.rows - 1);
    let sx = 0, sy = 0, avx = 0, avy = 0, cx = 0, cy = 0, cnt = 0;
    const start = i % 8; // a rotating cell order, so a full neighbour list has no directional bias
    scan: for (let q = 0; q < 9; q++) {
      const o = NEIGHBOR_ORDER[q === 0 ? 0 : 1 + ((q - 1 + start) % 8)];
      const xx = gx + o[0];
      const yy = gy + o[1];
      if (xx < 0 || yy < 0 || xx >= grid.cols || yy >= grid.rows) continue;
      for (let j = grid.head[yy * grid.cols + xx]; j !== -1; j = P.next[j]) {
        if (j === i) continue;
        const dx = P.x[j] - xi;
        const dy = P.y[j] - yi;
        const d2 = dx * dx + dy * dy;
        if (d2 > R2) continue;
        // linked: the same clump
        const ra = find(i);
        const rb = find(j);
        if (ra !== rb) P.root[ra] = rb;
        cnt++;
        avx += P.vx[j];
        avy += P.vy[j];
        cx += dx;
        cy += dy;
        if (d2 < S2 && d2 > 1e-10) {
          const d = Math.sqrt(d2);
          const push = (1 - d / S) / d;
          sx -= dx * push;
          sy -= dy * push;
        }
        if (cnt >= maxN) break scan;
      }
    }
    let ax = 0;
    let ay = 0;
    if (cnt) {
      ax += sx * wSep + (avx / cnt - P.vx[i]) * wAli + (cx / cnt) * wCoh;
      ay += sy * wSep + (avy / cnt - P.vy[i]) * wAli + (cy / cnt) * wCoh;
    }
    wanderAt(xi, yi, FLOW);
    ax += FLOW.x * wWan;
    ay += FLOW.y * wWan;
    // its clump's own random drift: a heading that wanders slowly, shared by the
    // particles the clump was born with, so neighbouring clumps head different ways
    const seed = P.drift[i];
    const ang = seed * TAU + 2.2 * vnoise1(seed * 13.7 + turn);
    ax += Math.cos(ang) * wDrift;
    ay += Math.sin(ang) * wDrift;
    if (xi < -bw) ax += (-bw - xi) * 2;
    else if (xi > bw) ax -= (xi - bw) * 2;
    if (yi < -bh) ay += (-bh - yi) * 2;
    else if (yi > bh) ay -= (yi - bh) * 2;
    P.ax[i] = ax;
    P.ay[i] = ay;
  }

  const drag = Math.exp(-0.6 * dt);
  for (let i = 0; i < P.n; i++) {
    if (P.mode[i] !== FLOCK) continue;
    let vx = (P.vx[i] + P.ax[i] * dt) * drag;
    let vy = (P.vy[i] + P.ay[i] * dt) * drag;
    const sp = Math.hypot(vx, vy);
    if (sp > vmax) {
      vx *= vmax / sp;
      vy *= vmax / sp;
    }
    P.vx[i] = vx;
    P.vy[i] = vy;
    P.x[i] += vx * dt;
    P.y[i] += vy * dt;
  }
}

/* ── The hunt ─────────────────────────────────────────────────────────────
   Any clump (MIN_CLUMP particles or more) with a particle inside the vision
   cone scatters, unless it is still within its CLUMP_COOLDOWN. Also counts
   the clumps for the overlay. */
const census = { clumps: 0, strays: 0, sizes: [] };
state.startCount = 0; // particles the field started with
state.spawned = 0;    // particles added by clicks since

function hunt() {
  const cos = Math.cos((CONFIG.CONE_ANGLE * Math.PI) / 360);
  const size = new Map();
  const seen = new Set();
  const guarded = new Set();
  for (let i = 0; i < P.n; i++) {
    if (P.mode[i] !== FLOCK) continue;
    const r = find(i);
    P.root[i] = r;
    size.set(r, (size.get(r) || 0) + 1);
    if (P.cool[i] > 0) guarded.add(r);
    if (!seen.has(r) && inCone(P.x[i], P.y[i], cos)) seen.add(r);
  }
  census.clumps = 0;
  census.strays = 0;
  census.sizes = [];
  for (const n of size.values()) {
    if (n >= CONFIG.MIN_CLUMP) { census.clumps++; census.sizes.push(n); }
    else census.strays += n;
  }
  census.sizes.sort((a, b) => b - a);

  const prey = new Map();
  for (const r of seen) if (!guarded.has(r) && size.get(r) >= CONFIG.MIN_CLUMP) prey.set(r, []);
  if (!prey.size) return;
  for (let i = 0; i < P.n; i++) {
    if (P.mode[i] !== FLOCK) continue;
    const list = prey.get(P.root[i]);
    if (list) list.push(i);
  }
  for (const members of prey.values()) scatterClump(members);
}

/* ==========================================================================
   Scatter, then fuse into a comet
   ========================================================================== */

const scatterGroups = new Map(); // every bursting group: the eye's scatters and the fireworks
let nextGroupId = 1;
const events = { scatters: [], fusions: [], collisions: [], spawns: [] }; // times, for the overlay
let flashes = [];

/* The eye's scatter: a soft version of the firework. The clump bursts
   radially from its own centre, each particle at a slightly random speed and
   angle, with a lean away from the eye (so the comet it fuses into flies
   away from the eye). Lower speed and shorter streaks than a firework, and no
   flash. */
function scatterClump(members) {
  const g = { id: nextGroupId++, kind: 'scatter', members, t: 0 };
  let cx = 0, cy = 0;
  for (const i of members) {
    cx += P.x[i];
    cy += P.y[i];
  }
  cx /= members.length;
  cy /= members.length;
  let ax = cx - eye.x;
  let ay = cy - eye.y;
  const al = Math.hypot(ax, ay) || 1;
  ax /= al;
  ay /= al;
  const speed = CONFIG.SCATTER_FORCE;
  for (const i of members) {
    const [ux, uy] = burstDirection(P.x[i] - cx, P.y[i] - cy);
    const sp = speed * (1 + (Math.random() * 2 - 1) * CONFIG.BURST_SPREAD);
    P.vx[i] = P.vx[i] * 0.3 + ux * sp * 0.8 + ax * speed * 0.5;
    P.vy[i] = P.vy[i] * 0.3 + uy * sp * 0.8 + ay * speed * 0.5;
    P.mode[i] = SCATTERED;
    P.group[i] = g.id;
    P.trail[i] = CONFIG.SCATTER_TRAIL;
  }
  scatterGroups.set(g.id, g);
  events.scatters.push(state.time);
}

// Outward from a centre, turned by a little random angle (a random direction at the very centre).
function burstDirection(dx, dy) {
  let d = Math.hypot(dx, dy);
  let a;
  if (d < 1e-4) a = Math.random() * TAU;
  else a = Math.atan2(dy, dx);
  a += (Math.random() * 2 - 1) * CONFIG.BURST_JITTER;
  return [Math.cos(a), Math.sin(a)];
}

/* Every bursting group flies apart under drag, then pulls back toward its
   common centre with a damped spring that keeps the group's own drift.
     · the eye's scatter, after SCATTER_TIME, pulls all the way in and fuses
       into one comet (once gathered, or after FUSE_TIME)
     · a firework, after BURST_TIME, gathers only to a clump-sized cluster and
       becomes a new clump (once gathered, or after GATHER_TIME) */
function updateScatter(dt) {
  for (const g of scatterGroups.values()) {
    g.t += dt;
    const firework = g.kind === 'firework';
    const flyTime = firework ? CONFIG.BURST_TIME : CONFIG.SCATTER_TIME;
    const drag = Math.exp(-(firework ? CONFIG.BURST_DRAG : CONFIG.SCATTER_DRAG) * dt);
    const k = firework ? CONFIG.GATHER_PULL : CONFIG.FUSE_PULL;
    const damp = 2 * Math.sqrt(k) * 0.7;
    const m = g.members;
    let cx = 0, cy = 0, mvx = 0, mvy = 0;
    for (const i of m) {
      cx += P.x[i];
      cy += P.y[i];
      mvx += P.vx[i];
      mvy += P.vy[i];
    }
    cx /= m.length;
    cy /= m.length;
    mvx /= m.length;
    mvy /= m.length;
    const pulling = g.t >= flyTime;
    // a firework gathers into a clump, not a point
    const hold = firework ? Math.sqrt(m.length) * CONFIG.SEPARATION_RADIUS * 0.6 : 0;
    let far = 0;
    let inside = 0;
    for (const i of m) {
      if (pulling) {
        const dx = cx - P.x[i];
        const dy = cy - P.y[i];
        const d = Math.hypot(dx, dy);
        const reach = d > hold && d > 1e-6 ? (d - hold) / d : 0;
        P.vx[i] += (dx * reach * k - (P.vx[i] - mvx) * damp) * dt;
        P.vy[i] += (dy * reach * k - (P.vy[i] - mvy) * damp) * dt;
      } else {
        P.vx[i] *= drag;
        P.vy[i] *= drag;
      }
      P.x[i] += P.vx[i] * dt;
      P.y[i] += P.vy[i] * dt;
      const d2 = (P.x[i] - cx) ** 2 + (P.y[i] - cy) ** 2;
      far = Math.max(far, d2);
      if (d2 < (hold * 1.4) ** 2) inside++;
    }
    if (!pulling) continue;
    if (firework) {
      if (inside >= m.length * 0.9 || g.t >= flyTime + CONFIG.GATHER_TIME) formClump(g);
    } else if (Math.sqrt(far) < 0.05 + cometRadius(m.length) || g.t >= flyTime + CONFIG.FUSE_TIME) {
      formComet(g, cx, cy, mvx, mvy);
    }
  }
}

// A firework's particles, gathered, become one new clump that resumes flocking.
function formClump(g) {
  const drift = Math.random() * 1000;
  for (const i of g.members) {
    P.mode[i] = FLOCK;
    P.group[i] = -1;
    P.trail[i] = 0;
    P.cool[i] = CONFIG.CLUMP_COOLDOWN;
    P.drift[i] = drift;
    const sp = Math.hypot(P.vx[i], P.vy[i]);
    if (sp > CONFIG.CLUMP_SPEED) {
      P.vx[i] *= CONFIG.CLUMP_SPEED / sp;
      P.vy[i] *= CONFIG.CLUMP_SPEED / sp;
    }
  }
  scatterGroups.delete(g.id);
}

/* ==========================================================================
   Comets
   --------------------------------------------------------------------------
   A comet carries the particles it was fused from, hidden inside it. It
   flies at COMET_SPEED in a straight line, bounces off the screen edges
   with a little random turn (so no two paths lock into a loop), and trails
   a glowing tail. Its size shows how many particles it holds. The eye does
   not touch it. Two comets that collide disintegrate, and all of their
   particles form one new slow clump at the point of impact.
   ========================================================================== */

let comets = [];
let nextCometId = 1;
let fadingComets = [];
let embers = [];

function cometRadius(n) {
  return CONFIG.COMET_RADIUS * Math.sqrt(n);
}

// The gathered particles fuse; the comet flies on the way the group was drifting.
function formComet(g, cx, cy, mvx, mvy) {
  const n = g.members.length;
  let sp = Math.hypot(mvx, mvy);
  let ux;
  let uy;
  if (sp > 0.05) {
    ux = mvx / sp;
    uy = mvy / sp;
  } else {
    ux = cx - eye.x;
    uy = cy - eye.y;
    sp = Math.hypot(ux, uy) || 1;
    ux /= sp;
    uy /= sp;
  }
  const r = cometRadius(n);
  const c = {
    id: nextCometId++,
    x: clamp(cx, -view.halfW + r, view.halfW - r),
    y: clamp(cy, -view.halfH + r, view.halfH - r),
    vx: ux * CONFIG.COMET_SPEED,
    vy: uy * CONFIG.COMET_SPEED,
    hx: ux,
    hy: uy,
    r,
    cool: CONFIG.COMET_COOLDOWN,
    members: g.members,
    dead: false,
  };
  for (const i of g.members) {
    P.mode[i] = IN_COMET;
    P.group[i] = c.id;
    P.trail[i] = 0;
    P.ccol[i] = Math.random() < 0.6 ? 0 : 2;
  }
  comets.push(c);
  scatterGroups.delete(g.id);
  events.fusions.push(state.time);
}

function updateComets(dt) {
  const jitter = (CONFIG.BOUNCE_JITTER * Math.PI) / 180;
  const point = 1 - Math.exp(-dt / 0.07);
  for (const c of comets) {
    c.cool -= dt;
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    const bw = view.halfW - c.r;
    const bh = view.halfH - c.r;
    let bounced = false;
    if (c.x < -bw) { c.x = -bw; c.vx = Math.abs(c.vx); bounced = true; }
    else if (c.x > bw) { c.x = bw; c.vx = -Math.abs(c.vx); bounced = true; }
    if (c.y < -bh) { c.y = -bh; c.vy = Math.abs(c.vy); bounced = true; }
    else if (c.y > bh) { c.y = bh; c.vy = -Math.abs(c.vy); bounced = true; }
    if (bounced) {
      // a little random turn, but never back out through the edge
      const a = (Math.random() * 2 - 1) * jitter;
      let vx = c.vx * Math.cos(a) - c.vy * Math.sin(a);
      let vy = c.vx * Math.sin(a) + c.vy * Math.cos(a);
      if ((c.x <= -bw && vx < 0) || (c.x >= bw && vx > 0)) vx = -vx;
      if ((c.y <= -bh && vy < 0) || (c.y >= bh && vy > 0)) vy = -vy;
      const sp = Math.hypot(vx, vy) || 1;
      c.vx = (vx / sp) * CONFIG.COMET_SPEED;
      c.vy = (vy / sp) * CONFIG.COMET_SPEED;
    }
    // the head points along the motion; the tail swings round at a bounce
    c.hx += (c.vx / CONFIG.COMET_SPEED - c.hx) * point;
    c.hy += (c.vy / CONFIG.COMET_SPEED - c.hy) * point;
    const hl = Math.hypot(c.hx, c.hy) || 1;
    c.hx /= hl;
    c.hy /= hl;
    for (const i of c.members) {
      P.x[i] = c.x;
      P.y[i] = c.y;
    }
  }
}

/* Comet collisions through a coarse spatial hash: each comet is checked
   only against comets in its own and the neighbouring cells. */
function collideComets() {
  if (comets.length < 2) return;
  let maxR = 0;
  for (const c of comets) maxR = Math.max(maxR, c.r);
  const cell = Math.max(0.2, 2 * maxR);
  const cells = new Map();
  const key = (gx, gy) => gx * 4096 + gy;
  for (const c of comets) {
    const k = key(Math.floor(c.x / cell), Math.floor(c.y / cell));
    if (!cells.has(k)) cells.set(k, []);
    cells.get(k).push(c);
  }
  for (const a of comets) {
    if (a.dead || a.cool > 0) continue;
    const gx = Math.floor(a.x / cell);
    const gy = Math.floor(a.y / cell);
    search: for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        const list = cells.get(key(gx + ox, gy + oy));
        if (!list) continue;
        for (const b of list) {
          if (b === a || b.dead || b.cool > 0) continue;
          if (Math.hypot(b.x - a.x, b.y - a.y) < a.r + b.r) {
            disintegrate(a, b);
            break search;
          }
        }
      }
    }
  }
  comets = comets.filter((c) => !c.dead);
}

/* Two comets collide: a firework. Every particle of both bursts out
   radially from the point of impact at about BURST_SPEED, each at a slightly
   random speed and angle, trailing a short fading streak, while a flash
   lights the impact. They slow under BURST_DRAG and after BURST_TIME gather
   back into one new clump (see updateScatter), which the eye leaves alone for
   CLUMP_COOLDOWN. No particle is created or lost. */
function disintegrate(a, b) {
  const members = a.members.concat(b.members);
  const n = members.length;
  const x = clamp((a.x * b.r + b.x * a.r) / (a.r + b.r), -view.halfW + 0.4, view.halfW - 0.4);
  const y = clamp((a.y * b.r + b.y * a.r) / (a.r + b.r), -view.halfH + 0.4, view.halfH - 0.4);
  // a little of the comets' shared momentum carries the whole burst
  const mvx = ((a.vx * a.members.length + b.vx * b.members.length) / n) * 0.1;
  const mvy = ((a.vy * a.members.length + b.vy * b.members.length) / n) * 0.1;
  const g = { id: nextGroupId++, kind: 'firework', members, t: 0 };
  const turn = Math.random() * TAU;
  members.forEach((i, j) => {
    const base = turn + j * 2.399963; // evenly round the circle …
    const [ux, uy] = burstDirection(Math.cos(base), Math.sin(base)); // … then roughened
    const sp = CONFIG.BURST_SPEED * (1 + (Math.random() * 2 - 1) * CONFIG.BURST_SPREAD);
    P.x[i] = P.lx[i] = x + ux * 0.02;
    P.y[i] = P.ly[i] = y + uy * 0.02;
    P.vx[i] = ux * sp + mvx;
    P.vy[i] = uy * sp + mvy;
    P.mode[i] = SCATTERED;
    P.group[i] = g.id;
    P.trail[i] = CONFIG.TRAIL_LENGTH;
    P.cmix[i] = 1; // they burst in the comet's colours, then fade to their own
  });
  scatterGroups.set(g.id, g);
  flashes.push({ x, y, age: 0, life: CONFIG.BURST_FLASH, size: 0.35 + 0.5 * Math.min(1, Math.sqrt(n / 400)) });
  retire(a, x, y);
  retire(b, x, y);
  events.collisions.push(state.time);
}

/* ── Click to spawn ───────────────────────────────────────────────────────
   A click adds a small new clump at the cursor, blooming out from the click.
   It is safe from the eye for CLICK_COOLDOWN. This is the only way the total
   ever changes: scattering, fusing and colliding never create or destroy a
   particle. At MAX_PARTICLES a click does nothing (nor when there is room for
   fewer than MIN_CLUMP, which would only be strays). Returns how many it added. */
function spawnClump(x, y) {
  const room = CONFIG.MAX_PARTICLES - P.n;
  const [lo, hi] = CONFIG.CLICK_CLUMP_SIZE;
  const n = Math.min(Math.round(lo + Math.random() * (hi - lo)), room);
  if (n < CONFIG.MIN_CLUMP) return 0;
  x = clamp(x, -view.halfW + 0.3, view.halfW - 0.3);
  y = clamp(y, -view.halfH + 0.3, view.halfH - 0.3);
  const R = Math.sqrt(n) * CONFIG.SEPARATION_RADIUS * 0.55;
  const turn = Math.random() * TAU;
  const drift = Math.random() * 1000;
  for (let j = 0; j < n; j++) {
    const i = P.n + j;
    const u = Math.sqrt((j + 0.5) / n);
    const a = turn + j * 2.399963;
    P.x[i] = P.lx[i] = x + Math.cos(a) * R * u * 0.35;
    P.y[i] = P.ly[i] = y + Math.sin(a) * R * u * 0.35;
    P.vx[i] = Math.cos(a) * CONFIG.CLUMP_SPEED * (0.2 + 0.5 * u);
    P.vy[i] = Math.sin(a) * CONFIG.CLUMP_SPEED * (0.2 + 0.5 * u);
    dressParticle(i);
    P.mode[i] = FLOCK;
    P.group[i] = -1;
    P.cool[i] = CONFIG.CLICK_COOLDOWN;
    P.ccol[i] = 0;
    P.cmix[i] = 0.7; // born bright, settling into its own colour
    P.drift[i] = drift;
  }
  P.n += n;
  state.spawned += n;
  events.spawns.push(state.time);
  for (let k = 0; k < 6; k++) {
    const a = Math.random() * TAU;
    const v = CONFIG.emberScatter * (0.3 + 0.5 * Math.random());
    spawnEmber(x, y, Math.cos(a) * v, Math.sin(a) * v, Math.random() < 0.6 ? 0 : 3, 0.7);
  }
  return n;
}

// A comet's glow does not vanish: it swells and fades, throwing off sparks.
function retire(c, ix, iy) {
  c.mass = c.members.length || 1;
  c.members = [];
  c.dead = true;
  c.fade = 1;
  fadingComets.push(c);
  const count = Math.round(2 + CONFIG.EMBER_COUNT * 0.5 * Math.min(1, c.mass / 400)); // the firework is the show; a few sparks only
  const scatter = CONFIG.emberScatter;
  for (let k = 0; k < count; k++) {
    const a = Math.random() * TAU;
    const v = scatter * (0.4 + Math.random());
    const r = Math.random();
    spawnEmber(ix, iy, Math.cos(a) * v + c.vx * 0.15, Math.sin(a) * v + c.vy * 0.15, r < 0.5 ? 0 : r < 0.85 ? 2 : 3, 0.7 + 0.6 * Math.random());
  }
}

function spawnEmber(x, y, vx, vy, col, size) {
  if (embers.length >= CONFIG.emberMax) return;
  const [l0, l1] = CONFIG.emberLife;
  embers.push({ x, y, lx: x, ly: y, vx, vy, col, size: size * CONFIG.emberSize, age: 0, life: lerp(l0, l1, Math.random()) });
}

function updateFading(dt) {
  const drag = Math.exp(-dt / 0.6);
  for (const c of fadingComets) {
    c.fade -= dt / CONFIG.COMET_FADE_TIME;
    c.vx *= drag;
    c.vy *= drag;
    c.x += c.vx * dt * 0.2;
    c.y += c.vy * dt * 0.2;
  }
  fadingComets = fadingComets.filter((c) => c.fade > 0);
  const edrag = Math.exp(-dt / 0.9);
  for (const e of embers) {
    e.age += dt;
    e.vx *= edrag;
    e.vy *= edrag;
    e.x += e.vx * dt;
    e.y += e.vy * dt;
  }
  embers = embers.filter((e) => e.age < e.life);
  for (const f of flashes) f.age += dt;
  flashes = flashes.filter((f) => f.age < f.life);
}

function clearComets() {
  comets = [];
  fadingComets = [];
  embers = [];
  flashes = [];
  scatterGroups.clear();
  for (const k of Object.keys(events)) events[k].length = 0;
}

// Cooldowns and comet colours fade for every particle outside a comet.
function ageParticles(dt) {
  const fade = 1 - Math.exp(-dt / CONFIG.starColourFade);
  for (let i = 0; i < P.n; i++) {
    if (P.cool[i] > 0) P.cool[i] -= dt;
    if (P.mode[i] !== IN_COMET && P.cmix[i] > 0) {
      P.cmix[i] *= 1 - fade;
      if (P.cmix[i] < 0.01) P.cmix[i] = 0;
    }
  }
}

function pruneEvents() {
  const old = state.time - 10;
  for (const k of Object.keys(events)) {
    const a = events[k];
    while (a.length && a[0] < old) a.shift();
  }
}

/* ==========================================================================
   The eye: a living polar spectrogram
   --------------------------------------------------------------------------
   After "Eye Design.mp4": a disk of fine, grainy light written ray by ray
   around a dark, ragged pupil. Each ray is one moment of an imagined sound:
   bands of light and shadow at different radii, cloudy dark patches, grain,
   the occasional bright sustained tone that draws a thin arc, and a ragged,
   hairy rim. The write head turns steadily, and the disk is drawn rotated
   so that fresh light always enters at a fixed seam at 12 o'clock while
   the older light turns away from it.
   ========================================================================== */

const iris = {
  N: 0, canvas: null, ictx: null, img: null, data: null, lut: null,
  head: 0,        // angle of the write head in texture space
  clock: 0,       // the imagined sound's own time
  tones: [],      // sustained tones: thin bright arcs
  flash: 0, flashT: -1, flashWait: 7,
};

function buildIrisLut() {
  const stops = CONFIG.colors.iris;
  const lut = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const v = i / 255;
    let k = 0;
    while (k < stops.length - 2 && v > stops[k + 1][0]) k++;
    const [p0, c0] = stops[k];
    const [p1, c1] = stops[k + 1];
    const f = clamp((v - p0) / (p1 - p0), 0, 1);
    for (let j = 0; j < 3; j++) lut[i * 3 + j] = Math.round(lerp(c0[j], c1[j], f));
  }
  return lut;
}

function buildIrisTexture() {
  const N = CONFIG.eyeTextureSize;
  iris.N = N;
  iris.canvas = document.createElement('canvas');
  iris.canvas.width = iris.canvas.height = N;
  iris.ictx = iris.canvas.getContext('2d');
  iris.img = iris.ictx.createImageData(N, N);
  iris.data = iris.img.data;
  for (let p = 3; p < iris.data.length; p += 4) iris.data[p] = 255;
  iris.lut = buildIrisLut();
  iris.tones = [];
  iris.head = 0;
  iris.clock = 0;
  iris.flashT = -1;
  iris.flashWait = lerp(CONFIG.eyeFlashEvery[0], CONFIG.eyeFlashEvery[1], Math.random());
  // Write one whole turn so the eye starts complete, the seam at 12 o'clock.
  const w = TAU / CONFIG.eyeSweepPeriod;
  const dA = 0.7 / (N / 2 - 1);
  for (let a = -TAU; a < 0; a += dA) writeRay(a, a / w);
  iris.ictx.putImageData(iris.img, 0, 0);
}

// One ray of the spectrogram: pupil, banded iris, ragged rim, fine hairs.
function writeRay(a, t) {
  const { N, data, lut } = iris;
  const c = N / 2;
  const Rpx = c - 1;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const burst = hash1(Math.floor(t * 24) + 0.5) > 0.965 ? 0.35 : 0;
  const loud = 0.8 + 0.22 * vnoise1(t * 1.7) + 0.12 * vnoise1(t * 7.3 + 3) + burst;
  const pupil = CONFIG.eyePupil * (1 + 0.35 * state.energy) * (1 + 0.14 * vnoise1(a * 9 + t * 0.6) + 0.06 * vnoise1(a * 31));
  const edge = 0.88 + 0.06 * vnoise1(a * 3.1 + t * 0.35) + 0.04 * vnoise1(a * 13 + t);
  const hair = hash1(a * 997 + t * 13) > 0.93 ? 0.03 + 0.08 * hash1(a * 57 + t) : 0;
  const b1 = 0.14 + 0.03 * vnoise1(t * 0.3);
  const b2 = 0.52 + 0.05 * vnoise1(t * 0.23 + 5);
  const b3 = 0.86 + 0.03 * vnoise1(t * 0.4 + 9);
  const d1 = 0.36 + 0.04 * vnoise1(t * 0.27 + 2);
  const d2 = 0.7 + 0.03 * vnoise1(t * 0.31 + 7);
  const fibreSeed = hash1(a * 7.31 + t * 0.77) * 50; // each ray its own fibres
  const fibreAmp = 0.5 + 0.5 * hash1(a * 3.3 + t * 1.9);
  const tones = iris.tones;

  for (let k = 0; k <= Rpx; k++) {
    const r = k / Rpx;
    let v = 0;
    if (r < pupil) {
      // a dark pupil, with faint radial striation just inside its rim
      const q = r / pupil;
      v = 0.04 + 0.2 * q * q * q * (0.4 + 0.6 * hash1(k * 3.7 + a * 211 + t));
    } else if (r <= edge) {
      const u = (r - pupil) / (edge - pupil);
      let band = 0.58;
      band += 0.32 * Math.exp(-(((u - b1) / 0.1) ** 2)); // bright collar round the pupil
      band += 0.22 * Math.exp(-(((u - b2) / 0.14) ** 2));
      band += 0.3 * Math.exp(-(((u - b3) / 0.08) ** 2));
      band -= 0.24 * Math.exp(-(((u - d1) / 0.04) ** 2)); // darker rings
      band -= 0.2 * Math.exp(-(((u - d2) / 0.035) ** 2));
      const patch = 0.32 + 0.68 * smoothstep(-0.45, 0.4, vnoise2(t * 0.7, u * 4.2)); // cloudy shadows
      const fibre = 0.5 + 0.5 * vnoise1(k * 0.11 + fibreSeed); // smooth along the ray: radial fibres
      const grain = hash1(k * 12.9898 + t * 78.233 + a * 3.1);
      v = band * patch * (0.3 + 0.55 * fibre * fibreAmp + 0.45 * grain * grain) * loud * CONFIG.eyeBrightness;
      v *= smoothstep(0, 0.08, u) * (1 - 0.35 * smoothstep(0.85, 1, u));
      for (let j = 0; j < tones.length; j++) {
        const tn = tones[j];
        if (tn.on) v += tn.amp * Math.exp(-(((u - tn.u) / 0.012) ** 2));
      }
    } else if (r <= edge + hair) {
      v = 0.3 * hash1(k * 5.1 + t * 17); // fine hairs past the rim
    }
    const li = Math.min(255, (v * 255) | 0) * 3;
    const p = (((c + sa * k + 0.5) | 0) * N + ((c + ca * k + 0.5) | 0)) * 4;
    data[p] = lut[li];
    data[p + 1] = lut[li + 1];
    data[p + 2] = lut[li + 2];
  }
}

function updateIris(dt) {
  const e = state.energy;
  const speed = 1 + 0.9 * e; // the eye writes faster while the field is excited
  const w = (TAU / CONFIG.eyeSweepPeriod) * speed;
  const from = iris.head;
  const t0 = iris.clock;
  iris.head += w * dt;
  iris.clock += dt * speed;

  // Sustained tones appear now and then, flickering into dashed arcs.
  if (Math.random() < dt * (0.9 + 2 * e)) {
    iris.tones.push({ u: 0.15 + Math.random() * 0.8, amp: 0.35 + Math.random() * 0.45, left: 0.2 + Math.random() * 1.1, on: true });
  }
  for (const tn of iris.tones) {
    tn.left -= dt;
    tn.on = Math.random() < 0.8;
  }
  iris.tones = iris.tones.filter((tn) => tn.left > 0);

  const dA = 0.7 / (iris.N / 2 - 1);
  const n = Math.max(1, Math.ceil((iris.head - from) / dA));
  for (let s = 1; s <= n; s++) {
    const f = s / n;
    writeRay(from + (iris.head - from) * f, t0 + (iris.clock - t0) * f);
  }
  iris.ictx.putImageData(iris.img, 0, 0);

  // Now and then the whole iris thins to sparse rings of light, then refills.
  if (iris.flashT >= 0) {
    iris.flashT += dt;
    if (iris.flashT > CONFIG.eyeFlashDuration) {
      iris.flashT = -1;
      iris.flashWait = lerp(CONFIG.eyeFlashEvery[0], CONFIG.eyeFlashEvery[1], Math.random());
    }
  } else {
    iris.flashWait -= dt;
    if (iris.flashWait <= 0) iris.flashT = 0;
  }
  iris.flash = iris.flashT >= 0 ? Math.sin((Math.PI * iris.flashT) / CONFIG.eyeFlashDuration) : 0;
}

/* ── The eyeball's rotation ───────────────────────────────────────────────
   The eyeball turns toward the cursor in every direction, further the
   further away the cursor is. A damped spring gives it a small delay, a
   slight overshoot and a settle, like a real eye; a faster cursor stiffens
   the spring, so the eye moves more quickly. While the cursor rests, tiny
   saccades keep it alive, and it rolls slightly as it turns. */
const eyeball = { ox: 0, oy: 0, vx: 0, vy: 0, roll: 0, saccX: 0, saccY: 0, saccWait: 1.5 };

function updateEyeball(dt) {
  // The iris looks the way the eye is heading: fully while it hunts, a little less at rest.
  const m = Math.sin(CONFIG.EYE_MAX_TURN * (0.55 + 0.45 * smoothstep(0, 1.5, eye.speed)));
  let tx = eye.hx * m;
  let ty = eye.hy * m;

  eyeball.saccWait -= dt;
  if (eyeball.saccWait <= 0) {
    const calm = (1 - state.cursorEnergy) * CONFIG.BASE_MOTION;
    eyeball.saccWait = 0.8 + Math.random() * 2.2;
    eyeball.saccX = (Math.random() - 0.5) * 0.06 * calm;
    eyeball.saccY = (Math.random() - 0.5) * 0.05 * calm;
  }
  tx += eyeball.saccX;
  ty += eyeball.saccY;

  const k = CONFIG.EYE_STIFFNESS * (1 + CONFIG.EYE_SPEED_RESPONSE * state.cursorEnergy);
  const c = 2 * Math.sqrt(k) * CONFIG.EYE_DAMPING;
  const steps = Math.max(1, Math.ceil(dt * 120));
  const h = dt / steps;
  for (let s = 0; s < steps; s++) {
    eyeball.vx += (k * (tx - eyeball.ox) - c * eyeball.vx) * h;
    eyeball.vy += (k * (ty - eyeball.oy) - c * eyeball.vy) * h;
    eyeball.ox += eyeball.vx * h;
    eyeball.oy += eyeball.vy * h;
  }
  const lim = Math.sin(CONFIG.EYE_MAX_TURN) * 1.05;
  const ol = Math.hypot(eyeball.ox, eyeball.oy);
  if (ol > lim) {
    eyeball.ox *= lim / ol;
    eyeball.oy *= lim / ol;
  }
  const roll = clamp(0.35 * eyeball.ox * eyeball.oy + 0.04 * eyeball.vx, -0.2, 0.2);
  eyeball.roll += (roll - eyeball.roll) * (1 - Math.exp(-dt / 0.15));
}

function resetEyeball() {
  eyeball.ox = eyeball.oy = eyeball.vx = eyeball.vy = eyeball.roll = 0;
}

/* ==========================================================================
   Simulation
   ========================================================================== */

function simulate(dt) {
  updateEye(dt);
  updateArrows(dt);
  ageParticles(dt);
  flock(dt);
  hunt();
  updateScatter(dt);
  updateComets(dt);
  collideComets();
  updateFading(dt);
  pruneEvents();
  updateIris(dt);
  updateEyeball(dt);
}

/* ==========================================================================
   Rendering
   ========================================================================== */

function render(dt) {
  const s = view.dpr * view.cell;
  const ox = view.dpr * view.cx;
  const oy = view.dpr * view.cy;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (!state.paused) drawTrails(dt);
  ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(trail, 0, 0, canvas.width, canvas.height);

  // A fading layer never quite reaches zero (8-bit rounding leaves a faint
  // floor). A slight colour-burn sets the black point just above that
  // floor, so old trails vanish into pure black instead of leaving haze.
  ctx.globalCompositeOperation = 'color-burn';
  ctx.fillStyle = `rgb(${CONFIG.trailBlackPoint}, ${CONFIG.trailBlackPoint}, ${CONFIG.trailBlackPoint})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (state.showVectors && intro.phase === 'done') drawArrows();

  ctx.globalCompositeOperation = 'lighter';
  ctx.setTransform(s, 0, 0, s, ox, oy);
  if (intro.glow > 0.001) drawIntroGlow();
  drawComets();
  drawFlashes();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawStreaks();
  drawStars();
  drawEmbers();

  // the eye, wherever it has got to (condensing out of the galaxy at first)
  ctx.setTransform(s, 0, 0, s, ox, oy);
  ctx.globalCompositeOperation = 'source-over';
  if (intro.eye > 0.001) {
    ctx.save();
    ctx.translate(eye.x, eye.y);
    if (intro.eye < 1) ctx.scale(intro.eye, intro.eye);
    drawEye();
    ctx.restore();
  }
  drawCursor();
  if (state.debug) drawDebug();
}

/* ── Star trails ──────────────────────────────────────────────────────────
   The trail layer fades a little every frame, and each particle draws a
   thin line into it from where it was to where it is. */
const trailPaths = [];

function drawTrails(dt) {
  const ts = view.tdpr * view.cell;
  const tox = view.tdpr * view.cx;
  const toy = view.tdpr * view.cy;
  tctx.setTransform(1, 0, 0, 1, 0, 0);

  if (state.clearTrails) {
    tctx.clearRect(0, 0, trail.width, trail.height);
    state.clearTrails = false;
  } else {
    const seconds = CONFIG.TRAIL_SECONDS * (1 + CONFIG.TRAIL_ENERGY_MULTIPLIER * state.cursorEnergy);
    tctx.globalCompositeOperation = 'destination-out';
    tctx.globalAlpha = 1;
    tctx.fillStyle = `rgba(0, 0, 0, ${1 - Math.exp(-Math.max(dt, 1 / 240) / seconds)})`;
    tctx.fillRect(0, 0, trail.width, trail.height);
  }

  for (let c = 0; c < starColours.length; c++) trailPaths[c] = new Path2D();
  for (let i = 0; i < P.n; i++) {
    if (P.mode[i] === IN_COMET || P.trail[i] > 0) {
      P.lx[i] = P.x[i]; // inside a comet, or bursting (it draws its own streak instead)
      P.ly[i] = P.y[i];
      continue;
    }
    const x = tox + P.x[i] * ts;
    const y = toy + P.y[i] * ts;
    const x0 = tox + P.lx[i] * ts;
    const y0 = toy + P.ly[i] * ts;
    P.lx[i] = P.x[i];
    P.ly[i] = P.y[i];
    const seg = Math.abs(x - x0) + Math.abs(y - y0);
    if (seg > 0.3 && seg < ts * 1.2) {
      const p = trailPaths[P.cmix[i] > 0.5 ? P.ccol[i] : P.col[i]];
      p.moveTo(x0, y0);
      p.lineTo(x, y);
    }
  }
  // sparks leave faint streaks too
  for (const e of embers) {
    const x = tox + e.x * ts;
    const y = toy + e.y * ts;
    const x0 = tox + e.lx * ts;
    const y0 = toy + e.ly * ts;
    e.lx = e.x;
    e.ly = e.y;
    if (Math.abs(x - x0) + Math.abs(y - y0) > 0.3) {
      trailPaths[e.col].moveTo(x0, y0);
      trailPaths[e.col].lineTo(x, y);
    }
  }

  tctx.globalCompositeOperation = 'lighter';
  tctx.globalAlpha = 1;
  tctx.lineWidth = Math.max(0.6, 0.6 * view.tdpr);
  tctx.lineCap = 'round';
  for (let c = 0; c < starColours.length; c++) {
    tctx.strokeStyle = `rgba(${starColours[c]}, ${CONFIG.trailOpacity * intro.starVis})`;
    tctx.stroke(trailPaths[c]);
  }
}

/* ── Burst streaks ─────────────────────────────────────────────────────────
   A bursting particle draws its own short streak back along its motion:
   TRAIL_LENGTH seconds of it for a firework, SCATTER_TRAIL for the eye's
   softer scatter. It fades toward the tail in three steps and shortens as
   drag slows the particle, until it is gone. */
const STREAK_STEPS = 3;
const streakPaths = [];

function drawStreaks() {
  const s = view.dpr * view.cell;
  const ox = view.dpr * view.cx;
  const oy = view.dpr * view.cy;
  streakPaths.length = 0;
  let any = false;
  for (let i = 0; i < P.n; i++) {
    if (P.mode[i] !== SCATTERED || P.trail[i] <= 0) continue;
    const vx = P.vx[i];
    const vy = P.vy[i];
    if (vx * vx + vy * vy < 0.15 * 0.15) continue;
    const col = P.cmix[i] > 0.5 ? P.ccol[i] : P.col[i];
    const x = ox + P.x[i] * s;
    const y = oy + P.y[i] * s;
    const dx = (-vx * P.trail[i] * s) / STREAK_STEPS;
    const dy = (-vy * P.trail[i] * s) / STREAK_STEPS;
    for (let l = 0; l < STREAK_STEPS; l++) {
      const k = col * STREAK_STEPS + l;
      const p = streakPaths[k] || (streakPaths[k] = new Path2D());
      p.moveTo(x + dx * l, y + dy * l);
      p.lineTo(x + dx * (l + 1), y + dy * (l + 1));
    }
    any = true;
  }
  if (!any) return;
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1, 1.3 * view.dpr);
  for (let k = 0; k < streakPaths.length; k++) {
    if (!streakPaths[k]) continue;
    const c = Math.floor(k / STREAK_STEPS);
    const l = k % STREAK_STEPS;
    ctx.strokeStyle = `rgba(${starColours[c]}, ${0.55 * (1 - l / STREAK_STEPS) * intro.starVis})`;
    ctx.stroke(streakPaths[k]);
  }
}

/* The star heads: small glowing points drawn fresh every frame. Scattered
   particles flare a little; particles fresh from a comet glow in its
   colours and cross-fade back to their own. */
function drawStars() {
  const s = view.dpr * view.cell;
  const ox = view.dpr * view.cx;
  const oy = view.dpr * view.cy;
  const size = (CONFIG.PARTICLE_SIZE * s) / STAR_CORE;
  const base = CONFIG.starOpacity * intro.starVis;
  for (let i = 0; i < P.n; i++) {
    const mode = P.mode[i];
    if (mode === IN_COMET) continue;
    const m = P.cmix[i];
    const a = Math.min(1, P.bright[i] * base * (mode === SCATTERED ? 1.3 : 1) * (1 + 0.3 * m));
    const r = size * P.size[i] * (1 + 0.1 * m);
    const x = ox + P.x[i] * s - r;
    const y = oy + P.y[i] * s - r;
    if (m < 0.02) {
      ctx.globalAlpha = a;
      ctx.drawImage(starSprites[P.col[i]], x, y, 2 * r, 2 * r);
    } else {
      ctx.globalAlpha = a * (1 - m);
      ctx.drawImage(starSprites[P.col[i]], x, y, 2 * r, 2 * r);
      ctx.globalAlpha = a * m;
      ctx.drawImage(starSprites[P.ccol[i]], x, y, 2 * r, 2 * r);
    }
  }
  ctx.globalAlpha = 1;
}


// Sparks: they ease in, then shrink and fade over their short lives.
function drawEmbers() {
  if (!embers.length) return;
  const s = view.dpr * view.cell;
  const ox = view.dpr * view.cx;
  const oy = view.dpr * view.cy;
  const size = (CONFIG.PARTICLE_SIZE * s) / STAR_CORE;
  for (const e of embers) {
    const u = 1 - e.age / e.life;
    const r = size * e.size * (0.25 + 0.75 * u);
    ctx.globalAlpha = CONFIG.starOpacity * u * u * smoothstep(0, 0.15, e.age);
    ctx.drawImage(starSprites[e.col], ox + e.x * s - r, oy + e.y * s - r, 2 * r, 2 * r);
  }
  ctx.globalAlpha = 1;
}

/* ── Impact flash ──────────────────────────────────────────────────────────
   Where two comets collide: a bright core that swells and fades over
   BURST_FLASH, a soft halo, and a thin shock ring racing outward ahead of
   the burst. (The eye's scatter has none.) */
function drawFlashes() {
  for (const f of flashes) {
    const u = f.age / f.life;
    const a = (1 - u) * (1 - u);
    const r = f.size * (0.5 + 1.2 * Math.sqrt(u));
    ctx.globalAlpha = a;
    ctx.drawImage(cometHeadSprite, f.x - r, f.y - r, 2 * r, 2 * r);
    const h = r * 2.6;
    ctx.globalAlpha = a * 0.9;
    ctx.drawImage(haloSprite, f.x - h, f.y - h, 2 * h, 2 * h);
    ctx.globalAlpha = a * 0.55;
    ctx.strokeStyle = 'rgb(255, 238, 205)';
    ctx.lineWidth = (0.6 + 1.8 * (1 - u)) * PX;
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.size * 0.3 + CONFIG.BURST_SPEED * f.age * 0.6, 0, TAU);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/* ── Comets ─────────────────────────────────────────────────────────────────
   After the comet photograph: a small, intensely bright head; a broad gold
   dust fan; a long, narrow blue ion tail with a violet fringe, all streaming
   opposite the motion. Head and tail grow with the particles inside. A
   comet that collides swells a little as its glow fades away. */
function drawComets() {
  for (const c of comets) drawComet(c, 1);
  for (const c of fadingComets) {
    const v = Math.max(0, c.fade);
    drawComet(c, v * v * (3 - 2 * v));
  }
  ctx.globalAlpha = 1;
}

function drawComet(c, vis) {
  const n = c.members.length || c.mass || 1;
  const k = Math.min(1, Math.sqrt(n / 400)); // size: 400 particles is a full-grown comet
  const L = CONFIG.COMET_TAIL * (0.3 + 0.7 * k) * (0.5 + 0.5 * vis);
  const back = Math.atan2(-c.hy, -c.hx);
  const tail = (sprite, angle, len, width, alpha) => {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(back + angle);
    ctx.globalAlpha = alpha * (0.5 + 0.5 * k) * vis;
    ctx.drawImage(sprite, 0, -width / 2, len, width);
    ctx.restore();
  };
  tail(tailSprites.dust, -0.1, L * 1.0, L * 0.6, 0.5);
  tail(tailSprites.head, -0.04, L * 0.55, L * 0.2, 0.5);
  tail(tailSprites.violet, 0.05, L * 1.25, L * 0.22, 0.38);
  tail(tailSprites.ion, 0.02, L * 1.45, L * 0.09, 0.75);
  const hr = (0.04 + c.r * 1.5) * (1 + 0.6 * (1 - vis));
  ctx.globalAlpha = vis;
  ctx.drawImage(cometHeadSprite, c.x - hr, c.y - hr, hr * 2, hr * 2);
  ctx.drawImage(cometHeadSprite, c.x - hr * 0.4, c.y - hr * 0.4, hr * 0.8, hr * 0.8);
}


/* ── The cosmic eyeball ───────────────────────────────────────────────────────
   Fixed at the centre; only the eyeball turns. A galactic glow surrounds it,
   brighter while the cursor moves fast. The sclera is a luminous pearl
   sphere lit from the upper left, with nebula and stars inside it that turn
   with the eyeball. On its surface the spectral iris and the pupil rotate
   toward the cursor, foreshortening as they turn away from the viewer. Limb
   shading, a fresnel rim and a fixed specular highlight make it round. */
function drawEye() {
  const R = CONFIG.EYEBALL_RADIUS;
  const Ri = CONFIG.IRIS_RADIUS;
  const glowE = Math.max(state.cursorEnergy, 0.5 * state.energy);
  const [neb1, neb2] = CONFIG.colors.nebula;
  const ox = eyeball.ox;
  const oy = eyeball.oy;
  const oz = Math.sqrt(Math.max(0, 1 - ox * ox - oy * oy));

  // galactic glow
  ctx.globalCompositeOperation = 'lighter';
  const ga = CONFIG.EYE_GLOW + 0.6 * glowE;
  const glow = ctx.createRadialGradient(0, 0, R * 0.85, 0, 0, R * 2.3);
  glow.addColorStop(0, `rgba(${CONFIG.colors.eyeGlow}, ${ga})`);
  glow.addColorStop(0.3, `rgba(${neb1}, ${ga * 0.45})`);
  glow.addColorStop(1, `rgba(${neb2}, 0)`);
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, R * 2.3, 0, TAU);
  ctx.fill();

  // sclera
  ctx.globalCompositeOperation = 'source-over';
  const scl = ctx.createRadialGradient(-R * 0.35, -R * 0.4, R * 0.05, 0, 0, R);
  scl.addColorStop(0, 'rgb(206, 213, 236)');
  scl.addColorStop(0.45, 'rgb(146, 156, 198)');
  scl.addColorStop(0.85, 'rgb(54, 62, 112)');
  scl.addColorStop(1, 'rgb(20, 22, 48)');
  ctx.fillStyle = scl;
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, TAU);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, TAU);
  ctx.clip();

  // the galaxy inside the sclera, turning with the eyeball
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.9;
  const gs = R * 1.5;
  ctx.save();
  ctx.translate(ox * R * 0.8, oy * R * 0.8);
  ctx.rotate(state.time * 0.02 + eyeball.roll);
  ctx.drawImage(eyeGalaxy, -gs, -gs, gs * 2, gs * 2);
  ctx.restore();
  ctx.globalAlpha = 1;

  // the iris and pupil, on the eyeball's surface, turned toward the cursor
  const look = Math.atan2(oy, ox);
  ctx.save();
  ctx.translate(ox * R * 0.95, oy * R * 0.95);
  ctx.rotate(look);
  ctx.scale(Math.max(0.3, oz), 1);
  ctx.rotate(-look + eyeball.roll);

  ctx.globalCompositeOperation = 'source-over';
  const base = ctx.createRadialGradient(0, 0, 0, 0, 0, Ri * 1.04);
  base.addColorStop(0, 'rgb(4, 5, 12)');
  base.addColorStop(0.85, 'rgb(10, 12, 30)');
  base.addColorStop(1, 'rgba(10, 12, 30, 0)');
  ctx.fillStyle = base;
  ctx.beginPath();
  ctx.arc(0, 0, Ri * 1.04, 0, TAU);
  ctx.fill();

  const f = iris.flash;
  const half = Ri / 0.92;
  ctx.globalCompositeOperation = 'lighter';
  ctx.save();
  ctx.rotate(-Math.PI / 2 - iris.head);
  ctx.globalAlpha = 1 - 0.9 * f;
  ctx.drawImage(iris.canvas, -half, -half, half * 2, half * 2);
  ctx.restore();
  if (f > 0.01) drawSparseRings(f, Ri);

  // limbal ring
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 0.6;
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2 * PX;
  ctx.beginPath();
  ctx.arc(0, 0, Ri * 0.99, 0, TAU);
  ctx.stroke();

  // pupil, widening with energy, ringed with a faint gold glint
  const pr = Ri * CONFIG.eyePupil * (1 + 0.28 * state.energy);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(0, 0, pr, 0, TAU);
  ctx.fill();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = `rgba(${CONFIG.colors.photon}, 0.55)`;
  ctx.lineWidth = 1 * PX;
  ctx.beginPath();
  ctx.arc(0, 0, pr * 1.05, 0, TAU);
  ctx.stroke();
  ctx.restore();

  // limb shading: the sphere darkens toward its edge
  ctx.globalCompositeOperation = 'source-over';
  const limb = ctx.createRadialGradient(0, 0, R * 0.5, 0, 0, R);
  limb.addColorStop(0, 'rgba(0, 2, 12, 0)');
  limb.addColorStop(1, 'rgba(0, 2, 12, 0.6)');
  ctx.fillStyle = limb;
  ctx.fillRect(-R, -R, R * 2, R * 2);
  ctx.restore();

  // fresnel rim light
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = `rgba(${CONFIG.colors.eyeGlow}, ${0.35 + 0.45 * glowE})`;
  ctx.lineWidth = 1.2 * PX;
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.995, 0, TAU);
  ctx.stroke();

  // specular highlights from a fixed light
  const hl = (x, y, r, a) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255, 255, 255, ${a})`);
    g.addColorStop(0.35, `rgba(235, 240, 255, ${a * 0.5})`);
    g.addColorStop(1, 'rgba(235, 240, 255, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  };
  hl(-R * 0.36, -R * 0.4, R * 0.16, 0.9);
  hl(R * 0.3, R * 0.34, R * 0.07, 0.35);
  ctx.globalCompositeOperation = 'source-over';
}

/* The galaxy inside the sclera, used with the overlay blend: violet and
   blue dust lanes darken and tint it, gold clouds and stars lighten it. */
function buildEyeGalaxy(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const m = size / 2;
  const rand = mulberry32(31);
  const blob = (x, y, r, rgb, a) => {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(${rgb}, ${a})`);
    gr.addColorStop(1, `rgba(${rgb}, 0)`);
    g.fillStyle = gr;
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fill();
  };
  // two loose spiral arms of dust and glow
  for (let arm = 0; arm < 2; arm++) {
    for (let k = 0; k < 26; k++) {
      const t = k / 26;
      const ang = arm * Math.PI + t * 4.2;
      const rad = m * (0.12 + 0.8 * t);
      const x = m + Math.cos(ang) * rad;
      const y = m + Math.sin(ang) * rad;
      blob(x, y, m * (0.1 + 0.12 * rand()), rand() < 0.55 ? '40, 34, 110' : '30, 60, 140', 0.35 + 0.2 * rand());
      blob(x + (rand() - 0.5) * m * 0.2, y + (rand() - 0.5) * m * 0.2, m * (0.05 + 0.08 * rand()), rand() < 0.6 ? '255, 226, 170' : '200, 215, 255', 0.25 + 0.2 * rand());
    }
  }
  for (let k = 0; k < 420; k++) {
    const r = Math.pow(rand(), 0.6) * m;
    const a = rand() * TAU;
    const s = 0.5 + Math.pow(rand(), 4) * 2.5;
    g.fillStyle = rand() < 0.75 ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 220, 160, 0.9)';
    g.beginPath();
    g.arc(m + Math.cos(a) * r, m + Math.sin(a) * r, s, 0, TAU);
    g.fill();
  }
  return c;
}

/* The eye's "blink", as in the reference: for a moment the dense iris
   thins to sparse dotted rings and short radial dashes, then refills. */
function drawSparseRings(f, R) {
  ctx.globalAlpha = f;
  ctx.strokeStyle = `rgba(${CONFIG.colors.ui}, 0.85)`;
  ctx.lineWidth = 1.1 * PX;
  ctx.setLineDash([1.2 * PX, 4 * PX]);
  for (let k = 0; k < 7; k++) {
    ctx.lineDashOffset = k * 3 * PX;
    ctx.beginPath();
    ctx.arc(0, 0, R * (0.34 + k * 0.1), 0, TAU);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.beginPath();
  for (let k = 0; k < 140; k++) {
    const a = (k / 140) * TAU;
    const r0 = R * (0.33 + 0.02 * hash1(k));
    const r1 = r0 + R * (0.04 + 0.08 * hash1(k * 3.1));
    ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
    ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/* ---- V: the vector field that drives the particles ------------------------ */

/* ── Vector field arrows (V) ──────────────────────────────────────────────
   A grid of arrows, one every ARROW_SPACING pixels, showing the eye's force
   where it is active:
     · inside the vision cone, pushed away from the eye
     · behind the eye, its wake, drawn back toward it
     · elsewhere there is no force, and no arrow
   Length (ARROW_MIN_LENGTH … ARROW_MAX_LENGTH) and opacity (up to
   ARROW_OPACITY) grow with the force: near the eye, and with cursor speed.
   An arrow grows quickly as the eye's force arrives (ARROW_RISE) and eases
   back over ARROW_EASE seconds. The whole field starts hidden, fades in over
   ARROW_FADE seconds once the cursor moves the eye, and fades back out to
   nothing when the cursor stops. (A picture of the eye's reach: its only
   real effect is still to scatter the clumps inside its cone.) */
const arrows = { n: 0, cols: 0, rows: 0, w: 0, h: 0, spacing: 0, vis: 0, px: null, py: null, x: null, y: null, ax: null, ay: null };
const EF = { x: 0, y: 0 };

function layoutArrows() {
  const sp = CONFIG.ARROW_SPACING;
  const cols = Math.max(1, Math.floor(view.w / sp));
  const rows = Math.max(1, Math.floor(view.h / sp));
  const n = cols * rows;
  Object.assign(arrows, { n, cols, rows, w: view.w, h: view.h, spacing: sp });
  for (const k of ['px', 'py', 'x', 'y', 'ax', 'ay']) arrows[k] = new Float32Array(n);
  const x0 = (view.w - (cols - 1) * sp) / 2;
  const y0 = (view.h - (rows - 1) * sp) / 2;
  for (let r = 0, j = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++, j++) {
      arrows.px[j] = x0 + c * sp; // screen position (CSS pixels)
      arrows.py[j] = y0 + r * sp;
      arrows.x[j] = (arrows.px[j] - view.cx) / view.cell; // world position
      arrows.y[j] = (arrows.py[j] - view.cy) / view.cell;
    }
  }
}

// The eye's force at a point: direction and strength (0…1) in out.x/out.y.
// Strongest at the eyeball's rim, the closest point the arrows show.
function eyeFieldAt(x, y, out) {
  const L = CONFIG.CONE_LENGTH;
  const R = CONFIG.EYEBALL_RADIUS;
  const dx = x - eye.x;
  const dy = y - eye.y;
  const d = Math.hypot(dx, dy) + 1e-6;
  const ux = dx / d;
  const uy = dy / d;
  const rim = Math.max(0, d - R); // distance beyond the eyeball
  const facing = ux * eye.hx + uy * eye.hy;
  const cosHalf = Math.cos((CONFIG.CONE_ANGLE * Math.PI) / 360);
  const energy = state.cursorEnergy; // how fast the cursor is moving, 0…1
  const pace = Math.min(1, (2 * eye.speed) / CONFIG.EYE_MAX_SPEED); // how fast the eye is moving
  // inside the cone: pushed away, strongest close to the eye; a faint hint even
  // at rest, since the cone still hunts
  const inside = smoothstep(cosHalf - 0.03, cosHalf + 0.015, facing) * (1 - smoothstep(L * 0.85, L, d));
  const push = inside * (1 / (1 + (rim / Math.max(0.1, (L - R) * 0.6)) ** 2)) * (0.15 + 0.85 * energy);
  // behind: the wake, drawn back toward the eye while it moves
  const behind = smoothstep(0.25, 0.85, -facing);
  const wake = behind * (1 / (1 + (rim / CONFIG.ARROW_WAKE_REACH) ** 2)) * pace * (0.25 + 0.75 * energy);
  out.x = ux * (push - wake);
  out.y = uy * (push - wake);
}

// Hidden again: on reset, and whenever V turns the arrows on or off.
function resetArrows() {
  arrows.vis = 0;
  if (arrows.n) {
    arrows.ax.fill(0);
    arrows.ay.fill(0);
  }
}

function updateArrows(dt) {
  if (!state.showVectors) return;
  if (arrows.w !== view.w || arrows.h !== view.h || arrows.spacing !== CONFIG.ARROW_SPACING) layoutArrows();
  // the whole field fades in while the cursor moves the eye, and out when it stops
  const moving = smoothstep(0.04, 0.12, state.cursorEnergy);
  const fade = dt / Math.max(0.01, CONFIG.ARROW_FADE);
  arrows.vis += clamp(moving - arrows.vis, -fade, fade);
  const up = 1 - Math.exp(-dt / CONFIG.ARROW_RISE);
  const down = 1 - Math.exp(-dt / CONFIG.ARROW_EASE);
  for (let j = 0; j < arrows.n; j++) {
    eyeFieldAt(arrows.x[j], arrows.y[j], EF);
    // quick to grow as the eye's force arrives, slow to ease back
    const k = Math.hypot(EF.x, EF.y) > Math.hypot(arrows.ax[j], arrows.ay[j]) ? up : down;
    arrows.ax[j] += (EF.x - arrows.ax[j]) * k;
    arrows.ay[j] += (EF.y - arrows.ay[j]) * k;
  }
}

// Each arrow is one filled shape (a shaft and a clear triangular head), so the
// head never doubles up where it meets the shaft. Batched by opacity.
const ARROW_LEVELS = 10;
function drawArrows() {
  const vis = smoothstep(0, 1, arrows.vis);
  if (!arrows.n || vis < 0.005) return;
  const paths = [];
  const minL = CONFIG.ARROW_MIN_LENGTH;
  const maxL = Math.max(minL, CONFIG.ARROW_MAX_LENGTH);
  const w = CONFIG.ARROW_WIDTH / 2;
  for (let j = 0; j < arrows.n; j++) {
    const ax = arrows.ax[j];
    const ay = arrows.ay[j];
    const mag = Math.hypot(ax, ay);
    if (mag < 1e-4) continue;
    const ux = ax / mag;
    const uy = ay / mag;
    // where the eye's force is weak or absent, the arrow fades to nothing
    const s = Math.min(1, mag);
    const q = smoothstep(0.05, 0.5, s);
    if (q < 0.02) continue;
    const len = minL + (maxL - minL) * s;
    const hl = Math.min(5.6 * w * 2, Math.max(3.4 * w * 2, len * 0.3)); // head length
    const hw = hl * 0.6; // head half-width
    const cx = arrows.px[j];
    const cy = arrows.py[j];
    const tipX = cx + ux * len * 0.5;
    const tipY = cy + uy * len * 0.5;
    const tailX = cx - ux * len * 0.5;
    const tailY = cy - uy * len * 0.5;
    const bx = tipX - ux * hl; // the head's base
    const by = tipY - uy * hl;
    const nx = -uy;
    const ny = ux;
    const level = Math.max(1, Math.round(q * ARROW_LEVELS));
    const p = paths[level] || (paths[level] = new Path2D());
    // shaft, reaching 1px into the head; both drawn with the same winding
    p.moveTo(tailX + nx * w, tailY + ny * w);
    p.lineTo(bx + ux + nx * w, by + uy + ny * w);
    p.lineTo(bx + ux - nx * w, by + uy - ny * w);
    p.lineTo(tailX - nx * w, tailY - ny * w);
    p.closePath();
    // head
    p.moveTo(tipX, tipY);
    p.lineTo(bx - nx * hw, by - ny * hw);
    p.lineTo(bx + nx * hw, by + ny * hw);
    p.closePath();
  }
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  ctx.globalCompositeOperation = 'lighter';
  for (let level = 1; level <= ARROW_LEVELS; level++) {
    if (!paths[level]) continue;
    ctx.fillStyle = `rgba(${CONFIG.colors.field}, ${CONFIG.ARROW_OPACITY * (level / ARROW_LEVELS) * vis})`;
    ctx.fill(paths[level]);
  }
}

function drawCursor() {
  const p = cursor.presence;
  if (p < 0.01) return;
  const x = cursor.x;
  const y = cursor.y;
  const e = state.cursorEnergy;
  ctx.strokeStyle = `rgb(${CONFIG.colors.ui})`;
  ctx.fillStyle = `rgb(${CONFIG.colors.ui})`;
  ctx.lineWidth = 0.8 * PX;

  ctx.globalAlpha = 0.4 * p;
  ctx.beginPath();
  ctx.arc(x, y, (10 + 8 * e) * PX, 0, TAU);
  ctx.stroke();

  // A wider, fainter ring that swells with speed: the reach of the pull.
  ctx.globalAlpha = 0.14 * p * (0.35 + e);
  ctx.beginPath();
  ctx.arc(x, y, (22 + 60 * e) * PX, 0, TAU);
  ctx.stroke();

  ctx.globalAlpha = 0.7 * p;
  ctx.beginPath();
  ctx.arc(x, y, 1.6 * PX, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
}

/* ── Debug overlay (D) ─────────────────────────────────────────────────────
   The vision cone, each comet's collision radius and size, and the counts
   for tuning. Every particle is in exactly one state, so flocking +
   scattered + inside comets must always equal the total. */
function drawDebug() {
  const s = view.dpr * view.cell;
  ctx.setTransform(s, 0, 0, s, view.dpr * view.cx, view.dpr * view.cy);
  ctx.globalCompositeOperation = 'source-over';

  // the vision cone
  const half = (CONFIG.CONE_ANGLE * Math.PI) / 360;
  const g = Math.atan2(eye.hy, eye.hx);
  const L = CONFIG.CONE_LENGTH;
  ctx.fillStyle = 'rgba(150, 175, 255, 0.07)';
  ctx.beginPath();
  ctx.moveTo(eye.x, eye.y);
  ctx.arc(eye.x, eye.y, L, g - half, g + half);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(150, 175, 255, 0.7)';
  ctx.lineWidth = 1.2 * PX;
  ctx.setLineDash([6 * PX, 5 * PX]);
  ctx.stroke();
  ctx.setLineDash([]);

  // comets: collision radius and size
  ctx.strokeStyle = 'rgba(255, 214, 140, 0.8)';
  ctx.fillStyle = 'rgba(255, 228, 180, 0.95)';
  ctx.font = `${11 * PX}px "IBM Plex Mono", ui-monospace, monospace`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 1 * PX;
  for (const c of comets) {
    ctx.globalAlpha = c.cool > 0 ? 0.45 : 1;
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r, 0, TAU);
    ctx.stroke();
    ctx.fillText(String(c.members.length), c.x + c.r + 4 * PX, c.y - c.r);
  }
  ctx.globalAlpha = 1;

  // counts
  let flocking = 0, scattered = 0, inside = 0;
  for (let i = 0; i < P.n; i++) {
    if (P.mode[i] === FLOCK) flocking++;
    else if (P.mode[i] === SCATTERED) scattered++;
    else inside++;
  }
  const total = flocking + scattered + inside;
  const expected = state.startCount + state.spawned; // only clicks change the total
  const ok = total === expected && inside === comets.reduce((a, c) => a + c.members.length, 0);
  const lines = [
    'DEBUG  (D to hide)',
    `particles  ${total} / ${CONFIG.MAX_PARTICLES} max   (${state.startCount} + ${state.spawned} from clicks) ${ok ? '✓' : '✗ not conserved'}`,
    `  flocking ${flocking}  bursting ${scattered}  in comets ${inside}`,
    `clumps     ${census.clumps}   sizes ${census.sizes.slice(0, 8).join(' ') || '-'}${census.strays ? `   strays ${census.strays}` : ''}`,
    `bursts     ${[...scatterGroups.values()].filter((g) => g.kind === 'scatter').length} scattered by the eye   ${[...scatterGroups.values()].filter((g) => g.kind === 'firework').length} fireworks`,
    `comets     ${comets.length}   sizes ${comets.map((c) => c.members.length).sort((a, b) => b - a).slice(0, 8).join(' ') || '-'}`,
    `last 10 s  scatters ${events.scatters.length}  comets formed ${events.fusions.length}  collisions ${events.collisions.length}  clicks ${events.spawns.length}`,
    `eye        ${eye.speed.toFixed(1)} u/s   cone ${CONFIG.CONE_ANGLE}° × ${CONFIG.CONE_LENGTH} u`,
  ];
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  ctx.font = '11px "IBM Plex Mono", ui-monospace, monospace';
  ctx.textBaseline = 'top';
  const w = Math.max(...lines.map((t) => ctx.measureText(t).width)) + 20;
  const x0 = Math.max(10, view.w - w - 18);
  const y0 = 44;
  ctx.fillStyle = 'rgba(8, 9, 14, 0.78)';
  ctx.fillRect(x0, y0, w, lines.length * 16 + 14);
  ctx.strokeStyle = 'rgba(223, 227, 238, 0.18)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x0 + 0.5, y0 + 0.5, w - 1, lines.length * 16 + 13);
  lines.forEach((t, k) => {
    ctx.fillStyle = k === 0 ? 'rgba(223, 227, 238, 0.55)' : 'rgba(223, 227, 238, 0.92)';
    ctx.fillText(t, x0 + 10, y0 + 8 + k * 16);
  });
  ctx.globalAlpha = 1;
}


/* ==========================================================================
   Main loop
   ========================================================================== */

function update(dt) {
  state.time += dt;
  updateCursor(dt);
  if (intro.phase === 'done') simulate(dt);
  else updateIntro(dt);
}

let lastTime = performance.now();

function frame(now) {
  let dt = (now - lastTime) / 1000;
  lastTime = now;
  if (!(dt > 0)) dt = 1 / 60;
  dt = Math.min(dt, 1 / 20); // a hidden tab or a hitch never becomes a jump
  if (!state.paused) update(dt);
  render(dt);
  requestAnimationFrame(frame);
}

// R: a fresh set of clumps; the eye returns to the centre.
function resetSystem() {
  buildSprites();
  clearComets();
  seedClumps();
  buildIrisTexture();
  resetEyeball();
  eye.x = eye.y = eye.vx = eye.vy = eye.speed = 0;
  eye.hx = 1;
  eye.hy = 0;
  state.energy = 0;
  state.cursorEnergy = 0;
  cursor.speed = 0;
  cursor.skipSample = true;
  resetArrows();
  if (intro.phase === 'idle') initIntro();
}


/* ==========================================================================
   Opening: a drifting galaxy that awakens into the clumps
   --------------------------------------------------------------------------
   Until the cursor first moves, every star drifts slowly in one wide spiral
   galaxy around the centre and the eye sleeps. The first movement awakens
   the system: the title fades away, each star leaves the galaxy along a
   gentle curve for its place in its starting clump, inner galaxy first, and
   the eye condenses out of the galaxy's core. Then the hunt begins.
   ========================================================================== */

const intro = {
  phase: CONFIG.INTRO_ENABLED ? 'idle' : 'done', // 'idle' → 'waking' → 'done'
  t: 0,            // seconds since the awakening began
  clock: 0,        // the galaxy's own time
  moved: 0,        // pointer travel so far (px): a real movement, not a stray event
  lastX: null,
  lastY: null,
  eye: CONFIG.INTRO_ENABLED ? 0 : 1,      // the eye's size as it condenses (0…1)
  glow: CONFIG.INTRO_ENABLED ? 1 : 0,     // the galaxy core's glow
  starVis: CONFIG.INTRO_ENABLED ? 0 : 1,  // the scene fades in from black at load
};
const introEl = document.getElementById('intro');
const GALAXY_FLAT = 0.56;
const GALAXY_TILT = -0.32;
const DRIFT = { x: 0, y: 0 };

// Where each star drifts in the opening galaxy, and how it will fly to its clump.
function initIntro() {
  for (let i = 0; i < P.n; i++) {
    const r = 0.06 + 0.94 * Math.pow(Math.random(), 0.85);
    let a;
    if (Math.random() < 0.22) a = Math.random() * TAU; // a diffuse halo
    else {
      const arm = Math.random() < 0.5 ? 0 : Math.PI;
      const scatter = (Math.random() + Math.random() + Math.random() - 1.5) * (0.22 + 0.55 * r);
      a = arm - 2.8 * Math.log(0.12 + r) + scatter; // two trailing spiral arms
    }
    P.gr[i] = r;
    P.ga[i] = a;
    P.gw[i] = 0.1 / Math.sqrt(0.15 + r);
    P.gd[i] = 0.1 + CONFIG.INTRO_STAGGER * (0.7 * r + 0.3 * Math.random());
    P.gu[i] = CONFIG.INTRO_TRANSFORM_TIME * (0.8 + 0.4 * Math.random());
    P.gc[i] = 0.1 + 0.24 * Math.random();
    driftPos(i, DRIFT);
    P.x[i] = P.lx[i] = DRIFT.x;
    P.y[i] = P.ly[i] = DRIFT.y;
    P.vx[i] = P.vy[i] = 0;
  }
}

function driftPos(i, out) {
  const r = P.gr[i] * Math.hypot(view.halfW, view.halfH) * 0.95;
  const a = P.ga[i] + P.gw[i] * CONFIG.INTRO_DRIFT_SPEED * CONFIG.BASE_MOTION * intro.clock;
  const x = r * Math.cos(a);
  const y = r * Math.sin(a) * GALAXY_FLAT;
  const tilt = GALAXY_TILT + (view.portrait ? Math.PI / 2 : 0); // stands upright on portrait screens
  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  flowAt(x * 0.6 + Math.floor(i / 90), y * 0.6, intro.clock * 0.25, FLOW);
  out.x = x * ct - y * st + FLOW.x * 0.05;
  out.y = x * st + y * ct + FLOW.y * 0.05;
}

function easeOutBack(x) {
  const c = 1.4;
  return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2;
}

function updateIntro(dt) {
  intro.clock += dt;
  intro.starVis = Math.min(1, intro.starVis + dt / 1.6);
  const waking = intro.phase === 'waking';
  if (waking) intro.t += dt;
  updateIris(dt);
  updateEyeball(dt);

  let arrivedAll = waking;
  for (let i = 0; i < P.n; i++) {
    driftPos(i, DRIFT);
    let x = DRIFT.x;
    let y = DRIFT.y;
    if (waking) {
      const p = clamp((intro.t - P.gd[i]) / P.gu[i], 0, 1);
      if (p < 1) arrivedAll = false;
      const e = p * p * p * (p * (p * 6 - 15) + 10); // eased at both ends
      const dx = P.tx[i] - DRIFT.x;
      const dy = P.ty[i] - DRIFT.y;
      const bend = Math.sin(Math.PI * e) * P.gc[i]; // a gentle sideways curve, turning with the galaxy
      x = DRIFT.x + dx * e - dy * bend;
      y = DRIFT.y + dy * e + dx * bend;
    }
    P.vx[i] = (x - P.x[i]) / Math.max(dt, 1e-4);
    P.vy[i] = (y - P.y[i]) / Math.max(dt, 1e-4);
    P.x[i] = x;
    P.y[i] = y;
  }

  // The eye condenses out of the galaxy's core, whose glow gives way to it.
  const k = waking ? clamp((intro.t - 0.2) / 1.8, 0, 1) : 0;
  intro.eye = k > 0 ? easeOutBack(k) : 0;
  intro.glow = 1 - smoothstep(0, 1, k);
  if (arrivedAll) finishIntro();
}

// The first real movement of the pointer awakens the system (once the
// opening has had a moment to be seen).
function noteIntroMove(x, y) {
  if (intro.lastX !== null && intro.clock >= CONFIG.INTRO_MIN_TIME) {
    intro.moved += Math.hypot(x - intro.lastX, y - intro.lastY);
  }
  intro.lastX = x;
  intro.lastY = y;
  if (intro.moved >= CONFIG.INTRO_WAKE_DISTANCE) awaken();
}

function awaken() {
  if (intro.phase !== 'idle') return;
  intro.phase = 'waking';
  intro.t = 0;
  if (introEl) introEl.classList.add('is-leaving');
}

function finishIntro() {
  intro.phase = 'done';
  intro.eye = 1;
  intro.glow = 0;
  intro.starVis = 1;
  for (let i = 0; i < P.n; i++) {
    P.vx[i] = P.vy[i] = 0; // the clumps start from rest, and the wander current sets them going
    P.mode[i] = FLOCK;
    P.cool[i] = CONFIG.CLUMP_COOLDOWN; // newly formed: a moment before the eye can scatter them
  }
  document.body.classList.remove('is-intro');
  if (introEl) {
    introEl.classList.add('is-leaving');
    introEl.setAttribute('aria-hidden', 'true');
    setTimeout(() => (introEl.hidden = true), 1600);
  }
}

// The galaxy's soft core glow, which the eye replaces as it forms.
function drawIntroGlow() {
  const r = 2.6;
  ctx.globalAlpha = 0.32 * intro.glow * intro.starVis;
  ctx.drawImage(haloSprite, -r, -r * 0.8, 2 * r, 1.6 * r);
  ctx.globalAlpha = 0.5 * intro.glow * intro.starVis;
  ctx.drawImage(nucleusSprite, -0.35, -0.3, 0.7, 0.6);
  ctx.globalAlpha = 1;
}


/* ==========================================================================
   Interaction
   ========================================================================== */

function setCursorFromEvent(e) {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left - view.cx) / view.cell;
  const y = (e.clientY - rect.top - view.cy) / view.cell;
  // Re-entering after the pointer left: the jump is not movement speed.
  if (cursor.targetPresence === 0) cursor.skipSample = true;
  cursor.x = x;
  cursor.y = y;
  cursor.targetPresence = 1;
  if (intro.phase === 'idle') noteIntroMove(e.clientX, e.clientY);
}

canvas.addEventListener('pointermove', setCursorFromEvent);
let touchHelpTimer = 0;
canvas.addEventListener('pointerdown', (e) => {
  setCursorFromEvent(e);
  if (e.pointerType !== 'mouse' && canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
  // Touch screens have no H key: the panel steps aside after the first touch.
  if (e.pointerType === 'touch' && !touchHelpTimer) {
    touchHelpTimer = setTimeout(() => helpPanel.classList.add('is-hidden'), 4000);
  }
});
// A click adds a new clump at the cursor (not during the opening).
canvas.addEventListener('click', (e) => {
  if (intro.phase !== 'done') return;
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left - view.cx) / view.cell;
  const y = (e.clientY - rect.top - view.cy) / view.cell;
  if (!spawnClump(x, y)) showStatus(`Particle limit reached (${P.n} of ${CONFIG.MAX_PARTICLES})`);
});
canvas.addEventListener('pointerup', (e) => {
  if (e.pointerType !== 'mouse') cursor.targetPresence = 0;
});
canvas.addEventListener('pointercancel', () => (cursor.targetPresence = 0));
canvas.addEventListener('pointerleave', () => (cursor.targetPresence = 0));
window.addEventListener('blur', () => (cursor.targetPresence = 0));

let statusTimer = 0;

function showStatus(text, ms = 1600) {
  clearTimeout(statusTimer);
  statusEl.textContent = text;
  statusEl.classList.add('is-visible');
  if (ms > 0) {
    statusTimer = setTimeout(() => {
      if (state.paused) statusEl.textContent = 'Paused';
      else statusEl.classList.remove('is-visible');
    }, ms);
  }
}

function togglePause() {
  state.paused = !state.paused;
  if (state.paused) showStatus('Paused', 0);
  else {
    cursor.skipSample = true;
    showStatus('Resumed', 900);
  }
}

function toggleHelp() {
  helpPanel.classList.toggle('is-hidden');
}

window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (intro.phase !== 'done') {
    // the opening: Enter or Space awaken the system too
    if (e.code === 'Enter' || e.code === 'Space') {
      e.preventDefault();
      awaken();
    }
    return;
  }
  switch (e.code) {
    case 'Space':
      e.preventDefault();
      if (!e.repeat) togglePause();
      break;
    case 'KeyV':
      state.showVectors = !state.showVectors;
      resetArrows();
      showStatus(state.showVectors ? 'Vector field on (shows while the eye moves)' : 'Vector field off');
      break;
    case 'KeyR':
      resetSystem();
      showStatus('Reset');
      break;
    case 'KeyH':
      toggleHelp();
      break;
    case 'KeyD':
      state.debug = !state.debug;
      showStatus(state.debug ? 'Debug overlay on' : 'Debug overlay off');
      break;
    default:
  }
});

// Space must never scroll or activate anything else on the page.
window.addEventListener('keyup', (e) => {
  if (e.code === 'Space') e.preventDefault();
});

/* ==========================================================================
   Start
   ========================================================================== */

window.addEventListener('resize', resize);
resize();
buildSprites();
seedClumps();
buildIrisTexture();
if (intro.phase === 'idle') initIntro();
if (intro.phase === 'done') finishIntro(); // the opening is switched off
else document.body.classList.add('is-intro'); // (also set in the HTML, so nothing flashes)
if (intro.phase !== 'done' && introEl) {
  void introEl.offsetWidth; // settle the hidden state first, so the title fades in
  introEl.classList.add('is-shown');
}
requestAnimationFrame((t) => {
  lastTime = t;
  requestAnimationFrame(frame);
});

// Handy for tuning from the browser console.
window.GAZE_FIELD = { CONFIG, state, cursor, eye, particles: P, comets: () => comets, census };
