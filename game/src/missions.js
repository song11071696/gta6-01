// Solmar Bay — the story. Five jobs for Mara Voss, a driver who came back to
// the bay broke and owes the wrong people. Each mission has an objective, a
// marker on the map, and cash on completion. Finish all five to clear the debt.
import { MISSION_REWARDS } from './config.js';
import { addWanted, showMessage } from './police.js';

export const MISSIONS = [
  {
    id: 1,
    title: 'First Wheels',
    giver: 'Dario — the fence at Old Marina',
    brief: 'You are back in Solmar Bay with empty pockets. Take any car on the street. Nobody here locks their doors.',
    objective: 'Get in a car',
    type: 'steal',
  },
  {
    id: 2,
    title: 'Harbor Pickup',
    giver: 'Dario',
    brief: 'A crate came in on the night ferry and nobody signed for it. Drive down to the harbor and collect it before the dock crew does.',
    objective: 'Drive to the harbor marker',
    type: 'goto',
    target: 'harbor',
  },
  {
    id: 3,
    title: 'The Courier',
    giver: 'Lena — runs the beachfront bar',
    brief: 'Lena needs a package carried from the beach to Palm Heights, fast and quiet. Pick it up on the sand, then drop it at the north house.',
    objective: 'Pick up the package, then deliver it',
    type: 'pickup',
    pickup: 'beachfront',
    target: 'safehouse',
  },
  {
    id: 4,
    title: 'Hot Pursuit',
    giver: 'Lena',
    brief: 'The drop was watched. Patrol cars are rolling in — three stars and climbing. Lose them, then lay low until the streets go quiet.',
    objective: 'Lose the police (reach 0 stars)',
    type: 'escape',
    setWanted: 3,
  },
  {
    id: 5,
    title: 'Bay Heist',
    giver: 'Dario',
    brief: 'One last job and the debt is gone: crack the Sunset bank vault, hold the lobby while the timer runs, then vanish to the safehouse. The whole bay will be hunting you.',
    objective: 'Hold the bank vault, then reach the safehouse',
    type: 'heist',
    target: 'bank',
    escape: 'safehouse',
    setWanted: 4,
    holdTime: 12,
  },
];

export function missionTarget(G) {
  const m = MISSIONS[G.missionIdx];
  if (!m) return null;
  if (m.type === 'goto') return G.world[m.target];
  if (m.type === 'pickup') return G.world[G.missionStage === 0 ? m.pickup : m.target];
  if (m.type === 'heist') return G.world[G.missionStage === 0 ? m.target : m.escape];
  return null;
}

export function missionText(G) {
  const m = MISSIONS[G.missionIdx];
  if (!m) return 'Story complete — Solmar Bay is yours. Free roam.';
  if (m.type === 'pickup' && G.missionStage === 1) return 'Deliver the package to Palm Heights';
  if (m.type === 'heist' && G.missionStage === 1) return 'Escape to the safehouse';
  if (m.type === 'heist' && G.missionStage === 0) return 'Hold the bank lobby: ' + Math.ceil(m.holdTime - G.missionT) + 's';
  return m.objective;
}

export function startMission(G, idx) {
  const m = MISSIONS[idx];
  if (!m) return;
  G.missionIdx = idx;
  G.missionStage = 0;
  G.missionT = 0;
  if (m.setWanted) {
    G.wanted = Math.max(G.wanted, m.setWanted);
    G.crimeT = 0;
  }
  showMessage(G, 'New job: ' + m.title + ' — ' + m.brief);
}

export function completeMission(G) {
  const m = MISSIONS[G.missionIdx];
  const reward = MISSION_REWARDS[G.missionIdx] || 0;
  G.player.cash += reward;
  G.stats.missionsDone += 1;
  showMessage(G, 'Job done: ' + m.title + ' — paid $' + reward + '.');
  if (G.playMissionComplete) G.playMissionComplete();
  saveGame(G);
  if (G.missionIdx + 1 < MISSIONS.length) {
    startMission(G, G.missionIdx + 1);
  } else {
    G.missionIdx = MISSIONS.length;
    G.state = 'complete';
    G.completeT = 0;
  }
}

// Check the active mission's objective every frame.
export function updateMissions(G, dt) {
  const m = MISSIONS[G.missionIdx];
  if (!m) return;
  const p = G.player;
  const near = (pt, r) => pt && Math.hypot(p.x - pt.x, p.y - pt.y) < r;
  if (m.type === 'steal') {
    if (!p.onFoot) completeMission(G);
    return;
  }
  if (m.type === 'goto') {
    if (near(G.world[m.target], 70)) completeMission(G);
    return;
  }
  if (m.type === 'pickup') {
    if (G.missionStage === 0 && near(G.world[m.pickup], 70)) {
      G.missionStage = 1;
      showMessage(G, 'Package picked up. Now deliver it to Palm Heights.');
      if (G.playPickup) G.playPickup();
    } else if (G.missionStage === 1 && near(G.world[m.target], 70)) {
      completeMission(G);
    }
    return;
  }
  if (m.type === 'escape') {
    if (G.wanted === 0) completeMission(G);
    return;
  }
  if (m.type === 'heist') {
    if (G.missionStage === 0) {
      if (near(G.world[m.target], 80)) {
        G.missionT += dt;
        if (G.missionT >= m.holdTime) {
          G.missionStage = 1;
          G.missionT = 0;
          showMessage(G, 'Vault cracked. Run — get to the safehouse!');
        }
      } else {
        G.missionT = Math.max(0, G.missionT - dt * 0.5);
      }
    } else if (near(G.world[m.escape], 70)) {
      completeMission(G);
    }
  }
}

// Save progress: cash, story step, position and health.
export function saveGame(G) {
  try {
    window.localStorage.setItem('solmar-bay-save', JSON.stringify({
      cash: G.player.cash,
      missionIdx: Math.min(G.missionIdx, MISSIONS.length - 1),
      x: G.player.x,
      y: G.player.y,
      health: G.player.health,
      kills: G.stats.kills,
      carsStolen: G.stats.carsStolen,
    }));
  } catch (err) { /* storage is best-effort */ }
}

export function loadGame(G) {
  try {
    const raw = window.localStorage.getItem('solmar-bay-save');
    if (!raw) return false;
    const s = JSON.parse(raw);
    G.player.cash = s.cash || 0;
    G.player.x = s.x || G.world.spawn.x;
    G.player.y = s.y || G.world.spawn.y;
    G.player.health = s.health || 100;
    G.stats.kills = s.kills || 0;
    G.stats.carsStolen = s.carsStolen || 0;
    startMission(G, s.missionIdx || 0);
    return true;
  } catch (err) {
    return false;
  }
}
