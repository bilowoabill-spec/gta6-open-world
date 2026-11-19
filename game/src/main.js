// Solara Bay — main loop and wiring. Builds the world, runs the states
// (menu, playing, paused, game over, win), updates every system and draws
// each frame. Exposes window.__solara for automated smoke tests.
import { WORLD } from './config.js';
import { makeRng, clamp } from './rng.js';
import { buildCity, hitBuilding } from './world.js';
import { SoundEngine } from './audio.js';
import { Input } from './input.js';
import { createPlayer, updatePlayer, hurtPlayer } from './player.js';
import { createTraffic, updateTraffic, scarePeds } from './traffic.js';
import { createPolice, updatePolice, nearestCopDist, addWanted } from './police.js';
import { createMissions, updateMissions, startMissions } from './missions.js';
import { drawWorld } from './render.js';
import { Hud } from './hud.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

const params = new URLSearchParams(location.search);
const shot = params.get('shot');
const seed = Number(params.get('seed') || 20261119);

const G = {
  time: 0,
  state: 'menu', // menu | playing | paused | over | win
  rng: makeRng(seed),
  city: buildCity(seed),
  player: createPlayer(),
  traffic: null,
  police: createPolice(),
  missions: createMissions(),
  input: new Input(canvas),
  sound: new SoundEngine(),
  bullets: [],
  particles: [],
  shake: 0,
  camera: { x: 0, y: 0 },
  viewW: canvas.width,
  viewH: canvas.height,
  hud: null,
};
G.traffic = createTraffic(G.city, G.rng);
G.hud = new Hud(G);
// Nearest-cop helper and crime reporter the player module uses.
G.police.nearestCopDist = (x, y) => nearestCopDist(G, x, y);
G.police.addWanted = (stars, kind) => addWanted(G, stars, kind);

G.startStory = function () {
  resetWorld(G);
  G.missions.active = true;
  startMissions(G);
  G.state = 'playing';
};

G.startFreeRoam = function () {
  resetWorld(G);
  G.missions.active = false;
  G.state = 'playing';
};

// Fresh world for a new run (keeps the same city layout).
function resetWorld(G) {
  G.player = createPlayer();
  G.traffic = createTraffic(G.city, G.rng);
  G.police = createPolice();
  G.police.nearestCopDist = (x, y) => nearestCopDist(G, x, y);
  G.police.addWanted = (stars, kind) => addWanted(G, stars, kind);
  G.missions = createMissions();
  G.bullets = [];
  G.particles = [];
  G.time = 0;
}

G.resetRun = function () {
  resetWorld(G);
  startMissions(G);
  G.state = 'playing';
};

function update(dt) {
  const p = G.player;
  // Pause / mute / restart keys.
  if (G.input.wasPressed('p', 'escape')) {
    if (G.state === 'playing') { G.state = 'paused'; G.hud.showPause(); }
    else if (G.state === 'paused') { G.state = 'playing'; G.hud.hideMenu(); }
  }
  if (G.input.wasPressed('m')) G.sound.setMuted(!G.sound.muted);
  if (G.state !== 'playing') return;

  G.time += dt;
  updatePlayer(G, dt);
  updateTraffic(G, dt);
  updatePolice(G, dt);
  updateMissions(G, dt);
  updateBullets(G, dt);

  // Particles age out.
  for (const pt of G.particles) pt.life -= dt;
  G.particles = G.particles.filter((pt) => pt.life > 0);
  G.shake = Math.max(0, G.shake - dt * 26);

  // Camera follows the player, clamped to the world.
  const tx = clamp(p.x - G.viewW / 2, 0, WORLD.size - G.viewW);
  const ty = clamp(p.y - G.viewH / 2, 0, WORLD.size - G.viewH);
  G.camera.x += (tx - G.camera.x) * Math.min(1, dt * 5);
  G.camera.y += (ty - G.camera.y) * Math.min(1, dt * 5);

  // Engine hum follows the driven car.
  if (!p.onFoot && p.car) G.sound.engine(Math.abs(p.car.speed) / p.car.model.top);
  else G.sound.engine(0);

  // End states.
  if (p.dead && G.state === 'playing') { G.state = 'over'; G.hud.showGameOver(false); }
  if (p.busted && G.state === 'playing') { G.state = 'over'; G.hud.showGameOver(true); }
  if (G.missions.done && G.state === 'playing') { G.state = 'win'; G.hud.showWin(); }
}

