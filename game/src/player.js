// The player on foot: a box-built third-person character (jacket, head, legs that
// swing while walking), WASD movement relative to the camera, Shift to sprint,
// and a simple push-out against building colliders. Driving is vehicles.js's job.
import * as THREE from '../vendor/three.module.min.js';
import { PLAYER } from './config.js';

export function createPlayer(scene) {
  const group = new THREE.Group();
  const jacket = new THREE.MeshStandardMaterial({ color: 0x2e8b6a, roughness: 0.8 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xd8a077, roughness: 0.8 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x2a3242, roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.05, 0.5), jacket);
  body.position.y = 1.15;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), skin);
  head.position.y = 1.95;
  head.castShadow = true;
  group.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.16, 0.56), new THREE.MeshStandardMaterial({ color: 0xffd23e }));
  cap.position.y = 2.24;
  group.add(cap);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.8, 0.36), pants);
  legL.position.set(-0.22, 0.4, 0);
  group.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.22;
  group.add(legR);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.85, 0.28), jacket);
  arm.position.set(-0.56, 1.15, 0);
  group.add(arm);
  const armR = arm.clone();
  armR.position.x = 0.56;
  group.add(armR);
  scene.add(group);
  return {
    mesh: group, legL, legR,
    x: 0, z: 8, yaw: 0, walkPhase: 0,
    health: PLAYER.maxHealth, armor: 0, inCar: false, car: null,
    speed: 0,
  };
}

/** Move the player on foot. `camYaw` is the camera heading; movement is relative to it. */
export function stepPlayerOnFoot(g, dt, camYaw) {
  const p = g.player;
  const input = g.input;
  const fwd = input.forward();
  const strafe = input.strafe();
  if (fwd === 0 && strafe === 0) { p.speed = 0; p.walkPhase *= 0.9; return; }
  const speed = input.running() ? PLAYER.runSpeed : PLAYER.walkSpeed;
  const sin = Math.sin(camYaw);
  const cos = Math.cos(camYaw);
  // Forward is -Z rotated by camYaw; strafe is perpendicular.
  let dx = (-sin * fwd + cos * strafe) * speed * dt;
  let dz = (-cos * fwd - sin * strafe) * speed * dt;
  const nx = p.x + dx;
  const nz = p.z + dz;
  if (!g.city.collides(nx, p.z, PLAYER.radius)) p.x = nx;
  if (!g.city.collides(p.x, nz, PLAYER.radius)) p.z = nz;
  g.city.clampPos(p, PLAYER.radius);
  p.speed = speed;
  p.yaw = Math.atan2(dx, dz);
  p.walkPhase += dt * speed * 1.6;
  p.legL.rotation.x = Math.sin(p.walkPhase) * 0.7;
  p.legR.rotation.x = -Math.sin(p.walkPhase) * 0.7;
  p.mesh.position.set(p.x, 0, p.z);
  p.mesh.rotation.y = p.yaw;
}

export function syncPlayerMesh(g) {
  const p = g.player;
  if (p.inCar) { p.mesh.visible = false; return; }
  p.mesh.visible = true;
  p.mesh.position.set(p.x, 0, p.z);
  p.mesh.rotation.y = p.yaw;
}

export function damagePlayer(g, amount) {
  const p = g.player;
  let rest = amount;
  if (p.armor > 0) {
    const absorbed = Math.min(p.armor, rest);
    p.armor -= absorbed;
    rest -= absorbed;
  }
  p.health = Math.max(0, p.health - rest);
  if (p.health <= 0) g.screen = 'wasted';
}
