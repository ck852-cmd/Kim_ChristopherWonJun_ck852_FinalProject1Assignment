'use strict';

/* ==========================================================================
   GAZE FIELD
   --------------------------------------------------------------------------
   A fixed 5 × 8 array of luminous nuclei on a black field. Each nucleus
   holds a small galaxy of orbiting star particles; the nuclei never move,
   only their particles do.

   One cursor is a negative charge and the particles are positive, so they
   are drawn toward it: a slow cursor gently pulls and stretches the
   orbits, a fast one tears nearby systems apart. Loose stars drift among
   the loose stars of other systems and attract them, and where stars from
   different nuclei collide they fuse into comets that chase the cursor.

   There is no timer. Every star remembers when it was last strongly
   affected; after a few quiet seconds a weak pull toward its own nucleus
   and its own place on that orbit wakes up, gradually. Strong forces
   overpower it; when they fade, it takes over, comets stretch apart along
   their stars' different ways home, and every star glides back into orbit.
   What the eye is looking at does not wait: while the cursor is slow, any
   star or comet inside the eye's gaze is sent home at once.

   One cosmic eye sits at the exact centre: a living polar spectrogram of
   fine light, written ray by ray around a dark pupil that follows the
   cursor. Its field pushes away what it faces and draws in what lies
   behind its gaze.

     particle movement = orbit + cursor attraction + eye push-or-pull
                         + attraction between loose stars + flow
                         + delayed pull toward home

   World space: 1 unit = the short spacing of the array, origin = the eye =
   canvas centre. Time: forces and speeds are expressed per 1/60 s frame.
   ========================================================================== */

const CONFIG = {
  /* Energy: the main controls ----------------------------------------------
     cursorEnergy (0…1) is the cursor's smoothed speed, normalised. */
  BASE_MOTION: 1,                 // orbital drift, twinkle and turbulence (0 = still, 2 = restless)
  CURSOR_SPEED_SENSITIVITY: 0.3,  // higher → less cursor speed needed for full energy
  CURSOR_FORCE_MULTIPLIER: 1,     // overall scale on the cursor's pull
  TRAIL_SECONDS: 0.28,            // how long a star trail lingers when calm
  TRAIL_ENERGY_MULTIPLIER: 1.2,   // how much energy lengthens the trails

  /* Opening: a drifting galaxy that awakens into the field ------------------ */
  INTRO_ENABLED: true,            // false skips the opening screen
  INTRO_DRIFT_SPEED: 1,           // how quickly the opening galaxy turns (1 = slowly)
  INTRO_TRANSFORM_TIME: 2.4,      // seconds each star takes to fly from the galaxy to its orbit
  INTRO_STAGGER: 1.3,             // spread of departure times, inner galaxy first (seconds)
  INTRO_WAKE_DISTANCE: 12,        // pixels the pointer must travel to awaken the system
  INTRO_MIN_TIME: 1.2,            // seconds the opening shows before a movement can awaken it

  /* Nuclei and their orbiting particles ------------------------------------- */
  NUCLEUS_ROWS: 5,                // the fixed 5 × 8 array (turned upright on portrait screens)
  NUCLEUS_COLUMNS: 8,
  PARTICLES_PER_NUCLEUS: 90,
  ORBIT_RADIUS: 0.3,              // outermost orbit (units)
  ORBIT_SPEED: 0.9,               // angular speed at the outer orbit (rad / s); inner orbits run faster
  PARTICLE_SIZE: 0.011,           // particle radius (units)
  ORBIT_SPRING: 0.06,             // how firmly particles hold their orbits (per frame²)
  STRETCH_AMOUNT: 2.2,            // how far a slow cursor pulls orbits toward itself
  DISINTEGRATION_THRESHOLD: 0.55, // local energy above which a system starts to break
  DISINTEGRATION_RATE: 90,        // how quickly energy past that threshold breaks it
  SCATTER_FORCE: 0.035,           // velocity given to released particles along the cursor's path
  GLOW_STRENGTH: 0.85,            // glow around nuclei and particles

  /* Coming home: a delayed attraction, not a deadline -------------------------
     Each star remembers when it was last strongly affected. After
     INACTIVITY_DELAY seconds of quiet, a weak pull toward its own home
     position wakes up gradually; strong forces overpower it at any time. */
  INACTIVITY_DELAY: 3,            // seconds of quiet before the pull home starts to wake
  GAZE_CONE_ANGLE: 45,            // full opening angle of the eye's gaze (degrees) …
  GAZE_RETURN_SPEED: 1,           // … while the smoothed cursor speed is below this (units / s), any star
                                  //   or comet inside the gaze is sent home at once, without the delay
  INTERACTION_THRESHOLD: 0.0004,  // push from the cursor or eye that counts as meaningful (units / frame²)
  HOME_ATTRACTION: 0.0004,        // the weak pull toward its own place on its own orbit (units / frame²)
  HOME_DISTANCE_SCALE: 0.6,       // the pull grows by this share per unit of distance from home
  RETURN_DAMPING: 0.05,           // damping toward its orbit's motion while returning (per frame)
  MAX_RETURN_SPEED: 1.6,          // top speed while returning, relative to its orbit (units / s)
  STEERING_SMOOTHNESS: 0.2,       // how quickly steering forces take effect (per frame; lower = smoother)
  homeRamp: 2,                    // seconds over which the pull home fades in after the delay
  gazeHomeEase: 0.5,              // seconds: how quickly the pull home rises for a star the eye sends home
  homeEaseRadius: 0.15,           // the pull eases out within this distance, so stars arrive gently
  rebindRadius: 0.07,             // close enough to its place to begin locking back into orbit
  rebindTime: 0.8,                // seconds to lock back into its orbit
  burstTime: 0.25,                // seconds over which a released star is accelerated away
  returnBrake: 0.006,             // how quickly a too-fast returning star slows (units / frame²)

  /* Loose stars and comets ---------------------------------------------------- */
  PARTICLE_ATTRACTION: 0.00012,   // pull between loose stars, whatever their nucleus
  interactionRadius: 0.45,        // reach of that pull (units)
  COMET_MERGE_DISTANCE: 0.07,     // loose stars from different nuclei this close fuse into a comet
  COMET_CAPTURE_RADIUS: 0.32,     // a comet's head gathers loose stars within this radius
  COMET_CURSOR_ATTRACTION: 1,     // how strongly comets steer toward the cursor (the strongest pull)
  COMET_GAZE_INFLUENCE: 0.35,     // how strongly the eye's gaze steers them as well
  COMET_TURN_RATE: 2.4,           // how quickly a comet can bend its path (rad / s): its momentum
  COMET_MIN_SPEED: 0.8,           // units per second; comets keep their founders' speed within
  COMET_MAX_SPEED: 5,             //   this range, so they never stall or outrun their stars
  COMET_TAIL_LENGTH: 1.5,         // units, for a fully grown comet
  COMET_MAX: 8,                   // comets alive at once
  COMET_MAX_MEMBERS: 70,          // stars one comet can hold
  COMET_RELEASE_DISTANCE: 0.4,    // a star pulled this far from its comet place by its home lets go
  cometCooldown: 1.5,             // seconds a star waits before it can join another comet
  cometSpring: 0.07,              // how firmly comet stars keep their place in head and tail
  cometDamping: 0.2,

  /* Dissolving: comets and their stars fade away, never blink out ----------- */
  COMET_FADE_TIME: 1.2,           // seconds a dissolving comet's glow takes to fade and shrink away
  EMBER_COUNT: 46,                // small sparks a fully grown comet scatters into as it dissolves
  emberLife: [0.6, 1.5],          // seconds each spark lasts, shrinking and fading all the while
  emberSize: 0.55,                // a spark's size compared with a star
  emberScatter: 0.9,              // how fast sparks scatter outward (units / s)
  emberMax: 700,                  // most sparks alive at once
  starColourFade: 0.6,            // seconds a star takes to lose its comet colours once it lets go

  /* Layout --------------------------------------------------------------------- */
  longSpacing: 1.5,               // spacing along the 8-nucleus side (leaves room for the eye)
  shortSpacing: 1,                // spacing along the 5-nucleus side (the world unit)
  layoutMargin: 0.8,              // free space around the array (units)
  seed: 11,                       // same seed → same starting systems

  /* Cursor: the single negative attractor ------------------------------------ */
  cursorBaseStrength: 0.0002,     // pull of a still cursor (deliberately faint)
  cursorAttraction: 0.012,        // extra pull at full energy
  cursorSpeedCurve: 1,            // >1 keeps slow movement gentle, fast movement strong
  cursorSpeedSmoothing: 0.12,     // seconds; smooths the per-frame speed reading
  cursorReach: 0.8,               // falloff radius of the pull (units)
  cursorCore: 0.12,               // pull fades to zero inside this radius
  proximityRadius: 1,             // systems within about this distance feel the cursor's energy
  pointerFadeIn: 0.25,            // seconds
  pointerFadeOut: 1.4,            // seconds for influence to fade once the pointer leaves

  /* Eye: directional push / pull --------------------------------------------- */
  eyeRepulsion: 0.00016,          // push on particles in front of the gaze
  eyeAttraction: 0.00014,         // pull on particles behind the gaze
  eyeEnergyGain: 2.6,             // eye field grows by up to this factor with energy
  eyeBlendSharpness: 2.4,         // tanh steepness across the gaze boundary
  eyeRange: 2.3,                  // falloff radius of the eye field (units)
  eyeClearRadius: 0.5,            // particles are kept outside this radius
  eyeClearStrength: 0.02,

  /* Eye: a galactic eyeball; its iris after the spectrogram in "Eye Design.mp4" */
  EYEBALL_RADIUS: 0.44,           // the eyeball, fixed at the centre (units)
  IRIS_RADIUS: 0.24,              // the iris on its surface (units)
  eyePupil: 0.42,                 // pupil radius as a share of the iris
  EYE_MAX_TURN: 0.62,             // furthest the eyeball rotates toward the cursor (rad)
  EYE_STIFFNESS: 55,              // spring of the eyeball's rotation when calm (1 / s²)
  EYE_SPEED_RESPONSE: 2.2,        // faster cursor → stiffer spring → quicker eye (×)
  EYE_DAMPING: 0.72,              // < 1 lets it overshoot slightly and settle, like a real eye
  EYE_GLOW: 0.35,                 // galactic glow when calm; cursor speed brightens it
  eyeSweepPeriod: 7,              // seconds for the iris's write seam to renew the whole iris
  eyeTextureSize: 320,            // resolution of the iris texture (pixels)
  eyeBrightness: 1.3,             // overall light of the iris
  eyeFlashEvery: [9, 15],         // seconds between moments when the iris thins to rings
  eyeFlashDuration: 0.5,

  /* Idle life and free particles ---------------------------------------------- */
  flowStrength: 0.0001,           // subtle flowing field
  flowScale: 0.85,
  flowSpeed: 0.16,
  turbulence: 0.00005,            // swirl on detached particles
  boundDamping: 0.2,              // how tightly bound particles follow their orbit
  freeDrag: 0.016,                // drag on detached particles
  particleMaxSpeed: 0.12,         // units per frame
  particleMaxAcceleration: 0.02,  // units per frame²; caps every change of velocity, damping included
  leash: 3.5,                     // detached particles are reeled in beyond this distance

  /* Look ---------------------------------------------------------------------- */
  trailPixelRatio: 1.5,           // resolution of the trail layer (lower = faster, softer)
  trailOpacity: 0.4,              // brightness of each new trail segment
  trailBlackPoint: 241,           // 255 = off; lower clears more of the faint trail floor
  starOpacity: 0.8,               // brightness of the star heads
  vectorSpacing: 0.42,            // V overlay arrow spacing (units)
  vectorLength: 0.3,
  vectorReference: 0.006,
  maxPixelRatio: 2,

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

  // 8 nuclei along the long side of the screen, 5 along the short side.
  const portrait = h > w;
  const long = (CONFIG.NUCLEUS_COLUMNS - 1) * CONFIG.longSpacing + 2 * CONFIG.layoutMargin;
  const short = (CONFIG.NUCLEUS_ROWS - 1) * CONFIG.shortSpacing + 2 * CONFIG.layoutMargin;
  view.cell = portrait ? Math.min(w / short, h / long) : Math.min(w / long, h / short);
  view.cx = w / 2;
  view.cy = h / 2;
  view.halfW = w / 2 / view.cell;
  view.halfH = h / 2 / view.cell;
  PX = 1 / view.cell;

  const turned = view.portrait !== portrait;
  view.portrait = portrait;
  if (turned && systems.length) createSystems();
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
  showVectors: false,
  cursorEnergy: 0,       // 0…1, the smoothed cursor speed: the main energy value
  energy: 0,             // lingering energy: widens the eye's field for a while
  clearTrails: true,
};

