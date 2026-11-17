// Vehicles: box-built cars (sedan, taxi, police, truck, sports) with wheels and
// headlights, arcade driving for the player's car (accel / steer / brake /
// handbrake, chase camera handled by main.js), simple waypoint traffic that
// follows the road grid, and enter/exit. Stealing a parked car raises wanted.
import * as THREE from '../vendor/three.module.min.js';
import { CAR, WANTED } from './config.js';

const CAR_COLORS = {
  sedan: [0xc23a3a, 0x3a6ac2, 0x8a8a8a, 0x2a8a5a],
  taxi: [0xf2c200],
  police: [0xe8e8e8],
  truck: [0x7a5a2a, 0x4a6a8a],
  sports: [0xff5a1e, 0xffd23e, 0x18c8e8],
};

export function makeCarMesh(scene, kind, color) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.5 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x1a2430, roughness: 0.15, metalness: 0.6 });
  const len = kind === 'truck' ? 5.6 : kind === 'sports' ? 4.2 : 4.5;
  const wid = kind === 'truck' ? 2.2 : 2.0;
  const body = new THREE.Mesh(new THREE.BoxGeometry(wid, 0.75, len), bodyMat);
  body.position.y = 0.65;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(wid - 0.3, 0.65, kind === 'truck' ? 1.4 : len * 0.5), glassMat);
  cabin.position.set(0, 1.3, kind === 'truck' ? 1.2 : -0.2);
  cabin.castShadow = true;
  group.add(cabin);
  if (kind === 'truck') {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(wid - 0.2, 0.5, 2.4), new THREE.MeshStandardMaterial({ color: 0x5a5a5a }));
    bed.position.set(0, 1.0, -1.4);
    group.add(bed);
  }
  if (kind === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.25, 0.5), new THREE.MeshStandardMaterial({ color: 0xf2c200, emissive: 0xaa8800 }));
    sign.position.set(0, 1.75, -0.2);
    group.add(sign);
  }
  if (kind === 'police') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.4), new THREE.MeshStandardMaterial({ color: 0x2233ff, emissive: 0x2233ff, emissiveIntensity: 0.9 }));
    bar.position.set(0, 1.72, -0.2);
    group.add(bar);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(wid + 0.02, 0.2, len * 0.8), new THREE.MeshStandardMaterial({ color: 0x1a1a2e }));
    stripe.position.y = 0.7;
    group.add(stripe);
  }
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  const wheels = [];
  for (const [wx, wz] of [[-wid / 2, len / 2 - 0.8], [wid / 2, len / 2 - 0.8], [-wid / 2, -len / 2 + 0.8], [wid / 2, -len / 2 + 0.8]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.38, wz);
    group.add(w);
    wheels.push(w);
  }
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const lx of [-0.6, 0.6]) {
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.08), lightMat);
    light.position.set(lx, 0.7, len / 2 + 0.02);
    group.add(light);
  }
  scene.add(group);
  return { mesh: group, wheels, len, wid };
}

export function createCar(g, kind, x, z, yaw, opts) {
  const o = opts || {};
  const color = o.color !== undefined ? o.color : g.random.pick(CAR_COLORS[kind] || CAR_COLORS.sedan);
  const parts = makeCarMesh(g.scene, kind, color);
  const car = {
    kind, parts, x, z, yaw, speed: 0, steer: 0,
    maxSpeed: kind === 'sports' ? CAR.maxSpeed : kind === 'police' ? 36 : kind === 'truck' ? 26 : 30,
    isPlayer: false, isPolice: kind === 'police', parked: !!o.parked,
    traffic: !!o.traffic, route: null, routeIndex: 0, wait: 0,
    health: 100, lightPhase: g.random.range(0, 6),
  };
  parts.mesh.position.set(x, 0, z);
  parts.mesh.rotation.y = yaw;
  g.cars.push(car);
  return car;
}

