// Solmar Bay — the city itself. A seeded road grid with blocks of buildings,
// two parks, a beach and open water on the east edge. Everything the game
// collides with, drives on or draws comes from this one build.
import { CFG, ROOF_COLORS } from './config.js';
import { makeRng } from './random.js';

export function buildWorld(seed) {
  const rng = makeRng(seed);
  const roadsH = [];
  const roadsV = [];
  for (let y = 200; y < CFG.WORLD_H; y += CFG.ROAD_GAP) roadsH.push(y);
  for (let x = 200; x < CFG.BEACH_X; x += CFG.ROAD_GAP) roadsV.push(x);

  // Two park blocks, picked from the interior grid so they never sit on the beach.
  const parkBlocks = [];
  while (parkBlocks.length < 2) {
    const bx = rng.int(1, 6);
    const by = rng.int(1, 4);
    if (!parkBlocks.some((p) => p.bx === bx && p.by === by)) parkBlocks.push({ bx, by });
  }

  const buildings = [];
  const parks = [];
  const half = CFG.ROAD_W / 2;
  for (let by = 0; by < roadsH.length - 1; by++) {
    for (let bx = 0; bx < roadsV.length - 1; bx++) {
      const x0 = roadsV[bx] + half + 18;
      const y0 = roadsH[by] + half + 18;
      const x1 = roadsV[bx + 1] - half - 18;
      const y1 = roadsH[by + 1] - half - 18;
      if (parkBlocks.some((p) => p.bx === bx && p.by === by)) {
        const trees = [];
        for (let i = 0; i < 14; i++) {
          trees.push({ x: rng.range(x0 + 14, x1 - 14), y: rng.range(y0 + 14, y1 - 14), r: rng.range(7, 13) });
        }
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, trees });
        continue;
      }
      // One or two buildings per block, with a gap between them.
      const split = rng.chance(0.55);
      const bw = split ? (x1 - x0) / 2 - 14 : x1 - x0;
      const bh = rng.range((y1 - y0) * 0.45, (y1 - y0) * 0.8);
      const count = split ? 2 : 1;
      for (let i = 0; i < count; i++) {
        const bx0 = x0 + i * (bw + 28);
        const by0 = y0 + rng.range(0, (y1 - y0) - bh);
        buildings.push({
          x: bx0, y: by0, w: bw, h: bh,
          roof: rng.pick(ROOF_COLORS),
          shade: rng.range(0.82, 1),
        });
      }
    }
  }

  return {
    seed, roadsH, roadsV, buildings, parks,
    w: CFG.WORLD_W, h: CFG.WORLD_H,
    spawn: { x: 600, y: 600 },
    harbor: { x: 600, y: 2600 },
    bank: { x: 2200, y: 1000 },
    safehouse: { x: 1000, y: 600 },
    beachfront: { x: 3250, y: 1400 },
  };
}

// True when the point sits on a road surface (used for traffic and spawning).
export function onRoad(world, x, y) {
  const half = CFG.ROAD_W / 2;
  for (const ry of world.roadsH) if (Math.abs(y - ry) < half) return true;
  for (const rx of world.roadsV) if (Math.abs(x - rx) < half) return true;
  return false;
}

// True when the point is inside a building, in the water, or outside the map.
export function blockedAt(world, x, y, r) {
  if (x < 12 + r || y < 12 + r || x > world.w - 12 - r || y > world.h - 12 - r) return true;
  if (x > CFG.WATER_X - r) return true;
  for (const b of world.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
  }
  return false;
}

// Slide-friendly move: try the full step, then each axis on its own.
export function moveWithCollision(world, pos, dx, dy, r) {
  if (!blockedAt(world, pos.x + dx, pos.y + dy, r)) {
    pos.x += dx;
    pos.y += dy;
    return;
  }
  if (!blockedAt(world, pos.x + dx, pos.y, r)) pos.x += dx;
  else if (!blockedAt(world, pos.x, pos.y + dy, r)) pos.y += dy;
}

// A random point on a road, for spawning traffic and police.
export function randomRoadPoint(world, rng) {
  if (rng.chance(0.5)) {
    const y = rng.pick(world.roadsH);
    return { x: rng.range(120, CFG.BEACH_X - 120), y: y + rng.range(-18, 18), axis: 'h' };
  }
  const x = rng.pick(world.roadsV);
  return { x: x + rng.range(-18, 18), y: rng.range(120, CFG.WORLD_H - 120), axis: 'v' };
}

// Distance from a point to the nearest road centre line.
export function roadDistance(world, x, y) {
  let best = 1e9;
  for (const ry of world.roadsH) best = Math.min(best, Math.abs(y - ry));
  for (const rx of world.roadsV) best = Math.min(best, Math.abs(x - rx));
  return best;
}
