// Story missions and side cash. Six missions for fixer "Marisol Vega" — a
// tutorial theft, a pickup and delivery, losing a 2-star wanted level, a getaway
// drive, a timed delivery, and a final marina heist with a 3-star escape. Each
// mission is a small state machine (go to marker -> do the thing -> go to the
// next marker -> paid). A glowing waypoint beacon marks the target in the world
// and on the minimap; the HUD shows the objective line and distance.
import * as THREE from '../vendor/three.module.min.js';
import { MISSION_PAY } from './config.js';

const MISSION_DEFS = [
  { id: 0, title: 'First Wheels', giver: 'Marisol Vega', text: 'Borrow a parked car on Palm Row and bring it to the garage on Marina Ave.', need: 'car', pay: MISSION_PAY[0] },
  { id: 1, title: 'The Package', giver: 'Marisol Vega', text: 'Pick up the package at the plaza fountain, then deliver it to the beach cafe.', need: 'pickup', pay: MISSION_PAY[1] },
  { id: 2, title: 'Cool Down', giver: 'Marisol Vega', text: 'The cops are onto you. Lose your 2-star wanted level — stay out of sight.', need: 'loseWanted', pay: MISSION_PAY[2] },
  { id: 3, title: 'Getaway Driver', giver: 'Dante Cole', text: 'Drive fast: reach the north lookout before the timer runs out. No cops needed.', need: 'drive', time: 75, pay: MISSION_PAY[3] },
  { id: 4, title: 'Rush Hour', giver: 'Marisol Vega', text: 'Timed delivery: take the briefcase from the tower lobby to the marina in 90 seconds.', need: 'timed', time: 90, pay: MISSION_PAY[4] },
  { id: 5, title: 'The Marina Job', giver: 'Dante Cole', text: 'Final job: grab the lockbox at the marina, then escape a 3-star wanted level.', need: 'heist', pay: MISSION_PAY[5] },
];

function markerPoint(g, kind) {
  if (kind === 'plaza') return { x: 8, z: 8 };
  if (kind === 'beach') return { x: 178, z: 60 };
  if (kind === 'garage') return { x: -132, z: 44 };
  if (kind === 'north') return { x: 0, z: -176 };
  if (kind === 'tower') return { x: -60, z: -44 };
  if (kind === 'marina') return { x: 178, z: -120 };
  if (kind === 'palmrow') return { x: 88, z: 0 };
  const pt = g.city.randomRoadPoint();
  return { x: pt.x, z: pt.z };
}

export function createMissions(g) {
  const beaconGeo = new THREE.CylinderGeometry(1.6, 1.6, 60, 16, 1, true);
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
  const beacon = new THREE.Mesh(beaconGeo, beaconMat);
  beacon.visible = false;
  g.scene.add(beacon);
  const ringGeo = new THREE.TorusGeometry(3, 0.3, 8, 32);
  const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffd23e }));
  ring.rotation.x = Math.PI / 2;
  ring.visible = false;
  g.scene.add(ring);
  // Side cash: spinning gold crates around the city.
  const cash = [];
  const cashGeo = new THREE.BoxGeometry(1, 1, 1);
  const cashMat = new THREE.MeshStandardMaterial({ color: 0xf2c200, emissive: 0xaa8800, metalness: 0.6, roughness: 0.3 });
  for (let i = 0; i < 10; i += 1) {
    const pt = g.city.randomRoadPoint();
    const m = new THREE.Mesh(cashGeo, cashMat);
    m.position.set(pt.x + g.random.range(-5, 5), 1, pt.z + g.random.range(-5, 5));
    m.castShadow = true;
    g.scene.add(m);
    cash.push({ mesh: m, x: m.position.x, z: m.position.z, taken: false });
  }
  return {
    defs: MISSION_DEFS, index: 0, active: false, stage: 0, target: null,
    timer: 0, beacon, ring, cash, completed: 0,
  };
}

export function missionObjective(g) {
  const m = g.missions;
  if (!m.active) return m.index < m.defs.length ? `Press Q — next job: ${m.defs[m.index].title} ($${m.defs[m.index].pay})` : 'All jobs done — free roam Solmar Bay!';
  const def = m.defs[m.index];
  const dist = m.target ? Math.round(Math.hypot(m.target.x - g.player.x, m.target.z - g.player.z)) : 0;
  const time = m.timer > 0 ? ` — ${Math.ceil(m.timer)}s left` : '';
  return `${def.title}: ${def.text} (${dist}m)${time}`;
}

