// Solmar Bay — seeded random numbers. One tiny generator drives the whole city:
// the same seed always builds the same streets, buildings, traffic and crowds.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed) {
  const next = mulberry32(seed);
  return {
    next,
    // Float in [min, max).
    range(min, max) {
      return min + next() * (max - min);
    },
    // Integer in [min, max] inclusive.
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    // A random element of an array.
    pick(list) {
      return list[Math.floor(next() * list.length)];
    },
    // True with the given probability.
    chance(p) {
      return next() < p;
    },
  };
}
