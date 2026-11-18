// Solmar Bay — combat. A pistol aimed with the mouse, fists up close, bullets
// that fly, hit and raise the heat, and the mess they leave behind.
import { CFG } from './config.js';
import { addWanted } from './police.js';
import { nearestPed } from './peds.js';

export function tryShoot(G) {
  const p = G.player;
  if (!p.onFoot || !p.alive || p.fireTimer > 0) return;
  if (!G.input.mouseDown) return;
  p.fireTimer = CFG.FIRE_DELAY;
  const a = Math.atan2(G.input.worldY - p.y, G.input.worldX - p.x);
  p.angle = a;
  G.bullets.push({
    x: p.x + Math.cos(a) * 20,
    y: p.y + Math.sin(a) * 20,
    vx: Math.cos(a) * CFG.BULLET_SPEED,
    vy: Math.sin(a) * CFG.BULLET_SPEED,
    life: CFG.BULLET_RANGE / CFG.BULLET_SPEED,
  });
  G.audio && G.playGunshot && G.playGunshot();
  G.alarmT = 1.2;
  spawnPuff(G, p.x + Math.cos(a) * 26, p.y + Math.sin(a) * 26, '#ffd76a', 4);
}

export function tryMelee(G) {
  const p = G.player;
  if (!p.onFoot || !p.alive) return;
  const ped = nearestPed(G, CFG.MELEE_RANGE);
  if (!ped) return;
  ped.hp -= CFG.MELEE_DAMAGE;
  ped.state = 'flee';
  const a = Math.atan2(ped.y - p.y, ped.x - p.x);
  ped.x += Math.cos(a) * 26;
  ped.y += Math.sin(a) * 26;
  G.audio && G.playPunch && G.playPunch();
  if (ped.hp <= 0) {
    ped.state = 'dead';
    ped.deadT = 0;
    G.stats.kills += 1;
    addWanted(G, 1);
  } else {
    addWanted(G, 1);
  }
  G.alarmT = 1.2;
}

export function updateBullets(G, dt) {
  for (const b of G.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    // A bullet dies on a wall.
    if (b.life > 0) {
      for (const bd of G.world.buildings) {
        if (b.x > bd.x && b.x < bd.x + bd.w && b.y > bd.y && b.y < bd.y + bd.h) {
          b.life = 0;
          spawnPuff(G, b.x, b.y, '#c8c8c8', 5);
          break;
        }
      }
    }
    if (b.life <= 0) continue;
    // Pedestrians on the street.
    for (const ped of G.peds) {
      if (ped.state === 'dead') continue;
      if (Math.hypot(ped.x - b.x, ped.y - b.y) < 14) {
        ped.hp -= 34;
        b.life = 0;
        spawnPuff(G, b.x, b.y, '#c04040', 7);
        if (ped.hp <= 0) {
          ped.state = 'dead';
          ped.deadT = 0;
          G.stats.kills += 1;
          addWanted(G, 1);
        } else {
          ped.state = 'flee';
          addWanted(G, 1);
        }
        break;
      }
    }
    if (b.life <= 0) continue;
    // Police officers on foot.
    for (const off of G.police.peds) {
      if (Math.hypot(off.x - b.x, off.y - b.y) < 14) {
        b.life = 0;
        spawnPuff(G, b.x, b.y, '#c04040', 7);
        addWanted(G, 1);
        off.x += b.vx * 0.01;
        off.y += b.vy * 0.01;
        break;
      }
    }
    if (b.life <= 0) continue;
    // Cars: dents, and a wrecked car stops.
    for (const car of G.cars) {
      if (car.driver === 'player') continue;
      if (Math.hypot(car.x - b.x, car.y - b.y) < 24) {
        car.hp -= 18;
        b.life = 0;
        spawnPuff(G, b.x, b.y, '#888888', 6);
        if (car.hp <= 0 && car.driver === 'traffic') {
          car.driver = 'none';
          car.speed = 0;
        }
        break;
      }
    }
  }
  G.bullets = G.bullets.filter((b) => b.life > 0);
}

export function spawnPuff(G, x, y, color, n) {
  for (let i = 0; i < n; i++) {
    const a = G.rng.range(0, Math.PI * 2);
    const s = G.rng.range(30, 130);
    G.parts.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: G.rng.range(0.25, 0.6),
      max: 0.6,
      color,
      size: G.rng.range(2, 5),
    });
  }
}

export function updateParticles(G, dt) {
  for (const pt of G.parts) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 0.92;
    pt.vy *= 0.92;
    pt.life -= dt;
  }
  G.parts = G.parts.filter((pt) => pt.life > 0);
}
