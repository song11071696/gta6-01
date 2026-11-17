// The city of Solmar Bay itself: procedural sunset coastal city built from three.js
// boxes, canvas window textures and a few primitives. Roads on a grid, towers and
// shops between them, palm-lined beach and ocean to the east, a low orange sun,
// warm fog and long shadows. Also owns the collision boxes and the road test the
// cars and pedestrians use. No network: every texture is drawn on a canvas here.
import * as THREE from '../vendor/three.module.min.js';
import { CITY, COLORS } from './config.js';

const ROAD_PITCH = CITY.block;
const HALF = CITY.size / 2;

function windowTexture(random, base, lit) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 256);
  for (let y = 8; y < 248; y += 24) {
    for (let x = 8; x < 120; x += 20) {
      g.fillStyle = random.chance(0.55) ? lit : '#2a2f3a';
      g.fillRect(x, y, 13, 15);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function roadCenters() {
  const list = [];
  for (let v = -HALF + ROAD_PITCH / 2; v <= HALF - ROAD_PITCH / 2; v += ROAD_PITCH) list.push(v);
  return list;
}

export function createCity(scene, random) {
  const colliders = [];
  const centers = roadCenters();
  const group = new THREE.Group();
  scene.add(group);

  // Sky, sun, fog and light: a low warm sun over the sea, orange horizon haze.
  scene.background = new THREE.Color(COLORS.skyHorizon);
  scene.fog = new THREE.Fog(0xe8906a, 180, 520);
  const hemi = new THREE.HemisphereLight(0xffd9b0, 0x3a4a6a, 1.35);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(COLORS.sun, 2.0);
  sun.position.set(260, 90, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -240;
  sun.shadow.camera.right = 240;
  sun.shadow.camera.top = 240;
  sun.shadow.camera.bottom = -240;
  scene.add(sun);
  const sunBall = new THREE.Mesh(
    new THREE.SphereGeometry(18, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8, fog: false }),
  );
  sunBall.position.set(320, 70, 40);
  scene.add(sunBall);

  // Ground: city slab, sand strip, ocean plane.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.size + 60, CITY.size + 60),
    new THREE.MeshStandardMaterial({ color: 0x6f6f68, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(60, CITY.size + 60),
    new THREE.MeshStandardMaterial({ color: COLORS.sand, roughness: 1 }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(CITY.beachAt + 18, 0.05, 0);
  sand.receiveShadow = true;
  group.add(sand);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(300, CITY.size + 200),
    new THREE.MeshStandardMaterial({ color: COLORS.sea, roughness: 0.25, metalness: 0.35 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(CITY.seaAt + 150, 0.02, 0);
  group.add(sea);

  // Roads: dark asphalt strips + pale centre dashes, one per grid line.
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x404048, roughness: 0.95 });
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xd8c86a });
  for (const c of centers) {
    for (const horizontal of [true, false]) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(CITY.size, CITY.road), roadMat);
      road.rotation.x = -Math.PI / 2;
      if (horizontal) { road.position.set(0, 0.1, c); }
      else { road.rotation.z = Math.PI / 2; road.position.set(c, 0.1, 0); }
      road.receiveShadow = true;
      group.add(road);
      for (let d = -HALF + 12; d < HALF; d += 24) {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(5, 0.5), dashMat);
        dash.rotation.x = -Math.PI / 2;
        if (horizontal) { dash.position.set(d, 0.12, c); }
        else { dash.rotation.z = Math.PI / 2; dash.position.set(c, 0.12, d); }
        group.add(dash);
      }
    }
  }

  // Buildings: varied towers, shops and hotels filling each block, with lit windows.
  const texA = windowTexture(random, '#c8a882', '#ffd98a');
  const texB = windowTexture(random, '#8fa8bc', '#ffe9b0');
  const texC = windowTexture(random, '#b08a7a', '#ffc890');
  const textures = [texA, texB, texC];
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  let buildingCount = 0;
  for (let bx = 0; bx < centers.length - 1; bx += 1) {
    for (let bz = 0; bz < centers.length - 1; bz += 1) {
      const cx = (centers[bx] + centers[bx + 1]) / 2;
      const cz = (centers[bz] + centers[bz + 1]) / 2;
      if (cx > CITY.beachAt - 30) continue; // beachfront stays open
      if (Math.abs(cx) < 24 && Math.abs(cz) < 24) continue; // central plaza
      if (random.chance(0.12)) continue; // a few empty lots / car parks
      const w = random.range(16, 26);
      const d = random.range(16, 26);
      const nearSea = cx > 120;
      const h = nearSea ? random.range(28, 62) : random.range(10, 42);
      const mat = new THREE.MeshStandardMaterial({
        map: textures[buildingCount % 3],
        color: COLORS.building[buildingCount % COLORS.building.length],
        roughness: 0.85,
      });
      const b = new THREE.Mesh(boxGeo, mat);
      b.scale.set(w, h, d);
      b.position.set(cx, h / 2, cz);
      b.castShadow = true;
      b.receiveShadow = true;
      group.add(b);
      // Rooftop box / antenna on the tall ones.
      if (h > 30) {
        const roof = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: 0x555560 }));
        roof.scale.set(4, 3, 4);
        roof.position.set(cx, h + 1.5, cz);
        group.add(roof);
      }
      colliders.push({ x: cx, z: cz, hx: w / 2 + 0.4, hz: d / 2 + 0.4 });
      buildingCount += 1;
    }
  }

  // Central plaza: fountain + the "Solmar Tower" landmark.
  const plaza = new THREE.Mesh(
    new THREE.CylinderGeometry(10, 12, 1.2, 24),
    new THREE.MeshStandardMaterial({ color: 0x9fd8e8, roughness: 0.3 }),
  );
  plaza.position.set(0, 0.6, 0);
  group.add(plaza);
  const tower = new THREE.Mesh(
    boxGeo,
    new THREE.MeshStandardMaterial({ map: texB, color: 0xe8d8b0, roughness: 0.8 }),
  );
  tower.scale.set(26, 78, 26);
  tower.position.set(-60, 39, -60);
  tower.castShadow = true;
  group.add(tower);
  colliders.push({ x: -60, z: -60, hx: 13.4, hz: 13.4 });

  // Palms along the beachfront and the plaza, streetlights along every road.
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5a38, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: COLORS.palm, roughness: 1 });
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.4, 7, 6);
  const leafGeo = new THREE.ConeGeometry(2.6, 3.2, 6);
  function palm(x, z) {
    const t = new THREE.Mesh(trunkGeo, trunkMat);
    t.position.set(x, 3.5, z);
    t.castShadow = true;
    group.add(t);
    const l = new THREE.Mesh(leafGeo, leafMat);
    l.position.set(x, 8, z);
    group.add(l);
  }
  for (let z = -HALF + 10; z < HALF; z += 22) {
    palm(CITY.beachAt - 6, z);
    if (random.chance(0.5)) palm(CITY.beachAt - 14, z + 11);
  }
  for (let i = 0; i < 8; i += 1) palm(random.range(-16, 16), random.range(-16, 16));
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x333338 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (const c of centers) {
    for (let d = -HALF + 20; d < HALF; d += 88) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6, 6), poleMat);
      pole.position.set(c + 8, 3, d);
      group.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), lampMat);
      lamp.position.set(c + 8, 6.2, d);
      group.add(lamp);
    }
  }

  function isRoad(x, z) {
    for (const c of centers) {
      if (Math.abs(z - c) < CITY.road / 2 + 1) return true;
      if (Math.abs(x - c) < CITY.road / 2 + 1) return true;
    }
    return false;
  }
  function collides(x, z, r) {
    for (const c of colliders) {
      if (Math.abs(x - c.x) < c.hx + r && Math.abs(z - c.z) < c.hz + r) return true;
    }
    return false;
  }
  function clampPos(p, r) {
    p.x = Math.max(-HALF + 4, Math.min(CITY.seaAt - 6, p.x));
    p.z = Math.max(-HALF + 4, Math.min(HALF - 4, p.z));
    return p;
  }
  function randomRoadPoint() {
    const c = random.pick(centers);
    const along = random.range(-HALF + 20, HALF - 20);
    return random.chance(0.5) ? { x: along, z: c } : { x: c, z: along };
  }
  return { group, colliders, centers, isRoad, collides, clampPos, randomRoadPoint, buildingCount };
}
