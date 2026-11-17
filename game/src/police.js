// The wanted system and the Solmar Bay Police Department. Stars 0–5 rise on
// crimes (car theft, hitting pedestrians, shooting) and decay while the player
// stays hidden. Police cruisers spawn at the edge of the player's view and ram
// the player's car; foot cops chase on foot and punch. Caught on foot at low
// speed = busted; health at zero = wasted.
import * as THREE from '../vendor/three.module.min.js';
import { WANTED } from './config.js';
import { createCar } from './vehicles.js';
import { damagePlayer } from './player.js';

export function addWanted(g, stars, why) {
  g.wanted = Math.min(WANTED.maxStars, g.wanted + stars);
  g.hiddenTimer = 0;
  g.lastCrime = why || '';
  if (g.wanted >= 1) g.hudFlashStars = 1;
}

export function spawnPoliceCar(g) {
  const a = g.random.range(0, Math.PI * 2);
  const x = g.player.x + Math.cos(a) * 70;
  const z = g.player.z + Math.sin(a) * 70;
  const car = createCar(g, 'police', x, z, 0, {});
  car.isPolice = true;
  car.traffic = false;
  g.policeCars.push(car);
  return car;
}

export function spawnFootCop(g) {
  const a = g.random.range(0, Math.PI * 2);
  const x = g.player.x + Math.cos(a) * 25;
  const z = g.player.z + Math.sin(a) * 25;
  const group = new THREE.Group();
  const navy = new THREE.MeshStandardMaterial({ color: 0x1a2a4a, roughness: 0.85 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.05, 0.5), navy);
  body.position.y = 1.15;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshStandardMaterial({ color: 0xd8a077 }));
  head.position.y = 1.95;
  group.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.16, 0.56), new THREE.MeshStandardMaterial({ color: 0x1a2a4a }));
  cap.position.y = 2.24;
  group.add(cap);
  group.position.set(x, 0, z);
  g.scene.add(group);
  const cop = { mesh: group, x, z, yaw: 0, speed: 5.2, punchTimer: 0 };
  g.cops.push(cop);
  return cop;
}

function removePoliceCar(g, car) {
  g.scene.remove(car.parts.mesh);
  const i = g.cars.indexOf(car);
  if (i >= 0) g.cars.splice(i, 1);
  const j = g.policeCars.indexOf(car);
  if (j >= 0) g.policeCars.splice(j, 1);
}

export function stepPolice(g, dt) {
  const wanted = g.wanted;
  // Spawn pressure scales with stars; despawn the surplus when stars fall.
  const wantCars = wanted === 0 ? 0 : wanted <= 1 ? 1 : wanted <= 2 ? 2 : wanted <= 3 ? 3 : 4;
  const wantCops = wanted >= 2 ? Math.min(3, wanted - 1) : 0;
  while (g.policeCars.length < wantCars) spawnPoliceCar(g);
  while (g.policeCars.length > wantCars) removePoliceCar(g, g.policeCars[g.policeCars.length - 1]);
  while (g.cops.length < wantCops) spawnFootCop(g);
  while (g.cops.length > wantCops) {
    const cop = g.cops.pop();
    g.scene.remove(cop.mesh);
  }
  // Cruisers chase and ram.
  for (const car of g.policeCars) {
    const dx = g.player.x - car.x;
    const dz = g.player.z - car.z;
    const dist = Math.hypot(dx, dz);
    const wantYaw = Math.atan2(dx, dz);
    let dy = wantYaw - car.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    car.yaw += Math.max(-2.2 * dt, Math.min(2.2 * dt, dy));
    const targetSpeed = dist > 8 ? 30 + wanted * 1.5 : 8;
    car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.5);
    car.x += Math.sin(car.yaw) * car.speed * dt;
    car.z += Math.cos(car.yaw) * car.speed * dt;
    car.parts.mesh.position.set(car.x, 0, car.z);
    car.parts.mesh.rotation.y = car.yaw;
    car.lightPhase += dt * 6;
    // Ram the player's car: damage + shake.
    if (g.player.inCar && g.player.car && dist < 3.4) {
      g.player.car.speed *= 0.7;
      g.player.car.health = Math.max(0, (g.player.car.health || 100) - 4);
      g.shake = 0.4;
      g.audio.crash();
      if (g.player.car.health <= 0) {
        g.toast('Your car is wrecked!');
        g.player.car.health = 100;
      }
    }
    // Busted: a cruiser sits on a slow on-foot player.
    if (!g.player.inCar && dist < 2.6 && g.player.speed < 2) {
      g.bustedTimer += dt;
      if (g.bustedTimer > 1.2) { g.screen = 'busted'; g.audio.busted(); }
    }
  }
  if (g.policeCars.length === 0 || g.player.speed > 2 || g.player.inCar) g.bustedTimer = 0;
  // Foot cops chase and punch.
  for (const cop of g.cops) {
    const dx = g.player.x - cop.x;
    const dz = g.player.z - cop.z;
    const dist = Math.hypot(dx, dz);
    cop.yaw = Math.atan2(dx, dz);
    if (dist > 1.6) {
      cop.x += Math.sin(cop.yaw) * cop.speed * dt;
      cop.z += Math.cos(cop.yaw) * cop.speed * dt;
    }
    cop.punchTimer -= dt;
    if (dist < 2 && cop.punchTimer <= 0) {
      cop.punchTimer = 1.1;
      damagePlayer(g, 8);
      g.audio.punch();
      g.shake = 0.25;
    }
    cop.mesh.position.set(cop.x, 0, cop.z);
    cop.mesh.rotation.y = cop.yaw;
  }
  // Decay: hidden (no cop within 30m, no crime recently) long enough -> lose a star.
  const nearest = Math.min(
    ...g.policeCars.map((c) => Math.hypot(c.x - g.player.x, c.z - g.player.z)),
    ...g.cops.map((c) => Math.hypot(c.x - g.player.x, c.z - g.player.z)),
    999,
  );
  if (wanted > 0 && nearest > 30) {
    g.hiddenTimer += dt;
    if (g.hiddenTimer > WANTED.decaySeconds) {
      g.wanted -= 1;
      g.hiddenTimer = 0;
      g.toast(g.wanted === 0 ? 'You lost the cops.' : 'Heat is cooling off…');
    }
  } else {
    g.hiddenTimer = 0;
  }
}