const cursor = {
  x: 2.1, y: -0.55,      // world position (a resting glance to the right)
  lastX: 2.1, lastY: -0.55,
  speed: 0,              // smoothed speed, units / second
  svx: 0, svy: 0,        // smoothed velocity
  dirX: 1, dirY: 0,      // smoothed direction of travel
  presence: 0,           // 0 = gone … 1 = on the canvas
  targetPresence: 0,
  skipSample: true,
};

const gaze = { x: 1, y: 0, dist: 1 };
const field = { cursorStrength: 0, eyeGain: 1 };

/* ==========================================================================
   Forces
   ========================================================================== */

const FLOW = { x: 0, y: 0 };
const FF = { x: 0, y: 0 };
const EYE = { x: 0, y: 0, dir: 0 };

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

/* ── The eye's gaze ────────────────────────────────────────────────────────
   A point is inside the gaze when its direction from the eye lies within
   half of GAZE_CONE_ANGLE of the gaze direction. */
function inGaze(x, y) {
  return x * gaze.x + y * gaze.y >= Math.cos((CONFIG.GAZE_CONE_ANGLE * Math.PI) / 360) * Math.hypot(x, y);
}

/* ── Eye field ─────────────────────────────────────────────────────────────
   u is the unit vector from the eye (the origin) to the point. */
function eyeAt(x, y, out, clearWeight = 1) {
  const ed = Math.hypot(x, y) + 1e-6;
  const ux = x / ed;
  const uy = y / ed;

  /* Dot-product calculation: compare this point's direction with the gaze.
       facing > 0 → the point lies in front of the gaze
       facing < 0 → the point lies behind it */
  const facing = ux * gaze.x + uy * gaze.y;

  /* Attraction-versus-repulsion blending: tanh turns the dot product into a
     soft −1…+1 switch, so there is no hard dividing line between the two
     halves. Positive pushes along +u (away from the eye); negative pulls
     along −u (toward it). */
  const side = Math.tanh(CONFIG.eyeBlendSharpness * facing);
  let eyeF = side * (side > 0 ? CONFIG.eyeRepulsion : CONFIG.eyeAttraction);
  eyeF *= field.eyeGain / (1 + (ed / CONFIG.eyeRange) ** 2);
  // The pull eases off right beside the eye so nothing gets swallowed by it.
  if (side < 0) eyeF *= smoothstep(CONFIG.eyeClearRadius * 0.9, CONFIG.eyeClearRadius + 0.5, ed);

  // How hard the gaze itself pushes or pulls here (the clear zone below is a
  // fixed boundary, so it does not count as an interaction).
  out.dir = Math.abs(eyeF);

  // A small clear zone keeps the eye readable above everything else.
  if (ed < CONFIG.eyeClearRadius) eyeF += (CONFIG.eyeClearRadius - ed) * CONFIG.eyeClearStrength * clearWeight;

  out.x = ux * eyeF;
  out.y = uy * eyeF;
}

/* ── Cursor attraction ─────────────────────────────────────────────────────
   Opposite charges attract: particles are drawn toward the cursor. The
   strength comes from cursorEnergy (updateCursor); a Lorentzian falloff
   1 / (1 + d²/R²) keeps it local, and it fades to zero inside a small core
   so nothing collapses onto the cursor itself. */
function cursorPullAt(x, y, out) {
  const dx = cursor.x - x;
  const dy = cursor.y - y;
  const d2 = dx * dx + dy * dy;
  const d = Math.sqrt(d2) + 1e-6;
  const R = CONFIG.cursorReach;
  const pull = (field.cursorStrength / (1 + d2 / (R * R))) * smoothstep(0, CONFIG.cursorCore, d);
  out.x = (dx / d) * pull;
  out.y = (dy / d) * pull;
}

// cursor attraction + eye push-or-pull + flow, for the V overlay
function fieldAt(x, y, out) {
  cursorPullAt(x, y, out);
  const ax = out.x;
  const ay = out.y;
  eyeAt(x, y, EYE);
  flowAt(x, y, state.time, FLOW);
  const flow = CONFIG.flowStrength * CONFIG.BASE_MOTION;
  out.x = ax + EYE.x + FLOW.x * flow;
  out.y = ay + EYE.y + FLOW.y * flow;
}

/* ==========================================================================
   Cursor, gaze and energy
   ========================================================================== */

function updateCursor(dt) {
  /* ── Cursor-speed calculation ───────────────────────────────────────────
     Speed is measured once per frame, in units per second, from how far the
     cursor moved since the previous frame. A still cursor therefore reads 0
     even though no pointer events arrive. Exponential smoothing turns the
     jittery per-frame reading into a steady value with no sudden jumps. */
  let mvx = 0;
  let mvy = 0;
  if (cursor.skipSample) {
    cursor.skipSample = false; // a re-entry or touch-down jump is not speed
  } else {
    const inv = 1 / Math.max(dt, 1 / 240);
    mvx = (cursor.x - cursor.lastX) * inv;
    mvy = (cursor.y - cursor.lastY) * inv;
  }
  cursor.lastX = cursor.x;
  cursor.lastY = cursor.y;
  const raw = Math.min(Math.hypot(mvx, mvy), 60);
  const ks = 1 - Math.exp(-dt / CONFIG.cursorSpeedSmoothing);
  cursor.speed += (raw - cursor.speed) * ks;

  // Smoothed direction of travel: scattered particles are flung along it.
  cursor.svx += (mvx - cursor.svx) * ks;
  cursor.svy += (mvy - cursor.svy) * ks;
  const sv = Math.hypot(cursor.svx, cursor.svy);
  if (sv > 0.05) {
    cursor.dirX = cursor.svx / sv;
    cursor.dirY = cursor.svy / sv;
  }

  // Presence eases in and out, so leaving the canvas fades the pull gradually.
  const pt = cursor.targetPresence > cursor.presence ? CONFIG.pointerFadeIn : CONFIG.pointerFadeOut;
  cursor.presence += (cursor.targetPresence - cursor.presence) * (1 - Math.exp(-dt / pt));

  /* ── cursorEnergy ───────────────────────────────────────────────────────
     The smoothed speed mapped onto 0…1 (still → 0, slow → ~0.25, fast →
     approaching 1) and faded by pointer presence. */
  const e = (1 - Math.exp(-cursor.speed * CONFIG.CURSOR_SPEED_SENSITIVITY)) * cursor.presence;
  state.cursorEnergy = e;

  // Cursor attraction strength: faint when still, strong when fast.
  field.cursorStrength =
    CONFIG.CURSOR_FORCE_MULTIPLIER *
    (cursor.presence * CONFIG.cursorBaseStrength + CONFIG.cursorAttraction * Math.pow(e, CONFIG.cursorSpeedCurve));

  // A lingering copy of the energy widens the eye's field for a while.
  const et = e > state.energy ? 0.18 : 2.4;
  state.energy += (e - state.energy) * (1 - Math.exp(-dt / et));
  field.eyeGain = 1 + CONFIG.eyeEnergyGain * state.energy;

  /* ── Eye gaze direction ─────────────────────────────────────────────────
     A normalised vector from the eye (origin) to the cursor. It is eased
     over a few frames so the field never flips in a single step when the
     cursor crosses the eye; very close to the eye the last direction holds. */
  const gl = Math.hypot(cursor.x, cursor.y);
  gaze.dist = gl;
  if (gl > 0.02) {
    const k = 1 - Math.exp(-dt / 0.05);
    const nx = gaze.x + (cursor.x / gl - gaze.x) * k;
    const ny = gaze.y + (cursor.y / gl - gaze.y) * k;
    const n = Math.hypot(nx, ny);
    if (n > 1e-4) {
      gaze.x = nx / n;
      gaze.y = ny / n;
    }
  }
}

