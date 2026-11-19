// Rendering for Solara Bay: the city, cars, people, police, effects and the
// minimap, all drawn on a 2D canvas with a camera that follows the player.
import { WORLD, COLORS } from './config.js';
import { objectivePoint, currentStep } from './missions.js';

export function drawWorld(ctx, G, viewW, viewH) {
  const cam = G.camera;
  const t = G.time;
  ctx.save();
  ctx.clearRect(0, 0, viewW, viewH);
  // Camera shake.
  const shx = (Math.random() - 0.5) * G.shake;
  const shy = (Math.random() - 0.5) * G.shake;
  ctx.translate(-Math.round(cam.x + shx), -Math.round(cam.y + shy));

  drawGround(ctx, G);
  drawBuildings(ctx, G);
  drawMarkers(ctx, G, t);
  drawCars(ctx, G);
  drawPeds(ctx, G);
  drawThugs(ctx, G);
  drawCops(ctx, G);
  drawPlayer(ctx, G);
  drawBullets(ctx, G);
  drawParticles(ctx, G);
  ctx.restore();

  // Hurt vignette.
  if (G.player.hurtFlash > 0) {
    ctx.fillStyle = `rgba(200, 30, 30, ${G.player.hurtFlash * 0.45})`;
    ctx.fillRect(0, 0, viewW, viewH);
  }
}

function drawGround(ctx, G) {
  const city = G.city;
  const cam = G.camera;
  const vw = G.viewW, vh = G.viewH;
  const x0 = Math.max(0, cam.x - 40), y0 = Math.max(0, cam.y - 40);
  const x1 = Math.min(WORLD.size, cam.x + vw + 40), y1 = Math.min(WORLD.size, cam.y + vh + 40);

  // Grass base.
  ctx.fillStyle = COLORS.grass;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  // Beach sand and water on the south edge.
  if (y1 > WORLD.beachY) {
    ctx.fillStyle = COLORS.sand;
    ctx.fillRect(x0, Math.max(y0, WORLD.beachY), x1 - x0, Math.min(y1, WORLD.waterY) - Math.max(y0, WORLD.beachY));
    ctx.fillStyle = COLORS.water;
    ctx.fillRect(x0, Math.max(y0, WORLD.waterY), x1 - x0, y1 - Math.max(y0, WORLD.waterY));
    // Animated wave lines.
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const wy = WORLD.waterY + 14 + i * 26 + Math.sin(G.time * 1.4 + i * 2) * 4;
      ctx.beginPath();
      ctx.moveTo(x0, wy);
      ctx.lineTo(x1, wy);
      ctx.stroke();
    }
  }
  // Parks.
  for (const pk of city.parks) {
    if (pk.x > x1 || pk.x + pk.w < x0 || pk.y > y1 || pk.y + pk.h < y0) continue;
    ctx.fillStyle = COLORS.park;
    ctx.fillRect(pk.x, pk.y, pk.w, pk.h);
  }
  // Parking lots.
  for (const lot of city.lots) {
    if (lot.x > x1 || lot.x + lot.w < x0 || lot.y > y1 || lot.y + lot.h < y0) continue;
    ctx.fillStyle = '#55585f';
    ctx.fillRect(lot.x, lot.y, lot.w, lot.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    for (let bx = lot.x + 20; bx < lot.x + lot.w - 10; bx += 34) {
      ctx.beginPath(); ctx.moveTo(bx, lot.y + 8); ctx.lineTo(bx, lot.y + 30); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx, lot.y + lot.h - 8); ctx.lineTo(bx, lot.y + lot.h - 30); ctx.stroke();
    }
  }
  // Roads: asphalt strips with sidewalks and lane dashes.
  ctx.fillStyle = COLORS.road;
  for (const c of city.lines) {
    if (c > y0 - 60 && c < y1 + 60) ctx.fillRect(x0, c - WORLD.roadWidth / 2, x1 - x0, WORLD.roadWidth);
    if (c > x0 - 60 && c < x1 + 60) ctx.fillRect(c - WORLD.roadWidth / 2, y0, WORLD.roadWidth, y1 - y0);
  }
  ctx.fillStyle = COLORS.sidewalk;
  for (const c of city.lines) {
    if (c > y0 - 60 && c < y1 + 60) {
      ctx.fillRect(x0, c - WORLD.roadWidth / 2 - 7, x1 - x0, 7);
      ctx.fillRect(x0, c + WORLD.roadWidth / 2, x1 - x0, 7);
    }
    if (c > x0 - 60 && c < x1 + 60) {
      ctx.fillRect(c - WORLD.roadWidth / 2 - 7, y0, 7, y1 - y0);
      ctx.fillRect(c + WORLD.roadWidth / 2, y0, 7, y1 - y0);
    }
  }
  // Lane dashes.
  ctx.strokeStyle = COLORS.lane;
  ctx.lineWidth = 3;
  ctx.setLineDash([22, 26]);
  for (const c of city.lines) {
    if (c > y0 - 60 && c < y1 + 60) {
      ctx.beginPath(); ctx.moveTo(x0, c); ctx.lineTo(x1, c); ctx.stroke();
    }
    if (c > x0 - 60 && c < x1 + 60) {
      ctx.beginPath(); ctx.moveTo(c, y0); ctx.lineTo(c, y1); ctx.stroke();
    }
  }
  ctx.setLineDash([]);
  // Trees.
  for (const tr of city.trees) {
    if (tr.x < x0 || tr.x > x1 || tr.y < y0 || tr.y > y1) continue;
    ctx.fillStyle = '#4d7a38';
    ctx.beginPath(); ctx.arc(tr.x, tr.y, tr.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#6aa84f';
    ctx.beginPath(); ctx.arc(tr.x - 3, tr.y - 3, tr.r * 0.7, 0, Math.PI * 2); ctx.fill();
  }
}

