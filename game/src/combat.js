// Combat: the player's pistol (raycast shot from the camera with a tracer and
// muzzle flash), the F punch (short-range, knocks pedestrians down), health and
// armor pickups, and ammo. Shooting scares pedestrians and raises wanted.
import * as THREE from '../vendor/three.module.min.js';
import { PLAYER } from './config.js';

export function createCombat(g) {
  const tracerGeo = new THREE.BufferGeometry();
  const positions = new Float32Array(6);
  tracerGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const tracer = new THREE.Line(tracerGeo, new THREE.LineBasicMaterial({ color: 0xffe98a }));
  tracer.visible = false;
  tracer.frustumCulled = false;
  g.scene.add(tracer);
  const flash = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffe98a }),
  );
  flash.visible = false;
  g.scene.add(flash);
  return { tracer, flash, tracerTimer: 0, ammo: 60, maxAmmo: 120 };
}

function shootAt(g, origin, dir) {
  const c = g.combat;
  if (c.ammo <= 0) { g.toast('Out of ammo — find a gun crate on the street.'); return; }
  c.ammo -= 1;
  g.audio.gunshot();
  g.shake = 0.12;
  const ray = new THREE.Raycaster(origin, dir, 0.1, 120);
  const targets = [];
  for (const ped of g.peds) if (!ped.down) targets.push(ped.parts.mesh);
  for (const cop of g.cops) targets.push(cop.mesh);
  for (const car of g.cars) targets.push(car.parts.mesh);
  const hits = ray.intersectObjects(targets, true);
  let end = origin.clone().add(dir.clone().multiplyScalar(120));
  if (hits.length > 0) {
    end = hits[0].point;
    const hitObj = hits[0].object;
    // Find which pedestrian or cop was hit and knock them down / hurt the player car.
    for (const ped of g.peds) {
      if (!ped.down && (ped.parts.mesh === hitObj || ped.parts.mesh.children.includes(hitObj) || hitObj.parent === ped.parts.mesh)) {
        ped.down = true; ped.downTimer = 8; ped.parts.mesh.visible = false;
        g.addWanted(2, 'shooting');
        break;
      }
    }
    for (const cop of g.cops) {
      if (cop.mesh === hitObj || cop.mesh.children.includes(hitObj)) {
        g.scene.remove(cop.mesh);
        g.cops.splice(g.cops.indexOf(cop), 1);
        g.addWanted(3, 'shot a cop');
        break;
      }
    }
  }
  const pos = c.tracer.geometry.attributes.position;
  pos.setXYZ(0, origin.x, origin.y, origin.z);
  pos.setXYZ(1, end.x, end.y, end.z);
  pos.needsUpdate = true;
  c.tracer.visible = true;
  c.tracerTimer = 0.08;
  c.flash.position.copy(origin).add(dir.clone().multiplyScalar(1.2));
  c.flash.visible = true;
  g.scarePeds(g.player.x, g.player.z, 40);
  g.addWanted(1, 'gunfire');
}

export function tryShoot(g) {
  const p = g.player;
  const origin = new THREE.Vector3(p.x, 1.6, p.z);
  if (p.inCar && p.car) {
    origin.set(p.car.x, 1.4, p.car.z);
  }
  const dir = new THREE.Vector3();
  g.camera.getWorldDirection(dir);
  shootAt(g, origin, dir);
}

export function tryPunch(g) {
  const p = g.player;
  if (p.inCar) return;
  g.audio.punch();
  const fx = Math.sin(p.yaw);
  const fz = Math.cos(p.yaw);
  for (const ped of g.peds) {
    if (ped.down) continue;
    const dx = ped.x - p.x;
    const dz = ped.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d < PLAYER.punchRange && (dx * fx + dz * fz) / (d || 1) > 0.2) {
      ped.down = true;
      ped.downTimer = 5;
      ped.parts.mesh.visible = false;
      g.addWanted(1, 'assault');
      g.toast('You knocked them out!');
      g.scarePeds(p.x, p.z, 25);
      return;
    }
  }
  for (const cop of g.cops) {
    const d = Math.hypot(cop.x - p.x, cop.z - p.z);
    if (d < PLAYER.punchRange) {
      g.scene.remove(cop.mesh);
      g.cops.splice(g.cops.indexOf(cop), 1);
      g.addWanted(2, 'fought a cop');
      g.toast('Cop down!');
      return;
    }
  }
}

export function stepCombat(g, dt) {
  const c = g.combat;
  if (c.tracerTimer > 0) {
    c.tracerTimer -= dt;
    if (c.tracerTimer <= 0) { c.tracer.visible = false; c.flash.visible = false; }
  }
}
