// Static game configuration: the object palette (tiers) and alley/physics tuning.
// Kept dependency-free so it can be imported by both the physics sim and the renderer.

// Object palette, lowest -> highest. Merging two of tier N produces tier N+1.
// Radius grows gently with tier so bigger merges feel weightier but still fit the lane.
export const TIERS = [
  { color: '#ff5a5f', r: 0.52 }, // 1
  { color: '#ff9f43', r: 0.60 }, // 2
  { color: '#feca57', r: 0.68 }, // 3
  { color: '#1dd1a1', r: 0.77 }, // 4
  { color: '#54a0ff', r: 0.87 }, // 5
  { color: '#5f4bff', r: 0.98 }, // 6
  { color: '#c56cf0', r: 1.10 }, // 7
];

// Merging two of the top visible tier produces this "clear": it vanishes in a
// burst and awards CLEAR_BONUS instead of leaving a puck behind.
export const CLEAR_TIER = TIERS.length; // one past the last visible tier

// Points awarded when a merge yields tier `t` (0-indexed). Higher merges pay more.
export function mergePoints(newTier) {
  return (newTier + 1) * 10;
}
export const CLEAR_BONUS = 750;

// Which tiers can appear as a fresh puck to bowl (keep it to the low end).
export const SPAWN_TIERS = [0, 0, 0, 1, 1, 2];

// ---- Alley geometry (world units; the lane runs along the Z axis) ----
export const ALLEY = {
  width: 8.4,        // playable width in X  (gutters just outside)
  wallX: 4.2,        // |x| at which pucks bounce
  far: -19,          // Z of the back wall (pucks travel toward negative Z)
  near: 7,           // Z of the launcher / player end
  foul: 3.2,         // if a settled puck's leading edge crosses this Z -> game over
  launchZ: 5.4,      // Z where the current puck waits to be bowled
};

// ---- Physics tuning ----
export const PHYS = {
  launchSpeed: 21,   // units/sec at release
  friction: 1.35,    // exponential velocity damping per second (higher = stops sooner)
  restitution: 0.42, // bounciness of wall/puck collisions
  stopSpeed: 0.22,   // below this speed a puck is considered at rest
  maxAimSpread: 0.55,// max sideways aim as a fraction of forward speed
  substeps: 2,       // physics substeps per frame for stable collisions
};