/* ==========================================================================
   Nuclei and their orbiting particles
   ========================================================================== */

class NucleusSystem {
  constructor(id, x, y, rand) {
    const n = CONFIG.PARTICLES_PER_NUCLEUS;
    const R = CONFIG.ORBIT_RADIUS;
    this.id = id;
    this.x = x; // the nucleus: fixed for good
    this.y = y;
    this.n = n;

    // Each system is a small tilted disk: squashed, turned, spinning one way.
    this.flat = 0.35 + rand() * 0.45;
    const angle = rand() * Math.PI;
    this.ca = Math.cos(angle);
    this.sa = Math.sin(angle);
    this.spin = rand() < 0.5 ? -1 : 1;
    this.twinkle = rand() * TAU;

    /* Every particle's own remembered place: its nucleus is this system, its
       resting position is its orbit (radius r, angle th, speed w). These are
       never exchanged or reassigned, so a star always returns to its own
       nucleus and its own orbit. */
    this.r = new Float32Array(n);
    this.th = new Float32Array(n);
    this.w = new Float32Array(n);
    this.size = new Float32Array(n);
    this.bright = new Float32Array(n);
    this.col = new Uint8Array(n);
    this.px = new Float32Array(n);
    this.py = new Float32Array(n);
    this.vx = new Float32Array(n);
    this.vy = new Float32Array(n);
    this.lx = new Float32Array(n);             // position at the last draw (for trail segments)
    this.ly = new Float32Array(n);
    this.bond = new Float32Array(n).fill(1);   // 1 = held on its orbit … 0 = flying free
    this.free = new Uint8Array(n);             // 1 = released, not yet settled back into orbit
    this.release = new Float32Array(n).fill(-1); // seconds into a break when it lets go (−1 = none due)
    this.kx = new Float32Array(n);             // its release burst: acceleration per frame …
    this.ky = new Float32Array(n);
    this.kt = new Float32Array(n);             // … and seconds of it left
    this.quiet = new Float32Array(n);          // seconds since it was last strongly affected
    this.homeOn = new Float32Array(n);         // 0…1 how awake its pull toward home is
    this.gazeHome = new Uint8Array(n);         // 1 = sent home by the eye's gaze: returning without the delay
    this.homeDist = new Float32Array(n);       // distance from its home position
    this.sax = new Float32Array(n);            // its eased steering acceleration
    this.say = new Float32Array(n);
    this.ex = new Float32Array(n);             // pull from other loose stars this frame
    this.ey = new Float32Array(n);
    this.comet = new Int32Array(n).fill(-1);   // comet it currently flies in (−1 = none)
    this.cool = new Float32Array(n);           // seconds before it may join a comet again
    this.cAge = new Float32Array(n);           // seconds since it joined that comet
    this.mtx = new Float32Array(n);            // its place in that comet's head or tail
    this.mty = new Float32Array(n);
    this.ccol = new Uint8Array(n);             // its colour while in a comet
    this.cmix = new Float32Array(n);           // 0…1 how much it shows its comet colours (eased)

    for (let i = 0; i < n; i++) {
      // Two loose spiral arms, denser toward the nucleus.
      const r = R * (0.16 + 0.84 * Math.pow(rand(), 0.8));
      const g = (rand() + rand() + rand() - 1.5) * 0.5;
      this.r[i] = r;
      this.th[i] = (i % 2) * Math.PI + 2.4 * Math.log(r / (R * 0.16)) * this.spin + g;
      this.w[i] = this.spin * CONFIG.ORBIT_SPEED * (0.8 + 0.7 * (1 - r / R)) * (0.9 + 0.2 * rand());
      this.size[i] = 0.6 + Math.pow(rand(), 3) * 1.5;
      this.bright[i] = 0.5 + 0.5 * rand();
      this.col[i] = pickWeighted(CONFIG.colors.starWeights, rand());
    }

    this.damage = 0;      // builds while the cursor's energy here is past the threshold
    this.breakClock = 99; // seconds since the last break (drives the staggered release)
    this.shown = 1;       // how whole the system looks (nucleus brightness)
    this.local = 0;       // cursorEnergy as this system feels it
    this.kickX = 1;
    this.kickY = 0;
    this.kickE = 0;
    this.appear = 1;      // 0 while asleep in the opening galaxy … 1 awake
    this.placeOnOrbits();
  }

  placeOnOrbits() {
    for (let i = 0; i < this.n; i++) {
      const r = this.r[i];
      const th = this.th[i];
      const ox = r * Math.cos(th);
      const oy = r * Math.sin(th) * this.flat;
      this.px[i] = this.lx[i] = this.x + ox * this.ca - oy * this.sa;
      this.py[i] = this.ly[i] = this.y + ox * this.sa + oy * this.ca;
      this.vx[i] = this.vy[i] = 0;
      this.bond[i] = 1;
      this.free[i] = 0;
      this.release[i] = -1;
      this.kt[i] = 0;
      this.quiet[i] = 0;
      this.homeOn[i] = 0;
      this.gazeHome[i] = 0;
      this.sax[i] = this.say[i] = 0;
      this.comet[i] = -1;
      this.cool[i] = 0;
      this.cmix[i] = 0;
    }
  }

  /* The system's life, star by star. The cursor's energy here builds
     damage, and full damage breaks the system: its stars let go a few at a
     time, outer orbits first. There is no timer after that. Each star keeps
     the time since it was last strongly affected (by the cursor, the eye, a
     collision or a comet). After INACTIVITY_DELAY seconds of quiet, a weak
     pull toward its own home position wakes up gradually; any new strong
     interaction puts it back to sleep, just as gradually. A loose star the
     eye is looking at while the cursor is slow (or in a comet the eye is
     looking at) skips the delay: it is sent home at once, and keeps going
     home until it is back unless a fast cursor takes hold of it. Once the
     pull has brought it close to its place, it locks back into its orbit. */
  updateState(dt) {
    const dx = cursor.x - this.x;
    const dy = cursor.y - this.y;
    const pr = CONFIG.proximityRadius;
    this.local = state.cursorEnergy * Math.exp(-(dx * dx + dy * dy) / (2 * pr * pr));

    const over = this.local - CONFIG.DISINTEGRATION_THRESHOLD;
    if (over > 0) this.damage += over * CONFIG.DISINTEGRATION_RATE * dt;
    else this.damage = Math.max(0, this.damage - dt * 0.8);
    if (this.damage >= 1) this.disintegrate();
    this.breakClock += dt;

    const delay = CONFIG.INACTIVITY_DELAY;
    const ramp = CONFIG.homeRamp;
    const slowCursor = cursor.speed < CONFIG.GAZE_RETURN_SPEED;
    let whole = 0;
    for (let i = 0; i < this.n; i++) {
      if (this.cool[i] > 0) this.cool[i] -= dt;
      if (this.comet[i] >= 0) this.cAge[i] += dt;
      this.quiet[i] += dt;

      // its comet colours come and go gradually, never in a blink
      const inComet = this.comet[i] >= 0 ? 1 : 0;
      const fade = inComet ? 0.2 : CONFIG.starColourFade;
      this.cmix[i] += (inComet - this.cmix[i]) * (1 - Math.exp(-dt / fade));

      // its turn to let go, in a break
      if (this.release[i] >= 0 && this.breakClock >= this.release[i]) {
        this.release[i] = -1;
        this.free[i] = 1;
        this.quiet[i] = 0;
        this.launch(i);
      }

      /* ── Sent home by the eye ───────────────────────────────────────────
         Inside the eye's gaze (itself, or the head of its comet) while the
         cursor is slower than GAZE_RETURN_SPEED: no waiting. */
      if (this.free[i] && slowCursor && !this.gazeHome[i]) {
        const cm = this.comet[i] >= 0 ? cometById.get(this.comet[i]) : null;
        if (inGaze(this.px[i], this.py[i]) || (cm && inGaze(cm.x, cm.y))) this.gazeHome[i] = 1;
      }

      /* ── Delayed homing ─────────────────────────────────────────────────
         Not a deadline: the pull home wakes slowly after the quiet delay,
         and fades again whenever something strong takes hold of the star.
         A star the eye sent home wants its full pull at once, though it
         still eases in rather than switching on. */
      let want = 0;
      if (this.free[i]) want = this.gazeHome[i] ? 1 : smoothstep(delay, delay + ramp, this.quiet[i]);
      const rise = this.gazeHome[i] ? CONFIG.gazeHomeEase : ramp * 0.5;
      const tau = want > this.homeOn[i] ? rise : 0.35;
      this.homeOn[i] += (want - this.homeOn[i]) * (1 - Math.exp(-dt / tau));

      // its bond with its orbit: lost while free, regained gently once home
      if (this.free[i]) {
        const settling = this.homeOn[i] > 0.5 && this.homeDist[i] < CONFIG.rebindRadius && this.comet[i] < 0;
        if (settling) this.bond[i] = Math.min(1, this.bond[i] + dt / CONFIG.rebindTime);
        else this.bond[i] = Math.max(0, this.bond[i] - dt / 0.3);
        if (this.bond[i] >= 1) {
          this.free[i] = 0;
          this.homeOn[i] = 0;
          this.gazeHome[i] = 0;
        }
      } else {
        this.bond[i] = Math.min(1, this.bond[i] + dt * 2);
      }
      whole += this.bond[i];
    }
    this.shown += (whole / this.n - this.shown) * (1 - Math.exp(-dt / 0.4));
  }

