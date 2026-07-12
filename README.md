# Merge Bowl (game-merge-101)

A browser game that mashes a **merge puzzle** together with **bowling**. You look
straight down a lane like you're standing at the foul line of a bowling alley.
Random pucks appear at your end; bowl them down the lane, and when two pucks with
the **same number** collide they merge into the next one up. Merge all the way to
the top tier to *clear* it for a big bonus.

## How to play

- **Aim** with your mouse or finger — a dotted guide shows the launch path.
- **Tap / click the lane** to bowl the current puck.
- Matching pucks that touch **merge** into the next tier (1 → 2 → 3 → …).
- Merging two of the **top tier** clears them in a burst for **+750**.
- The pile builds toward you. If a settled puck crosses the red **foul line**,
  the lane jams and the game ends.

The **Next** puck is previewed in the top-right; your best score is saved locally.

## Tech

- **Rendering:** [Three.js](https://threejs.org) — a perspective camera looking
  down the lane gives the real bowling-alley depth. All textures are generated
  procedurally (no external assets), so the build is fully self-contained.
- **Physics:** a small custom top-down 2D simulation (`src/physics.js`) — circle
  bodies with friction, wall/back-wall bounces, mass-weighted collision impulses,
  and merge-on-contact. Keeping physics in-house makes the merge rules exact and
  avoids a heavyweight 3D physics dependency for what is really a flat-table game.
- **Build:** [Vite](https://vitejs.dev), driven by `make`.

### Why not a 3D physics engine?

The pucks only ever slide on a flat table, so the simulation is genuinely 2D.
A bespoke circle solver is a few hundred lines, runs anywhere, and lets the
merge/clear logic live right inside the collision step — cleaner than reconciling
merge events against a general 3D engine (cannon-es / Rapier). Three.js still does
all the 3D *rendering*.

## Running it

```sh
make install   # install dependencies (three, vite)
make dev       # start the dev server with hot reload (opens the browser)
make build     # production build -> dist/
make preview   # serve the production build
make clean     # remove dist/
make distclean # remove dist/ and node_modules/
```

## Layout

```
game-merge-101/
├── Makefile          # build/run targets
├── index.html        # HUD, overlays, styles
├── vite.config.js
└── src/
    ├── config.js     # tier palette, alley geometry, physics tuning
    ├── physics.js    # renderer-agnostic top-down puck simulation
    └── main.js       # Three.js scene, rendering, input, game loop
```

Tuning knobs (tier colors/sizes, lane dimensions, launch speed, friction,
scoring) all live in `src/config.js`.
