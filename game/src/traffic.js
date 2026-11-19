// Traffic and pedestrians: cars cruise the road grid, pedestrians stroll
// the sidewalks and flee from gunfire, and mission thugs take shots at
// the player. All of it makes the city feel alive.
import { CAR, CAR_MODELS, COLORS } from './config.js';
import { clamp, dist, angleDiff } from './rng.js';
import { isOnRoad, nearestRoadPoint, randomRoadPoint, resolveCollision } from './world.js';

export function createTraffic(city, rng) {
  const cars = [];
  const peds = [];
  const thugs = [];
  // Parked cars along roads.
  for (let i = 0; i < 26; i++) {
    const pt = randomRoadPoint(rng, 0, 0, 0);
    const vertical = pt.vertical;
    const off = (rng.chance(0.5) ? 1 : -1) * 24;
    cars.push(makeCar(rng, {
      x: pt.x + (vertical ? off : 0),
      y: pt.y + (vertical ? 0 : off),
      angle: vertical ? (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (rng.chance(0.5) ? 0 : Math.PI),
      parked: true,
    }));
  }
  // Moving traffic.
  for (let i = 0; i < 16; i++) spawnTrafficCar(cars, rng);
  // Pedestrians on sidewalks.
  for (let i = 0; i < 34; i++) {
    const pt = randomRoadPoint(rng, 0, 0, 0);
    peds.push({
      x: pt.x + rng.range(-70, 70), y: pt.y + rng.range(-70, 70),
      angle: rng.range(0, Math.PI * 2),
      speed: rng.range(28, 55),
      color: rng.pick(COLORS.ped),
      alive: true, dead: false,
      target: null, flee: null, panic: 0,
    });
  }
  return { cars, peds, thugs, spawnTimer: 0 };
}

function makeCar(rng, opts) {
  const model = opts.model || rng.pick(CAR_MODELS);
  return {
    x: opts.x, y: opts.y, angle: opts.angle,
    speed: opts.speed || 0,
    model,
    color: model.color,
    parked: !!opts.parked,
    driver: opts.driver || null,   // 'player' | 'traffic' | 'police' | null
    police: !!opts.police,
    health: CAR.health,
    wrecked: false,
    stolen: false,
    targetAngle: opts.angle,
    brakeLight: false,
  };
}

export function spawnTrafficCar(cars, rng) {
  const pt = randomRoadPoint(rng, 0, 0, 0);
  const car = makeCar(rng, {
    x: pt.x, y: pt.y,
    angle: pt.vertical ? (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (rng.chance(0.5) ? 0 : Math.PI),
    speed: rng.range(90, 150),
    driver: 'traffic',
  });
  // Drive on the right side of the road.
  const lane = 17;
  if (pt.vertical) car.x += Math.cos(car.angle + Math.PI / 2) * lane;
  else car.y += Math.sin(car.angle + Math.PI / 2) * lane;
  cars.push(car);
  return car;
}

export function spawnThug(G, x, y) {
  const thug = {
    x, y, angle: 0,
    health: 60, speed: 150,
    fireCooldown: 1 + Math.random(),
    alive: true,
  };
  G.traffic.thugs.push(thug);
  return thug;
}

export function updateTraffic(G, dt) {
  const t = G.traffic;
  const p = G.player;
  // Keep traffic topped up near the player.
  t.spawnTimer -= dt;
  if (t.spawnTimer <= 0) {
    t.spawnTimer = 2.5;
    const moving = t.cars.filter((c) => c.driver === 'traffic' && !c.wrecked).length;
    if (moving < 14) {
      const pt = randomRoadPoint(G.rng, p.x, p.y, 500);
      const car = makeCar(G.rng, {
        x: pt.x, y: pt.y,
        angle: pt.vertical ? (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (Math.random() < 0.5 ? 0 : Math.PI),
        speed: G.rng.range(90, 150), driver: 'traffic',
      });
      t.cars.push(car);
    }
    const alivePeds = t.peds.filter((w) => w.alive).length;
    if (alivePeds < 26) {
      const pt = randomRoadPoint(G.rng, p.x, p.y, 420);
      t.peds.push({
        x: pt.x + G.rng.range(-70, 70), y: pt.y + G.rng.range(-70, 70),
        angle: G.rng.range(0, Math.PI * 2), speed: G.rng.range(28, 55),
        color: G.rng.pick(COLORS.ped), alive: true, dead: false,
        target: null, flee: null, panic: 0,
      });
    }
  }

  for (const car of t.cars) {
    if (car.wrecked) continue;
    if (car.driver === 'traffic') updateTrafficCar(G, car, dt);
    else if (car.driver === 'police') { /* police.js drives these */ }
    // Player-driven cars are moved by player.js.
  }

  for (const ped of t.peds) updatePed(G, ped, dt);
  for (const thug of t.thugs) updateThug(G, thug, dt);
  t.thugs = t.thugs.filter((th) => th.alive);
}

function updateTrafficCar(G, car, dt) {
  // Slow down for the car ahead in the same lane.
  let targetSpeed = 130;
  for (const other of G.traffic.cars) {
    if (other === car || other.wrecked) continue;
    const dx = other.x - car.x, dy = other.y - car.y;
    const ahead = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
    const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
    if (ahead > 0 && ahead < 70 && side < 26) { targetSpeed = 0; break; }
  }
  // Also stop for the player's car blocking the road.
  const p = G.player;
  if (!p.onFoot && p.car) {
    const dx = p.car.x - car.x, dy = p.car.y - car.y;
    const ahead = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
    const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
    if (ahead > 0 && ahead < 70 && side < 26) targetSpeed = 0;
  }
  car.speed += clamp(targetSpeed - car.speed, -260 * dt, 160 * dt);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  // At an intersection, sometimes turn onto the crossing road.
  const nearX = isOnRoad(car.x, car.y) && isOnRoad(car.x + Math.cos(car.angle) * 40, car.y + Math.sin(car.angle) * 40);
  if (nearX && Math.abs(((car.x % 320) + 320) % 320 - 160) < 24 && Math.abs(((car.y % 320) + 320) % 320 - 160) < 24) {
    if (Math.random() < 0.35) {
      car.angle += (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2;
    }
  }
  // Wrap around the city edges so traffic never runs out.
  if (car.x < 60) car.x = 3140;
  if (car.x > 3140) car.x = 60;
  if (car.y < 60) car.y = 3000;
  if (car.y > 3000) car.y = 60;
  resolveCollision(G.city, car, 18);
}

function updatePed(G, ped, dt) {
  if (!ped.alive) return;
  ped.panic = Math.max(0, ped.panic - dt);
  if (ped.flee) {
    // Run away from the scare.
    const a = Math.atan2(ped.y - ped.flee.y, ped.x - ped.flee.x);
    ped.x += Math.cos(a) * 130 * dt;
    ped.y += Math.sin(a) * 130 * dt;
    ped.angle = a;
    if (dist(ped.x, ped.y, ped.flee.x, ped.flee.y) > 420) ped.flee = null;
  } else {
    if (!ped.target || dist(ped.x, ped.y, ped.target.x, ped.target.y) < 12) {
      const pt = nearestRoadPoint(ped.x + (Math.random() - 0.5) * 500, ped.y + (Math.random() - 0.5) * 500);
      ped.target = { x: pt.x + (Math.random() - 0.5) * 90, y: pt.y + (Math.random() - 0.5) * 90 };
    }
    const a = Math.atan2(ped.target.y - ped.y, ped.target.x - ped.x);
    ped.angle = a;
    ped.x += Math.cos(a) * ped.speed * dt;
    ped.y += Math.sin(a) * ped.speed * dt;
  }
  resolveCollision(G.city, ped, 8);
}

export function scarePeds(G, x, y, radius) {
  for (const ped of G.traffic.peds) {
    if (!ped.alive) continue;
    if (dist(ped.x, ped.y, x, y) < radius) { ped.flee = { x, y }; ped.panic = 3; }
  }
}

function updateThug(G, thug, dt) {
  if (!thug.alive) return;
  const p = G.player;
  const d = dist(thug.x, thug.y, p.x, p.y);
  thug.angle = Math.atan2(p.y - thug.y, p.x - thug.x);
  if (d > 260) {
    // Close the distance.
    thug.x += Math.cos(thug.angle) * thug.speed * dt;
    thug.y += Math.sin(thug.angle) * thug.speed * dt;
    resolveCollision(G.city, thug, 12);
  } else {
    // Hold position and shoot.
    thug.fireCooldown -= dt;
    if (thug.fireCooldown <= 0 && !p.dead && !p.busted) {
      thug.fireCooldown = 0.9 + Math.random() * 0.7;
      G.bullets.push({
        x: thug.x + Math.cos(thug.angle) * 20, y: thug.y + Math.sin(thug.angle) * 20,
        vx: Math.cos(thug.angle) * 700, vy: Math.sin(thug.angle) * 700,
        life: 0.7, damage: 8, fromPlayer: false,
      });
      G.sound.thugShot();
    }
  }
}