function setTarget(g, point) {
  const m = g.missions;
  m.target = point;
  m.beacon.visible = true;
  m.beacon.position.set(point.x, 30, point.z);
  m.ring.visible = true;
  m.ring.position.set(point.x, 0.3, point.z);
}

function clearTarget(g) {
  const m = g.missions;
  m.target = null;
  m.beacon.visible = false;
  m.ring.visible = false;
}

export function startMission(g) {
  const m = g.missions;
  if (m.active || m.index >= m.defs.length) return;
  const def = m.defs[m.index];
  m.active = true;
  m.stage = 0;
  m.timer = def.time || 0;
  g.toast(`New job: ${def.title} — ${def.giver}`);
  g.audio.jingle();
  if (def.need === 'car') setTarget(g, markerPoint(g, 'palmrow'));
  else if (def.need === 'pickup' || def.need === 'timed') setTarget(g, def.need === 'pickup' ? markerPoint(g, 'plaza') : markerPoint(g, 'tower'));
  else if (def.need === 'loseWanted') { g.addWanted(2, 'mission heat'); setTarget(g, markerPoint(g, 'north')); }
  else if (def.need === 'drive') setTarget(g, markerPoint(g, 'north'));
  else if (def.need === 'heist') setTarget(g, markerPoint(g, 'marina'));
}

function completeMission(g) {
  const m = g.missions;
  const def = m.defs[m.index];
  g.money += def.pay;
  m.completed += 1;
  m.index += 1;
  m.active = false;
  clearTarget(g);
  g.toast(`Job complete! +$${def.pay}`);
  g.audio.jingle();
  g.save();
}

function atTarget(g, radius) {
  const m = g.missions;
  if (!m.target) return false;
  return Math.hypot(m.target.x - g.player.x, m.target.z - g.player.z) < (radius || 6);
}

export function stepMissions(g, dt) {
  const m = g.missions;
  // Spinning cash pickups.
  for (const c of m.cash) {
    if (c.taken) continue;
    c.mesh.rotation.y += dt * 2;
    c.mesh.position.y = 1 + Math.sin(g.elapsed * 2 + c.x) * 0.25;
    if (Math.hypot(c.x - g.player.x, c.z - g.player.z) < 2.2) {
      c.taken = true;
      c.mesh.visible = false;
      g.money += 150;
      g.toast('Found street cash +$150');
      g.audio.pickup();
    }
  }
  if (!m.active) return;
  const def = m.defs[m.index];
  if (m.timer > 0) {
    m.timer -= dt;
    if (m.timer <= 0) {
      m.active = false;
      clearTarget(g);
      g.toast('Too slow — job failed. Press Q to retry.');
      return;
    }
  }
  if (def.need === 'car') {
    if (m.stage === 0 && g.player.inCar) { m.stage = 1; setTarget(g, markerPoint(g, 'garage')); g.toast('Nice wheels. Now bring it to the garage.'); }
    else if (m.stage === 1 && atTarget(g, 8)) completeMission(g);
  } else if (def.need === 'pickup') {
    if (m.stage === 0 && atTarget(g, 6)) { m.stage = 1; setTarget(g, markerPoint(g, 'beach')); g.toast('Package secured. Deliver it to the beach cafe.'); g.audio.pickup(); }
    else if (m.stage === 1 && atTarget(g, 8)) completeMission(g);
  } else if (def.need === 'loseWanted') {
    if (g.wanted === 0) completeMission(g);
  } else if (def.need === 'drive') {
    if (atTarget(g, 10)) completeMission(g);
  } else if (def.need === 'timed') {
    if (m.stage === 0 && atTarget(g, 6)) { m.stage = 1; setTarget(g, markerPoint(g, 'marina')); g.toast('Briefcase in hand — go, go, go!'); g.audio.pickup(); }
    else if (m.stage === 1 && atTarget(g, 8)) completeMission(g);
  } else if (def.need === 'heist') {
    if (m.stage === 0 && atTarget(g, 6)) {
      m.stage = 1;
      g.addWanted(3, 'marina heist');
      g.toast('Lockbox grabbed — now lose the cops!');
      g.audio.jingle();
      setTarget(g, markerPoint(g, 'north'));
    } else if (m.stage === 1 && g.wanted === 0 && atTarget(g, 12)) completeMission(g);
  }
  // Beacon pulse.
  if (m.beacon.visible) {
    m.beacon.material.opacity = 0.25 + Math.sin(g.elapsed * 4) * 0.12;
    m.ring.scale.setScalar(1 + Math.sin(g.elapsed * 4) * 0.12);
  }
}
