// Solmar Bay — cars. Player driving with arcade physics, traffic that follows
// the road grid, parked cars to steal, and car-to-car bumps.
import { CFG, CAR_COLORS } from './config.js';
import { moveWithCollision, onRoad, randomRoadPoint, blockedAt } from './world.js';
import { keyDown } from './input.js';

export function makeCar(x, y, angle, color, kind) {
  return {
    x, y, angle,
    speed: 0,
    color,
    kind: kind || 'sedan',
    driver: 'none', // 'player' | 'traffic' | 'police' | 'none'
    hp: 100,
    axis: 'h',
    dir: 1,
    lane: 0,
    stuckT: 0,
    damageT: 0,
    playerOwned: false,
    brakeLight: false,
  };
}

export function spawnTraffic(G) {
  const rng = G.rng;
  G.cars = [];
  for (let i = 0; i < CFG.TRAFFIC_COUNT; i++) {
    const pt = randomRoadPoint(G.world, rng);
    const car = makeCar(pt.x, pt.y, pt.axis === 'h' ? (rng.chance(0.5) ? 0 : Math.PI) : (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2), rng.pick(CAR_COLORS), rng.pick(['sedan', 'sedan', 'taxi', 'van', 'sport']));
    car.driver = 'traffic';
    car.axis = pt.axis;
    car.dir = car.angle === 0 || car.angle === Math.PI / 2 ? 1 : -1;
    car.lane = rng.chance(0.5) ? 16 : -16;
    car.speed = rng.range(90, 170);
    G.cars.push(car);
  }
  for (let i = 0; i < CFG.PARKED_COUNT; i++) {
    const pt = randomRoadPoint(G.world, rng);
    // Park tight to the edge of the road, facing along it, so traffic
    // does not sit on the bumper all day.
    const along = pt.axis === 'h' ? 0 : Math.PI / 2;
    const side = rng.chance(0.5) ? 1 : -1;
    const off = 34;
    const car = makeCar(
      pt.axis === 'h' ? pt.x : pt.x + side * off,
      pt.axis === 'h' ? pt.y + side * off : pt.y,
      along + (rng.chance(0.5) ? 0 : Math.PI),
      rng.pick(CAR_COLORS),
      rng.pick(['sedan', 'sport', 'van']),
    );
    car.driver = 'none';
    G.cars.push(car);
  }
}

