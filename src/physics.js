// Top-down 2D physics for the pucks sliding on the alley (X = width, Z = length).
// Bodies are plain data; the renderer attaches a `.mesh` and reads x/z each frame.
// The World is deliberately renderer-agnostic and talks back through callbacks.

import { ALLEY, PHYS, CLEAR_TIER, TIERS } from './config.js';

let nextId = 1;

export class World {
  /**
   * @param {object} cb
   * @param {(body)=>void} cb.onSpawn   - build a visual for a newly created body
   * @param {(body)=>void} cb.onRemove  - tear down a body's visual
   * @param {(body)=>void} cb.onMerge   - a merge produced this new body (score it / pop it)
   * @param {(x,z,tier)=>void} cb.onClear - two top-tier pucks cleared at (x,z)
   */
  constructor(cb) {
    this.cb = cb;
    this.bodies = [];
    this._pending = []; // merge results queued within a substep
  }

  spawn(tier, x, z, vx = 0, vz = 0) {
    const body = {
      id: nextId++,
      tier,
      x, z, vx, vz,
      r: TIERS[tier].r,
      mesh: null,
      dead: false,
      born: performance.now(), // used by the renderer for the pop-in animation
    };
    this.bodies.push(body);
    this.cb.onSpawn(body);
    return body;
  }

  step(dt) {
    // Clamp dt so an alt-tab / long frame can't tunnel pucks through walls.
    dt = Math.min(dt, 1 / 30);
    const h = dt / PHYS.substeps;
    for (let s = 0; s < PHYS.substeps; s++) this._substep(h);
  }

  _substep(h) {
    const damp = Math.exp(-PHYS.friction * h);
    const bodies = this.bodies;

    // Integrate + wall collisions.
    for (const b of bodies) {
      if (b.dead) continue;
      b.vx *= damp;
      b.vz *= damp;
      if (b.vx * b.vx + b.vz * b.vz < PHYS.stopSpeed * PHYS.stopSpeed) {
        b.vx = 0;
        b.vz = 0;
      }
      b.x += b.vx * h;
      b.z += b.vz * h;

      const wall = ALLEY.wallX - b.r;
      if (b.x < -wall) { b.x = -wall; b.vx = Math.abs(b.vx) * PHYS.restitution; }
      else if (b.x > wall) { b.x = wall; b.vx = -Math.abs(b.vx) * PHYS.restitution; }

      const back = ALLEY.far + b.r;
      if (b.z < back) { b.z = back; b.vz = Math.abs(b.vz) * PHYS.restitution; }
    }

    // Pairwise collisions (O(n^2); n stays small in practice).
    for (let i = 0; i < bodies.length; i++) {
      const a = bodies[i];
      if (a.dead) continue;
      for (let j = i + 1; j < bodies.length; j++) {
        const b = bodies[j];
        if (b.dead) continue;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const min = a.r + b.r;
        const d2 = dx * dx + dz * dz;
        if (d2 >= min * min) continue;

        if (a.tier === b.tier) {
          this._queueMerge(a, b);
          break; // `a` is consumed; stop scanning it this substep
        }

        const d = Math.sqrt(d2) || 1e-4;
        const nx = dx / d;
        const nz = dz / d;
        const overlap = min - d;
        const ma = a.r * a.r;
        const mb = b.r * b.r;
        const tm = ma + mb;

        // Positional correction, split by mass.
        a.x -= nx * overlap * (mb / tm);
        a.z -= nz * overlap * (mb / tm);
        b.x += nx * overlap * (ma / tm);
        b.z += nz * overlap * (ma / tm);

        // Impulse along the collision normal (only if closing).
        const vn = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
        if (vn < 0) {
          const jimp = -(1 + PHYS.restitution) * vn / (1 / ma + 1 / mb);
          a.vx -= jimp * nx / ma;
          a.vz -= jimp * nz / ma;
          b.vx += jimp * nx / mb;
          b.vz += jimp * nz / mb;
        }
      }
    }

    this._resolveMerges();
    this._compact();
  }

  _queueMerge(a, b) {
    a.dead = true;
    b.dead = true;
    const ma = a.r * a.r;
    const mb = b.r * b.r;
    const tm = ma + mb;
    this._pending.push({
      tier: a.tier + 1,
      x: (a.x * ma + b.x * mb) / tm,
      z: (a.z * ma + b.z * mb) / tm,
      vx: (a.vx * ma + b.vx * mb) / tm,
      vz: (a.vz * ma + b.vz * mb) / tm,
    });
  }

  _resolveMerges() {
    for (const m of this._pending) {
      if (m.tier >= CLEAR_TIER) {
        this.cb.onClear(m.x, m.z, m.tier - 1);
      } else {
        const nb = this.spawn(m.tier, m.x, m.z, m.vx, m.vz);
        this.cb.onMerge(nb);
      }
    }
    this._pending.length = 0;
  }

  _compact() {
    if (!this.bodies.some((b) => b.dead)) return;
    const kept = [];
    for (const b of this.bodies) {
      if (b.dead) this.cb.onRemove(b);
      else kept.push(b);
    }
    this.bodies = kept;
  }

  /** True once a settled puck's player-facing edge has crossed the foul line. */
  jammed() {
    for (const b of this.bodies) {
      if (b.dead) continue;
      const atRest = b.vx === 0 && b.vz === 0;
      if (atRest && b.z + b.r > ALLEY.foul) return true;
    }
    return false;
  }

  clear() {
    for (const b of this.bodies) this.cb.onRemove(b);
    this.bodies = [];
    this._pending.length = 0;
  }
}
