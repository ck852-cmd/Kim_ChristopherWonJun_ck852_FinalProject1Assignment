# Gaze Field

An interactive creative-coding piece about attraction, rejection, freedom and control, drawn as a vector field.

**Live site:** <https://ck852-cmd.github.io/Kim_ChristopherWonJun_ck852_FinalProject1Assignment/>

A fixed 5 × 8 array of luminous **nuclei** floats on a pure black field. Each one holds a small galaxy of orbiting star particles in white, silver, gold and a little blue, each star leaving a glowing trail. The nuclei never move; only their particles do.

- **Slow cursor:** the orbits lean and stretch toward it.
- **Fast cursor:** nearby systems break apart. Their loose stars drift among the loose stars of other systems and attract them. Where stars from different nuclei meet, they fuse into **comets**. A comet keeps the speed and direction of the stars that made it, then curves toward the cursor, nudged by the eye's gaze.
- **Left alone:** there is no timer. Each star remembers when it was last strongly affected. After three quiet seconds a weak pull toward its own nucleus and its own place on that orbit wakes up gradually. What the eye is looking at does not wait: while the cursor is slow, any star or comet inside the eye's gaze is sent home at once. Comets stretch apart along their stars' different ways home and dissolve, and every star glides back into its orbit.

It opens on a **sleeping galaxy**. Every star drifts slowly in one wide spiral around the centre under the title *Gaze Field* and the line "Move your cursor to awaken the system." The first real movement of the cursor awakens it. The text fades away, each star curves out of the galaxy to its own place on its own nucleus's orbit, the nuclei brighten as their stars arrive, and the eye condenses out of the galaxy's core. Then the field is interactive.

At the centre a **galactic eyeball** watches, fixed in place. Its iris is a living polar spectrogram of fine light. The iris and pupil turn across the sphere toward the cursor, following with a small, natural delay.

Plain HTML, CSS and JavaScript on the Canvas 2D API. There are no frameworks, no build step and no server code.

---

## Concept

| Element | Role |
| --- | --- |
| **Nuclei** | 40 fixed stars in a 5 × 8 array: 8 across on landscape screens, and the same array turned upright on portrait screens. They never move. Each dims while its system is broken and brightens as its stars return. |
| **Particles** | Around 90 stars per nucleus, on tilted, spiral-armed orbits. Every star remembers its own nucleus and its own place on that nucleus's orbit, and never exchanges them. |
| **Cursor** | A single **negative charge**. The particles are positive, so they are drawn toward it, more strongly the faster it moves. |
| **Eye** | A galactic eyeball fixed at the **exact centre**. It looks toward the cursor, and its field **pushes away particles in front of its gaze** and **draws in those behind it**. |
| **Comets** | Loose stars from different nuclei, fused until their pulls toward home pull them apart. Each comet chases the cursor (its strongest pull), nudged by the eye's gaze. Its head points the way it moves and its tail streams behind. |

```text
particle movement = orbit + cursor attraction + eye push-or-pull
                    + attraction between loose stars + subtle flow
                    + delayed pull toward its own home
```

### A system's life

| Phase | What happens |
| --- | --- |
| **Bound** | Stars orbit their nucleus. A slow cursor leans and stretches the orbits toward itself (`STRETCH_AMOUNT`). |
| **Disintegrating** | When the cursor's local energy passes `DISINTEGRATION_THRESHOLD`, the system breaks. Its stars are released a few at a time, outer orbits first, and accelerated along the cursor's path over a quarter of a second rather than flung in one jolt. |
| **Loose** | Loose stars attract all other loose stars nearby, from any nucleus (`PARTICLE_ATTRACTION`). Two loose stars from different nuclei that come within `COMET_MERGE_DISTANCE` fuse into a comet, which then gathers loose stars near its head (`COMET_CAPTURE_RADIUS`). |
| **Comet** | A small, intensely bright head; a broad gold dust tail sweeping to one side; a long, narrow blue ion tail with a violet fringe. It keeps the **average direction and speed** of the stars that founded it, and never slows. Its path bends at a limited rate (`COMET_TURN_RATE`) toward a blend of the cursor (`COMET_CURSOR_ATTRACTION`, the strongest pull) and the eye's gaze (`COMET_GAZE_INFLUENCE`). Its momentum makes it sweep, overshoot and loop round the cursor. The head always points along its motion, and the tail streams behind. |
| **Return** | Not a deadline: a delayed attraction (see below). Each star is drawn back to **its own** nucleus and **its own** place on that orbit. Stars never return to the nearest nucleus and never swap places. A comet has no timer either: when its stars' pulls toward home wake, it stretches apart and dissolves on its own. |

