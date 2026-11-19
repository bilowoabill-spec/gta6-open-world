// Screenshot staging for Solara Bay: ?shot=start|drive|chase|mission puts
// the game into a deterministic, photogenic state so the screenshots the
// entry ships show the city, the HUD, traffic, police and missions at
// their best. The game itself is unchanged — these are just starting
// positions picked from a fixed seed.
import { addWanted, spawnCopCar } from './police.js';
import { startMissions } from './missions.js';

export function stageShot(G, shot) {
  const p = G.player;
  if (shot === 'start') {
    // Title screen over downtown.
    G.state = 'menu';
    G.camera.x = 1600 - G.viewW / 2;
    G.camera.y = 1500 - G.viewH / 2;
    G.hud.showStart();
    return;
  }

  // Every other shot is live gameplay with the HUD on.
  G.state = 'playing';
  G.hud.hideMenu();

  if (shot === 'drive') {
    // Jax in a red Comet on the main avenue, traffic around him.
    const car = G.traffic.cars.find((c) => c.model.name === 'Comet' && c.parked) || G.traffic.cars[0];
    p.x = car.x; p.y = car.y;
    p.car = car; p.onFoot = false;
    car.driver = 'player';
    car.parked = false;
    car.angle = 0;
    car.speed = 260;
    car.x = 1480; car.y = 1160;
    p.x = car.x; p.y = car.y;
    // A few traffic cars ahead and behind.
    const near = G.traffic.cars.filter((c) => c !== car).slice(0, 6);
    near.forEach((c, i) => {
      c.x = 1480 + (i % 2 === 0 ? 260 + i * 60 : -240 - i * 50);
      c.y = 1160 + (i % 2 === 0 ? -17 : 17);
      c.angle = i % 2 === 0 ? 0 : Math.PI;
      c.speed = 120;
      c.driver = 'traffic';
      c.parked = false;
    });
    startMissions(G);
  } else if (shot === 'chase') {
    // Three-star chase: Jax fleeing in a car, two interceptors on him.
    const car = G.traffic.cars.find((c) => c.model.name === 'Sunbeam' && c.parked) || G.traffic.cars[0];
    p.x = car.x; p.y = car.y;
    p.car = car; p.onFoot = false;
    car.driver = 'player';
    car.parked = false;
    car.angle = 0;
    car.speed = 380;
    car.x = 1160; car.y = 1800;
    p.x = car.x; p.y = car.y;
    addWanted(G, 3, 'bank job gone loud');
    // Two police cars right behind.
    const cop1 = spawnCopCar(G, 1040, 1783);
    const cop2 = spawnCopCar(G, 950, 1817);
    cop1.angle = 0; cop1.speed = 420;
    cop2.angle = 0; cop2.speed = 420;
    // A foot cop on the sidewalk for good measure.
    if (G.police.cops[0]) { G.police.cops[0].x = 1300; G.police.cops[0].y = 1740; }
    startMissions(G);
  } else if (shot === 'mission') {
    // On foot at the first package, peds and traffic around, objective live.
    p.x = 800; p.y = 800;
    p.onFoot = true;
    p.car = null;
    p.angle = Math.PI / 4;
    startMissions(G);
    // Jump the story to mission 2's collect step for the package marker.
    G.missions.index = 1;
    G.missions.stepIndex = 0;
    G.missions.active = true;
    G.missions.banner = { title: 'Mission 2 — Package Run', story: 'Three packages, three corners of the bay.' };
    G.missions.introTimer = 4.5;
  }
}
