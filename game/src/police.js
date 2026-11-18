// Solmar Bay — the wanted level and the police who answer it. Stars rise when
// the player commits crimes in public; patrol cars and officers on foot chase
// the player down, and getting caught ends the run.
import { CFG } from './config.js';
import { makeCar } from './vehicles.js';
import { moveWithCollision } from './world.js';
import { hurtPlayer } from './player.js';

export function createPolice() {
  return { cars: [], peds: [], bustedT: 0, decayT: 0 };
}

export function addWanted(G, amount) {
  if (G.wanted >= CFG.WANTED_MAX) return;
  G.wanted = Math.min(CFG.WANTED_MAX, G.wanted + amount);
  G.crimeT = 0;
  G.police.decayT = 0;
  if (G.wanted >= 3) showMessage(G, 'The whole bay is looking for you now.');
  else if (G.wanted === 2) showMessage(G, 'Patrol cars are on their way.');
  else showMessage(G, 'Someone called the police.');
}

export function showMessage(G, text) {
  G.message = text;
  G.messageT = 4;
}

function spawnPoliceCar(G) {
  const rng = G.rng;
  const a = rng.range(0, Math.PI * 2);
  let x = G.player.x + Math.cos(a) * 620;
  let y = G.player.y + Math.sin(a) * 620;
  x = Math.max(120, Math.min(CFG.BEACH_X - 140, x));
  y = Math.max(120, Math.min(CFG.WORLD_H - 120, y));
  const car = makeCar(x, y, Math.atan2(G.player.y - y, G.player.x - x), '#20242e', 'police');
  car.driver = 'police';
  car.speed = 260;
  G.police.cars.push(car);
  G.cars.push(car);
}

function spawnPolicePed(G) {
  const rng = G.rng;
  const a = rng.range(0, Math.PI * 2);
  const x = G.player.x + Math.cos(a) * 320;
  const y = G.player.y + Math.sin(a) * 320;
  G.police.peds.push({
    x: Math.max(60, Math.min(CFG.BEACH_X - 60, x)),
    y: Math.max(60, Math.min(CFG.WORLD_H - 60, y)),
    angle: 0, speed: 0, state: 'chase', hp: 80, color: '#20242e',
    tx: 0, ty: 0, retarget: 0, deadT: 0,
  });
}

function updatePoliceCar(G, car, dt) {
  const p = G.player;
  const dx = p.x - car.x;
  const dy = p.y - car.y;
  const dist = Math.hypot(dx, dy);
  const want = Math.atan2(dy, dx);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  // If the car is wedged against a building, swing around until it is free.
  if (car.stuckT > 0.35) {
    car.angle += 2.4 * dt;
    car.speed = 180;
  } else {
    car.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
    const target = dist > 320 ? CFG.POLICE_CAR_SPEED : CFG.POLICE_CAR_SPEED * 0.75;
    car.speed += (target - car.speed) * Math.min(1, dt * 1.2);
  }
  const step = car.speed * dt;
  const before = { x: car.x, y: car.y };
  moveWithCollision(G.world, car, Math.cos(car.angle) * step, Math.sin(car.angle) * step, 20);
  const moved = Math.hypot(car.x - before.x, car.y - before.y);
  car.stuckT = moved < step * 0.35 && step > 1 ? car.stuckT + dt : 0;
  car.x = Math.max(40, Math.min(CFG.BEACH_X - 40, car.x));
  car.y = Math.max(40, Math.min(CFG.WORLD_H - 40, car.y));
  // Ramming the player's car slows it and hurts it.
  if (p.car && dist < 52) {
    p.car.speed *= 0.92;
    p.car.hp -= 6 * dt;
    if (G.onCrash) G.onCrash(120);
  }
  // Running the player down on foot.
  if (p.onFoot && dist < 30) {
    hurtPlayer(G, 26 * dt);
  }
}

export function updatePolice(G, dt) {
  const police = G.police;
  const wantCars = G.wanted >= 1 ? Math.min(G.wanted, 4) : 0;
  const wantPeds = G.wanted >= 2 ? Math.min(G.wanted - 1, 3) : 0;
  while (police.cars.length < wantCars) spawnPoliceCar(G);
  while (police.peds.length < wantPeds) spawnPolicePed(G);
  // Extra units leave when the heat dies down.
  while (police.cars.length > wantCars) {
    const car = police.cars.pop();
    const i = G.cars.indexOf(car);
    if (i >= 0) G.cars.splice(i, 1);
  }
  while (police.peds.length > wantPeds) police.peds.pop();

  for (const car of police.cars) updatePoliceCar(G, car, dt);

  const p = G.player;
  for (const off of police.peds) {
    const d = Math.hypot(p.x - off.x, p.y - off.y);
    const a = Math.atan2(p.y - off.y, p.x - off.x);
    off.angle = a;
    const speed = p.onFoot ? 235 : 150;
    off.x += Math.cos(a) * speed * dt;
    off.y += Math.sin(a) * speed * dt;
    if (d < 30 && p.onFoot) {
      police.bustedT += dt;
      if (police.bustedT >= CFG.BUSTED_TIME) {
        G.state = 'over';
        G.overReason = 'busted';
      }
    }
  }
  // Busted on foot needs a clear run of contact; stepping away resets it.
  const nearest = police.peds.reduce((m, o) => Math.min(m, Math.hypot(p.x - o.x, p.y - o.y)), 1e9);
  if (nearest > 46 || !p.onFoot) police.bustedT = Math.max(0, police.bustedT - dt * 2);

  // Caught in the car: boxed in and barely moving while a patrol car sits on you.
  if (p.car && Math.abs(p.car.speed) < 25 && police.cars.length > 0) {
    const close = police.cars.some((c) => Math.hypot(c.x - p.x, c.y - p.y) < 70);
    if (close) {
      police.bustedT += dt;
      if (police.bustedT >= CFG.BUSTED_TIME + 0.8) {
        G.state = 'over';
        G.overReason = 'busted';
      }
    }
  }

  // Wanted decays after a quiet spell; hotter levels take longer to cool.
  if (G.wanted > 0) {
    G.crimeT += dt;
    const quiet = CFG.WANTED_DECAY_BASE + G.wanted * 9;
    if (G.crimeT > quiet) {
      G.wanted -= 1;
      G.crimeT = 0;
      if (G.wanted === 0) showMessage(G, 'You lost them. The bay is quiet again.');
    }
  }
}