  disintegrate() {
    this.damage = 0;
    this.breakClock = 0;
    this.kickX = cursor.dirX;
    this.kickY = cursor.dirY;
    this.kickE = state.cursorEnergy;
    const R = CONFIG.ORBIT_RADIUS;
    for (let i = 0; i < this.n; i++) {
      if (this.free[i]) {
        this.quiet[i] = 0; // already loose: struck again
        continue;
      }
      if (this.release[i] < 0) this.release[i] = (1 - this.r[i] / R) * 0.35 + Math.random() * 0.15;
    }
  }

  /* A released star is accelerated along the cursor's path, spreading as it
     goes. The push is spread over CONFIG.burstTime rather than given at
     once, so even the break is a continuous motion. */
  launch(i) {
    const spread = (Math.random() - 0.5) * 1.2;
    const c = Math.cos(spread);
    const s = Math.sin(spread);
    const kx = this.kickX * c - this.kickY * s;
    const ky = this.kickX * s + this.kickY * c;
    const f = CONFIG.SCATTER_FORCE * (0.45 + 0.8 * this.kickE) * (0.5 + Math.random());
    let ox = this.px[i] - this.x;
    let oy = this.py[i] - this.y;
    const ol = Math.hypot(ox, oy) || 1;
    ox /= ol;
    oy /= ol;
    const frames = CONFIG.burstTime * 60;
    this.kx[i] = (kx * f + ox * f * 0.35) / frames;
    this.ky[i] = (ky * f + oy * f * 0.35) / frames;
    this.kt[i] = CONFIG.burstTime;
  }

  /* ── Particle motion ────────────────────────────────────────────────────
     Two kinds of force act on a star.
       · Its holds: the spring to its moving place on its orbit (as strong as
         its bond) and, in a comet, the spring to its place in that comet.
       · Steering: the cursor, the eye, other loose stars, a little swirl, its
         release burst and, once awake, its pull toward home. Steering is
         eased in (STEERING_SMOOTHNESS) rather than applied as a jolt, so a
         star never changes direction suddenly.
     Velocity carries momentum and is damped toward the motion of whatever
     holds the star. A returning star is damped toward its orbit's own
     motion (RETURN_DAMPING) and kept below MAX_RETURN_SPEED, so it glides
     back and settles instead of snapping or overshooting. */
  step(h) {
    const { n, r, th, w, px, py, vx, vy, bond, homeOn, comet } = this;
    const dtSec = h / 60;
    const bm = CONFIG.BASE_MOTION;
    const excite = 1 + 0.35 * this.local;
    const loosen = (1 - 0.45 * this.local) * (1 - 0.6 * Math.min(1, this.damage));
    const k0 = CONFIG.ORBIT_SPRING * loosen;
    const stretch = CONFIG.STRETCH_AMOUNT;
    const boundDamp = 1 - Math.pow(1 - CONFIG.boundDamping, h);
    const freeDamp = 1 - Math.pow(1 - CONFIG.freeDrag, h);
    const cometDamp = 1 - Math.pow(1 - CONFIG.cometDamping, h);
    const retDamp = 1 - Math.pow(1 - CONFIG.RETURN_DAMPING, h);
    const ease = 1 - Math.pow(1 - CONFIG.STEERING_SMOOTHNESS, h);
    const vRet = CONFIG.MAX_RETURN_SPEED / 60;
    const amax = CONFIG.particleMaxAcceleration;
    const vmax = CONFIG.particleMaxSpeed;
    const thr = CONFIG.INTERACTION_THRESHOLD;
    const bw = view.halfW - 0.05;
    const bh = view.halfH - 0.05;
    const tt = state.time * 0.6;
    const off = this.id * 3.1;
    const gs = CONFIG.GAZE_RETURN_SPEED;
    const slowness = 1 - smoothstep(gs * 0.8, gs, cursor.speed); // 1 = clearly below GAZE_RETURN_SPEED

    for (let i = 0; i < n; i++) {
      // its home: its own place on its own orbit, which keeps turning
      th[i] += w[i] * dtSec * bm * excite;
      const ri = r[i];
      const c = Math.cos(th[i]);
      const s = Math.sin(th[i]);
      const ox = ri * c;
      const oy = ri * s * this.flat;
      const tx = this.x + ox * this.ca - oy * this.sa;
      const ty = this.y + ox * this.sa + oy * this.ca;
      const wv = (w[i] / 60) * bm * excite;
      const dvx = -ri * s * wv;
      const dvy = ri * c * this.flat * wv;
      const tvx = dvx * this.ca - dvy * this.sa;
      const tvy = dvx * this.sa + dvy * this.ca;

      const x = px[i];
      const y = py[i];
      const hx = tx - x;
      const hy = ty - y;
      const hd = Math.hypot(hx, hy);
      this.homeDist[i] = hd;
      const a = bond[i];
      const hOn = homeOn[i];

      // ── holds ────────────────────────────────────────────────────────────
      let ix = hx * k0 * a * a;
      let iy = hy * k0 * a * a;
      let refX = tvx * a;
      let refY = tvy * a;
      let damp = lerp(freeDamp, boundDamp, a);
      let cm = comet[i] >= 0 ? cometById.get(comet[i]) : null;
      if (comet[i] >= 0 && !cm) comet[i] = -1;
      let hold = 0;
      if (cm) {
        // Its comet's hold eases in when it joins and fades as its own pull
        // home wakes; stretched too far from its place, it lets go.
        hold = smoothstep(0, 0.5, this.cAge[i]) * (1 - hOn) * (1 - hOn);
        ix += (this.mtx[i] - x) * CONFIG.cometSpring * hold;
        iy += (this.mty[i] - y) * CONFIG.cometSpring * hold;
        refX = lerp(refX, cm.vx, hold);
        refY = lerp(refY, cm.vy, hold);
        damp = lerp(damp, cometDamp, hold);
        if (hOn > 0.5 && Math.hypot(this.mtx[i] - x, this.mty[i] - y) > CONFIG.COMET_RELEASE_DISTANCE) {
          leaveComet(cm, this, i);
          cm = null;
        }
      }

      // ── steering ─────────────────────────────────────────────────────────
      let fx = 0;
      let fy = 0;
      cursorPullAt(x, y, FF);
      const pw = lerp(0.5, stretch, a);
      // (a star on its way home may pass the eye's clear zone to reach its orbit)
      eyeAt(x, y, EYE, 1 - hOn);
      const ew = 0.3 + 0.7 * (1 - a);
      // A strong push from the cursor or the eye counts as meaningful interaction.
      if (Math.hypot(FF.x, FF.y) * pw > thr || EYE.dir * ew > thr) this.quiet[i] = 0;
      // Only a fast cursor taking hold of it calls back a star the eye sent home.
      if (this.gazeHome[i] && cursor.speed >= CONFIG.GAZE_RETURN_SPEED && Math.hypot(FF.x, FF.y) * pw > thr) {
        this.gazeHome[i] = 0;
      }
      // A star the eye sent home is let go by the eye, and by a slow cursor,
      // as its pull home rises, so it really does head home.
      const sent = this.gazeHome[i] ? hOn : 0;
      const cw = pw * (1 - sent * slowness);
      const gw = ew * (1 - sent);
      fx += FF.x * cw + EYE.x * gw;
      fy += FF.y * cw + EYE.y * gw;

      const free = 1 - a;
      if (free > 0.02) {
        fx += this.ex[i] * free;
        fy += this.ey[i] * free;
        flowAt(x * 1.7 + off, y * 1.7, tt, FLOW);
        fx += FLOW.x * CONFIG.turbulence * bm * free;
        fy += FLOW.y * CONFIG.turbulence * bm * free;
        if (this.kt[i] > 0) {
          fx += this.kx[i];
          fy += this.ky[i];
          this.kt[i] -= dtSec;
        }
        /* ── Home attraction ───────────────────────────────────────────────
           Weak, and only as awake as homeOn. It grows slightly with distance
           so far-flung stars come back reliably, and eases out over the last
           stretch so they arrive gently. */
        if (hOn > 0.001 && hd > 1e-5) {
          const pull = CONFIG.HOME_ATTRACTION * (1 + CONFIG.HOME_DISTANCE_SCALE * hd) * smoothstep(0, CONFIG.homeEaseRadius, hd);
          fx += (hx / hd) * pull * hOn;
          fy += (hy / hd) * pull * hOn;
        }
        if (hd > CONFIG.leash) {
          const f = ((hd - CONFIG.leash) * 0.002) / hd;
          fx += hx * f;
          fy += hy * f;
        }
      }
      if (x < -bw) fx += (-bw - x) * 0.006;
      else if (x > bw) fx -= (x - bw) * 0.006;
      if (y < -bh) fy += (-bh - y) * 0.006;
      else if (y > bh) fy -= (y - bh) * 0.006;

      // Gradual steering: the steering force eases toward its new value.
      this.sax[i] += (fx - this.sax[i]) * ease;
      this.say[i] += (fy - this.say[i]) * ease;
      let ax = ix + this.sax[i];
      let ay = iy + this.say[i];
      const fa = Math.hypot(ax, ay);
      if (fa > amax) {
        ax *= amax / fa;
        ay *= amax / fa;
      }

      // momentum, damped toward the motion of whatever holds it
      let nvx = vx[i] + ax * h;
      let nvy = vy[i] + ay * h;
      nvx = refX + (nvx - refX) * (1 - damp);
      nvy = refY + (nvy - refY) * (1 - damp);

      /* Returning: damped toward its orbit's motion, and eased down to no
         more than MAX_RETURN_SPEED, braking gradually rather than clamped in
         one step. In a comet this grows as the comet's hold fades, so a star
         turning for home slows, falls behind and drifts out of its comet. */
      if (hOn > 0.001) {
        const unheld = 1 - hold;
        const rd = retDamp * hOn * unheld;
        nvx = tvx + (nvx - tvx) * (1 - rd);
        nvy = tvy + (nvy - tvy) * (1 - rd);
        const rel = Math.hypot(nvx - tvx, nvy - tvy);
        const cap = lerp(vmax, vRet, smoothstep(0, 0.6, hOn) * unheld);
        if (rel > cap) {
          const eased = Math.max(cap, rel - CONFIG.returnBrake * h);
          nvx = tvx + ((nvx - tvx) * eased) / rel;
          nvy = tvy + ((nvy - tvy) * eased) / rel;
        }
      }
      // No force or damping may change its velocity faster than the
      // acceleration limit: every turn and every brake takes a few frames.
      const cdx = nvx - vx[i];
      const cdy = nvy - vy[i];
      const cd = Math.hypot(cdx, cdy);
      if (cd > amax * h) {
        nvx = vx[i] + (cdx * amax * h) / cd;
        nvy = vy[i] + (cdy * amax * h) / cd;
      }
      const sp = Math.hypot(nvx, nvy);
      if (sp > vmax) {
        nvx *= vmax / sp;
        nvy *= vmax / sp;
      }
      vx[i] = nvx;
      vy[i] = nvy;
      px[i] = x + nvx * h;
      py[i] = y + nvy * h;
    }
  }

