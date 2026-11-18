// Solmar Bay — bootstrap, game loop and state machine. Title, play, paused,
// busted / wasted, and story complete. Wires every system together and owns
// the one shared game object G that the modules pass around.
import { CFG } from './config.js';
import { makeRng } from './random.js';
import { buildWorld } from './world.js';
import { createInput, keyPressed, clearPressed } from './input.js';
import { createAudio, initAudio, updateAudio, toggleMute, playGunshot, playPunch, playCrash, playPickup, playMissionComplete, playBusted } from './audio.js';
import { createPlayer, updatePlayerOnFoot, exitCar } from './player.js';
import { spawnTraffic, nearestCar, enterCar, updateVehicles, carHitsPeds } from './vehicles.js';
import { spawnPeds, updatePeds, nearestPed } from './peds.js';
import { createPolice, updatePolice, addWanted, showMessage } from './police.js';
import { tryShoot, tryMelee, updateBullets, updateParticles } from './combat.js';
import { startMission, updateMissions, missionTarget, loadGame, saveGame } from './missions.js';
import { drawHUD, drawTitle, drawOverlay } from './hud.js';
import { updateCamera, drawWorld } from './render.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
// One input object for the life of the page: recreating it on every restart
// would stack duplicate key and mouse listeners on the window.
const sharedInput = createInput(canvas);

export function createGame(seed) {
  const rng = makeRng(seed);
  const world = buildWorld(seed);
  const audio = createAudio();
  const G = {
    seed, rng, world, audio,
    input: sharedInput,
    player: createPlayer(world),
    police: createPolice(),
    cars: [],
    peds: [],
    bullets: [],
    parts: [],
    wanted: 0,
    crimeT: 0,
    alarmT: 0,
    message: '',
    messageT: 0,
    missionIdx: 0,
    missionStage: 0,
    missionT: 0,
    missionMarker: null,
    nearCar: null,
    state: 'title',
    overReason: '',
    completeT: 0,
    time: 0,
    lastHurt: -10,
    stats: { kills: 0, carsStolen: 0, missionsDone: 0 },
    cam: { x: 0, y: 0 },
    viewW: CFG.VIEW_W,
    viewH: CFG.VIEW_H,
    hasSave: false,
    shotMode: null,
    frames: 0,
  };
  G.onCrime = (n) => addWanted(G, n);
  G.onCrash = (s) => playCrash(audio, s > 150);
  G.playGunshot = () => playGunshot(audio);
  G.playPunch = () => playPunch(audio);
  G.playPickup = () => playPickup(audio);
  G.playMissionComplete = () => playMissionComplete(audio);
  G.playBusted = () => playBusted(audio);
  try {
    G.hasSave = !!window.localStorage.getItem('solmar-bay-save');
  } catch (err) { /* storage is best-effort */ }
  spawnTraffic(G);
  spawnPeds(G);
  return G;
}

let G = createGame(7);

function resetGame(load) {
  const seed = 7;
  G = createGame(seed);
  if (load && loadGame(G)) {
    showMessage(G, 'Welcome back to Solmar Bay, Mara.');
  } else {
    startMission(G, 0);
  }
  G.state = 'play';
}

