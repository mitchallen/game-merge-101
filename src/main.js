import * as THREE from 'three';
import { World } from './physics.js';
import {
  TIERS, ALLEY, PHYS, SPAWN_TIERS, CLEAR_TIER,
  mergePoints, CLEAR_BONUS,
} from './config.js';

// ---------------------------------------------------------------------------
// Renderer / scene / camera
// ---------------------------------------------------------------------------
const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#070b14');
scene.fog = new THREE.Fog('#070b14', 22, 42);

const camera = new THREE.PerspectiveCamera(56, 1, 0.1, 100);
camera.position.set(0, 12.5, ALLEY.near + 5.5);
camera.lookAt(0, 0, -4);

// ---------------------------------------------------------------------------
// Lights
// ---------------------------------------------------------------------------
scene.add(new THREE.HemisphereLight('#cfe0ff', '#141822', 0.75));

const key = new THREE.DirectionalLight('#fff4e0', 1.15);
key.position.set(6, 16, 10);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
key.shadow.camera.near = 1;
key.shadow.camera.far = 60;
key.shadow.camera.left = -12;
key.shadow.camera.right = 12;
key.shadow.camera.top = 12;
key.shadow.camera.bottom = -28;
key.shadow.bias = -0.0004;
scene.add(key);

const fill = new THREE.DirectionalLight('#5f7fff', 0.35);
fill.position.set(-8, 6, -12);
scene.add(fill);

// ---------------------------------------------------------------------------
// Textures (procedural, no external assets)
// ---------------------------------------------------------------------------
function laneTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const g = c.getContext('2d');
  const boards = 14;
  for (let i = 0; i < boards; i++) {
    const t = i / boards;
    const shade = 150 + Math.sin(i * 1.7) * 14 + (i % 2 ? 10 : -6);
    g.fillStyle = `rgb(${shade | 0}, ${(shade * 0.72) | 0}, ${(shade * 0.42) | 0})`;
    g.fillRect((t * c.width) | 0, 0, Math.ceil(c.width / boards) + 1, c.height);
    g.fillStyle = 'rgba(40,22,8,0.35)';
    g.fillRect((t * c.width) | 0, 0, 2, c.height);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// Cache one numbered-top texture per tier.
const topTexCache = new Map();
function topTexture(tier) {
  if (topTexCache.has(tier)) return topTexCache.get(tier);
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  const col = TIERS[tier].color;
  const cx = 128, cy = 128;
  const grad = g.createRadialGradient(cx - 34, cy - 40, 20, cx, cy, 140);
  grad.addColorStop(0, shade(col, 1.35));
  grad.addColorStop(0.6, col);
  grad.addColorStop(1, shade(col, 0.62));
  g.fillStyle = grad;
  g.beginPath(); g.arc(cx, cy, 124, 0, Math.PI * 2); g.fill();
  // inset ring
  g.lineWidth = 10;
  g.strokeStyle = 'rgba(255,255,255,0.22)';
  g.beginPath(); g.arc(cx, cy, 96, 0, Math.PI * 2); g.stroke();
  // number
  g.fillStyle = shade(col, 0.28);
  g.font = '900 150px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(String(tier + 1), cx, cy + 10);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  topTexCache.set(tier, tex);
  return tex;
}

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) * f) | 0;
  const g = Math.min(255, ((n >> 8) & 255) * f) | 0;
  const b = Math.min(255, (n & 255) * f) | 0;
  return `rgb(${r},${g},${b})`;
}

// ---------------------------------------------------------------------------
// Alley geometry
// ---------------------------------------------------------------------------
const laneLen = ALLEY.near - ALLEY.far;
const laneMidZ = (ALLEY.near + ALLEY.far) / 2;

const lane = new THREE.Mesh(
  new THREE.PlaneGeometry(ALLEY.wallX * 2, laneLen),
  new THREE.MeshStandardMaterial({ map: laneTexture(), roughness: 0.85, metalness: 0.05 }),
);
lane.rotation.x = -Math.PI / 2;
lane.position.set(0, 0, laneMidZ);
lane.receiveShadow = true;
scene.add(lane);

// Side rails + gutters
const railMat = new THREE.MeshStandardMaterial({ color: '#1b2740', roughness: 0.5, metalness: 0.4 });
const gutterMat = new THREE.MeshStandardMaterial({ color: '#0a1120', roughness: 0.9 });
for (const s of [-1, 1]) {
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.1, laneLen), railMat);
  rail.position.set(s * (ALLEY.wallX + 0.25), 0.35, laneMidZ);
  rail.castShadow = true; rail.receiveShadow = true;
  scene.add(rail);

  const gutter = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.25, laneLen), gutterMat);
  gutter.position.set(s * (ALLEY.wallX + 0.95), -0.12, laneMidZ);
  gutter.receiveShadow = true;
  scene.add(gutter);
}