  // Safety net: a system that ever goes non-finite is rebuilt in place.
  guard() {
    if (Number.isFinite(this.px[0] + this.py[0] + this.px[this.n - 1] + this.py[this.n - 1])) return;
    releaseFromComets(this);
    this.damage = 0;
    this.placeOnOrbits();
  }
}

let systems = [];

function createSystems() {
  const rand = mulberry32(CONFIG.seed);
  const rows = CONFIG.NUCLEUS_ROWS;
  const cols = CONFIG.NUCLEUS_COLUMNS;
  clearComets();
  systems = [];
  let id = 0;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const a = (i - (cols - 1) / 2) * CONFIG.longSpacing;
      const b = (j - (rows - 1) / 2) * CONFIG.shortSpacing;
      // 8 across on landscape screens; the same array turned upright on portrait ones
      const x = view.portrait ? b : a;
      const y = view.portrait ? a : b;
      systems.push(new NucleusSystem(id++, x, y, rand));
    }
  }
  allocateLoose();
  state.clearTrails = true;
  if (intro.phase === 'idle') initIntro();
  else if (intro.phase === 'waking') finishIntro();
}

/* ==========================================================================
   Loose stars: they pull on one another, whatever their nucleus
   ========================================================================== */

const loose = { n: 0, sys: null, idx: null, x: null, y: null, fx: null, fy: null };
const lgrid = { size: 0.45, cols: 1, rows: 1, x0: 0, y0: 0, head: null, next: null };

function allocateLoose() {
  const total = systems.length * CONFIG.PARTICLES_PER_NUCLEUS;
  loose.sys = new Int32Array(total);
  loose.idx = new Int32Array(total);
  loose.x = new Float32Array(total);
  loose.y = new Float32Array(total);
  loose.fx = new Float32Array(total);
  loose.fy = new Float32Array(total);
  lgrid.next = new Int32Array(total);
}

function gridCell(x, y) {
  const cx = clamp(Math.floor((x - lgrid.x0) / lgrid.size), 0, lgrid.cols - 1);
  const cy = clamp(Math.floor((y - lgrid.y0) / lgrid.size), 0, lgrid.rows - 1);
  return [cx, cy];
}

/* Every loose star (released, and not flying in a comet) attracts the loose
   stars around it, from any nucleus, with a small cushion at very close
   range. A star whose pull home is waking takes less part, so gatherings
   loosen as their stars turn for home. When two loose stars from different
   nuclei collide, they fuse into a new comet. */
function interactLoose() {
  const R = CONFIG.interactionRadius;
  const R2 = R * R;
  const G = CONFIG.PARTICLE_ATTRACTION;
  const merge2 = CONFIG.COMET_MERGE_DISTANCE ** 2;

  let n = 0;
  for (let s = 0; s < systems.length; s++) {
    const S = systems[s];
    S.ex.fill(0);
    S.ey.fill(0);
    for (let i = 0; i < S.n; i++) {
      if (!S.free[i] || S.bond[i] >= 0.2 || S.comet[i] >= 0) continue;
      loose.sys[n] = s;
      loose.idx[n] = i;
      loose.x[n] = S.px[i];
      loose.y[n] = S.py[i];
      loose.fx[n] = 0;
      loose.fy[n] = 0;
      n++;
    }
  }
  loose.n = n;

  lgrid.size = R;
  lgrid.x0 = -view.halfW - 1;
  lgrid.y0 = -view.halfH - 1;
  lgrid.cols = Math.max(1, Math.ceil((2 * view.halfW + 2) / R));
  lgrid.rows = Math.max(1, Math.ceil((2 * view.halfH + 2) / R));
  const cells = lgrid.cols * lgrid.rows;
  if (!lgrid.head || lgrid.head.length < cells) lgrid.head = new Int32Array(cells);
  lgrid.head.fill(-1, 0, cells);
  for (let k = 0; k < n; k++) {
    const [cx, cy] = gridCell(loose.x[k], loose.y[k]);
    const c = cy * lgrid.cols + cx;
    lgrid.next[k] = lgrid.head[c];
    lgrid.head[c] = k;
  }
  if (n < 2) return;

  for (let a = 0; a < n; a++) {
    const ax = loose.x[a];
    const ay = loose.y[a];
    const SA = systems[loose.sys[a]];
    const ia = loose.idx[a];
    const awakeA = SA.homeOn[ia];
    const [cx, cy] = gridCell(ax, ay);
    for (let oy = -1; oy <= 1; oy++) {
      const yy = cy + oy;
      if (yy < 0 || yy >= lgrid.rows) continue;
      for (let ox = -1; ox <= 1; ox++) {
        const xx = cx + ox;
        if (xx < 0 || xx >= lgrid.cols) continue;
        for (let b = lgrid.head[yy * lgrid.cols + xx]; b !== -1; b = lgrid.next[b]) {
          if (b <= a) continue;
          const dx = loose.x[b] - ax;
          const dy = loose.y[b] - ay;
          const d2 = dx * dx + dy * dy;
          if (d2 >= R2 || d2 < 1e-10) continue;
          const SB = systems[loose.sys[b]];
          const ib = loose.idx[b];
          const awakeB = SB.homeOn[ib];
          const d = Math.sqrt(d2);
          let f = (G * (1 - d / R)) / (d + 0.05);
          if (d < 0.03) f -= 0.0006 * (1 - d / 0.03);
          f *= (1 - awakeA) * (1 - awakeB);
          const ux = (dx / d) * f;
          const uy = (dy / d) * f;
          loose.fx[a] += ux;
          loose.fy[a] += uy;
          loose.fx[b] -= ux;
          loose.fy[b] -= uy;

          // A collision of loose stars from different nuclei: a comet is born.
          if (d2 < merge2 && SA !== SB && comets.length < CONFIG.COMET_MAX) {
            if (
              SA.comet[ia] < 0 && SB.comet[ib] < 0 &&
              SA.cool[ia] <= 0 && SB.cool[ib] <= 0 &&
              awakeA < 0.3 && awakeB < 0.3 &&
              !SA.gazeHome[ia] && !SB.gazeHome[ib]
            ) {
              // The comet keeps its founders' average direction and speed.
              const c = createComet((ax + loose.x[b]) / 2, (ay + loose.y[b]) / 2, [SA.vx[ia], SB.vx[ib]], [SA.vy[ia], SB.vy[ib]]);
              joinComet(c, SA, ia);
              joinComet(c, SB, ib);
            }
          }
        }
      }
    }
  }

  const cap = 0.0025;
  for (let k = 0; k < n; k++) {
    let fx = loose.fx[k];
    let fy = loose.fy[k];
    const m = Math.hypot(fx, fy);
    if (m > cap) {
      fx *= cap / m;
      fy *= cap / m;
    }
    const S = systems[loose.sys[k]];
    S.ex[loose.idx[k]] = fx;
    S.ey[loose.idx[k]] = fy;
  }
}

