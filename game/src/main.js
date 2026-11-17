// Solmar Bay — boot, game loop and state machine. Fixed 1/60 s steps, screens
// title / play / paused / busted / wasted, chase camera with mouse-drag orbit,
// and ?shot=<name>&seed=N staging: stage a scene, paint twice, set
// window.__shotReady for a screenshot. The game object `g` is shared by every
// module; each module owns one job and reads what it needs from `g`.
import * as THREE from '../vendor/three.module.min.js';
import { BEST_KEY, CITY, SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createInput, ACTION_CONFIRM, ACTION_ENTER, ACTION_MISSION, ACTION_MUTE, ACTION_PAUSE, ACTION_PUNCH, ACTION_SHOOT } from './input.js';
import { createAudio } from './audio.js';
import { createCity } from './world.js';
import { createPlayer, damagePlayer, stepPlayerOnFoot, syncPlayerMesh } from './player.js';
import { createCar, enterCar, exitCar, nearestCar, stepPlayerCar, stepTraffic, syncCarMeshes } from './vehicles.js';
import { spawnPeds, scarePeds, stepPeds } from './peds.js';
import { addWanted, stepPolice } from './police.js';
import { createMissions, missionObjective, startMission, stepMissions } from './missions.js';
import { createCombat, stepCombat, tryPunch, tryShoot } from './combat.js';
import { createHud } from './hud.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.35;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);

const g = {
  scene, camera, random: createRandom(seed),
  input: null, audio: createAudio(), city: null, player: null,
  cars: [], peds: [], cops: [], policeCars: [],
  wanted: 0, money: 250, elapsed: 0, screen: 'title',
  missions: null, combat: null, hud: null,
  shake: 0, hiddenTimer: 0, bustedTimer: 0, lastCrime: '',
  camYaw: 0, camPitch: 0.32, camDist: 9,
  hudFlashStars: 0,
};
g.addWanted = (stars, why) => addWanted(g, stars, why);
g.toast = (text) => g.hud.showToast(text);
g.scarePeds = (x, z, r) => scarePeds(g, x, z, r);
g.missionObjective = () => missionObjective(g);
g.save = () => {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({ money: g.money, completed: g.missions.completed, best: g.best }));
  } catch { /* storage off: progress lasts this visit only */ }
};
window.__game = g;

g.city = createCity(scene, g.random);
g.player = createPlayer(scene);
g.input = createInput(canvas);
g.missions = createMissions(g);
g.combat = createCombat(g);
g.hud = createHud(g);

function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (typeof data.money === 'number') g.money = data.money;
    if (typeof data.completed === 'number') g.missions.index = Math.min(data.completed, 5);
    if (typeof data.best === 'number') g.best = data.best;
  } catch { /* corrupt save: start fresh */ }
}
g.best = 0;
try { g.best = Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0; } catch { g.best = 0; }
loadSave();

function spawnWorld() {
  // Traffic on the roads.
  const kinds = ['sedan', 'sedan', 'taxi', 'sedan', 'truck', 'sedan', 'taxi'];
  for (let i = 0; i < 11; i += 1) {
    const pt = g.city.randomRoadPoint();
    const car = createCar(g, kinds[i % kinds.length], pt.x, pt.z, g.random.range(0, Math.PI * 2), { traffic: true });
    car.route = null;
  }
  // Parked cars to steal, including a sports car near the spawn.
  const parked = [
    { kind: 'sports', x: 6, z: 33, color: 0xff5a1e },
    { kind: 'sedan', x: -40, z: -11, color: 0x3a6ac2 },
    { kind: 'taxi', x: 88, z: 77, color: 0xf2c200 },
    { kind: 'sedan', x: -99, z: 121, color: 0xc23a3a },
    { kind: 'sports', x: 165, z: -55, color: 0xffd23e },
    { kind: 'truck', x: -143, z: 33, color: 0x4a6a8a },
  ];
  for (const p of parked) createCar(g, p.kind, p.x, p.z, Math.PI / 2, { parked: true, color: p.color });
  spawnPeds(g, 30);
}
spawnWorld();

