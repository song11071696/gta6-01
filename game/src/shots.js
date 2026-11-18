// Solmar Bay — screenshot staging. The ?shot=cover|street|chase|mission&seed=7
// URL params put the game into a fixed, lively scene, render it once, and set
// window.__shotReady so the capture script knows the frame is ready.
import { CFG } from './config.js';
import { makeCar } from './vehicles.js';
import { startMission } from './missions.js';
import { addWanted } from './police.js';

function placePlayer(G, x, y, angle) {
  G.player.x = x;
  G.player.y = y;
  G.player.angle = angle;
  G.cam.x = Math.max(0, Math.min(CFG.WORLD_W - G.viewW, x - G.viewW / 2));
  G.cam.y = Math.max(0, Math.min(CFG.WORLD_H - G.viewH, y - G.viewH / 2));
}

function givePlayerCar(G, x, y, angle, color) {
  const car = makeCar(x, y, angle, color, 'sport');
  car.driver = 'player';
  car.speed = 260;
  G.cars.push(car);
  G.player.car = car;
  G.player.onFoot = false;
  G.player.x = x;
  G.player.y = y;
  G.player.angle = angle;
  return car;
}

function scatterTrafficNear(G, x, y, n) {
  const rng = G.rng;
  for (let i = 0; i < n; i++) {
    const a = rng.range(0, Math.PI * 2);
    const d = rng.range(120, 480);
    const cx = x + Math.cos(a) * d;
    const cy = y + Math.sin(a) * d;
    if (cx < 100 || cy < 100 || cx > CFG.BEACH_X - 100 || cy > CFG.WORLD_H - 100) continue;
    const car = makeCar(cx, cy, rng.range(0, Math.PI * 2), rng.pick(['#d84040', '#3a6fd8', '#e8c832', '#e8e8e8', '#3fae6a', '#e87a20']), 'sedan');
    car.driver = 'traffic';
    car.speed = rng.range(90, 160);
    G.cars.push(car);
  }
}

function gatherPedsNear(G, x, y, n) {
  const rng = G.rng;
  for (let i = 0; i < n; i++) {
    const a = rng.range(0, Math.PI * 2);
    const d = rng.range(60, 300);
    G.peds.push({
      x: x + Math.cos(a) * d, y: y + Math.sin(a) * d,
      angle: rng.range(0, Math.PI * 2), speed: 0, state: 'walk',
      hp: CFG.PED_HP, color: rng.pick(['#e8e8e8', '#d84040', '#3a6fd8', '#e8c832', '#3fae6a']),
      tx: x, ty: y, retarget: 3, deadT: 0,
    });
  }
}

export function stageShot(G, name) {
  G.state = 'play';
  if (name === 'cover') {
    // Downtown, driving, traffic, a mission live, two stars on the board.
    placePlayer(G, 1400, 1000, 0);
    givePlayerCar(G, 1400, 1000, 0, '#d84040');
    scatterTrafficNear(G, 1400, 1000, 8);
    gatherPedsNear(G, 1400, 1000, 6);
    startMission(G, 1);
    addWanted(G, 2);
    G.player.cash = 450;
  } else if (name === 'street') {
    // On foot among pedestrians and traffic, first job on the board.
    placePlayer(G, 1000, 1000, Math.PI / 4);
    scatterTrafficNear(G, 1000, 1000, 6);
    gatherPedsNear(G, 1000, 1000, 12);
    startMission(G, 0);
    G.player.cash = 120;
  } else if (name === 'chase') {
    // Five stars, patrol cars closing in from every side.
    placePlayer(G, 1800, 1400, Math.PI / 2);
    givePlayerCar(G, 1800, 1400, Math.PI / 2, '#e8c832');
    scatterTrafficNear(G, 1800, 1400, 5);
    addWanted(G, 5);
    G.player.cash = 980;
    startMission(G, 3);
  } else if (name === 'mission') {
    // The heist in progress: holding the bank lobby, timer running.
    placePlayer(G, 2200, 1000, 0);
    givePlayerCar(G, 2200, 1060, 0, '#3a6fd8');
    scatterTrafficNear(G, 2200, 1000, 4);
    gatherPedsNear(G, 2200, 1000, 4);
    startMission(G, 4);
    G.missionT = 7;
    G.player.cash = 1250;
  } else {
    startMission(G, 0);
  }
  // Let the world settle one tick so police and markers are in place.
  G.missionMarker = null;
}
