// The player: Jax Marlowe. On foot he walks, sprints and shoots toward the
// mouse; in a car he drives it. E gets in and out of the nearest car.
import { PLAYER, CAR, PLAYER_SPAWN, START_MONEY } from './config.js';
import { clamp, dist } from './rng.js';
import { resolveCollision } from './world.js';

export function createPlayer() {
  return {
    x: PLAYER_SPAWN.x, y: PLAYER_SPAWN.y,
    angle: -Math.PI / 2,
    health: PLAYER.health,
    money: START_MONEY,
    onFoot: true,
    car: null,          // car object being driven, or null
    speed: 0,
    fireCooldown: 0,
    hurtFlash: 0,
    dead: false,
    busted: false,
  };
}

// Find the nearest drivable car within reach.
export function nearestCar(cars, x, y, maxDist) {
  let best = null, bestD = maxDist;
  for (const c of cars) {
    if (c.wrecked || c.police) continue;
    const d = dist(x, y, c.x, c.y);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

export function updatePlayer(G, dt) {
  const p = G.player;
  const input = G.input;
  if (p.dead || p.busted) return;
  p.fireCooldown = Math.max(0, p.fireCooldown - dt);
  p.hurtFlash = Math.max(0, p.hurtFlash - dt);

  if (p.onFoot) {
    updateOnFoot(G, dt);
  } else if (p.car) {
    updateDriving(G, dt);
  }

  // Entering / leaving cars.
  if (input.wasPressed('e')) {
    if (p.onFoot) {
      const car = nearestCar(G.traffic.cars, p.x, p.y, 60);
      if (car) {
        p.car = car;
        p.onFoot = false;
        car.driver = 'player';
        car.stolen = true;
        G.sound.click();
        if (G.police.nearestCopDist(p.x, p.y) < 500) G.police.addWanted(1, 'car theft');
        G.hud.toast('You took the ' + car.model.name);
      }
    } else if (p.car) {
      const car = p.car;
      car.driver = null;
      car.speed = 0;
      p.car = null;
      p.onFoot = true;
      // Step out to the side of the car.
      p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
      p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
      resolveCollision(G.city, p, PLAYER.radius);
      G.sound.click();
    }
  }

  if (p.health <= 0) {
    p.health = 0;
    p.dead = true;
    G.sound.busted();
  }
}

function updateOnFoot(G, dt) {
  const p = G.player;
  const input = G.input;
  const mv = input.moveVector();
  const sprint = input.down('shift');
  const speed = sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
  p.x += mv.x * speed * dt;
  p.y += mv.y * speed * dt;
  resolveCollision(G.city, p, PLAYER.radius);
  // Aim at the mouse.
  const wx = G.camera.x + input.mouseX;
  const wy = G.camera.y + input.mouseY;
  p.angle = Math.atan2(wy - p.y, wx - p.x);
  // Shoot.
  if (input.mouseDown && p.fireCooldown <= 0) {
    p.fireCooldown = PLAYER.fireInterval;
    G.bullets.push({
      x: p.x + Math.cos(p.angle) * 20, y: p.y + Math.sin(p.angle) * 20,
      vx: Math.cos(p.angle) * PLAYER.bulletSpeed, vy: Math.sin(p.angle) * PLAYER.bulletSpeed,
      life: PLAYER.pistolRange / PLAYER.bulletSpeed,
      damage: PLAYER.pistolDamage, fromPlayer: true,
    });
    G.sound.shot();
    G.particles.push({ x: p.x + Math.cos(p.angle) * 24, y: p.y + Math.sin(p.angle) * 24, life: 0.08, max: 0.08, kind: 'flash' });
    G.police.addWanted(1, 'gunfire');
  }
}

function updateDriving(G, dt) {
  const p = G.player;
  const car = p.car;
  const input = G.input;
  const fwd = input.down('w', 'arrowup');
  const back = input.down('s', 'arrowdown');
  const left = input.down('a', 'arrowleft');
  const right = input.down('d', 'arrowright');

  if (fwd) car.speed += car.model.accel * dt;
  else if (back) car.speed -= (car.speed > 0 ? CAR.brake : CAR.reverseAccel) * dt;
  else {
    // Coast down.
    const drag = CAR.drag * car.speed * dt;
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), Math.abs(drag) + 30 * dt);
  }
  car.speed = clamp(car.speed, -CAR.maxReverse, car.model.top);
  // Steering only works while moving; stronger at low speed, gentler at speed.
  const steer = (left ? -1 : 0) + (right ? 1 : 0);
  const spd = Math.abs(car.speed);
  if (steer !== 0 && spd > 5) {
    car.angle += steer * CAR.turnRate * (car.speed >= 0 ? 1 : -1) * clamp(spd / 120, 0.25, 1) * dt;
  }
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  // Blocked by a building or the water: stop with a thud.
  const probe = { x: nx, y: ny };
  resolveCollision(G.city, probe, 20);
  const blocked = Math.abs(probe.x - nx) > 0.5 || Math.abs(probe.y - ny) > 0.5;
  if (blocked) {
    if (spd > 180) { car.health -= 12; G.sound.crash(); G.shake = Math.min(10, G.shake + 5); }
    car.speed *= 0.3;
  }
  car.x = probe.x; car.y = probe.y;
  p.x = car.x; p.y = car.y;
  p.angle = car.angle;
  // Running over a pedestrian is a crime.
  for (const ped of G.traffic.peds) {
    if (!ped.alive) continue;
    if (dist(p.x, p.y, ped.x, ped.y) < 26 && spd > 60) {
      ped.alive = false;
      ped.dead = true;
      G.police.addWanted(1, 'hit pedestrian');
      G.particles.push({ x: ped.x, y: ped.y, life: 0.5, max: 0.5, kind: 'poof' });
    }
  }
  // Engine sound follows speed.
  G.sound.engine(Math.abs(car.speed) / car.model.top);
}

// Damage the player (cops, thugs). Returns true if it killed them.
export function hurtPlayer(G, amount) {
  const p = G.player;
  if (p.dead || p.busted) return false;
  p.health -= amount;
  p.hurtFlash = 0.35;
  G.shake = Math.min(12, G.shake + 4);
  if (p.health <= 0) { p.health = 0; p.dead = true; G.sound.busted(); return true; }
  return false;
}
