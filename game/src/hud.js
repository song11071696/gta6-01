// Solmar Bay — everything drawn in screen space: health and cash, wanted
// stars, the mission tracker, the minimap, messages, and the title, pause,
// busted and story-complete screens.
import { CFG, districtAt } from './config.js';
import { MISSIONS, missionText } from './missions.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawHUD(G, ctx) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  const p = G.player;
  // Health bar, top left.
  ctx.fillStyle = 'rgba(10,10,14,0.62)';
  roundRect(ctx, 14, 14, 210, 54, 8);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('MARA VOSS', 26, 34);
  ctx.fillStyle = '#222';
  ctx.fillRect(26, 42, 150, 12);
  ctx.fillStyle = p.health > 30 ? '#3fae5a' : '#d84040';
  ctx.fillRect(26, 42, 150 * (p.health / CFG.PLAYER_HP), 12);
  ctx.fillStyle = '#ffd76a';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('$' + p.cash, 182, 55);
  // District name under the health bar.
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '13px sans-serif';
  ctx.fillText(districtAt(p.x, p.y), 26, 86);

  // Wanted stars, top right.
  ctx.fillStyle = 'rgba(10,10,14,0.62)';
  roundRect(ctx, W - 178, 14, 164, 40, 8);
  ctx.fill();
  for (let i = 0; i < CFG.WANTED_MAX; i++) {
    ctx.fillStyle = i < G.wanted ? '#ffd21f' : 'rgba(255,255,255,0.25)';
    drawStar(ctx, W - 160 + i * 30, 34, 11);
  }

  // Mission tracker, top centre.
  const m = MISSIONS[G.missionIdx];
  ctx.fillStyle = 'rgba(10,10,14,0.62)';
  roundRect(ctx, W / 2 - 230, 14, 460, 52, 8);
  ctx.fill();
  ctx.fillStyle = '#ffd76a';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(m ? 'JOB ' + m.id + '/5 — ' + m.title : 'STORY COMPLETE', W / 2, 34);
  ctx.fillStyle = '#ffffff';
  ctx.font = '13px sans-serif';
  const text = missionText(G);
  ctx.fillText(text.length > 58 ? text.slice(0, 58) + '…' : text, W / 2, 54);

  // Heist hold progress.
  if (m && m.type === 'heist' && G.missionStage === 0) {
    ctx.fillStyle = '#222';
    ctx.fillRect(W / 2 - 110, 72, 220, 8);
    ctx.fillStyle = '#ffd76a';
    ctx.fillRect(W / 2 - 110, 72, 220 * Math.min(1, G.missionT / m.holdTime), 8);
  }

  // Busted warning while the police close in.
  if (G.police.bustedT > 0.2 && G.state === 'play') {
    ctx.fillStyle = 'rgba(216,64,64,0.85)';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('THEY ARE GRABBING YOU — RUN!', W / 2, 130);
  }

  // Message banner.
  if (G.messageT > 0) {
    ctx.globalAlpha = Math.min(1, G.messageT);
    ctx.fillStyle = 'rgba(10,10,14,0.72)';
    const tw = ctx.measureText(G.message).width + 36;
    roundRect(ctx, W / 2 - tw / 2, H - 118, tw, 34, 8);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '15px sans-serif';
    ctx.fillText(G.message, W / 2, H - 96);
    ctx.globalAlpha = 1;
  }

  // Controls hint, bottom right.
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('WASD move/drive · E enter car · Click shoot · F punch · P pause · M mute', W - 16, H - 16);

  // "Press E" prompt when a car is in reach.
  if (G.nearCar && p.onFoot) {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Press E to take the car', W / 2, H - 150);
  }

  drawMinimap(G, ctx);
}