function updatePlay(dt) {
  const p = G.player;
  const input = G.input;
  input.worldX = G.cam.x + input.mouseX;
  input.worldY = G.cam.y + input.mouseY;

  // Enter / exit a car.
  if (keyPressed(input, 'KeyE')) {
    initAudio(G.audio);
    if (p.onFoot) {
      const car = nearestCar(G, 60);
      if (car) {
        const stolen = enterCar(G, car);
        if (stolen) {
          addWanted(G, 1);
          showMessage(G, 'That car was not yours. Someone called it in.');
        }
      }
    } else {
      exitCar(G);
    }
  }
  if (keyPressed(input, 'KeyF')) tryMelee(G);

  if (p.onFoot) {
    updatePlayerOnFoot(G, dt);
    tryShoot(G);
  }
  updateVehicles(G, dt);
  carHitsPeds(G);
  updatePeds(G, dt);
  updatePolice(G, dt);
  updateBullets(G, dt);
  updateParticles(G, dt);
  updateMissions(G, dt);
  G.missionMarker = missionTarget(G);
  G.nearCar = p.onFoot ? nearestCar(G, 60) : null;
  if (G.messageT > 0) G.messageT -= dt;
  if (G.alarmT > 0) G.alarmT -= dt;
  updateCamera(G);
  const driving = !p.onFoot && p.car !== null;
  const speedRatio = driving ? Math.abs(p.car.speed) / CFG.CAR_MAX_SPEED : 0;
  updateAudio(G.audio, driving, speedRatio, G.wanted, dt);
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (G.state === 'title') {
    drawTitle(G, ctx);
    return;
  }
  drawWorld(G, ctx);
  if (G.state === 'play' || G.state === 'paused' || G.state === 'complete') {
    drawHUD(G, ctx);
  }
  if (G.state === 'paused') {
    drawOverlay(G, ctx, 'PAUSED', ['Take a breath. The bay will wait.', 'Cash $' + G.player.cash + '  ·  Jobs done ' + G.stats.missionsDone + '/5'], '#ffd76a');
  }
  if (G.state === 'complete') {
    drawOverlay(G, ctx, 'DEBT PAID', ['Mara Voss owns her name again.', 'Five jobs, $' + G.player.cash + ' earned. Solmar Bay is yours — keep driving.'], '#3fae5a');
  }
  if (G.state === 'over') {
    const busted = G.overReason === 'busted';
    drawOverlay(
      G, ctx,
      busted ? 'BUSTED' : 'WASTED',
      busted
        ? ['The Solmar Bay patrol finally caught up with you.', 'Cash kept: $' + G.player.cash + '  ·  Jobs done ' + G.stats.missionsDone + '/5']
        : ['Mara Voss did not make it out of the bay.', 'Cash kept: $' + G.player.cash + '  ·  Jobs done ' + G.stats.missionsDone + '/5'],
      '#d84040',
    );
  }
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.033, Math.max(0.001, (now - last) / 1000));
  last = now;
  const input = G.input;
  if (G.state === 'play') {
    G.time += dt;
    updatePlay(dt);
    // Global keys while playing.
    if (keyPressed(input, 'KeyP') || keyPressed(input, 'Escape')) G.state = 'paused';
    if (keyPressed(input, 'KeyM')) toggleMute(G.audio);
  } else if (G.state === 'paused') {
    if (keyPressed(input, 'KeyP') || keyPressed(input, 'Escape') || keyPressed(input, 'Enter')) G.state = 'play';
  } else if (G.state === 'title') {
    if (keyPressed(input, 'Enter')) {
      initAudio(G.audio);
      resetGame(false);
    } else if (keyPressed(input, 'KeyL')) {
      initAudio(G.audio);
      resetGame(true);
    }
  } else if (G.state === 'over') {
    if (keyPressed(input, 'Enter')) {
      initAudio(G.audio);
      resetGame(false);
    } else if (keyPressed(input, 'KeyT')) G.state = 'title';
  } else if (G.state === 'complete') {
    G.completeT += dt;
    if (keyPressed(input, 'Enter')) {
      G.state = 'play';
      saveGame(G);
    }
  }
  draw();
  G.frames += 1;
  // Debug handle for headless playtests; harmless in normal play.
  window.__solmar = G;
  // In screenshot mode, tell the capture script the staged scene is rendered.
  if (G.shotMode && !window.__shotReady && G.frames >= 3) {
    window.__shotReady = true;
  }
  clearPressed(input);
  requestAnimationFrame(frame);
}

// Screenshot mode: ?shot=cover|street|chase|mission&seed=7 stages a fixed scene.
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot) {
  const seed = Number(params.get('seed')) || 7;
  G = createGame(seed);
  G.shotMode = shot;
  stageShot(G, shot);
}

requestAnimationFrame(frame);