export function nearestCar(g, x, z, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of g.cars) {
    if (car.isPolice) continue;
    const d = Math.hypot(car.x - x, car.z - z);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

export function enterCar(g, car) {
  if (car.parked) {
    car.parked = false;
    g.addWanted(WANTED.stealStars, 'car theft');
    g.toast('Car taken — the cops noticed!');
    g.audio.crash();
  } else {
    g.toast('You took the car.');
  }
  car.isPlayer = true;
  car.traffic = false;
  g.player.inCar = true;
  g.player.car = car;
  g.player.x = car.x;
  g.player.z = car.z;
}

export function exitCar(g) {
  const car = g.player.car;
  if (!car) return;
  car.isPlayer = false;
  car.speed = 0;
  g.player.inCar = false;
  g.player.car = null;
  const side = 2.4;
  g.player.x = car.x + Math.cos(car.yaw) * side;
  g.player.z = car.z - Math.sin(car.yaw) * side;
  g.city.clampPos(g.player, 0.6);
}

/** Arcade driving for the player's car. Returns speed fraction for engine sound. */
export function stepPlayerCar(g, dt) {
  const car = g.player.car;
  const input = g.input;
  const fwd = input.forward();
  const steerIn = input.strafe();
  const targetSteer = steerIn * CAR.steer;
  car.steer += (targetSteer - car.steer) * Math.min(1, dt * 8);
  if (fwd > 0) car.speed += CAR.accel * dt;
  else if (fwd < 0) {
    if (car.speed > 1) car.speed -= CAR.brake * dt;
    else car.speed -= CAR.reverseAccel * dt;
  } else {
    car.speed -= Math.sign(car.speed) * CAR.drag * 4 * dt;
    if (Math.abs(car.speed) < 0.3) car.speed = 0;
  }
  if (input.handbrake()) car.speed *= Math.max(0, 1 - dt * 3);
  car.speed = Math.max(-CAR.maxReverse, Math.min(car.maxSpeed, car.speed));
  car.yaw += car.steer * (car.speed / car.maxSpeed) * dt * 1.4;
  const dx = Math.sin(car.yaw) * car.speed * dt;
  const dz = Math.cos(car.yaw) * car.speed * dt;
  const nx = car.x + dx;
  const nz = car.z + dz;
  const hit = g.city.collides(nx, nz, 1.4);
  if (hit) {
    if (Math.abs(car.speed) > 12) { g.audio.crash(); g.shake = 0.35; }
    car.speed *= -0.25;
  } else {
    car.x = nx;
    car.z = nz;
  }
  g.city.clampPos(car, 1.4);
  g.player.x = car.x;
  g.player.z = car.z;
  car.parts.mesh.position.set(car.x, 0, car.z);
  car.parts.mesh.rotation.y = car.yaw;
  for (const w of car.parts.wheels) w.rotation.x += car.speed * dt * 2;
  return Math.abs(car.speed) / car.maxSpeed;
}

function pickRoute(g, car) {
  const centers = g.city.centers;
  const pts = [];
  const horizontal = g.random.chance(0.5);
  const line = g.random.pick(centers);
  for (let i = 0; i < 4; i += 1) {
    const along = g.random.range(-180, 180);
    pts.push(horizontal ? { x: along, z: line } : { x: line, z: along });
  }
  car.route = pts;
  car.routeIndex = 0;
}

/** Traffic cars cruise their road routes and stop briefly at random. */
export function stepTraffic(g, dt) {
  for (const car of g.cars) {
    if (!car.traffic) continue;
    if (!car.route) pickRoute(g, car);
    if (car.wait > 0) { car.wait -= dt; continue; }
    const target = car.route[car.routeIndex];
    const dx = target.x - car.x;
    const dz = target.z - car.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 3) {
      car.routeIndex += 1;
      if (car.routeIndex >= car.route.length) {
        car.route = null;
        if (g.random.chance(0.3)) car.wait = g.random.range(1, 3);
      }
      continue;
    }
    const wantYaw = Math.atan2(dx, dz);
    let dy = wantYaw - car.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    car.yaw += Math.max(-1.6 * dt, Math.min(1.6 * dt, dy));
    car.speed += ((Math.abs(dy) > 0.6 ? 4 : 11) - car.speed) * Math.min(1, dt * 2);
    car.x += Math.sin(car.yaw) * car.speed * dt;
    car.z += Math.cos(car.yaw) * car.speed * dt;
    car.parts.mesh.position.set(car.x, 0, car.z);
    car.parts.mesh.rotation.y = car.yaw;
    for (const w of car.parts.wheels) w.rotation.x += car.speed * dt * 2;
  }
}

export function syncCarMeshes(g) {
  for (const car of g.cars) {
    car.parts.mesh.position.set(car.x, 0, car.z);
    car.parts.mesh.rotation.y = car.yaw;
  }
}