function updateCamera(dt) {
  const p = g.player;
  const target = p.inCar && p.car ? p.car : p;
  const tx = target.x;
  const tz = target.z;
  const ty = p.inCar ? 1.6 : 1.8;
  // Mouse drag orbits; otherwise the camera settles behind the car / player.
  const md = g.input.takeMouseDelta();
  g.camYaw -= md.x * 0.005;
  g.camPitch = Math.max(0.08, Math.min(0.9, g.camPitch + md.y * 0.003));
  const followYaw = p.inCar && p.car ? p.car.yaw : p.yaw;
  let dy = followYaw - g.camYaw;
  while (dy > Math.PI) dy -= Math.PI * 2;
  while (dy < -Math.PI) dy += Math.PI * 2;
  if (Math.abs(md.x) < 0.5) g.camYaw += dy * Math.min(1, dt * 1.2);
  const dist = p.inCar ? 11 : 8;
  const cx = tx - Math.sin(g.camYaw) * Math.cos(g.camPitch) * dist;
  const cz = tz - Math.cos(g.camYaw) * Math.cos(g.camPitch) * dist;
  const cy = ty + Math.sin(g.camPitch) * dist;
  const shakeAmp = g.shake > 0 ? g.shake * 0.5 : 0;
  camera.position.set(
    cx + (Math.random() - 0.5) * shakeAmp,
    Math.max(1.2, cy + (Math.random() - 0.5) * shakeAmp),
    cz + (Math.random() - 0.5) * shakeAmp,
  );
  camera.lookAt(tx + Math.sin(g.camYaw) * 4, ty, tz + Math.cos(g.camYaw) * 4);
  if (g.shake > 0) g.shake = Math.max(0, g.shake - dt);
}

function step(dt) {
  g.elapsed += dt;
  if (g.screen !== 'play') return;
  const actions = g.input.takeActions();
  if (actions & ACTION_PAUSE) { g.screen = 'paused'; g.hud.showScreen('paused'); return; }
  if (actions & ACTION_MUTE) { const m = g.audio.toggleMute(); g.toast(m ? 'Sound muted (M to unmute)' : 'Sound on'); }
  if (actions & ACTION_MISSION) startMission(g);
  if (actions & ACTION_ENTER) {
    if (g.player.inCar) exitCar(g);
    else {
      const car = nearestCar(g, g.player.x, g.player.z, 4);
      if (car) enterCar(g, car);
    }
  }
  if (actions & ACTION_PUNCH) tryPunch(g);
  if (actions & ACTION_SHOOT) tryShoot(g);
  if (g.player.inCar) {
    const speed01 = stepPlayerCar(g, dt);
    g.audio.engine(speed01, true);
  } else {
    stepPlayerOnFoot(g, dt, g.camYaw);
    g.audio.engine(0, false);
  }
  g.audio.siren(g.wanted > 0, dt);
  stepTraffic(g, dt);
  stepPeds(g, dt);
  stepPolice(g, dt);
  stepMissions(g, dt);
  stepCombat(g, dt);
  syncPlayerMesh(g);
  g.hud.tickToast(dt);
  g.hud.update(g);
  if (g.player.health <= 0) {
    g.screen = 'wasted';
    g.hud.showScreen('wasted');
    g.audio.busted();
  }
  if (g.screen === 'busted' || g.screen === 'wasted') {
    if (g.money > g.best) {
      g.best = g.money;
      try { window.localStorage.setItem(BEST_KEY, String(g.best)); } catch { /* ignore */ }
    }
  }
}

function startGame() {
  g.screen = 'play';
  g.hud.showScreen('play');
  g.audio.unlock();
  g.audio.click();
  status.textContent = 'Playing Solmar Bay. Press Q for a job, E to enter a car.';
  g.toast('Welcome to Solmar Bay — press Q for your first job');
}

function resetRun() {
  g.player.health = 100;
  g.player.armor = 50;
  g.player.x = 0;
  g.player.z = 8;
  g.player.yaw = 0;
  g.player.inCar = false;
  g.player.car = null;
  g.wanted = 0;
  g.money = 250;
  g.elapsed = 0;
  g.missions.index = 0;
  g.missions.active = false;
  g.missions.completed = 0;
  g.camYaw = 0;
  syncPlayerMesh(g);
}

