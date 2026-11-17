// Solmar Bay — tuning constants for the whole game. One place for every number
// a designer would want to tweak: city size, speeds, wanted rules, mission pay.
export const STEP = 1 / 60;
export const CITY = {
  size: 420,
  block: 44,
  road: 14,
  beachAt: 186,
  seaAt: 210,
};
export const PLAYER = {
  walkSpeed: 6,
  runSpeed: 10.5,
  radius: 0.6,
  maxHealth: 100,
  maxArmor: 100,
  punchDamage: 25,
  punchRange: 2.4,
};
export const CAR = {
  accel: 24,
  brake: 36,
  reverseAccel: 13,
  maxSpeed: 40,
  maxReverse: 11,
  steer: 2.0,
  drag: 0.55,
};
export const WANTED = {
  maxStars: 5,
  decaySeconds: 12,
  stealStars: 1,
  hitPedStars: 2,
  shootStars: 2,
};
export const MISSION_PAY = [500, 800, 1200, 1500, 2000, 5000];
export const COLORS = {
  skyTop: 0x35548f,
  skyHorizon: 0xff9a5c,
  sun: 0xffd27a,
  sea: 0x1e6f8e,
  sand: 0xe8c98a,
  asphalt: 0x2e2e33,
  sidewalk: 0x8f8f8a,
  building: [0xd8b48a, 0xc98f6a, 0xe8d8b0, 0x9ab8c8, 0xd98a7a, 0xb8a8d8, 0x7fb8a0],
};
export const SAVE_KEY = 'solmar-bay-save-v1';
export const BEST_KEY = 'solmar-bay-best-v1';
