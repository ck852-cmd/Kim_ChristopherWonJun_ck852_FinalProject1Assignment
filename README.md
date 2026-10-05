# Gaze Field

An interactive creative-coding piece about a predator and its prey, drawn in starlight on a black field.

**Live site:** <https://ck852-cmd.github.io/Kim_ChristopherWonJun_ck852_FinalProject1Assignment/>

**Clumps of stars** flock and wander across the screen, and a click adds a new one. A **galactic eye** follows the cursor and hunts them. Its vision cone points the way it is moving.

It opens on a **sleeping galaxy**. Every star drifts slowly in one wide spiral around the centre under the title *Gaze Field* and the line "Move your cursor to awaken the system." The first real movement of the cursor awakens it. The text fades away, each star curves out of the galaxy into its starting clump, and the eye condenses out of the galaxy's core.

Plain HTML, CSS and JavaScript on the Canvas 2D API. There are no frameworks, no build step and no server code.

---

## The life cycle

| Step | What happens |
| --- | --- |
| **Prey** | Clumps of particles move together by boids flocking: separation, alignment and cohesion. A swirling wander current carries them, and each clump also has its own slowly turning random drift, so neighbouring clumps head off in different directions. They stay far slower than comets. The field starts with 18 clumps of different sizes spread across the screen. |
| **Click** | A click adds a new clump (`CLICK_CLUMP_SIZE`, 30–50 particles) at the cursor. It is safe from the eye for `CLICK_COOLDOWN` (1 s). |
| **1. Seen** | When a clump enters the eye's vision cone, it bursts: a soft version of the firework below. Its particles fly out radially from the clump's centre with a lean away from the eye, at `SCATTER_FORCE`, with short streaks (`SCATTER_TRAIL`) and no flash. |
| **2. Fused** | After `SCATTER_TIME` (1 s) the scattered particles pull back together and fuse into a single comet, which flies off the way the group was drifting: away from the eye. |
| **3. Comet** | Comets move fast in straight lines (`COMET_SPEED`), bounce off the screen edges and trail a glowing tail. A comet's size shows how many particles it contains. The eye does not affect comets. |
| **4. Firework** | When two comets collide there is a brief flash and a shock ring at the impact point (`BURST_FLASH`). Every particle bursts out radially at about `BURST_SPEED`, each at a slightly random speed (`BURST_SPREAD`) and angle (`BURST_JITTER`) so the burst looks organic rather than a perfect circle. Each leaves a short fading streak (`TRAIL_LENGTH`). They slow under `BURST_DRAG`, and after `BURST_TIME` gather back (`GATHER_PULL`) into one new clump, which resumes flocking. This is the most dramatic moment; the eye's scatter is deliberately softer. |
| **5. Conservation** | Every particle is always in exactly one state: flocking, scattered or inside a comet. Scattering, fusing and colliding never change the total. Only a click adds particles, up to `MAX_PARTICLES` (3000); at the limit, clicks do nothing. |

**Cooldowns.** A newly formed clump, including the starting clumps, is safe from the eye for `CLUMP_COOLDOWN` (1 s). A newly formed comet cannot collide for `COMET_COOLDOWN`, so fragments do not instantly re-collide.

**Specks.** Groups of fewer than `MIN_CLUMP` (3) particles are strays rather than clumps, and the eye ignores them.

### The eye

The eye chases the cursor as a critically damped spring (`EYE_FOLLOW`, `EYE_MAX_SPEED`), so it follows with a natural lag and never overshoots. Its vision cone (`CONE_ANGLE` 30° wide, `CONE_LENGTH` 1.3 units long) points along its velocity. When it stops, it keeps looking where it was going. If the pointer leaves, the eye coasts to a stop.

The eyeball keeps its look: a living polar spectrogram for an iris, a pearl sclera with a galaxy inside, and a glow that brightens with cursor speed. The iris turns toward the eye's heading.

### The vector field

Soft-blue arrows on a grid, one every `ARROW_SPACING` pixels, show the eye's force wherever it is active. Each has a solid shaft (`ARROW_WIDTH`) and a filled arrowhead, in a blue a little paler than the eye's glow:

- **Inside the cone:** arrows point away from the eye.
- **Behind the eye:** its wake points back toward it while the eye is moving (`ARROW_WAKE_REACH`).
- **Elsewhere:** there is no force, so there are no arrows.