// Back wall
const backWall = new THREE.Mesh(new THREE.BoxGeometry(ALLEY.wallX * 2 + 1.4, 1.6, 0.6), railMat);
backWall.position.set(0, 0.6, ALLEY.far - 0.3);
backWall.castShadow = true; backWall.receiveShadow = true;
scene.add(backWall);

// Foul line
const foul = new THREE.Mesh(
  new THREE.PlaneGeometry(ALLEY.wallX * 2, 0.16),
  new THREE.MeshBasicMaterial({ color: '#ff5a5f', transparent: true, opacity: 0.85 }),
);
foul.rotation.x = -Math.PI / 2;
foul.position.set(0, 0.02, ALLEY.foul);
scene.add(foul);

// Launcher pad
const pad = new THREE.Mesh(
  new THREE.RingGeometry(0.7, 0.95, 40),
  new THREE.MeshBasicMaterial({ color: '#ffd54a', transparent: true, opacity: 0.5, side: THREE.DoubleSide }),
);
pad.rotation.x = -Math.PI / 2;
pad.position.set(0, 0.02, ALLEY.launchZ);
scene.add(pad);

// ---------------------------------------------------------------------------
// Puck factory
// ---------------------------------------------------------------------------
const PUCK_H = 0.5;
const geoCache = new Map();
function puckGeo(tier) {
  if (!geoCache.has(tier)) {
    const r = TIERS[tier].r;
    geoCache.set(tier, new THREE.CylinderGeometry(r, r * 0.9, PUCK_H, 44));
  }
  return geoCache.get(tier);
}
function makePuck(tier) {
  const side = new THREE.MeshStandardMaterial({ color: TIERS[tier].color, roughness: 0.35, metalness: 0.25 });
  const top = new THREE.MeshStandardMaterial({ map: topTexture(tier), roughness: 0.3, metalness: 0.2 });
  const bottom = new THREE.MeshStandardMaterial({ color: shade(TIERS[tier].color, 0.55), roughness: 0.6 });
  const mesh = new THREE.Mesh(puckGeo(tier), [side, top, bottom]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// ---------------------------------------------------------------------------
// World wiring
// ---------------------------------------------------------------------------
const world = new World({
  onSpawn(b) {
    const m = makePuck(b.tier);
    m.position.set(b.x, PUCK_H / 2, b.z);
    scene.add(m);
    b.mesh = m;
  },
  onRemove(b) {
    if (b.mesh) { scene.remove(b.mesh); disposePuck(b.mesh); b.mesh = null; }
  },
  onMerge(b) {
    addScore(mergePoints(b.tier));
    const p = worldToScreen(b.x, 0.4, b.z);
    popup(p.x, p.y, `+${mergePoints(b.tier)}`, TIERS[b.tier].color);
  },
  onClear(x, z, tier) {
    addScore(CLEAR_BONUS);
    burst(x, z, TIERS[tier].color);
    const p = worldToScreen(x, 0.4, z);
    popup(p.x, p.y, `CLEAR +${CLEAR_BONUS}`, '#ffd54a', true);
    flash();
  },
});

function disposePuck(mesh) {
  // Geometry/textures are cached & shared, so only free the per-instance materials.
  for (const mat of mesh.material) mat.dispose?.();
}

// ---------------------------------------------------------------------------
// Aim guide + launcher preview
// ---------------------------------------------------------------------------
const aimDots = [];
for (let i = 0; i < 9; i++) {
  const dot = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 12, 12),
    new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5 }),
  );
  dot.visible = false;
  scene.add(dot);
  aimDots.push(dot);
}

let preview = null;
function buildPreview() {
  if (preview) { scene.remove(preview); disposePuck(preview); }
  preview = makePuck(currentTier);
  preview.position.set(0, PUCK_H / 2, ALLEY.launchZ);
  scene.add(preview);
}

// ---------------------------------------------------------------------------
// Effects: clear burst + screen flash
// ---------------------------------------------------------------------------
const effects = [];
function burst(x, z, color) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.3, 0.55, 40),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(x, 0.1, z);
  scene.add(ring);
  effects.push({ mesh: ring, t: 0, life: 0.6, type: 'ring' });

  for (let i = 0; i < 10; i++) {
    const s = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 10, 10),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 }),
    );
    s.position.set(x, 0.3, z);
    const a = (i / 10) * Math.PI * 2;
    scene.add(s);
    effects.push({
      mesh: s, t: 0, life: 0.7, type: 'spark',
      vx: Math.cos(a) * (4 + Math.random() * 3),
      vy: 4 + Math.random() * 3,
      vz: Math.sin(a) * (4 + Math.random() * 3),
    });
  }
}
function updateEffects(dt) {
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i];
    e.t += dt;
    const k = e.t / e.life;
    if (k >= 1) {
      scene.remove(e.mesh);
      e.mesh.geometry.dispose(); e.mesh.material.dispose();
      effects.splice(i, 1);
      continue;
    }
    if (e.type === 'ring') {
      e.mesh.scale.setScalar(1 + k * 5);
      e.mesh.material.opacity = 0.9 * (1 - k);
    } else {
      e.vy -= 14 * dt;
      e.mesh.position.x += e.vx * dt;
      e.mesh.position.y = Math.max(0.1, e.mesh.position.y + e.vy * dt);
      e.mesh.position.z += e.vz * dt;
      e.mesh.material.opacity = 1 - k;
    }
  }
}