/* ==========================================================================
   Comets: loose stars of different nuclei, fused while nothing calls them home
   ========================================================================== */

const HEAD = 0;
const DUST = 1;
const ION = 2;
let comets = [];
let nextCometId = 1;
const cometById = new Map();

/* A comet is born where two loose stars collide. It keeps their average
   direction and their average speed, so it flies on as fast as they were
   moving instead of slowing down. */
function createComet(x, y, vxs, vys) {
  let sx = 0;
  let sy = 0;
  let sp = 0;
  for (let k = 0; k < vxs.length; k++) {
    sx += vxs[k];
    sy += vys[k];
    sp += Math.hypot(vxs[k], vys[k]);
  }
  sp /= vxs.length;
  let dl = Math.hypot(sx, sy);
  if (dl < 1e-9) {
    sx = gaze.x;
    sy = gaze.y;
    dl = 1;
  }
  const speed = clamp(sp, CONFIG.COMET_MIN_SPEED / 60, CONFIG.COMET_MAX_SPEED / 60);
  const c = {
    id: nextCometId++,
    x, y,
    speed,                                  // units per frame, kept for the comet's life
    vx: (sx / dl) * speed,
    vy: (sy / dl) * speed,
    hx: sx / dl, hy: sy / dl,               // where its head points: along its motion
    wx: sx / dl, wy: sy / dl,               // where it wants to go, eased
    size: 0,                                // 0…1, grows with its stars
    curve: Math.random() < 0.5 ? -1 : 1,    // which way the dust tail sweeps
    members: [],
    dead: false,
  };
  comets.push(c);
  cometById.set(c.id, c);
  return c;
}

/* A star joins a comet with a role: part of the bright head, the broad gold
   dust tail, or the narrow blue-violet ion tail. Joining is a strong
   interaction: the star's quiet time starts again. */
function joinComet(c, S, i) {
  S.comet[i] = c.id;
  S.cAge[i] = 0;
  S.quiet[i] = 0;
  let kind;
  let t;
  if (c.members.length < 6 || Math.random() < 0.12) {
    kind = HEAD;
    t = Math.random() * 0.05;
  } else {
    kind = Math.random() < 0.62 ? DUST : ION;
    t = 0.06 + 0.94 * Math.pow(Math.random(), 1.25);
  }
  if (kind === HEAD) S.ccol[i] = 0;
  else if (kind === DUST) S.ccol[i] = Math.random() < 0.7 ? 2 : 0;
  else S.ccol[i] = Math.random() < 0.7 ? 3 : 4;
  c.members.push({ s: S, i, kind, t, lat: Math.random() + Math.random() - 1, ph: Math.random() * TAU });
}

// A star lets go of its comet, keeping its own momentum. Now and then it
// sheds a spark as it goes, so a stretching comet frays into points.
function leaveComet(c, S, i) {
  S.comet[i] = -1;
  S.cool[i] = CONFIG.cometCooldown;
  c.members = c.members.filter((m) => !(m.s === S && m.i === i));
  if (Math.random() < 0.35) {
    const a = Math.random() * TAU;
    const v = (CONFIG.emberScatter / 60) * (0.2 + 0.5 * Math.random());
    spawnEmber(S.px[i], S.py[i], S.vx[i] * 0.5 + Math.cos(a) * v, S.vy[i] * 0.5 + Math.sin(a) * v, S.ccol[i], 0.8);
  }
}

/* A comet with too few stars left dissolves. Its stars carry on home, but
   its glow does not vanish: it drifts on, fading and shrinking over
   COMET_FADE_TIME, and it scatters into small sparks. */
function dissolveComet(c, quietly = false) {
  for (const m of c.members) {
    m.s.comet[m.i] = -1;
    m.s.cool[m.i] = CONFIG.cometCooldown;
  }
  c.members.length = 0;
  c.dead = true;
  cometById.delete(c.id);
  if (quietly) return;
  c.fade = 1;
  fadingComets.push(c);
  scatterComet(c);
}

/* ── Sparks ───────────────────────────────────────────────────────────────
   Small points a dissolving comet scatters into: from its head and all
   along its tail, each drifting on with part of the comet's motion plus a
   little outward scatter, shrinking and fading until it is gone. */
let fadingComets = [];
let embers = [];

function spawnEmber(x, y, vx, vy, col, size) {
  if (embers.length >= CONFIG.emberMax) return;
  const [l0, l1] = CONFIG.emberLife;
  embers.push({ x, y, lx: x, ly: y, vx, vy, col, size: size * CONFIG.emberSize, age: 0, life: lerp(l0, l1, Math.random()) });
}

function scatterComet(c) {
  const n = Math.round(CONFIG.EMBER_COUNT * (0.25 + 0.75 * c.size));
  const L = CONFIG.COMET_TAIL_LENGTH * (0.35 + 0.65 * c.size);
  const scatter = CONFIG.emberScatter / 60;
  for (let k = 0; k < n; k++) {
    const t = Math.pow(Math.random(), 1.6); // 0 = head … 1 = tail tip; more near the head
    const side = (Math.random() - 0.5) * (0.06 + 0.3 * t) * L;
    const x = c.x - c.hx * t * L - c.hy * side;
    const y = c.y - c.hy * t * L + c.hx * side;
    const a = Math.random() * TAU;
    const v = scatter * (0.3 + 0.7 * Math.random());
    const keep = 0.6 * (1 - t); // sparks near the head keep more of the comet's motion
    const r = Math.random();
    const col = t < 0.12 ? (r < 0.6 ? 0 : 2) : r < 0.55 ? 2 : r < 0.85 ? 3 : 4;
    spawnEmber(x, y, c.vx * keep + Math.cos(a) * v, c.vy * keep + Math.sin(a) * v, col, (0.6 + 0.6 * Math.random()) * (t < 0.12 ? 1.3 : 1));
  }
}

function updateFading(dt) {
  const f = dt * 60;
  const drag = Math.exp(-dt / 0.8);
  for (const c of fadingComets) {
    c.fade -= dt / CONFIG.COMET_FADE_TIME;
    c.vx *= drag;
    c.vy *= drag;
    c.x += c.vx * f;
    c.y += c.vy * f;
  }
  fadingComets = fadingComets.filter((c) => c.fade > 0);

  const edrag = Math.exp(-dt / 0.9);
  for (const e of embers) {
    e.age += dt;
    e.vx *= edrag;
    e.vy *= edrag;
    e.x += e.vx * f;
    e.y += e.vy * f;
  }
  embers = embers.filter((e) => e.age < e.life);
}

// Only for the safety net: take one system's stars out of every comet.
function releaseFromComets(S) {
  for (const c of comets) {
    for (const m of c.members) if (m.s === S) S.comet[m.i] = -1;
    c.members = c.members.filter((m) => m.s !== S);
  }
}

function clearComets() {
  for (const c of comets) if (!c.dead) dissolveComet(c, true);
  comets = [];
  cometById.clear();
  fadingComets = [];
  embers = [];
}

/* ── Comet flight ─────────────────────────────────────────────────────────
   Each comet keeps its speed and bends its path toward a blend of the
   cursor (the strongest pull) and the eye's gaze. Where it wants to go is
   itself eased (STEERING_SMOOTHNESS), and its turning rate is limited, so
   its momentum carries it on in smooth curves. A comet has no timer: as
   its stars' own pulls home wake up, the comet's hold on them fades, stars
   from different nuclei stretch away in different directions, and the
   comet thins out and dissolves on its own. */
