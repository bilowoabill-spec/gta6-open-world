// The Solara Bay Police Department: a wanted level that rises with crime,
// patrol cars and foot cops that chase the player, and the bust that ends
// the run when they catch you.
import { POLICE, CAR_MODELS, SAFEHOUSE } from './config.js';
import { clamp, dist, angleDiff } from './rng.js';
import { randomRoadPoint, resolveCollision } from './world.js';
import { hurtPlayer } from './player.js';

export function createPolice() {
  return {
    stars: 0,
    points: 0,            // crime points; 100 points = 1 star
    lastCrimeAt: -999,
    decayTimer: 0,
    cops: [],             // foot cops {x, y, angle, touchTime}
    copCars: [],          // police cars (live in G.traffic.cars with driver 'police')
    spawnTimer: 0,
    siren: false,
  };
}

// A crime happened. `kind` is only for the toast text.
export function addWanted(G, stars, kind) {
  const pol = G.police;
  if (pol.stars >= POLICE.maxStars) return;
  pol.points += stars * 100;
  pol.lastCrimeAt = G.time;
  const newStars = Math.min(POLICE.maxStars, Math.floor(pol.points / 100));
  if (newStars > pol.stars) {
    pol.stars = newStars;
    G.hud.toast('Wanted level: ' + '★'.repeat(pol.stars) + ' — ' + kind);
    G.sound.siren(true);
  }
}

export function nearestCopDist(G, x, y) {
  let best = Infinity;
  for (const c of G.police.cops) best = Math.min(best, dist(x, y, c.x, c.y));
  for (const car of G.police.copCars) best = Math.min(best, dist(x, y, car.x, car.y));
  return best;
}