const flashEl = document.createElement('div');
Object.assign(flashEl.style, {
  position: 'fixed', inset: '0', background: '#ffd54a', opacity: '0',
  pointerEvents: 'none', transition: 'opacity .35s', zIndex: '5', mixBlendMode: 'screen',
});
document.body.appendChild(flashEl);
function flash() {
  flashEl.style.opacity = '0.28';
  setTimeout(() => { flashEl.style.opacity = '0'; }, 60);
}

// ---------------------------------------------------------------------------
// HUD helpers
// ---------------------------------------------------------------------------
const scoreEl = document.querySelector('#score .big');
const bestEl = document.getElementById('best');
const nextDot = document.getElementById('nextDot');
const hintEl = document.getElementById('hint');

let score = 0;
let best = Number(localStorage.getItem('mergebowl.best') || 0);
bestEl.textContent = `Best ${best}`;

function addScore(n) {
  score += n;
  scoreEl.textContent = score;
  scoreEl.animate(
    [{ transform: 'scale(1.18)' }, { transform: 'scale(1)' }],
    { duration: 180, easing: 'ease-out' },
  );
}

function updateNext() {
  nextDot.textContent = nextTier + 1;
  nextDot.style.background = TIERS[nextTier].color;
}

function worldToScreen(x, y, z) {
  const v = new THREE.Vector3(x, y, z).project(camera);
  return {
    x: (v.x * 0.5 + 0.5) * window.innerWidth,
    y: (-v.y * 0.5 + 0.5) * window.innerHeight,
  };
}

function popup(sx, sy, text, color, big = false) {
  const el = document.createElement('div');
  el.textContent = text;
  Object.assign(el.style, {
    position: 'fixed', left: `${sx}px`, top: `${sy}px`,
    transform: 'translate(-50%,-50%)', color, fontWeight: '800',
    fontSize: big ? '26px' : '18px', textShadow: '0 2px 8px rgba(0,0,0,.6)',
    pointerEvents: 'none', zIndex: '6', transition: 'transform .7s ease-out, opacity .7s',
  });
  document.body.appendChild(el);
  requestAnimationFrame(() => {
    el.style.transform = 'translate(-50%,-180%)';
    el.style.opacity = '0';
  });
  setTimeout(() => el.remove(), 720);
}

// ---------------------------------------------------------------------------
// Game state
// ---------------------------------------------------------------------------
const State = { START: 0, PLAY: 1, OVER: 2 };
let state = State.START;
let currentTier = randSpawn();
let nextTier = randSpawn();
let launchCooldown = 0;

function randSpawn() {
  return SPAWN_TIERS[(Math.random() * SPAWN_TIERS.length) | 0];
}

function startGame() {
  world.clear();
  score = 0; scoreEl.textContent = '0';
  currentTier = randSpawn();
  nextTier = randSpawn();
  launchCooldown = 0;
  updateNext();
  buildPreview();
  state = State.PLAY;
  document.getElementById('startOverlay').classList.add('hidden');
  document.getElementById('overOverlay').classList.add('hidden');
  hintEl.style.opacity = '0.75';
}

function gameOver() {
  state = State.OVER;
  if (preview) { scene.remove(preview); disposePuck(preview); preview = null; }
  aimDots.forEach((d) => (d.visible = false));
  if (score > best) {
    best = score;
    localStorage.setItem('mergebowl.best', String(best));
  }
  bestEl.textContent = `Best ${best}`;
  document.getElementById('finalScore').textContent = score;
  document.getElementById('overBest').textContent = `Best ${best}`;
  document.getElementById('overOverlay').classList.remove('hidden');
}

// ---------------------------------------------------------------------------
// Input / aiming
// ---------------------------------------------------------------------------
const raycaster = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const pointer = new THREE.Vector2();
let aim = { vx: 0, vz: -PHYS.launchSpeed };
let hasAim = false;

