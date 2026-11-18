// Solmar Bay — the player on foot. Walks, runs, aims with the mouse and steps
// in and out of cars. Driving itself lives in vehicles.js.
import { CFG } from './config.js';
import { moveWithCollision } from './world.js';
import { moveVector, keyDown } from './input.js';

export function createPlayer(world) {
  return {
    x: world.spawn.x,
    y: world.spawn.y,
    angle: 0,
    health: CFG.PLAYER_HP,
    cash: 0,
    onFoot: true,
    car: null,
    fireTimer: 0,
    runStamina: 1,
    alive: true,
  };
}

export function updatePlayerOnFoot(G, dt) {
  const p = G.player;
  const input = G.input;
  const mv = moveVector(input);
  const running = keyDown(input, 'ShiftLeft') || keyDown(input, 'ShiftRight');
  const speed = running ? CFG.RUN_SPEED : CFG.WALK_SPEED;
  if (mv.x !== 0 || mv.y !== 0) {
    moveWithCollision(G.world, p, mv.x * speed * dt, mv.y * speed * dt, 13);
    // Face the aim direction while the mouse is held, else face where we walk.
    if (input.mouseDown) {
      p.angle = Math.atan2(input.worldY - p.y, input.worldX - p.x);
    } else {
      p.angle = Math.atan2(mv.y, mv.x);
    }
  } else if (input.mouseDown) {
    p.angle = Math.atan2(input.worldY - p.y, input.worldX - p.x);
  }
  // Slow health recovery when not in a fight.
  if (p.health > 0 && p.health < CFG.PLAYER_HP && G.time - G.lastHurt > 6) {
    p.health = Math.min(CFG.PLAYER_HP, p.health + 4 * dt);
  }
  if (p.fireTimer > 0) p.fireTimer -= dt;
}

export function hurtPlayer(G, amount) {
  const p = G.player;
  if (!p.alive) return;
  p.health -= amount;
  G.lastHurt = G.time;
  if (p.health <= 0) {
    p.health = 0;
    p.alive = false;
    G.state = 'over';
    G.overReason = 'wasted';
  }
}

// Step out of the car onto the nearest free patch of ground beside it.
export function exitCar(G) {
  const p = G.player;
  const car = p.car;
  if (!car) return;
  const spots = [
    { x: car.x - Math.sin(car.angle) * 34, y: car.y + Math.cos(car.angle) * 34 },
    { x: car.x + Math.sin(car.angle) * 34, y: car.y - Math.cos(car.angle) * 34 },
    { x: car.x - Math.cos(car.angle) * 34, y: car.y - Math.sin(car.angle) * 34 },
    { x: car.x + Math.cos(car.angle) * 34, y: car.y + Math.sin(car.angle) * 34 },
  ];
  for (const s of spots) {
    if (!G.world || s.x < 0 || s.y < 0) continue;
    p.x = s.x;
    p.y = s.y;
    break;
  }
  car.driver = 'none';
  car.speed = 0;
  p.car = null;
  p.onFoot = true;
  p.angle = car.angle;
}