function updateComets(dt) {
  const f = dt * 60;
  const cap2 = CONFIG.COMET_CAPTURE_RADIUS ** 2;
  const maxTurn = CONFIG.COMET_TURN_RATE * dt;
  const ease = 1 - Math.pow(1 - CONFIG.STEERING_SMOOTHNESS, f);
  const point = 1 - Math.exp(-dt / 0.08);
  const bw = view.halfW - 0.3;
  const bh = view.halfH - 0.3;

  for (const c of comets) {
    if (c.dead) continue;

    // It gathers loose stars near its head, from any nucleus, unless they
    // are already turning for home.
    if (c.members.length < CONFIG.COMET_MAX_MEMBERS && loose.n) {
      const [cx, cy] = gridCell(c.x, c.y);
      for (let oy = -1; oy <= 1; oy++) {
        const yy = cy + oy;
        if (yy < 0 || yy >= lgrid.rows) continue;
        for (let ox = -1; ox <= 1; ox++) {
          const xx = cx + ox;
          if (xx < 0 || xx >= lgrid.cols) continue;
          for (let k = lgrid.head[yy * lgrid.cols + xx]; k !== -1; k = lgrid.next[k]) {
            const S = systems[loose.sys[k]];
            const i = loose.idx[k];
            if (S.comet[i] >= 0 || S.cool[i] > 0 || S.homeOn[i] >= 0.3 || S.gazeHome[i]) continue;
            const dx = S.px[i] - c.x;
            const dy = S.py[i] - c.y;
            if (dx * dx + dy * dy > cap2) continue;
            joinComet(c, S, i);
            if (c.members.length >= CONFIG.COMET_MAX_MEMBERS) break;
          }
        }
      }
    }

    // Where it wants to go: toward the cursor, nudged along the eye's gaze,
    // and back toward the screen if it is about to leave it.
    const dx = cursor.x - c.x;
    const dy = cursor.y - c.y;
    const dl = Math.hypot(dx, dy) || 1;
    const wc = CONFIG.COMET_CURSOR_ATTRACTION * (0.3 + 0.7 * cursor.presence);
    const wg = CONFIG.COMET_GAZE_INFLUENCE;
    let tx = (dx / dl) * wc + gaze.x * wg;
    let ty = (dy / dl) * wc + gaze.y * wg;
    if (c.x < -bw) tx += (-bw - c.x) * 4;
    else if (c.x > bw) tx -= (c.x - bw) * 4;
    if (c.y < -bh) ty += (-bh - c.y) * 4;
    else if (c.y > bh) ty -= (c.y - bh) * 4;
    const tl = Math.hypot(tx, ty) || 1;
    c.wx += (tx / tl - c.wx) * ease;
    c.wy += (ty / tl - c.wy) * ease;

    // Bend the velocity toward it, at a limited rate, keeping the speed.
    const now = Math.atan2(c.vy, c.vx);
    const want = Math.atan2(c.wy, c.wx);
    const turn = clamp(Math.atan2(Math.sin(want - now), Math.cos(want - now)), -maxTurn, maxTurn);
    const ang = now + turn;
    c.vx = Math.cos(ang) * c.speed;
    c.vy = Math.sin(ang) * c.speed;
    c.x += c.vx * f;
    c.y += c.vy * f;

    // Its bright head points the way it is moving; the tail streams behind.
    c.hx += (Math.cos(ang) - c.hx) * point;
    c.hy += (Math.sin(ang) - c.hy) * point;
    const hl = Math.hypot(c.hx, c.hy) || 1;
    c.hx /= hl;
    c.hy /= hl;

    c.size += (Math.min(1, c.members.length / 30) - c.size) * (1 - Math.exp(-dt / 0.5));
    if (c.members.length < 2) dissolveComet(c);
    else layoutComet(c);
  }
  comets = comets.filter((c) => !c.dead);
}

/* Each star's place in its comet: a bright concentrated head, a broad gold
   dust tail sweeping to one side, and a long narrow blue-violet ion tail,
   all streaming behind the head with a slow ripple. */