### Coming home

Every star keeps a quiet clock: the time since it was last strongly affected.

- **What counts as interaction:** a push from the cursor or the eye stronger than `INTERACTION_THRESHOLD`, a break that strikes it, or joining a comet. Any of these resets its clock to zero.
- **The delay:** while the clock is under `INACTIVITY_DELAY` (3 s), there is no pull home at all. After that, the pull fades in gradually over about two seconds. It never switches on in a single step.
- **Sent home by the eye:** while the smoothed cursor speed is below `GAZE_RETURN_SPEED` (1 unit / s, so the cursor is all but still), any loose star inside the eye's gaze is sent home at once, without the three-second wait. A comet whose head is inside the gaze sends all its stars home. The gaze is a cone from the eye toward the cursor, `GAZE_CONE_ANGLE` (45°) wide. The pull home still eases in over about half a second rather than switching on. As it rises, the eye and a slow cursor let go of the star, so it really heads home. It keeps going until it is back. Only a cursor faster than `GAZE_RETURN_SPEED` that takes hold of it calls it back, and the normal rules apply again.
- **Overpowered, then dominant:** the pull home is weak (`HOME_ATTRACTION`). The cursor, the eye, other loose stars and comets all outweigh it, and any meaningful interaction makes it fade out again. When those forces die away, it slowly becomes the strongest force on the star.
- **Distance:** the pull grows slightly with distance from home (`HOME_DISTANCE_SCALE`), so far-flung stars come back reliably without snapping back. It eases out over the last stretch, so stars arrive gently.
- **Settling:** a returning star is damped toward its orbit's own motion (`RETURN_DAMPING`) and eases down to no more than `MAX_RETURN_SPEED` relative to its orbit. Close to its place, it locks back into its orbit over a fraction of a second.
- **Comets dissolve naturally:** a comet's hold on each star fades as that star's pull home wakes, whether after the quiet delay or because the eye sent it home. Stars from different nuclei are pulled toward different homes, so the comet stretches. A star dragged farther than `COMET_RELEASE_DISTANCE` from its place in the comet lets go, and a comet left with fewer than two stars dissolves.
- **Dissolving gradually, never in a blink:** a dissolving comet's glow drifts on as it fades and shrinks over `COMET_FADE_TIME` (1.2 s). It scatters into small sparks (`EMBER_COUNT` for a full-grown comet) from its head and all along its tail. Each spark eases in, drifts outward, then shrinks and fades. Stars that let go of a comet cross-fade from comet colours back to their own over `starColourFade`, and some shed a spark as they go.
- **Smoothness:** steering forces ease in rather than jolt (`STEERING_SMOOTHNESS`), and no force or damping can change a star's velocity faster than the acceleration limit. Every turn, brake and release is a continuous curve.

### The eye

A complete galactic eyeball, fixed at the centre. Only the eyeball, iris, pupil and the galaxy inside it move.

- **Sclera:** a luminous pearl sphere lit from the upper left, with nebula dust lanes and stars inside that turn with the eyeball. Limb shading and a fresnel rim make it round, and a fixed specular highlight sits on top.
- **Glow:** a blue galactic glow surrounds it and brightens as the cursor speeds up.
- **Iris:** modelled on the reference video `Eye Design.mp4` and generated live in code; no video frames are used. Fine, grainy, fibrous light is written ray by ray into a polar texture, with bands of light and shadow, cloudy patches, radial fibres and a ragged rim. Fresh light enters at a seam at 12 o'clock. Now and then the iris thins to sparse dotted rings, then refills.
- **Pupil:** black with a faint gold glint, widening as the energy rises.
- **Movement:** the iris and pupil rotate across the sphere toward the cursor in every direction, foreshortening as they turn. A damped spring gives a small delay, a slight overshoot and a settle (`EYE_STIFFNESS`, `EYE_DAMPING`). A faster cursor stiffens it, so the eye moves more quickly (`EYE_SPEED_RESPONSE`). While the cursor rests, tiny saccades keep the eye alive, and it rolls slightly as it turns.

