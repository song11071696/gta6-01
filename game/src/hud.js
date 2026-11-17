// HUD: DOM bars and readouts (health, armor, money, wanted stars, objective,
// speed, ammo, clock) plus a 2D canvas minimap showing roads, the beach, the
// player arrow, police dots and the mission waypoint. Also the toast line and
// the title / pause / busted / wasted overlays.
import { CITY } from './config.js';

export function createHud(g) {
  const el = (id) => document.getElementById(id);
  const hud = {
    healthFill: el('health-fill'), armorFill: el('armor-fill'),
    money: el('money'), stars: el('stars'), objective: el('objective-text'),
    speed: el('speed'), ammo: el('ammo'), clock: el('clock'),
    toast: el('toast'), minimap: el('minimap'),
    title: el('title-screen'), pause: el('pause-screen'),
    busted: el('busted-screen'), wasted: el('wasted-screen'),
    titleBest: el('title-best'),
  };
  hud.mapCtx = hud.minimap.getContext('2d');
  let toastTimer = 0;
  return {
    ...hud,
    showToast(text) {
      hud.toast.textContent = text;
      hud.toast.style.opacity = '1';
      toastTimer = 3;
    },
    tickToast(dt) {
      if (toastTimer > 0) {
        toastTimer -= dt;
        if (toastTimer <= 0) hud.toast.style.opacity = '0';
      }
    },
    update(g2) {
      const p = g2.player;
      hud.healthFill.style.width = `${Math.max(0, p.health)}%`;
      hud.armorFill.style.width = `${Math.max(0, p.armor)}%`;
      hud.money.textContent = `$${g2.money.toLocaleString('en-US')}`;
      hud.stars.textContent = '★'.repeat(g2.wanted) + '☆'.repeat(5 - g2.wanted);
      hud.stars.style.color = g2.wanted > 0 ? '#ffd23e' : '#888888';
      hud.objective.textContent = g2.missionObjective();
      const kmh = p.inCar && p.car ? Math.round(Math.abs(p.car.speed) * 3.6) : Math.round(p.speed * 3.6);
      hud.speed.textContent = p.inCar ? `${kmh} km/h` : '';
      hud.ammo.textContent = `Ammo ${g2.combat.ammo}`;
      const mins = Math.floor(g2.elapsed / 60);
      const secs = Math.floor(g2.elapsed % 60);
      hud.clock.textContent = `17:${String(20 + mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      drawMinimap(g2, hud.mapCtx);
    },
    showScreen(name) {
      hud.title.style.display = name === 'title' ? 'flex' : 'none';
      hud.pause.style.display = name === 'paused' ? 'flex' : 'none';
      hud.busted.style.display = name === 'busted' ? 'flex' : 'none';
      hud.wasted.style.display = name === 'wasted' ? 'flex' : 'none';
      const inGame = name === 'play';
      document.getElementById('hud').style.display = inGame ? 'block' : 'none';
    },
  };
}

function drawMinimap(g, ctx) {
  const S = 168;
  const half = CITY.size / 2;
  const toMap = (x, z) => [(x + half) / CITY.size * S, (z + half) / CITY.size * S];
  ctx.clearRect(0, 0, S, S);
  ctx.fillStyle = '#20242e';
  ctx.fillRect(0, 0, S, S);
  // Beach + sea.
  const [bx] = toMap(CITY.beachAt, 0);
  ctx.fillStyle = '#e8c98a';
  ctx.fillRect(bx, 0, S - bx, S);
  ctx.fillStyle = '#1e6f8e';
  ctx.fillRect(toMap(CITY.seaAt, 0)[0], 0, S, S);
  // Roads.
  ctx.strokeStyle = '#555560';
  ctx.lineWidth = 3;
  for (const c of g.city.centers) {
    const [x1] = toMap(c, 0);
    const [, y1] = toMap(0, c);
    ctx.beginPath(); ctx.moveTo(x1, 0); ctx.lineTo(x1, S); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, y1); ctx.lineTo(S, y1); ctx.stroke();
  }
  // Mission waypoint.
  if (g.missions.target) {
    const [mx, my] = toMap(g.missions.target.x, g.missions.target.z);
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath(); ctx.arc(mx, my, 6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  // Police dots.
  ctx.fillStyle = '#3a6aff';
  for (const car of g.policeCars) {
    const [px, py] = toMap(car.x, car.z);
    ctx.beginPath(); ctx.arc(px, py, 3.5, 0, Math.PI * 2); ctx.fill();
  }
  // Player arrow.
  const [px, py] = toMap(g.player.x, g.player.z);
  const yaw = g.player.inCar && g.player.car ? g.player.car.yaw : g.player.yaw;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(yaw);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}