// The closest drivable car the player could climb into. Wrecks are skipped.
export function nearestCar(G, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of G.cars) {
    if (car.driver === 'police' || car.hp <= 0) continue;
    const d = Math.hypot(car.x - G.player.x, car.y - G.player.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

// Steal a car: the player climbs in, the old driver (if any) is out on the street.
// Returns true when the car was taken from someone else (a crime); re-entering
// a car the player already owns is not a new crime.
export function enterCar(G, car) {
  const p = G.player;
  const wasOwned = !!car.playerOwned;
  if (car.driver === 'traffic') {
    // The driver bails out and runs.
    G.peds.push({
      x: car.x + 30, y: car.y + 30, angle: 0, speed: 0,
      state: 'flee', hp: CFG.PED_HP, color: '#e8b040', tx: 0, ty: 0, retarget: 0,
    });
    G.stats.carsStolen += 1;
  }
  car.driver = 'player';
  car.playerOwned = true;
  p.car = car;
  p.onFoot = false;
  p.x = car.x;
  p.y = car.y;
  return !wasOwned;
}

function drivePlayerCar(G, car, dt) {
  const input = G.input;
  const accel = keyDown(input, 'KeyW') || keyDown(input, 'ArrowUp');
  const reverse = keyDown(input, 'KeyS') || keyDown(input, 'ArrowDown');
  const left = keyDown(input, 'KeyA') || keyDown(input, 'ArrowLeft');
  const right = keyDown(input, 'KeyD') || keyDown(input, 'ArrowRight');
  if (accel) car.speed += CFG.CAR_ACCEL * dt;
  if (reverse) {
    if (car.speed > 20) car.speed -= CFG.CAR_BRAKE * dt;
    else car.speed -= CFG.CAR_ACCEL * 0.55 * dt;
  }
  if (!accel && !reverse) {
    car.speed -= car.speed * CFG.CAR_DRAG * dt;
    if (Math.abs(car.speed) < 4) car.speed = 0;
  }
  if (car.speed > CFG.CAR_MAX_SPEED) car.speed = CFG.CAR_MAX_SPEED;
  if (car.speed < -CFG.CAR_REVERSE_MAX) car.speed = -CFG.CAR_REVERSE_MAX;
  const steer = (left ? -1 : 0) + (right ? 1 : 0);
  if (steer !== 0 && Math.abs(car.speed) > 12) {
    car.angle += steer * CFG.CAR_TURN * dt * Math.sign(car.speed) * Math.min(1, Math.abs(car.speed) / 180);
  }
  car.brakeLight = reverse || (accel === false && car.speed > 60);
  const dx = Math.cos(car.angle) * car.speed * dt;
  const dy = Math.sin(car.angle) * car.speed * dt;
  const before = { x: car.x, y: car.y };
  moveWithCollision(G.world, car, dx, dy, 20);
  if (Math.hypot(car.x - before.x, car.y - before.y) < Math.hypot(dx, dy) * 0.4 && Math.abs(car.speed) > 120) {
    car.speed *= 0.45;
    car.hp -= 4;
    if (G.onCrash) G.onCrash(Math.abs(car.speed));
  }
  G.player.x = car.x;
  G.player.y = car.y;
  G.player.angle = car.angle;
}

// One traffic car following its road, turning at intersections sometimes.
function driveTrafficCar(G, car, dt) {
  const rng = G.rng;
  // Slow down for the car ahead.
  let ahead = 1e9;
  for (const other of G.cars) {
    if (other === car) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const along = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
    const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
    if (along > 0 && along < 90 && side < 26) ahead = Math.min(ahead, along);
  }
  const target = ahead < 70 ? 0 : 150;
  car.speed += (target - car.speed) * Math.min(1, dt * 1.6);
  if (car.speed < 0) car.speed = 0;
  // At a crossing, sometimes turn onto the other road.
  const nearCross = G.world.roadsH.some((y) => Math.abs(car.y - y) < 24) &&
    G.world.roadsV.some((x) => Math.abs(car.x - x) < 24);
  if (nearCross && rng.chance(dt * 0.35)) {
    if (car.axis === 'h') {
      car.axis = 'v';
      car.angle = rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2;
    } else {
      car.axis = 'h';
      car.angle = rng.chance(0.5) ? 0 : Math.PI;
    }
  }
  // Keep the car glued to its lane on its road.
  const step = car.speed * dt;
  let nx = car.x + Math.cos(car.angle) * step;
  let ny = car.y + Math.sin(car.angle) * step;
  if (car.axis === 'h') {
    const roadY = nearestRoadLine(G.world.roadsH, car.y);
    ny += (roadY + car.lane - car.y) * Math.min(1, dt * 3);
  } else {
    const roadX = nearestRoadLine(G.world.roadsV, car.x);
    nx += (roadX + car.lane - car.x) * Math.min(1, dt * 3);
  }
  // Wrap around the map edges instead of driving into the sea or off the map.
  if (nx < 60 || nx > CFG.BEACH_X - 60 || ny < 60 || ny > CFG.WORLD_H - 60) {
    const pt = randomRoadPoint(G.world, rng);
    car.x = pt.x;
    car.y = pt.y;
    car.axis = pt.axis;
    car.angle = pt.axis === 'h' ? 0 : Math.PI / 2;
    car.speed = 120;
    return;
  }
  car.x = nx;
  car.y = ny;
}

function nearestRoadLine(lines, v) {
  let best = lines[0];
  let bestD = Math.abs(v - lines[0]);
  for (const l of lines) {
    const d = Math.abs(v - l);
    if (d < bestD) {
      bestD = d;
      best = l;
    }
  }
  return best;
}

// Simple circle bump between cars: push apart and trade a little speed.
// Damage only lands on a real impact, and a car cannot be hurt twice within
// half a second — otherwise two cars resting against each other would grind
// each other into wrecks while standing still.
function collideCars(G, dt) {
  const cars = G.cars;
  for (const car of cars) {
    if (car.damageT > 0) car.damageT -= dt;
  }
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i];
      const b = cars[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d > 0 && d < 44) {
        const push = (44 - d) / 2;
        const nx = dx / d;
        const ny = dy / d;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
        const rel = Math.abs(a.speed - b.speed);
        if (rel > 140 && G.onCrash) G.onCrash(rel);
        const tmp = a.speed;
        a.speed = b.speed * 0.6;
        b.speed = tmp * 0.6;
        if (rel > 140) {
          if (a.damageT <= 0) {
            a.hp -= 6;
            a.damageT = 0.5;
          }
          if (b.damageT <= 0) {
            b.hp -= 6;
            b.damageT = 0.5;
          }
        }
      }
    }
  }
}

export function updateVehicles(G, dt) {
  for (const car of G.cars) {
    if (car.driver === 'player') drivePlayerCar(G, car, dt);
    else if (car.driver === 'traffic') driveTrafficCar(G, car, dt);
    // Parked and driverless cars sit still.
    if (car.hp <= 0 && car.driver !== 'player') {
      car.driver = 'none';
      car.speed = 0;
    }
  }
  collideCars(G, dt);
  // A wrecked player car strands the player on foot.
  const p = G.player;
  if (p.car && p.car.hp <= 0) {
    p.car.driver = 'none';
    p.car = null;
    p.onFoot = true;
  }
}

// Cars the player runs over or shoves while driving: pedestrians take a hit.
export function carHitsPeds(G) {
  const p = G.player;
  if (!p.car) return;
  const car = p.car;
  if (Math.abs(car.speed) < 60) return;
  for (const ped of G.peds) {
    if (ped.state === 'dead') continue;
    const d = Math.hypot(ped.x - car.x, ped.y - car.y);
    if (d < 30) {
      ped.hp -= 60;
      ped.state = 'dead';
      ped.deadT = 0;
      G.stats.kills += 1;
      if (G.onCrime) G.onCrime(1);
      if (G.onCrash) G.onCrash(200);
    }
  }
}