function pointerToWorld(clientX, clientY) {
  pointer.x = (clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hit = new THREE.Vector3();
  return raycaster.ray.intersectPlane(groundPlane, hit) ? hit : null;
}

function computeAim(target) {
  let dz = ALLEY.launchZ - target.z; // forward distance toward the far end
  if (dz < 0.5) dz = 0.5;
  let spread = target.x / dz;
  spread = Math.max(-PHYS.maxAimSpread, Math.min(PHYS.maxAimSpread, spread));
  const inv = 1 / Math.hypot(1, spread);
  aim.vz = -PHYS.launchSpeed * inv;
  aim.vx = PHYS.launchSpeed * spread * inv;
  hasAim = true;
}

function updateAimDots() {
  const ready = state === State.PLAY && preview && launchCooldown <= 0;
  const nx = aim.vx / PHYS.launchSpeed;
  const nz = aim.vz / PHYS.launchSpeed;
  for (let i = 0; i < aimDots.length; i++) {
    const d = aimDots[i];
    d.visible = ready && hasAim;
    if (!d.visible) continue;
    const dist = 1.2 + i * 1.15;
    d.position.set(nx * dist, 0.28, ALLEY.launchZ + nz * dist);
    d.material.opacity = 0.5 * (1 - i / aimDots.length);
  }
}

function onMove(clientX, clientY) {
  if (state !== State.PLAY) return;
  const t = pointerToWorld(clientX, clientY);
  if (t) computeAim(t);
}

// Bowl the current puck along the aim set by the drag. No coordinates here:
// the shot always uses the aim the player last saw, so releasing where you
// aimed never nudges the puck (critical on touch, where the "shoot" tap would
// otherwise land at a different spot than the aim drag).
function launch() {
  if (state !== State.PLAY || !preview || launchCooldown > 0) return;
  world.spawn(currentTier, 0, ALLEY.launchZ, aim.vx, aim.vz);

  scene.remove(preview); disposePuck(preview); preview = null;
  currentTier = nextTier;
  nextTier = randSpawn();
  updateNext();
  launchCooldown = 0.35;
  hintEl.style.opacity = '0';
}

// Aim on drag, shoot on release. Only a drag (pointermove) changes the aim; a
// plain tap bowls along the current aim — the direction the guide arrow is
// already showing. The press itself must NOT re-aim: tapping the puck sits at
// the launcher (dz~0, x~0), which computeAim resolves to dead-straight, so
// aiming on press snapped the arrow forward on every tap. Pointer capture keeps
// move/up flowing even if the finger strays off the canvas mid-drag.
let aiming = false;
renderer.domElement.addEventListener('pointermove', (e) => onMove(e.clientX, e.clientY));
renderer.domElement.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  aiming = true;
  try { renderer.domElement.setPointerCapture(e.pointerId); } catch {}
});
renderer.domElement.addEventListener('pointerup', (e) => {
  e.preventDefault();
  if (!aiming) return;
  aiming = false;
  // Bowl along the aim the last pointermove already set — do NOT re-aim to the
  // release point. On touch the finger rolls a few pixels as it lifts, so the
  // pointerup coords differ slightly from the last drag position; re-aiming
  // here made the guide arrow visibly jump (~5deg) right after release.
  launch();
});
renderer.domElement.addEventListener('pointercancel', () => { aiming = false; });

document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('againBtn').addEventListener('click', startGame);

// Build the legend chips in the start card.
(function buildLegend() {
  const el = document.getElementById('legend');
  for (let i = 0; i < TIERS.length; i++) {
    const b = document.createElement('div');
    b.className = 'b';
    b.textContent = i + 1;
    b.style.background = TIERS[i].color;
    el.appendChild(b);
    if (i < TIERS.length - 1) {
      const arrow = document.createElement('span');
      arrow.textContent = '›';
      arrow.style.opacity = '0.5';
      el.appendChild(arrow);
    }
  }
})();

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------
const clock = new THREE.Clock();
function easeOutBack(t) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const now = performance.now();

  if (state === State.PLAY) {
    if (launchCooldown > 0) {
      launchCooldown -= dt;
      if (launchCooldown <= 0 && !preview) buildPreview();
    }
    world.step(dt);

    // Sync meshes + pop-in animation.
    for (const b of world.bodies) {
      if (!b.mesh) continue;
      b.mesh.position.set(b.x, PUCK_H / 2, b.z);
      const age = (now - b.born) / 220;
      b.mesh.scale.setScalar(age < 1 ? Math.max(0.2, easeOutBack(age)) : 1);
    }

    if (world.jammed()) gameOver();
  }

  updateEffects(dt);
  updateAimDots();

  if (preview) {
    preview.position.y = PUCK_H / 2 + Math.sin(now / 300) * 0.06;
    preview.rotation.y += dt * 0.6;
  }

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();
updateNext();
animate();