The field is hidden when the piece loads. It fades in over `ARROW_FADE` (1 s) once the cursor starts moving the eye, and fades back out to nothing when the cursor stops. Arrow length (`ARROW_MIN_LENGTH` up to `ARROW_MAX_LENGTH`) and opacity (up to `ARROW_OPACITY`) grow with the force, so they are strongest at the eyeball's rim and when the cursor moves fast. An arrow grows quickly as the eye's force arrives (`ARROW_RISE`) and eases back over `ARROW_EASE`. <kbd>V</kbd> turns the arrows off completely, and on again. The arrows are a picture of the eye's reach; its only real effect is still to scatter the clumps inside its cone.

### Balance

The life cycle combines groups (two comets make one clump), and flocking clumps also join when they meet. Splitting comes only from the wander current. Its swirls (`WANDER_SCALE`) are tight enough to shear big clumps apart now and then, which keeps several groups in play. Broader swirls let clumps drift together into a few giants.

---

## Controls

| Input | Action |
| --- | --- |
| Mouse / touch move | Lead the eye |
| Click / tap | Add a new clump at the cursor (until `MAX_PARTICLES` is reached) |
| <kbd>V</kbd> | Turn the vector field arrows on / off (on at start; they show only while the eye moves) |
| <kbd>Space</kbd> | Pause / resume |
| <kbd>R</kbd> | A fresh set of clumps (back to `PARTICLE_COUNT`); the eye returns to the centre |
| <kbd>H</kbd> | Show / hide the instruction panel (on touch screens it steps aside after the first touch) |
| <kbd>D</kbd> | Debug overlay: total particles against `MAX_PARTICLES` (start + added by clicks, with a conservation check), particles flocking / scattered / inside comets, clump and comet counts and sizes, events in the last 10 s, and the vision cone outline |

During the opening, moving the cursor (or touching and moving) awakens the system. <kbd>Enter</kbd> or <kbd>Space</kbd> also awaken it, and the other keys wait until it is awake.

---

## Run locally

Any static file server works. From this folder:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>. Opening `index.html` directly also works in most browsers.

## Publish on GitHub Pages

1. Put `index.html`, `styles.css`, `script.js`, `README.md` and `.nojekyll` at the root of a GitHub repository and push to `main`.
2. In the repository, open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, select `main` and `/ (root)`, then **Save**.
4. After a minute the site is live at `https://<user>.github.io/<repository>/`.

All paths are relative, so the site works from a project subpath. `.nojekyll` tells Pages to serve the files as they are.

---

## Tuning

Every adjustable value lives in the `CONFIG` object at the top of [`script.js`](script.js).

| Key | Effect |
| --- | --- |
| `PARTICLE_COUNT`, `MAX_PARTICLES` | Particles at the start, and the most there can ever be (clicks add up to this) |
| `CLUMP_COUNT` | How many clumps the field starts with |
| `CLUMP_SPEED` | Top speed of a flocking particle (units / s); comets are far faster |
| `SEPARATION_WEIGHT`, `ALIGNMENT_WEIGHT`, `COHESION_WEIGHT`, `WANDER_WEIGHT` | The boids weights, plus the wander current |
| `CLUMP_DRIFT_WEIGHT`, `CLUMP_DRIFT_TURN` | Each clump's own random drift, and how quickly its direction wanders |
| `CLICK_CLUMP_SIZE`, `CLICK_COOLDOWN` | Size range of a clicked clump, and how long it is safe from the eye |
| `NEIGHBOR_RADIUS`, `SEPARATION_RADIUS`, `MAX_NEIGHBORS` | How far a particle sees flockmates, how close is too close, and how many it considers |
| `WANDER_SCALE`, `WANDER_RATE` | How tight the wander current's swirls are, and how quickly it changes |
| `CLUMP_COOLDOWN`, `MIN_CLUMP` | How long a new clump is safe from the eye, and the smallest group that counts as a clump |
| `EYE_FOLLOW`, `EYE_MAX_SPEED` | How tightly and how fast the eye follows the cursor |
| `CONE_ANGLE`, `CONE_LENGTH` | The vision cone's full angle (degrees) and reach (units) |
| `ARROWS_ON`, `ARROW_SPACING`, `ARROW_WIDTH` | Whether the arrows show at start, their spacing and their line thickness (pixels) |
| `ARROW_MIN_LENGTH`, `ARROW_MAX_LENGTH`, `ARROW_OPACITY` | The shortest and longest arrow (pixels), and the strongest arrow's opacity |
| `ARROW_FADE` | Seconds for the whole field to fade in once the cursor moves the eye, and back out when it stops |
| `ARROW_RISE`, `ARROW_EASE` | How quickly an arrow grows as the eye's force arrives, and how slowly it eases back (seconds) |
| `ARROW_WAKE_REACH` | How far behind the eyeball the wake reaches (units) |
| `colors.field` | The arrows' soft blue |
| `BURST_SPEED`, `BURST_TIME`, `BURST_DRAG`, `TRAIL_LENGTH` | The firework: how fast particles fly out, how long before they gather back, how quickly they slow, and their streak length (seconds of motion) |
| `BURST_SPREAD`, `BURST_JITTER`, `BURST_FLASH` | Randomness of each burst particle's speed and angle, and how long the impact flash lasts |
| `GATHER_PULL`, `GATHER_TIME` | How hard the burst gathers back into a clump, and the longest that takes |
| `SCATTER_TIME`, `SCATTER_FORCE`, `SCATTER_DRAG`, `SCATTER_TRAIL` | The eye's softer scatter: how long it flies apart, how fast, how quickly it slows, and its shorter streaks |
| `FUSE_PULL`, `FUSE_TIME` | How hard the scattered particles pull back together, and the longest the pull lasts before they fuse anyway |
| `COMET_SPEED`, `COMET_RADIUS`, `COMET_TAIL` | Comet speed, collision radius per √particles, and tail length |
| `COMET_COOLDOWN`, `BOUNCE_JITTER` | How long a new comet cannot collide, and the random turn at each bounce (so paths never lock into a loop) |
| `COMET_FADE_TIME`, `EMBER_COUNT` | How a colliding comet's glow fades, and how many sparks it throws off |
| `INTRO_ENABLED` | `false` skips the opening galaxy |
| `INTRO_DRIFT_SPEED`, `INTRO_TRANSFORM_TIME`, `INTRO_STAGGER` | The opening galaxy's turn, each star's flight into its clump, and how spread out the departures are |
| `INTRO_WAKE_DISTANCE`, `INTRO_MIN_TIME` | How far the pointer must move to awaken the system, and how long the opening shows before it can |
| `EYEBALL_RADIUS`, `IRIS_RADIUS`, `EYE_MAX_TURN`, `EYE_STIFFNESS`, `EYE_DAMPING`, `EYE_GLOW` | The eyeball's look and how its iris turns |