function layoutComet(c) {
  const L = CONFIG.COMET_TAIL_LENGTH * (0.35 + 0.65 * c.size);
  const gx = c.hx;
  const gy = c.hy;
  const px = -gy;
  const py = gx;
  const t = state.time;
  for (const m of c.members) {
    let along;
    let side;
    if (m.kind === HEAD) {
      along = m.t * L;
      side = m.lat * 0.03;
    } else if (m.kind === DUST) {
      along = m.t * L;
      side = m.lat * 0.34 * L * Math.pow(m.t, 0.8) + c.curve * 0.28 * L * m.t * m.t;
    } else {
      along = m.t * L * 1.25;
      side = m.lat * 0.045 * L * m.t - c.curve * 0.06 * L * m.t;
    }
    side += 0.035 * m.t * Math.sin(t * 3 + m.t * 9 + m.ph);
    m.s.mtx[m.i] = c.x - gx * along + px * side;
    m.s.mty[m.i] = c.y - gy * along + py * side;
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
  const d = Math.hypot(cursor.x, cursor.y);
  const m = Math.sin(CONFIG.EYE_MAX_TURN * smoothstep(0.05, 2.6, d));
  let tx = d > 1e-4 ? (cursor.x / d) * m : 0;
  let ty = d > 1e-4 ? (cursor.y / d) * m : 0;

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
  for (const s of systems) s.updateState(dt);
  interactLoose();
  updateComets(dt);
  updateFading(dt);
  const frames = dt * 60;
  const steps = Math.max(1, Math.ceil(frames));
  const h = frames / steps;
  for (let k = 0; k < steps; k++) for (const s of systems) s.step(h);
  for (const s of systems) s.guard();
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

  ctx.globalCompositeOperation = 'lighter';
  ctx.setTransform(s, 0, 0, s, ox, oy);
  if (intro.glow > 0.001) drawIntroGlow();
  drawComets();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawStars();
  drawEmbers();

  ctx.setTransform(s, 0, 0, s, ox, oy);
  drawNuclei();
  ctx.globalCompositeOperation = 'source-over';
  if (intro.eye >= 1) drawEye();
  else if (intro.eye > 0.001) {
    // the eye condensing out of the galaxy's core
    ctx.save();
    ctx.scale(intro.eye, intro.eye);
    drawEye();
    ctx.restore();
  }
  if (state.showVectors) drawVectors();
  drawCursor();
}

/* ── Star trails ──────────────────────────────────────────────────────────
   The trail layer fades a little every frame, and each particle draws a
   thin line into it from where it was to where it is. Together they leave
   soft, luminous streaks that lengthen with energy. */
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
  for (const S of systems) {
    const { px, py, lx, ly, col, ccol } = S;
    for (let i = 0; i < S.n; i++) {
      const x = tox + px[i] * ts;
      const y = toy + py[i] * ts;
      const x0 = tox + lx[i] * ts;
      const y0 = toy + ly[i] * ts;
      lx[i] = px[i];
      ly[i] = py[i];
      const seg = Math.abs(x - x0) + Math.abs(y - y0);
      if (seg > 0.3 && seg < ts * 1.2) {
        const p = trailPaths[S.cmix[i] > 0.5 ? ccol[i] : col[i]];
        p.moveTo(x0, y0);
        p.lineTo(x, y);
      }
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

/* The star heads: small glowing points drawn fresh every frame. Loose stars
   flare slightly; stars flying in a comet take the comet's colours, and
   cross-fade back to their own when they let go. */
function drawStars() {
  const s = view.dpr * view.cell;
  const ox = view.dpr * view.cx;
  const oy = view.dpr * view.cy;
  const size = (CONFIG.PARTICLE_SIZE * s) / STAR_CORE;
  const base = CONFIG.starOpacity * intro.starVis;
  for (const S of systems) {
    const { px, py, col, ccol, cmix, bright, bond } = S;
    for (let i = 0; i < S.n; i++) {
      const m = cmix[i];
      const a = Math.min(1, bright[i] * base * lerp(1 + 0.3 * (1 - bond[i]), 1.3, m));
      const r = size * S.size[i] * (1 + 0.1 * m);
      const x = ox + px[i] * s - r;
      const y = oy + py[i] * s - r;
      if (m < 0.02) {
        ctx.globalAlpha = a;
        ctx.drawImage(starSprites[col[i]], x, y, 2 * r, 2 * r);
      } else if (m > 0.98) {
        ctx.globalAlpha = a;
        ctx.drawImage(starSprites[ccol[i]], x, y, 2 * r, 2 * r);
      } else {
        ctx.globalAlpha = a * (1 - m);
        ctx.drawImage(starSprites[col[i]], x, y, 2 * r, 2 * r);
        ctx.globalAlpha = a * m;
        ctx.drawImage(starSprites[ccol[i]], x, y, 2 * r, 2 * r);
      }
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

/* ── Comets ─────────────────────────────────────────────────────────────────
   After the comet photograph: a small, intensely bright head; a broad gold
   dust tail sweeping to one side; a long, narrow blue ion tail with a violet
   fringe. All of it streams away from the direction of flight, and it grows
   with the number of stars the comet has gathered. */
function drawComets() {
  for (const c of comets) drawComet(c, 1);
  // dissolving comets: fading, shrinking, drifting on
  for (const c of fadingComets) {
    const v = Math.max(0, c.fade);
    drawComet(c, v * v * (3 - 2 * v));
  }
  ctx.globalAlpha = 1;
}

function drawComet(c, vis) {
  const k = c.size * (0.45 + 0.55 * vis); // a dissolving comet shrinks as it fades
  if (k < 0.02) return;
  const L = CONFIG.COMET_TAIL_LENGTH * (0.35 + 0.65 * k);
  const back = Math.atan2(-c.hy, -c.hx);
  const tail = (sprite, angle, len, width, alpha) => {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(back + angle);
    ctx.globalAlpha = alpha * k * vis;
    ctx.drawImage(sprite, 0, -width / 2, len, width);
    ctx.restore();
  };
  // broad gold dust fan, with a brighter, whiter core near the head
  tail(tailSprites.dust, -c.curve * 0.2, L * 1.05, L * 0.78, 0.5);
  tail(tailSprites.dust, -c.curve * 0.12, L * 0.8, L * 0.38, 0.45);
  tail(tailSprites.head, -c.curve * 0.08, L * 0.55, L * 0.2, 0.45);
  // long narrow blue ion tail with a violet fringe
  tail(tailSprites.violet, c.curve * 0.1, L * 1.3, L * 0.26, 0.38);
  tail(tailSprites.ion, c.curve * 0.05, L * 1.5, L * 0.1, 0.75);
  // a small, intensely bright head
  const hr = (0.06 + 0.1 * k) * (0.25 + 0.75 * vis);
  ctx.globalAlpha = vis;
  ctx.drawImage(cometHeadSprite, c.x - hr, c.y - hr, hr * 2, hr * 2);
  ctx.drawImage(cometHeadSprite, c.x - hr * 0.4, c.y - hr * 0.4, hr * 0.8, hr * 0.8);
}

/* ── Nuclei ─────────────────────────────────────────────────────────────────
   Each nucleus is a small star: a white-gold core with a soft glow, a faint
   blue halo and fine diffraction spikes. It dims while its system is
   scattered and brightens again as it rebuilds. */
function drawNuclei() {
  const g = CONFIG.GLOW_STRENGTH;
  const t = state.time;
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.strokeStyle = `rgb(${CONFIG.colors.nucleus})`;
  ctx.fillStyle = '#fff';
  ctx.lineWidth = 0.7 * PX;
  for (const s of systems) {
    if (s.appear <= 0.001) continue; // asleep in the opening galaxy
    const whole = s.shown;
    const b = g * (0.35 + 0.65 * whole) * (0.85 + 0.15 * Math.sin(t * 1.3 + s.twinkle)) * (1 + 0.35 * s.local) * s.appear;

    ctx.globalAlpha = 0.5 * b * whole;
    const hr = 0.3;
    ctx.drawImage(haloSprite, s.x - hr, s.y - hr, 2 * hr, 2 * hr);

    ctx.globalAlpha = Math.min(1, 0.9 * b);
    const nr = 0.1 * (0.75 + 0.25 * whole);
    ctx.drawImage(nucleusSprite, s.x - nr, s.y - nr, 2 * nr, 2 * nr);

    const len = 0.08 * (0.45 + 0.55 * whole);
    ctx.globalAlpha = 0.35 * b;
    ctx.beginPath();
    ctx.moveTo(s.x - len, s.y);
    ctx.lineTo(s.x + len, s.y);
    ctx.moveTo(s.x, s.y - len);
    ctx.lineTo(s.x, s.y + len);
    ctx.stroke();

    ctx.globalAlpha = Math.min(1, b);
    ctx.beginPath();
    ctx.arc(s.x, s.y, 1.5 * PX, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
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

function drawVectors() {
  const sp = CONFIG.vectorSpacing;
  const x0 = Math.ceil(-view.halfW / sp) * sp;
  const y0 = Math.ceil(-view.halfH / sp) * sp;
  const calm = new Path2D();
  const strong = new Path2D();
  for (let y = y0; y < view.halfH; y += sp) {
    for (let x = x0; x < view.halfW; x += sp) {
      if (Math.hypot(x, y) < CONFIG.eyeClearRadius) continue;
      fieldAt(x, y, FF);
      const m = Math.hypot(FF.x, FF.y);
      if (m < 1e-8) continue;
      const q = Math.min(1, Math.sqrt(m / CONFIG.vectorReference));
      const len = CONFIG.vectorLength * (0.18 + 0.82 * q);
      const ux = FF.x / m;
      const uy = FF.y / m;
      const path = q > 0.8 ? strong : calm;
      const tx = x + ux * len * 0.5;
      const ty = y + uy * len * 0.5;
      path.moveTo(x - ux * len * 0.5, y - uy * len * 0.5);
      path.lineTo(tx, ty);
      const hl = Math.min(0.06, len * 0.35);
      path.moveTo(tx - (ux * 0.9 - uy * 0.45) * hl, ty - (uy * 0.9 + ux * 0.45) * hl);
      path.lineTo(tx, ty);
      path.lineTo(tx - (ux * 0.9 + uy * 0.45) * hl, ty - (uy * 0.9 - ux * 0.45) * hl);
    }
  }
  ctx.lineWidth = 0.8 * PX;
  ctx.strokeStyle = `rgb(${CONFIG.colors.ui})`;
  ctx.globalAlpha = 0.3;
  ctx.stroke(calm);
  ctx.globalAlpha = 0.65;
  ctx.stroke(strong);
  ctx.globalAlpha = 1;
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

function resetSystem() {
  buildSprites();
  createSystems();
  buildIrisTexture();
  resetEyeball();
  state.energy = 0;
  state.cursorEnergy = 0;
  cursor.speed = 0;
  cursor.svx = cursor.svy = 0;
  cursor.skipSample = true;
}

/* ==========================================================================
   Opening: a drifting galaxy that awakens into the field
   --------------------------------------------------------------------------
   Until the cursor first moves, every star drifts slowly in one wide spiral
   galaxy around the centre, while the nuclei and the eye sleep. The first
   movement awakens the system: the title fades away, and each star leaves
   the galaxy along a gentle curve for its own place on its own nucleus's
   orbit, inner galaxy first. The nuclei brighten as their stars arrive and
   the eye condenses out of the galaxy's core. Every star arrives already
   moving with its orbit, so the hand-over to the field is seamless.
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
const HOME = { x: 0, y: 0 };

// Where each star drifts in the opening galaxy, and its place in the field.
function initIntro() {
  for (const S of systems) {
    const n = S.n;
    S.gr = new Float32Array(n); // share of the galaxy's radius
    S.ga = new Float32Array(n); // angle in the galaxy
    S.gw = new Float32Array(n); // how fast it turns (rad / s): inner stars faster
    S.gd = new Float32Array(n); // when it leaves for its orbit (s)
    S.gu = new Float32Array(n); // how long its flight takes (s)
    S.gc = new Float32Array(n); // how much its path curves
    for (let i = 0; i < n; i++) {
      const r = 0.06 + 0.94 * Math.pow(Math.random(), 0.85);
      let a;
      if (Math.random() < 0.22) a = Math.random() * TAU; // a diffuse halo
      else {
        const arm = Math.random() < 0.5 ? 0 : Math.PI;
        const scatter = (Math.random() + Math.random() + Math.random() - 1.5) * (0.22 + 0.55 * r);
        a = arm - 2.8 * Math.log(0.12 + r) + scatter; // two trailing spiral arms
      }
      S.gr[i] = r;
      S.ga[i] = a;
      S.gw[i] = 0.1 / Math.sqrt(0.15 + r);
      S.gd[i] = 0.1 + CONFIG.INTRO_STAGGER * (0.7 * r + 0.3 * Math.random());
      S.gu[i] = CONFIG.INTRO_TRANSFORM_TIME * (0.8 + 0.4 * Math.random());
      S.gc[i] = 0.1 + 0.24 * Math.random();
      driftPos(S, i, DRIFT);
      S.px[i] = S.lx[i] = DRIFT.x;
      S.py[i] = S.ly[i] = DRIFT.y;
      S.vx[i] = S.vy[i] = 0;
    }
    S.appear = 0;
    S.shown = 0;
  }
}

function driftPos(S, i, out) {
  const r = S.gr[i] * Math.hypot(view.halfW, view.halfH) * 0.95;
  const a = S.ga[i] + S.gw[i] * CONFIG.INTRO_DRIFT_SPEED * CONFIG.BASE_MOTION * intro.clock;
  const x = r * Math.cos(a);
  const y = r * Math.sin(a) * GALAXY_FLAT;
  const tilt = GALAXY_TILT + (view.portrait ? Math.PI / 2 : 0); // stands upright on portrait screens
  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  flowAt(x * 0.6 + S.id, y * 0.6, intro.clock * 0.25, FLOW);
  out.x = x * ct - y * st + FLOW.x * 0.05;
  out.y = x * st + y * ct + FLOW.y * 0.05;
}

function homePos(S, i, out) {
  const ox = S.r[i] * Math.cos(S.th[i]);
  const oy = S.r[i] * Math.sin(S.th[i]) * S.flat;
  out.x = S.x + ox * S.ca - oy * S.sa;
  out.y = S.y + ox * S.sa + oy * S.ca;
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

  const bm = CONFIG.BASE_MOTION;
  let arrivedAll = waking;
  for (const S of systems) {
    let arrived = 0;
    for (let i = 0; i < S.n; i++) {
      S.th[i] += S.w[i] * dt * bm; // its place on the orbit keeps turning
      driftPos(S, i, DRIFT);
      let x = DRIFT.x;
      let y = DRIFT.y;
      if (waking) {
        const p = clamp((intro.t - S.gd[i]) / S.gu[i], 0, 1);
        if (p < 1) arrivedAll = false;
        const e = p * p * p * (p * (p * 6 - 15) + 10); // eased at both ends
        homePos(S, i, HOME);
        const dx = HOME.x - DRIFT.x;
        const dy = HOME.y - DRIFT.y;
        const bend = Math.sin(Math.PI * e) * S.gc[i]; // a gentle sideways curve, turning with the galaxy
        x = DRIFT.x + dx * e - dy * bend;
        y = DRIFT.y + dy * e + dx * bend;
        arrived += e;
      }
      S.vx[i] = x - S.px[i];
      S.vy[i] = y - S.py[i];
      S.px[i] = x;
      S.py[i] = y;
    }
    S.appear = smoothstep(0.2, 0.95, arrived / S.n);
    S.shown = S.appear;
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
  for (const S of systems) {
    S.appear = 1;
    S.shown = 1;
    for (let i = 0; i < S.n; i++) {
      S.bond[i] = 1;
      S.free[i] = 0;
      S.sax[i] = S.say[i] = 0;
    }
  }
  document.body.classList.remove('is-intro');
  if (introEl) {
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
      showStatus(state.showVectors ? 'Vector field on' : 'Vector field off');
      break;
    case 'KeyR':
      resetSystem();
      showStatus('Reset');
      break;
    case 'KeyH':
      toggleHelp();
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
createSystems();
buildIrisTexture();
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
window.GAZE_FIELD = { CONFIG, state, cursor, systems: () => systems, comets: () => comets };