function drawBuildings(ctx, G) {
  const cam = G.camera;
  const x0 = cam.x - 60, y0 = cam.y - 60, x1 = cam.x + G.viewW + 60, y1 = cam.y + G.viewH + 60;
  for (const b of G.city.buildings) {
    if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) continue;
    // Drop shadow for height.
    if (b.tall) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(b.x + 8, b.y + 10, b.w, b.h);
    }
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    // Roof details: inner border + vents.
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 3;
    ctx.strokeRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(b.x + 10, b.y + 10, Math.min(26, b.w - 20), Math.min(18, b.h - 20));
    if (b.landmark === 'bank') {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 20px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', b.x + b.w / 2, b.y + b.h / 2 + 7);
    }
    if (b.landmark === 'safehouse') {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 18px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('HOME', b.x + b.w / 2, b.y + b.h / 2 + 6);
    }
  }
}

function drawMarkers(ctx, G, t) {
  const pt = objectivePoint(G);
  if (pt) {
    const pulse = 1 + Math.sin(t * 5) * 0.15;
    ctx.save();
    ctx.translate(pt.x, pt.y);
    ctx.fillStyle = 'rgba(255, 210, 63, 0.25)';
    ctx.beginPath(); ctx.arc(0, 0, 46 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 30 * pulse, 0, Math.PI * 2); ctx.stroke();
    // Diamond marker above the point.
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.moveTo(0, -52 - Math.sin(t * 5) * 6);
    ctx.lineTo(10, -40 - Math.sin(t * 5) * 6);
    ctx.lineTo(0, -28 - Math.sin(t * 5) * 6);
    ctx.lineTo(-10, -40 - Math.sin(t * 5) * 6);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  // Safehouse beacon when it is the objective is the same marker; the
  // bank gets a red ring during the hold step.
  const step = currentStep(G.missions);
  if (step && step.type === 'hold') {
    ctx.strokeStyle = 'rgba(255,80,80,0.8)';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(step.x, step.y, step.radius, 0, Math.PI * 2); ctx.stroke();
  }
}

function drawCarShape(ctx, car, time) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const L = 46, W = 22;
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-L / 2 + 3, -W / 2 + 4, L, W);
  // Body.
  ctx.fillStyle = car.color;
  roundRect(ctx, -L / 2, -W / 2, L, W, 7);
  ctx.fill();
  // Windshield + roof.
  ctx.fillStyle = 'rgba(20,30,40,0.85)';
  ctx.fillRect(4, -W / 2 + 4, 10, W - 8);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(-8, -W / 2 + 4, 8, W - 8);
  // Headlights.
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(L / 2 - 3, -W / 2 + 2, 3, 5);
  ctx.fillRect(L / 2 - 3, W / 2 - 7, 3, 5);
  // Police light bar.
  if (car.police) {
    const flash = Math.floor(time * 6) % 2 === 0;
    ctx.fillStyle = flash ? '#ff2e2e' : '#2e7bff';
    ctx.fillRect(-4, -W / 2 - 2, 8, 5);
    ctx.fillStyle = flash ? '#2e7bff' : '#ff2e2e';
    ctx.fillRect(-4, W / 2 - 3, 8, 5);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 8px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POLICE', 0, 3);
  }
  // Wreck smoke.
  if (car.wrecked) {
    ctx.fillStyle = 'rgba(120,120,120,0.5)';
    ctx.beginPath(); ctx.arc(-6, -4, 9, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawCars(ctx, G) {
  for (const car of G.traffic.cars) drawCarShape(ctx, car, G.time);
}

function drawPeds(ctx, G) {
  for (const ped of G.traffic.peds) {
    if (!ped.alive) continue;
    ctx.save();
    ctx.translate(ped.x, ped.y);
    ctx.rotate(ped.angle);
    ctx.fillStyle = ped.color;
    ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(-3, -3, 6, 6);
    ctx.restore();
  }
}

function drawThugs(ctx, G) {
  for (const thug of G.traffic.thugs) {
    if (!thug.alive) continue;
    ctx.save();
    ctx.translate(thug.x, thug.y);
    ctx.rotate(thug.angle);
    ctx.fillStyle = '#7a2e2e';
    ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.fillRect(6, -2, 14, 4); // gun
    ctx.restore();
    // Health bar.
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(thug.x - 14, thug.y - 22, 28, 4);
    ctx.fillStyle = '#e23b3b';
    ctx.fillRect(thug.x - 14, thug.y - 22, 28 * (thug.health / 60), 4);
  }
}

function drawCops(ctx, G) {
  for (const cop of G.police.cops) {
    ctx.save();
    ctx.translate(cop.x, cop.y);
    ctx.rotate(cop.angle);
    ctx.fillStyle = '#1f3a93';
    ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#dfe6ff';
    ctx.fillRect(-4, -4, 8, 8);
    ctx.restore();
  }
}

function drawPlayer(ctx, G) {
  const p = G.player;
  if (p.dead || p.busted) return;
  if (!p.onFoot) return; // the car drawing shows the driver
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(2, 3, 12, 10, 0, 0, Math.PI * 2); ctx.fill();
  // Body: yellow shirt, dark pants.
  ctx.fillStyle = '#ffcf3f';
  ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#20242c';
  ctx.fillRect(-6, -4, 8, 8);
  // Pistol.
  ctx.fillStyle = '#111';
  ctx.fillRect(8, -2, 12, 4);
  ctx.restore();
  // Direction tick.
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(p.x + Math.cos(p.angle) * 16, p.y + Math.sin(p.angle) * 16);
  ctx.lineTo(p.x + Math.cos(p.angle) * 24, p.y + Math.sin(p.angle) * 24);
  ctx.stroke();
}

function drawBullets(ctx, G) {
  ctx.fillStyle = '#ffe9a8';
  for (const b of G.bullets) {
    ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fill();
  }
}

function drawParticles(ctx, G) {
  for (const pt of G.particles) {
    const a = pt.life / pt.max;
    if (pt.kind === 'flash') {
      ctx.fillStyle = `rgba(255, 220, 120, ${a})`;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, 10 * a + 4, 0, Math.PI * 2); ctx.fill();
    } else if (pt.kind === 'poof') {
      ctx.fillStyle = `rgba(160,160,160,${a * 0.7})`;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, 14 * (1 - a) + 4, 0, Math.PI * 2); ctx.fill();
    } else if (pt.kind === 'hit') {
      ctx.fillStyle = `rgba(255, 80, 60, ${a})`;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, 6 * a + 2, 0, Math.PI * 2); ctx.fill();
    }
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Minimap: the whole city shrunk into a small canvas, with the player,
// the objective, police and traffic as dots.
export function drawMinimap(canvas, G) {
  const ctx = canvas.getContext('2d');
  const S = canvas.width / WORLD.size;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#2c3e50';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // Roads.
  ctx.fillStyle = '#5a5e66';
  for (const c of G.city.lines) {
    ctx.fillRect(c * S - 2, 0, 4, canvas.height);
    ctx.fillRect(0, c * S - 2, canvas.width, 4);
  }
  // Beach + water.
  ctx.fillStyle = '#e6d199';
  ctx.fillRect(0, WORLD.beachY * S, canvas.width, (WORLD.waterY - WORLD.beachY) * S);
  ctx.fillStyle = '#2f7fb8';
  ctx.fillRect(0, WORLD.waterY * S, canvas.width, canvas.height - WORLD.waterY * S);
  // Objective blip.
  const pt = objectivePoint(G);
  if (pt) {
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.arc(pt.x * S, pt.y * S, 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffd23f';
    ctx.beginPath(); ctx.arc(pt.x * S, pt.y * S, 8 + Math.sin(G.time * 5) * 2, 0, Math.PI * 2); ctx.stroke();
  }
  // Police (blue), traffic (grey), player (white arrow).
  ctx.fillStyle = '#2e7bff';
  for (const car of G.police.copCars) { ctx.fillRect(car.x * S - 2, car.y * S - 2, 4, 4); }
  for (const cop of G.police.cops) { ctx.fillRect(cop.x * S - 2, cop.y * S - 2, 4, 4); }
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (const car of G.traffic.cars) {
    if (car.driver === 'traffic') ctx.fillRect(car.x * S - 1, car.y * S - 1, 2, 2);
  }
  const p = G.player;
  ctx.save();
  ctx.translate(p.x * S, p.y * S);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill();
  ctx.restore();
  // Viewport rectangle.
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 1;
  ctx.strokeRect(G.camera.x * S, G.camera.y * S, G.viewW * S, G.viewH * S);
}