### The eye rule

```text
g      = normalize(cursor − eye)            // gaze direction
u      = normalize(point − eye)
facing = dot(u, g)                          // +1 in front … −1 behind
side   = tanh(k · facing)                   // soft switch, no hard dividing line
force  = u · side · strength · falloff(|point − eye|)
```

Loose stars feel the rule most strongly, bound ones feel a gentle version, and comets are steered partly along `g` itself.

---

## Controls

| Input | Action |
| --- | --- |
| Mouse / touch move | Move the attractor (the eye and the comets follow) |
| <kbd>V</kbd> | Show / hide vector-field arrows |
| <kbd>Space</kbd> | Pause / resume |
| <kbd>R</kbd> | Reset the system |
| <kbd>H</kbd> | Show / hide the instruction panel (on touch screens it steps aside after the first touch) |

During the opening, moving the cursor (or touching and moving) awakens the system. <kbd>Enter</kbd> or <kbd>Space</kbd> also awaken it, and the other keys wait until the field is awake. Movements in the first 1.2 s and tiny stray pointer events are ignored, so the opening is always seen.

When the pointer leaves the canvas, its influence fades out over about 1.4 s instead of stopping abruptly.

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

All paths are relative, so the site works from a project subpath. `.nojekyll` tells Pages to serve the files as they are. The reference files (`Eye Design.mp4`, `Comet.PNG.webp` and the sketches) are not needed by the page.

---

## Tuning

Every adjustable value lives in the `CONFIG` object at the top of [`script.js`](script.js).

| Key | Effect |
| --- | --- |
| `INTRO_ENABLED` | `false` skips the opening galaxy and starts with the field awake |
| `INTRO_DRIFT_SPEED`, `INTRO_TRANSFORM_TIME`, `INTRO_STAGGER` | How fast the opening galaxy turns, how long each star's flight to its orbit takes, and how spread out the departures are (inner galaxy first) |
| `INTRO_WAKE_DISTANCE`, `INTRO_MIN_TIME` | How far the pointer must move to awaken the system, and how long the opening shows before it can |
| `BASE_MOTION` | Orbital drift, twinkle and turbulence (0 = still, 2 = restless) |
| `CURSOR_SPEED_SENSITIVITY`, `CURSOR_FORCE_MULTIPLIER` | How easily the cursor reaches full energy, and how hard it pulls |
| `TRAIL_SECONDS`, `TRAIL_ENERGY_MULTIPLIER` | How long star trails linger, and how much energy lengthens them |
| `NUCLEUS_ROWS`, `NUCLEUS_COLUMNS`, `PARTICLES_PER_NUCLEUS` | The fixed array and the stars around each nucleus |
| `ORBIT_RADIUS`, `ORBIT_SPEED`, `ORBIT_SPRING`, `STRETCH_AMOUNT` | Orbit size, speed, firmness, and how far a slow cursor stretches them |
| `DISINTEGRATION_THRESHOLD`, `DISINTEGRATION_RATE`, `SCATTER_FORCE` | What breaks a system, how quickly, and how hard its stars are flung |
| `INACTIVITY_DELAY` | Seconds a star must go without meaningful interaction before its pull home begins to wake (3) |
| `INTERACTION_THRESHOLD` | How strong a push from the cursor or the eye must be to count as interaction and restart that delay |
| `GAZE_CONE_ANGLE` | Full opening angle of the eye's gaze, in degrees |
| `GAZE_RETURN_SPEED` | Below this smoothed cursor speed (1 unit / s), stars and comets inside the gaze are sent home without the delay |
| `HOME_ATTRACTION` | Strength of the weak, delayed pull toward a star's own nucleus and home position |
| `HOME_DISTANCE_SCALE` | How much that pull grows with distance from home, so far-flung stars return reliably |
| `RETURN_DAMPING` | Damping toward the orbit's own motion while returning, so stars settle without overshooting |
| `MAX_RETURN_SPEED` | Top speed while returning, relative to the orbit (units / s) |
| `STEERING_SMOOTHNESS` | How quickly steering forces take effect each frame (lower = smoother, lazier turns) |
| `PARTICLE_ATTRACTION` | Pull between loose stars of any nuclei |
| `COMET_MERGE_DISTANCE`, `COMET_CAPTURE_RADIUS` | When loose stars fuse into a comet, and how far a comet reaches to gather more |
| `COMET_CURSOR_ATTRACTION`, `COMET_GAZE_INFLUENCE`, `COMET_TURN_RATE` | How strongly comets steer toward the cursor and along the gaze, and how quickly they can bend |
| `COMET_MIN_SPEED`, `COMET_MAX_SPEED` | The range a comet's inherited speed is kept within |
| `COMET_TAIL_LENGTH`, `COMET_MAX`, `COMET_MAX_MEMBERS` | Tail length and how many comets and stars there can be |
| `COMET_RELEASE_DISTANCE` | How far a star's pull home must drag it from its place in a comet before it lets go |
| `COMET_FADE_TIME`, `EMBER_COUNT` | How long a dissolving comet takes to fade and shrink away, and how many sparks it scatters into |
| `EYEBALL_RADIUS`, `IRIS_RADIUS`, `eyePupil` | The eyeball's size, and its iris and pupil |
| `EYE_MAX_TURN`, `EYE_STIFFNESS`, `EYE_SPEED_RESPONSE`, `EYE_DAMPING`, `EYE_GLOW` | How far it turns, how it eases and settles, how much faster it moves with a fast cursor, and its glow |
| `GLOW_STRENGTH` | Glow around nuclei and stars |

