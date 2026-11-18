// Solmar Bay — the camera and the world drawing. Top-down, sun-soaked: sand and
// sea on the east edge, a road grid, rooftops, parks, traffic, crowds, the
// player, and the mission marker pulsing over the city.
import { CFG } from './config.js';

export function updateCamera(G) {
  const p = G.player;
  const vw = G.viewW;
  const vh = G.viewH;
  let cx = p.x - vw / 2;
  let cy = p.y - vh / 2;
  cx = Math.max(0, Math.min(CFG.WORLD_W - vw, cx));
  cy = Math.max(0, Math.min(CFG.WORLD_H - vh, cy));
  // Ease the camera so it trails the player instead of snapping.
  G.cam.x += (cx - G.cam.x) * 0.12;
  G.cam.y += (cy - G.cam.y) * 0.12;
}

export function drawWorld(G, ctx) {
  const cam = G.cam;
  const vw = G.viewW;
  const vh = G.viewH;
  ctx.save();
  ctx.translate(-Math.round(cam.x), -Math.round(cam.y));

  // Ground: grass, then sand and water along the east edge.
  ctx.fillStyle = CFG.COLORS.grass;
  ctx.fillRect(cam.x - 20, cam.y - 20, vw + 40, vh + 40);
  ctx.fillStyle = CFG.COLORS.sand;
  ctx.fillRect(CFG.BEACH_X, cam.y - 20, CFG.WATER_X - CFG.BEACH_X, vh + 40);
  ctx.fillStyle = CFG.COLORS.water;
  ctx.fillRect(CFG.WATER_X, cam.y - 20, CFG.WORLD_W - CFG.WATER_X + 40, vh + 40);
  // Gentle waves on the water.
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    const wy = cam.y + ((G.time * 22 + i * 180) % (vh + 80)) - 40;
    ctx.beginPath();
    ctx.moveTo(CFG.WATER_X + 8, wy);
    ctx.quadraticCurveTo(CFG.WATER_X + 40, wy + 12, CFG.WATER_X + 80, wy);
    ctx.stroke();
  }

  // Roads with sidewalks and dashed centre lines.
  for (const ry of G.world.roadsH) {
    drawRoadH(ctx, ry, cam, vw, vh);
  }
  for (const rx of G.world.roadsV) {
    drawRoadV(ctx, rx, cam, vw, vh);
  }

  // Parks and their trees.
  for (const park of G.world.parks) {
    if (!inView(park, cam, vw, vh)) continue;
    ctx.fillStyle = CFG.COLORS.park;
    ctx.fillRect(park.x, park.y, park.w, park.h);
    for (const t of park.trees) {
      ctx.fillStyle = CFG.COLORS.tree;
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.arc(t.x - 3, t.y - 3, t.r * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Buildings: soft shadow, wall, then a coloured roof with a lighter edge.
  for (const b of G.world.buildings) {
    if (!inView(b, cam, vw, vh)) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
    ctx.fillStyle = '#e8e0d0';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.globalAlpha = b.shade;
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
  }

  // Mission marker: a pulsing diamond and a beam of light.
  const mt = G.missionMarker;
  if (mt) {
    const pulse = 1 + Math.sin(G.time * 5) * 0.18;
    ctx.fillStyle = 'rgba(255,210,31,0.25)';
    ctx.fillRect(mt.x - 14, mt.y - 260, 28, 260);
    ctx.save();
    ctx.translate(mt.x, mt.y);
    ctx.rotate(Math.PI / 4);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = '#ffd21f';
    ctx.fillRect(-13, -13, 26, 26);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.strokeRect(-13, -13, 26, 26);
    ctx.restore();
  }

  // Cars, police included.
  for (const car of G.cars) {
    if (!inView({ x: car.x - 30, y: car.y - 30, w: 60, h: 60 }, cam, vw, vh)) continue;
    drawCar(ctx, car);
  }

  // Pedestrians: a body, a head, and a direction they face.
  for (const ped of G.peds) {
    if (ped.state === 'dead') {
      ctx.fillStyle = 'rgba(120,20,20,0.8)';
      ctx.beginPath();
      ctx.ellipse(ped.x, ped.y, 13, 7, ped.angle, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    if (!inView({ x: ped.x - 16, y: ped.y - 16, w: 32, h: 32 }, cam, vw, vh)) continue;
    ctx.fillStyle = ped.color;
    ctx.beginPath();
    ctx.arc(ped.x, ped.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8c39a';
    ctx.beginPath();
    ctx.arc(ped.x + Math.cos(ped.angle) * 3, ped.y + Math.sin(ped.angle) * 3, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(ped.x, ped.y, 10, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Police on foot wear dark blue with a cap brim.
  for (const off of G.police.peds) {
    ctx.fillStyle = '#20242e';
    ctx.beginPath();
    ctx.arc(off.x, off.y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4a90ff';
    ctx.beginPath();
    ctx.arc(off.x + Math.cos(off.angle) * 3, off.y + Math.sin(off.angle) * 3, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // The player: a green jacket, always readable against the street.
  const p = G.player;
  if (p.alive && p.onFoot) {
    ctx.fillStyle = '#2f9e4a';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#20242e';
    ctx.beginPath();
    ctx.arc(p.x + Math.cos(p.angle) * 4, p.y + Math.sin(p.angle) * 4, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 12, 0, Math.PI * 2);
    ctx.stroke();
    // Aim line while shooting.
    if (G.input.mouseDown) {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + Math.cos(p.angle) * 46, p.y + Math.sin(p.angle) * 46);
      ctx.stroke();
    }
  }

  // Bullets and particles.
  ctx.fillStyle = '#ffe27a';
  for (const b of G.bullets) {
    ctx.fillRect(b.x - 2, b.y - 2, 5, 5);
  }
  for (const pt of G.parts) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.max);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function inView(r, cam, vw, vh) {
  return r.x + r.w > cam.x - 40 && r.x < cam.x + vw + 40 &&
    r.y + r.h > cam.y - 40 && r.y < cam.y + vh + 40;
}

function drawRoadH(ctx, y, cam, vw, vh) {
  const half = CFG.ROAD_W / 2;
  ctx.fillStyle = CFG.COLORS.sidewalk;
  ctx.fillRect(cam.x - 20, y - half - 8, vw + 40, CFG.ROAD_W + 16);
  ctx.fillStyle = CFG.COLORS.road;
  ctx.fillRect(cam.x - 20, y - half, vw + 40, CFG.ROAD_W);
  ctx.strokeStyle = CFG.COLORS.roadLine;
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 22]);
  ctx.beginPath();
  ctx.moveTo(cam.x - 20, y);
  ctx.lineTo(cam.x + vw + 20, y);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawRoadV(ctx, x, cam, vw, vh) {
  const half = CFG.ROAD_W / 2;
  ctx.fillStyle = CFG.COLORS.sidewalk;
  ctx.fillRect(x - half - 8, cam.y - 20, CFG.ROAD_W + 16, vh + 40);
  ctx.fillStyle = CFG.COLORS.road;
  ctx.fillRect(x - half, cam.y - 20, CFG.ROAD_W, vh + 40);
  ctx.strokeStyle = CFG.COLORS.roadLine;
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 22]);
  ctx.beginPath();
  ctx.moveTo(x, cam.y - 20);
  ctx.lineTo(x, cam.y + vh + 20);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawCar(ctx, car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const L = CFG.CAR_LENGTH;
  const W = CFG.CAR_WIDTH;
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-L / 2 + 3, -W / 2 + 4, L, W);
  // Body.
  ctx.fillStyle = car.color;
  ctx.beginPath();
  ctx.roundRect(-L / 2, -W / 2, L, W, 6);
  ctx.fill();
  // Police livery.
  if (car.kind === 'police') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-L / 2 + 4, -W / 2, L - 8, 5);
    ctx.fillRect(-L / 2 + 4, W / 2 - 5, L - 8, 5);
    ctx.fillStyle = '#d84040';
    ctx.fillRect(-6, -W / 2, 6, W);
    ctx.fillStyle = '#4a90ff';
    ctx.fillRect(0, -W / 2, 6, W);
  }
  // Windshield and rear window.
  ctx.fillStyle = 'rgba(20,30,40,0.85)';
  ctx.fillRect(L / 2 - 14, -W / 2 + 3, 8, W - 6);
  ctx.fillRect(-L / 2 + 4, -W / 2 + 3, 6, W - 6);
  // Headlights and brake lights.
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(L / 2 - 2, -W / 2 + 2, 2, 5);
  ctx.fillRect(L / 2 - 2, W / 2 - 7, 2, 5);
  ctx.fillStyle = car.brakeLight ? '#ff2a2a' : '#a02020';
  ctx.fillRect(-L / 2, -W / 2 + 2, 2, 5);
  ctx.fillRect(-L / 2, W / 2 - 7, 2, 5);
  ctx.restore();
}