// ---- Screenshot staging: ?shot=cover|street|chase|mission (&seed=N) ----
function stageShot(name) {
  resetRun();
  g.screen = 'play';
  g.hud.showScreen('play');
  g.hud.titleBest.textContent = `Best fortune: $${g.best.toLocaleString('en-US')}`;
  const sports = g.cars.find((c) => c.kind === 'sports' && c.parked);
  if (name === 'cover') {
    if (sports) { sports.parked = false; enterCar(g, sports); }
    g.player.car.x = -30; g.player.car.z = 33; g.player.car.yaw = Math.PI / 2; g.player.car.speed = 18;
    g.camYaw = Math.PI / 2;
    g.camPitch = 0.22;
    g.missions.index = 2; startMission(g);
    stepPolice(g, STEP);
    for (let i = 0; i < 3; i += 1) { const c = g.policeCars[i]; if (c) { c.x = [-8, -52, -58][i]; c.z = [29, 37, 29][i]; c.yaw = Math.PI / 2; } }
    g.wanted = 3;
    g.money = 2350;
  } else if (name === 'street') {
    g.player.x = -24; g.player.z = 26; g.player.yaw = Math.PI * 0.5;
    g.camYaw = Math.PI * 0.5;
    g.camPitch = 0.3;
    g.money = 850;
    g.missions.index = 0;
    for (let i = 0; i < 240; i += 1) { stepTraffic(g, STEP); stepPeds(g, STEP); }
    for (let i = 0; i < 3; i += 1) {
      const ped = g.peds[i];
      ped.x = -18 + i * 5; ped.z = 30; ped.target = { x: -10 + i * 5, z: 26 };
      ped.parts.mesh.position.set(ped.x, 0, ped.z);
    }
  } else if (name === 'chase') {
    const sedan = g.cars.find((c) => c.kind === 'sedan' && c.parked);
    if (sedan) { sedan.parked = false; enterCar(g, sedan); }
    g.player.car.x = 40; g.player.car.z = -11; g.player.car.yaw = -Math.PI / 2; g.player.car.speed = 24;
    g.camYaw = -Math.PI / 2;
    g.camPitch = 0.2;
    g.missions.index = 3; startMission(g);
    stepPolice(g, STEP);
    for (let i = 0; i < 4; i += 1) { const c = g.policeCars[i]; if (c) { c.x = [16, 64, 72, 80][i]; c.z = [-7, -15, -7, -15][i]; c.yaw = -Math.PI / 2; } }
    g.wanted = 4;
    g.money = 4100;
  } else { // mission
    g.wanted = 1;
    g.player.x = -16; g.player.z = 22; g.player.yaw = 2.07;
    g.camYaw = 2.07;
    g.camPitch = 0.28;
    g.missions.index = 1; startMission(g);
    g.money = 1650;
    for (let i = 0; i < 120; i += 1) { stepTraffic(g, STEP); stepPeds(g, STEP); }
  }
  stepPolice(g, STEP);
  syncCarMeshes(g);
  syncPlayerMesh(g);
  g.hud.update(g);
  updateCamera(0.016);
  renderer.render(scene, camera);
  renderer.render(scene, camera);
  window.__shotReady = true;
}

function runGame() {
  g.hud.showScreen('title');
  g.hud.titleBest.textContent = `Best fortune: $${g.best.toLocaleString('en-US')}`;
  status.textContent = 'Solmar Bay. Press Space or click to start.';
  let accumulator = 0;
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    // Only non-play screens consume actions here; in play, step() owns them.
    if (g.screen !== 'play') {
      const actions = g.input.takeActions();
      if (g.screen === 'title' && (actions & ACTION_CONFIRM)) startGame();
      else if ((g.screen === 'busted' || g.screen === 'wasted') && (actions & ACTION_CONFIRM)) { resetRun(); startGame(); }
      else if (g.screen === 'paused' && (actions & (ACTION_PAUSE | ACTION_CONFIRM))) { g.screen = 'play'; g.hud.showScreen('play'); }
    }
    if (g.screen === 'play') {
      while (accumulator >= STEP) { step(STEP); accumulator -= STEP; if (g.screen !== 'play') break; }
    } else {
      accumulator = 0;
      // Title backdrop: traffic and pedestrians keep moving.
      stepTraffic(g, STEP);
      stepPeds(g, STEP);
    }
    updateCamera(1 / 60);
    renderer.render(scene, camera);
  }
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && g.screen === 'play') { g.screen = 'paused'; g.hud.showScreen('paused'); }
  });
  requestAnimationFrame(frame);
}

if (shotName) stageShot(shotName);
else runGame();