export function updatePolice(G, dt) {
  const pol = G.police;
  const p = G.player;
  if (p.dead || p.busted) { G.sound.siren(false); return; }

  // Wanted decays when the player stays clean and out of sight. Inside the
  // safehouse the cops lose the trail, so the heat falls twice as fast.
  if (pol.stars > 0 && G.time - pol.lastCrimeAt > POLICE.decayDelay) {
    const inSafehouse = dist(p.x, p.y, SAFEHOUSE.x, SAFEHOUSE.y) < 130;
    const hidden = inSafehouse || nearestCopDist(G, p.x, p.y) > 420;
    if (hidden) {
      pol.decayTimer += dt;
      const interval = inSafehouse ? 5 : POLICE.decayInterval;
      if (pol.decayTimer >= interval) {
        pol.decayTimer = 0;
        pol.stars -= 1;
        pol.points = pol.stars * 100;
        if (pol.stars === 0) { G.sound.siren(false); G.hud.toast('You lost the cops.'); }
      }
    } else {
      pol.decayTimer = 0;
    }
  }

  // Spawn police to match the wanted level.
  pol.spawnTimer -= dt;
  const wantCops = pol.stars === 0 ? 0 : pol.stars <= 2 ? pol.stars : pol.stars + 1;
  const wantCars = pol.stars >= 2 ? Math.min(3, pol.stars - 1) : 0;
  if (pol.spawnTimer <= 0) {
    pol.spawnTimer = 1.5;
    if (pol.cops.length < wantCops) spawnCop(G);
    if (pol.copCars.length < wantCars) spawnCopCar(G);
    // Despawn far-away cops when the heat is gone.
    if (pol.stars === 0) {
      pol.cops = pol.cops.filter((c) => dist(c.x, c.y, p.x, p.y) < 600);
      pol.copCars = pol.copCars.filter((c) => {
        if (dist(c.x, c.y, p.x, p.y) >= 600) { c.driver = null; c.police = false; return false; }
        return true;
      });
    }
  }

  // Foot cops run at the player and try to arrest them. Inside the
  // safehouse the cops have lost the trail: they mill around the block
  // instead of chasing, and they cannot make an arrest there.
  const inSafehouse = dist(p.x, p.y, SAFEHOUSE.x, SAFEHOUSE.y) < 130;
  for (const cop of pol.cops) {
    const d = dist(cop.x, cop.y, p.x, p.y);
    if (inSafehouse) {
      cop.touchTime = 0;
      cop.angle += 0.6 * dt;
      const nx = cop.x + Math.cos(cop.angle) * 40 * dt;
      const ny = cop.y + Math.sin(cop.angle) * 40 * dt;
      const probe = { x: nx, y: ny };
      resolveCollision(G.city, probe, 12);
      cop.x = probe.x; cop.y = probe.y;
      continue;
    }
    const a = Math.atan2(p.y - cop.y, p.x - cop.x);
    cop.angle = a;
    if (d > 30) {
      cop.x += Math.cos(a) * POLICE.copSpeed * dt;
      cop.y += Math.sin(a) * POLICE.copSpeed * dt;
      resolveCollision(G.city, cop, 12);
      cop.touchTime = 0;
    } else {
      // On top of the player: arrest clock runs.
      cop.touchTime += dt;
      if (p.onFoot) {
        hurtPlayer(G, 6 * dt);
        if (cop.touchTime >= POLICE.arrestTime && !p.dead) {
          p.busted = true;
          G.sound.busted();
          G.sound.siren(false);
        }
      } else {
        // Yank the player out of the car.
        cop.touchTime += dt;
        if (cop.touchTime >= POLICE.arrestTime * 1.6) {
          p.busted = true;
          G.sound.busted();
          G.sound.siren(false);
        }
      }
    }
  }

  // Police cars ram the player's car, or chase on foot speed when close.
  // Inside the safehouse they have lost the trail and roll to a stop.
  for (const car of pol.copCars) {
    if (car.wrecked) continue;
    const d = dist(car.x, car.y, p.x, p.y);
    const targetAngle = Math.atan2(p.y - car.y, p.x - car.x);
    const turn = clamp(angleDiff(car.angle, targetAngle), -1, 1);
    car.angle += turn * 2.4 * dt;
    const speed = inSafehouse ? 0 : (d > 120 ? POLICE.copCarSpeed : 260);
    car.speed += clamp(speed - car.speed, -500 * dt, 420 * dt);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const probe = { x: nx, y: ny };
    resolveCollision(G.city, probe, 18);
    car.x = probe.x; car.y = probe.y;
    // Ram the player's car (never while the player is hiding).
    if (!inSafehouse && !p.onFoot && p.car && dist(car.x, car.y, p.car.x, p.car.y) < 46) {
      p.car.health -= 22 * dt;
      p.car.speed *= 0.985;
      if (p.car.health <= 0 && !p.car.wrecked) {
        p.car.wrecked = true;
        p.car.speed = 0;
        p.car = null;
        p.onFoot = true;
        G.sound.crash();
        G.hud.toast('Your car is wrecked!');
      }
    }
  }
  G.sound.updateSiren(dt);
}

function spawnCop(G) {
  const p = G.player;
  const pt = randomRoadPoint(G.rng, p.x, p.y, 450);
  G.police.cops.push({ x: pt.x, y: pt.y, angle: 0, touchTime: 0 });
}

export function spawnCopCar(G, atX, atY) {
  const p = G.player;
  const pt = atX !== undefined ? { x: atX, y: atY } : randomRoadPoint(G.rng, p.x, p.y, 550);
  const car = {
    x: pt.x, y: pt.y,
    angle: Math.atan2(p.y - pt.y, p.x - pt.x),
    speed: 200,
    model: { name: 'Interceptor', color: '#20242c', top: POLICE.copCarSpeed, accel: 520 },
    color: '#20242c',
    parked: false,
    driver: 'police',
    police: true,
    health: 200,
    wrecked: false,
    stolen: false,
    targetAngle: 0,
    brakeLight: false,
  };
  G.traffic.cars.push(car);
  G.police.copCars.push(car);
  return car;
}
