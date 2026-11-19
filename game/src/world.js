// Solara Bay city: a road grid with blocks of buildings, parks, a marina
// district and a beach on the south edge. Builds the static layout once
// from a seed and answers collision / road queries for the rest of the game.
import { WORLD, COLORS, SAFEHOUSE, BANK } from './config.js';
import { makeRng } from './rng.js';

export function roadLines() {
  const lines = [];
  for (let x = WORLD.firstRoad; x < WORLD.size; x += WORLD.roadGap) lines.push(x);
  return lines;
}

// True when the point is on a road (drivable asphalt).
export function isOnRoad(x, y) {
  const half = WORLD.roadWidth / 2;
  for (const c of roadLines()) {
    if (Math.abs(x - c) <= half || Math.abs(y - c) <= half) return true;
  }
  return false;
}

// Nearest point on the road network (used to snap spawns onto roads).
export function nearestRoadPoint(x, y) {
  const lines = roadLines();
  let bx = x, by = y, best = Infinity;
  for (const c of lines) {
    const d = Math.abs(x - c);
    if (d < best) { best = d; bx = c; by = y; }
    const d2 = Math.abs(y - c);
    if (d2 < best) { best = d2; bx = x; by = c; }
  }
  return { x: bx, y: by };
}

export function buildCity(seed) {
  const rng = makeRng(seed);
  const lines = roadLines();
  const buildings = [];
  const trees = [];
  const parks = [];
  const lots = [];

  // Blocks are the squares between roads. Each block gets buildings,
  // a park, or a parking lot.
  for (let i = 0; i < lines.length - 1; i++) {
    for (let j = 0; j < lines.length - 1; j++) {
      const x0 = lines[i] + WORLD.roadWidth / 2 + 8;
      const y0 = lines[j] + WORLD.roadWidth / 2 + 8;
      const x1 = lines[i + 1] - WORLD.roadWidth / 2 - 8;
      const y1 = lines[j + 1] - WORLD.roadWidth / 2 - 8;
      if (y0 > WORLD.beachY) continue; // beach strip, no blocks
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      const downtown = Math.abs(cx - 1600) < 700 && Math.abs(cy - 1600) < 700;
      const roll = rng.next();
      if (roll < 0.16) {
        // Park block: grass with trees.
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        const n = rng.int(4, 7);
        for (let t = 0; t < n; t++) {
          trees.push({ x: rng.range(x0 + 14, x1 - 14), y: rng.range(y0 + 14, y1 - 14), r: rng.range(9, 14) });
        }
        continue;
      }
      if (roll < 0.26) {
        // Parking lot: flat asphalt with painted bays.
        lots.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        continue;
      }
      // Buildings block: 1 big building or 2 smaller ones.
      const tall = downtown && rng.chance(0.6);
      if (rng.chance(0.45)) {
        buildings.push(makeBuilding(rng, x0, y0, x1 - x0, y1 - y0, tall));
      } else {
        const vertical = rng.chance(0.5);
        if (vertical) {
          const mid = (x0 + x1) / 2;
          buildings.push(makeBuilding(rng, x0, y0, mid - x0 - 6, y1 - y0, tall));
          buildings.push(makeBuilding(rng, mid + 6, y0, x1 - mid - 6, y1 - y0, tall));
        } else {
          const mid = (y0 + y1) / 2;
          buildings.push(makeBuilding(rng, x0, y0, x1 - x0, mid - y0 - 6, tall));
          buildings.push(makeBuilding(rng, x0, mid + 6, x1 - x0, y1 - mid - 6, tall));
        }
      }
    }
  }

  // Landmark buildings: the safehouse (a green cottage) and the bank.
  const safehouse = { x: SAFEHOUSE.x - 46, y: SAFEHOUSE.y - 34, w: 92, h: 68, color: COLORS.safehouse, landmark: 'safehouse', tall: false };
  const bank = { x: BANK.x - 60, y: BANK.y - 44, w: 120, h: 88, color: COLORS.bank, landmark: 'bank', tall: true };
  buildings.push(safehouse, bank);

  return { lines, buildings, trees, parks, lots, safehouse, bank };
}

function makeBuilding(rng, x, y, w, h, tall) {
  const inset = rng.range(6, 18);
  return {
    x: x + inset, y: y + inset,
    w: Math.max(40, w - inset * 2), h: Math.max(40, h - inset * 2),
    color: rng.pick(COLORS.buildingRoof),
    tall: !!tall,
    landmark: null,
  };
}

// Circle-vs-building collision. Returns the building hit, or null.
export function hitBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  return null;
}

// Push a circle out of buildings and the water. Mutates the given point.
export function resolveCollision(city, p, r) {
  for (const b of city.buildings) {
    const nx = Math.max(b.x, Math.min(p.x, b.x + b.w));
    const ny = Math.max(b.y, Math.min(p.y, b.y + b.h));
    const dx = p.x - nx, dy = p.y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r && d2 > 0.0001) {
      const d = Math.sqrt(d2);
      p.x = nx + (dx / d) * r;
      p.y = ny + (dy / d) * r;
    } else if (d2 <= 0.0001) {
      // Center inside the rect: push out along the smallest overlap.
      const left = p.x - b.x, right = b.x + b.w - p.x;
      const top = p.y - b.y, bottom = b.y + b.h - p.y;
      const m = Math.min(left, right, top, bottom);
      if (m === left) p.x = b.x - r;
      else if (m === right) p.x = b.x + b.w + r;
      else if (m === top) p.y = b.y - r;
      else p.y = b.y + b.h + r;
    }
  }
  // Water blocks movement; sand is walkable.
  if (p.y > WORLD.waterY - r) p.y = WORLD.waterY - r;
  p.x = Math.max(r, Math.min(WORLD.size - r, p.x));
  p.y = Math.max(r, Math.min(WORLD.size - r, p.y));
  return p;
}

// A random point on a road, at least `minDist` away from (ax, ay).
export function randomRoadPoint(rng, ax, ay, minDist) {
  const lines = roadLines();
  for (let tries = 0; tries < 40; tries++) {
    const vertical = rng.chance(0.5);
    const line = rng.pick(lines);
    const along = rng.range(100, WORLD.size - 100);
    const x = vertical ? line : along;
    const y = vertical ? along : line;
    if (Math.hypot(x - ax, y - ay) >= minDist) return { x, y, vertical };
  }
  return { x: lines[4], y: lines[4], vertical: true };
}