function drawStar(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

function drawMinimap(G, ctx) {
  const size = 168;
  const x0 = 16;
  const y0 = ctx.canvas.height - size - 16;
  const sx = size / CFG.WORLD_W;
  const sy = size / CFG.WORLD_H;
  ctx.fillStyle = 'rgba(10,10,14,0.7)';
  roundRect(ctx, x0 - 5, y0 - 5, size + 10, size + 10, 8);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, size, size);
  ctx.clip();
  ctx.fillStyle = '#5d8a4a';
  ctx.fillRect(x0, y0, size, size);
  // Beach and water.
  ctx.fillStyle = '#e8d39a';
  ctx.fillRect(x0 + CFG.BEACH_X * sx, y0, size - CFG.BEACH_X * sx, size);
  ctx.fillStyle = '#2e7fa8';
  ctx.fillRect(x0 + CFG.WATER_X * sx, y0, size - CFG.WATER_X * sx, size);
  // Roads.
  ctx.strokeStyle = '#3d3d42';
  ctx.lineWidth = 3;
  for (const ry of G.world.roadsH) {
    ctx.beginPath();
    ctx.moveTo(x0, y0 + ry * sy);
    ctx.lineTo(x0 + size, y0 + ry * sy);
    ctx.stroke();
  }
  for (const rx of G.world.roadsV) {
    ctx.beginPath();
    ctx.moveTo(x0 + rx * sx, y0);
    ctx.lineTo(x0 + rx * sx, y0 + size);
    ctx.stroke();
  }
  // Mission marker.
  const mt = G.missionMarker;
  if (mt) {
    ctx.fillStyle = '#ffd21f';
    ctx.beginPath();
    ctx.arc(x0 + mt.x * sx, y0 + mt.y * sy, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  // Police.
  ctx.fillStyle = '#4a90ff';
  for (const car of G.police.cars) {
    ctx.fillRect(x0 + car.x * sx - 2, y0 + car.y * sy - 2, 4, 4);
  }
  // Player.
  ctx.fillStyle = '#3fae5a';
  ctx.beginPath();
  ctx.arc(x0 + G.player.x * sx, y0 + G.player.y * sy, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('SOLMAR BAY', x0, y0 - 8);
}

export function drawTitle(G, ctx) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#ff9a3c');
  grad.addColorStop(0.55, '#e85a7a');
  grad.addColorStop(1, '#3a2a6a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fillRect(0, H * 0.62, W, 4);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.font = 'bold 84px sans-serif';
  ctx.fillText('SOLMAR BAY', W / 2, H * 0.34);
  ctx.fillStyle = '#ffd76a';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('A SUN-SOAKED OPEN-WORLD CRIME STORY', W / 2, H * 0.34 + 42);
  ctx.fillStyle = '#ffffff';
  ctx.font = '17px sans-serif';
  ctx.fillText('Mara Voss came home broke and in debt. The bay owes her a living —', W / 2, H * 0.52);
  ctx.fillText('take it back, one job at a time. Five jobs. One way out.', W / 2, H * 0.52 + 26);
  ctx.font = 'bold 20px sans-serif';
  ctx.fillStyle = '#ffd76a';
  ctx.fillText('Press ENTER to start  ·  L to continue a saved game', W / 2, H * 0.68);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '15px sans-serif';
  ctx.fillText('WASD move / drive   ·   E enter or steal a car   ·   Mouse aim, Click shoot   ·   F punch', W / 2, H * 0.68 + 32);
  ctx.fillText('P pause   ·   M mute   ·   Progress saves after every job', W / 2, H * 0.68 + 58);
  if (G.hasSave) {
    ctx.fillStyle = '#ffd76a';
    ctx.font = '15px sans-serif';
    ctx.fillText('A saved game was found — press L to pick up where you left off.', W / 2, H * 0.68 + 92);
  }
}

export function drawOverlay(G, ctx, title, lines, accent) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  ctx.fillStyle = 'rgba(8,8,12,0.72)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = accent || '#ffffff';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText(title, W / 2, H * 0.38);
  ctx.fillStyle = '#ffffff';
  ctx.font = '18px sans-serif';
  lines.forEach((line, i) => {
    ctx.fillText(line, W / 2, H * 0.38 + 44 + i * 30);
  });
  ctx.fillStyle = '#ffd76a';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('Press ENTER to play again  ·  Press T for the title screen', W / 2, H * 0.38 + 44 + lines.length * 30 + 30);
}
