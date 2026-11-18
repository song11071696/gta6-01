// Solmar Bay — pedestrians. They stroll the sidewalks, scatter when a gun goes
// off or a car bears down on them, and remember what they saw.
import { CFG } from './config.js';
import { moveWithCollision, roadDistance } from './world.js';

const SHIRTS = ['#e8e8e8', '#d84040', '#3a6fd8', '#e8c832', '#3fae6a', '#e87a20', '#8a4fd8', '#c8a080'];

export function spawnPeds(G) {
  const rng = G.rng;
  G.peds = [];
  for (let i = 0; i < CFG.PED_COUNT; i++) {
    const x = rng.range(140, CFG.BEACH_X - 140);
    const y = rng.range(140, CFG.WORLD_H - 140);
    G.peds.push({
      x, y,
      angle: rng.range(0, Math.PI * 2),
      speed: 0,
      state: 'walk',
      hp: CFG.PED_HP,
      color: rng.pick(SHIRTS),
      tx: x, ty: y,
      retarget: 0,
      deadT: 0,
    });
  }
}

// Pick a fresh strolling target a short walk away, preferably on a sidewalk.
function pickTarget(G, ped) {
  const rng = G.rng;
  for (let tries = 0; tries < 6; tries++) {
    const tx = ped.x + rng.range(-260, 260);
    const ty = ped.y + rng.range(-260, 260);
    if (tx < 60 || ty < 60 || tx > CFG.BEACH_X - 40 || ty > CFG.WORLD_H - 60) continue;
    if (roadDistance(G.world, tx, ty) < 90) {
      ped.tx = tx;
      ped.ty = ty;
      return;
    }
  }
  ped.tx = ped.x + rng.range(-120, 120);
  ped.ty = ped.y + rng.range(-120, 120);
}

export function updatePeds(G, dt) {
  const p = G.player;
  for (const ped of G.peds) {
    if (ped.state === 'dead') {
      ped.deadT += dt;
      continue;
    }
    const dPlayer = Math.hypot(ped.x - p.x, ped.y - p.y);
    // A nearby gunshot or a speeding car sends everyone running.
    if (G.alarmT > 0 && dPlayer < 420) ped.state = 'flee';
    if (p.car && Math.abs(p.car.speed) > 200 && dPlayer < 120) ped.state = 'flee';
    if (ped.state === 'flee') {
      const away = Math.atan2(ped.y - p.y, ped.x - p.x);
      ped.angle = away;
      const speed = 265;
      moveWithCollision(G.world, ped, Math.cos(away) * speed * dt, Math.sin(away) * speed * dt, 11);
      if (dPlayer > 520) ped.state = 'walk';
      continue;
    }
    // Strolling: walk to the target, then pick another.
    ped.retarget -= dt;
    const d = Math.hypot(ped.tx - ped.x, ped.ty - ped.y);
    if (d < 14 || ped.retarget <= 0) {
      pickTarget(G, ped);
      ped.retarget = G.rng.range(4, 9);
    }
    const a = Math.atan2(ped.ty - ped.y, ped.tx - ped.x);
    ped.angle = a;
    const speed = 62;
    moveWithCollision(G.world, ped, Math.cos(a) * speed * dt, Math.sin(a) * speed * dt, 11);
  }
  // The dead fade out after a while so the streets do not fill with bodies.
  G.peds = G.peds.filter((ped) => ped.state !== 'dead' || ped.deadT < 25);
  // Keep the crowd topped up near the player.
  if (G.peds.length < CFG.PED_COUNT && G.rng.chance(dt * 0.5)) {
    const a = G.rng.range(0, Math.PI * 2);
    const x = p.x + Math.cos(a) * 700;
    const y = p.y + Math.sin(a) * 700;
    if (x > 80 && y > 80 && x < CFG.BEACH_X - 60 && y < CFG.WORLD_H - 80) {
      G.peds.push({
        x, y, angle: a, speed: 0, state: 'walk', hp: CFG.PED_HP,
        color: G.rng.pick(SHIRTS), tx: x, ty: y, retarget: 0, deadT: 0,
      });
    }
  }
}

// The nearest living pedestrian within range, for melee and targeting.
export function nearestPed(G, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const ped of G.peds) {
    if (ped.state === 'dead') continue;
    const d = Math.hypot(ped.x - G.player.x, ped.y - G.player.y);
    if (d < bestD) {
      bestD = d;
      best = ped;
    }
  }
  return best;
}