Forces and speeds are in **array units per 1/60 s frame** (one unit is the short spacing of the array), so the piece behaves the same at any window size. For live tuning, open the browser console and edit `GAZE_FIELD.CONFIG`. Values that shape the systems, sprites or eye texture take effect after <kbd>R</kbd>.

---

## How it works

- **Orbits.** Every star has its own orbit radius, angle and speed on its own system's tilted disk. A spring holds it to its moving place on that orbit, and it rides along with the orbit's own velocity. The cursor's pull shifts that balance, which is what stretches a system toward the cursor.
- **Breaking and returning.** Energy past the threshold builds damage, and full damage releases the stars in a short, staggered sequence. Released stars feel no orbit spring. Each keeps a quiet clock that strong forces reset. After `INACTIVITY_DELAY` seconds of quiet, a weak pull toward its own home fades in. Strong forces overpower it, and it grows with distance. Damping and a speed limit make the star glide back, and close to its place its orbit bond is restored over a fraction of a second.
- **Loose stars and comets.** Each frame, loose stars are binned into a spatial grid. Neighbours attract with a short-range cushion, and a meeting of two stars from different nuclei founds a comet with their average direction and speed. The comet keeps that speed and turns its velocity, at a limited rate, toward the cursor and the gaze. Its stars each hold a role (head, dust tail or ion tail) and a place along the tail behind the direction of motion. Comet glows are soft fan-shaped sprites laid along the tail.
- **Trails.** Stars draw thin segments into a separate layer that fades each frame, and bright heads are drawn fresh on top. A slight colour-burn black point clears the faint floor that fading layers leave behind, so old trails vanish into pure black.
- **Smooth motion.** Forces change acceleration, never position or velocity directly. Steering is eased in, velocity is damped toward the motion of whatever holds the star, and every change of velocity is capped. This keeps movement continuous through disintegration, comet formation and reassembly.
- **Stability.** Speed and acceleration are capped, stars are softly kept on screen and leashed to their own orbits, and any system that ever goes non-finite is rebuilt in place.

---

## Files

```text
index.html     page shell and instruction panel
styles.css     black-field chrome around the canvas
script.js      simulation and rendering (CONFIG at the top)
assets/        gaze-field-teaser.gif (a 9 s looping teaser) and an early concept reference; neither is used by the page
.nojekyll      serve files as-is on GitHub Pages
```

## Browser notes

Tested with Chromium. Uses only standard Canvas 2D (including the `color-burn` blend mode and `ImageData`), Pointer Events and `requestAnimationFrame`.
