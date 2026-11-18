// Solmar Bay — tuning constants. One place for every number the game balances on,
// so a tweak here retunes driving, walking, police and missions together.
export const CFG = {
  WORLD_W: 3600,
  WORLD_H: 2800,
  ROAD_GAP: 400,
  ROAD_W: 96,
  BEACH_X: 3300,
  WATER_X: 3480,

  // On-foot movement
  WALK_SPEED: 205,
  RUN_SPEED: 305,

  // Driving
  CAR_ACCEL: 460,
  CAR_MAX_SPEED: 540,
  CAR_REVERSE_MAX: 220,
  CAR_BRAKE: 700,
  CAR_DRAG: 0.9,
  CAR_TURN: 2.7,
  CAR_LENGTH: 46,
  CAR_WIDTH: 22,

  // Combat and health
  PLAYER_HP: 100,
  BULLET_SPEED: 780,
  BULLET_RANGE: 460,
  FIRE_DELAY: 0.17,
  MELEE_RANGE: 44,
  MELEE_DAMAGE: 30,
  PED_HP: 50,

  // Wanted / police
  WANTED_MAX: 5,
  WANTED_DECAY_BASE: 26,
  BUSTED_TIME: 1.4,
  POLICE_CAR_SPEED: 500,

  // Traffic and crowds
  TRAFFIC_COUNT: 26,
  PED_COUNT: 34,
  PARKED_COUNT: 12,

  // Camera and view
  VIEW_W: 1280,
  VIEW_H: 720,

  COLORS: {
    grass: '#7fae62',
    grassDark: '#74a258',
    road: '#3d3d42',
    roadLine: '#d8c95a',
    sidewalk: '#9a9a92',
    sand: '#e8d39a',
    water: '#2e7fa8',
    waterDeep: '#256b8f',
    park: '#5d9e4a',
    tree: '#2f6b2a',
  },
};

// Mission rewards, in order. The story arc pays more as the heat rises.
export const MISSION_REWARDS = [150, 300, 500, 800, 1500];

// Paint jobs for traffic, parked and stolen cars.
export const CAR_COLORS = [
  '#d84040', '#3a6fd8', '#e8c832', '#e8e8e8', '#222222', '#3fae6a',
  '#e87a20', '#8a4fd8', '#20b8c8', '#c8c8c8', '#5a3a28', '#7a9a3a',
];

// Roof colours for the city's buildings.
export const ROOF_COLORS = [
  '#c96f4a', '#4a7a96', '#8a6fa8', '#b8a24a', '#5a8a6a', '#a85a6a', '#6a6a7a',
];

// Names for the city's districts, shown on the HUD as the player crosses them.
export const DISTRICTS = [
  { x0: 0, y0: 0, x1: 1800, y1: 1400, name: 'Old Marina' },
  { x0: 1800, y0: 0, x1: 3300, y1: 1400, name: 'Palm Heights' },
  { x0: 0, y0: 1400, x1: 1800, y1: 2800, name: 'Harbor District' },
  { x0: 1800, y0: 1400, x1: 3300, y1: 2800, name: 'Sunset Strip' },
  { x0: 3300, y0: 0, x1: 3600, y1: 2800, name: 'Solmar Beach' },
];

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d.name;
  }
  return 'Solmar Bay';
}