function updateBullets(G, dt) {
  const p = G.player;
  for (const b of G.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    // Buildings stop bullets.
    if (hitBuilding(G.city, b.x, b.y, 2)) { b.life = 0; continue; }
    if (b.fromPlayer) {
      // Hit a thug?
      for (const th of G.traffic.thugs) {
        if (th.alive && Math.hypot(th.x - b.x, th.y - b.y) < 14) {
          th.health -= b.damage;
          b.life = 0;
          G.particles.push({ x: b.x, y: b.y, life: 0.3, max: 0.3, kind: 'hit' });
          if (th.health <= 0) th.alive = false;
          break;
        }
      }
      if (b.life <= 0) continue;
      // Hit a pedestrian? That is a crime.
      for (const ped of G.traffic.peds) {
        if (ped.alive && Math.hypot(ped.x - b.x, ped.y - b.y) < 10) {
          ped.alive = false; ped.dead = true;
          b.life = 0;
          G.police.addWanted(1, 'shot a pedestrian');
          scarePeds(G, ped.x, ped.y, 300);
          G.particles.push({ x: ped.x, y: ped.y, life: 0.5, max: 0.5, kind: 'poof' });
          break;
        }
      }
      if (b.life <= 0) continue;
      // Hit a cop? That is a bigger crime.
      for (const cop of G.police.cops) {
        if (Math.hypot(cop.x - b.x, cop.y - b.y) < 12) {
          b.life = 0;
          G.police.cops.splice(G.police.cops.indexOf(cop), 1);
          G.police.addWanted(2, 'shot a cop');
          scarePeds(G, cop.x, cop.y, 300);
          break;
        }
      }
      if (b.life <= 0) continue;
      // Hit a car?
      for (const car of G.traffic.cars) {
        if (car.wrecked) continue;
        if (Math.hypot(car.x - b.x, car.y - b.y) < 24) {
          car.health -= b.damage;
          b.life = 0;
          if (car.health <= 0) {
            car.wrecked = true;
            car.speed = 0;
            G.particles.push({ x: car.x, y: car.y, life: 0.6, max: 0.6, kind: 'poof' });
            if (car.driver === 'player') {
              G.player.car = null;
              G.player.onFoot = true;
              G.hud.toast('Your car is wrecked!');
            }
          }
          break;
        }
      }
    } else {
      // Enemy bullet: only the player can be hit.
      if (!p.dead && !p.busted && Math.hypot(p.x - b.x, p.y - b.y) < 14) {
        hurtPlayer(G, b.damage);
        b.life = 0;
      }
    }
  }
  G.bullets = G.bullets.filter((b) => b.life > 0);
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - (frame.last || now)) / 1000 || 0.016);
  frame.last = now;
  G.viewW = canvas.width;
  G.viewH = canvas.height;
  update(dt);
  if (G.state === 'playing' || G.state === 'paused' || G.state === 'over' || G.state === 'win') {
    drawWorld(ctx, G, G.viewW, G.viewH);
    G.hud.update(dt);
  } else {
    // Menu: draw the city behind the title.
    drawWorld(ctx, G, G.viewW, G.viewH);
    G.hud.update(dt);
  }
  G.input.endFrame();
}

// Staged screenshot scenes, or the normal menu.
if (shot) {
  stageShot(G, shot);
  // Let the world settle for a moment before the first paint.
  G.camera.x = clamp(G.player.x - G.viewW / 2, 0, WORLD.size - G.viewW);
  G.camera.y = clamp(G.player.y - G.viewH / 2, 0, WORLD.size - G.viewH);
} else {
  G.hud.showStart();
}

requestAnimationFrame(frame);

// Test hook for the automated smoke test (invisible in play).
window.__solara = {
  G,
  state: () => G.state,
  player: () => ({ x: G.player.x, y: G.player.y, onFoot: G.player.onFoot, health: G.player.health, money: G.player.money }),
  wanted: () => G.police.stars,
  mission: () => ({ index: G.missions.index, step: G.missions.stepIndex, done: G.missions.done }),
  counts: () => ({ cars: G.traffic.cars.length, peds: G.traffic.peds.filter((w) => w.alive).length, cops: G.police.cops.length, copCars: G.police.copCars.length }),
};