World units: one unit is 1/5.6 of the screen's short side (`worldLong` × `worldShort` units fill the screen), so the piece behaves the same at any window size. Speeds are in units per second. For live tuning, open the browser console and edit `GAZE_FIELD.CONFIG`; <kbd>R</kbd> applies values that shape the clumps.

---

## How it works

- **Particles.** Every star lives in one set of flat typed arrays, sized for `MAX_PARTICLES`, with a state (flocking, scattered or inside a comet), so conservation is structural. A click appends a new clump to the end of the arrays.
- **Random drift.** Each clump is born with a drift seed shared by its particles. The seed sets a heading that wanders slowly (1D value noise). Clumps that merge keep their members' seeds, so they can pull apart again.
- **Boids on a spatial grid.** Flocking particles are binned into cells as wide as the neighbour radius. Each looks at the nine cells around it, in a rotating order so a capped neighbour list has no directional bias. The same neighbour pairs feed a union-find that tells which particles form each clump.
- **The hunt.** Each frame, any clump with a particle inside the cone that is not cooling down scatters. The cone is a distance check plus a dot product with the eye's heading.
- **Bursts.** Bursting particles draw their own streaks: three segments back along their velocity, fading toward the tail, as long as `TRAIL_LENGTH` (or `SCATTER_TRAIL`) seconds of motion, so they shrink as drag slows them. They skip the shared trail layer. The flash is a swelling core, a halo and an expanding ring.
- **Fusing.** A scattered group flies apart under drag for `SCATTER_TIME`. Then a damped spring pulls each particle toward the group's centre while keeping the group's drift. When the group is gathered, or `FUSE_TIME` has passed, it becomes a comet travelling along that drift.
- **Comets.** Constant speed, reflected at the edges with a small random turn. Collisions use a coarse spatial hash. A collision becomes a firework group: it flies apart under `BURST_DRAG`, then gathers to a clump-sized cluster (not a point) and becomes a clump. The particles' comet colours fade back to their own, and the comets' glows fade out rather than blinking.
- **Trails.** Particles draw thin segments into a separate layer that fades each frame. A slight colour-burn black point clears the faint floor that fading layers leave behind.

---

## Files

```text
index.html     page shell and instruction panel
styles.css     black-field chrome around the canvas
script.js      simulation and rendering (CONFIG at the top)
assets/        gaze-field-teaser.gif (a teaser of an earlier version) and an early concept reference; neither is used by the page
.nojekyll      serve files as-is on GitHub Pages
```

## Browser notes

Tested with Chromium. Uses only standard Canvas 2D (including the `color-burn` blend mode and `ImageData`), Pointer Events and `requestAnimationFrame`.
