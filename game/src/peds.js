// Pedestrians: box-built walkers strolling the sidewalks, chatting in pairs at
// the plaza, and fleeing in a panic when a gun goes off or a car comes at them.
// Hitting one with a car is a crime — the wanted level notices.
import * as THREE from '../vendor/three.module.min.js';

const SHIRTS = [0xd8d8d8, 0xe88a8a, 0x8ab8e8, 0xf2d38a, 0x9ad8a0, 0xd8a0e8, 0x333333];

export function makePedMesh(scene, random) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshStandardMaterial({ color: random.pick(SHIRTS), roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: random.pick([0xd8a077, 0x8a5a3a, 0xe8c8a8]), roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.95, 0.42), shirt);
  body.position.y = 1.05;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), skin);
  head.position.y = 1.75;
  group.add(head);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x2a2a33, roughness: 0.9 });
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.65, 0.3), legMat);
  legL.position.set(-0.18, 0.32, 0);
  group.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.18;
  group.add(legR);
  scene.add(group);
  return { mesh: group, legL, legR };
}

export function spawnPeds(g, count) {
  for (let i = 0; i < count; i += 1) {
    const pt = g.city.randomRoadPoint();
    const parts = makePedMesh(g.scene, g.random);
    const ped = {
      parts, x: pt.x + g.random.range(-6, 6), z: pt.z + g.random.range(-6, 6),
      yaw: g.random.range(0, Math.PI * 2), speed: g.random.range(1.2, 2.2),
      phase: g.random.range(0, 6), flee: 0, down: false, downTimer: 0,
      target: null,
    };
    ped.target = { x: ped.x + g.random.range(-40, 40), z: ped.z + g.random.range(-40, 40) };
    parts.mesh.position.set(ped.x, 0, ped.z);
    g.peds.push(ped);
  }
}

export function scarePeds(g, x, z, radius) {
  for (const ped of g.peds) {
    if (ped.down) continue;
    if (Math.hypot(ped.x - x, ped.z - z) < radius) ped.flee = g.random.range(3, 6);
  }
}

export function stepPeds(g, dt) {
  for (const ped of g.peds) {
    if (ped.down) {
      ped.downTimer -= dt;
      if (ped.downTimer <= 0) {
        ped.down = false;
        ped.parts.mesh.visible = true;
        ped.parts.mesh.position.y = 0;
      }
      continue;
    }
    let tx = ped.target.x;
    let tz = ped.target.z;
    let speed = ped.speed;
    if (ped.flee > 0) {
      ped.flee -= dt;
      const dx = ped.x - g.player.x;
      const dz = ped.z - g.player.z;
      const d = Math.hypot(dx, dz) || 1;
      tx = ped.x + (dx / d) * 30;
      tz = ped.z + (dz / d) * 30;
      speed = 5.5;
    }
    const dx = tx - ped.x;
    const dz = tz - ped.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 2) {
      ped.target = { x: ped.x + g.random.range(-50, 50), z: ped.z + g.random.range(-50, 50) };
      g.city.clampPos(ped.target, 1);
      continue;
    }
    const wantYaw = Math.atan2(dx, dz);
    ped.yaw = wantYaw;
    ped.x += Math.sin(ped.yaw) * speed * dt;
    ped.z += Math.cos(ped.yaw) * speed * dt;
    if (g.city.collides(ped.x, ped.z, 0.5)) {
      ped.x -= Math.sin(ped.yaw) * speed * dt;
      ped.z -= Math.cos(ped.yaw) * speed * dt;
      ped.target = { x: ped.x + g.random.range(-50, 50), z: ped.z + g.random.range(-50, 50) };
    }
    g.city.clampPos(ped, 0.5);
    ped.phase += dt * speed * 2.4;
    ped.parts.legL.rotation.x = Math.sin(ped.phase) * 0.6;
    ped.parts.legR.rotation.x = -Math.sin(ped.phase) * 0.6;
    ped.parts.mesh.position.set(ped.x, 0, ped.z);
    ped.parts.mesh.rotation.y = ped.yaw;
    // A fast player car hitting a pedestrian: they go down, wanted rises.
    if (g.player.inCar && g.player.car) {
      const car = g.player.car;
      if (Math.abs(car.speed) > 6 && Math.hypot(ped.x - car.x, ped.z - car.z) < 2.2) {
        ped.down = true;
        ped.downTimer = 6;
        ped.parts.mesh.visible = false;
        g.addWanted(2, 'hit a pedestrian');
        g.toast('You hit a pedestrian!');
        g.audio.crash();
      }
    }
  }
}
