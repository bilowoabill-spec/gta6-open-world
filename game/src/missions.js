// Missions and story for Solara Bay: four jobs for Mama Rosa, each a
// sequence of steps (drive somewhere, collect, lay low, hold a position,
// escape). Completing a mission pays out, autosaves and starts the next.
import { MISSIONS, SAFEHOUSE } from './config.js';
import { dist } from './rng.js';
import { addWanted } from './police.js';
import { spawnThug } from './traffic.js';

export function createMissions() {
  return {
    index: 0,             // current mission in MISSIONS
    stepIndex: 0,         // current step inside the mission
    active: false,        // a mission is running
    done: false,          // all missions complete
    holdTime: 0,          // progress inside a 'hold' step
    collected: 0,         // packages collected in a 'collect' step
    collectedSet: new Set(),
    heatStarted: false,
    escapeStarted: false,
    introTimer: 0,        // shows the mission title card
    banner: null,         // {title, story} currently displayed
  };
}

export function currentMission(M) { return MISSIONS[M.index] || null; }
export function currentStep(M) {
  const m = currentMission(M);
  return m ? m.steps[M.stepIndex] : null;
}

export function startMissions(G) {
  const M = G.missions;
  M.active = true;
  M.index = 0;
  M.stepIndex = 0;
  M.done = false;
  beginStep(G);
  showIntro(G);
}

export function objectiveText(G) {
  const M = G.missions;
  if (M.done) return 'Story complete — Solara Bay is yours. Free roam!';
  if (!M.active) return 'Press Enter to start the story.';
  const step = currentStep(M);
  if (!step) return '';
  let label = step.label;
  if (step.type === 'collect') label = label.replace(/\(\d+\/\d+\)/, `(${M.collected}/${step.points.length})`);
  if (step.type === 'hold') label += ` (${Math.ceil(step.duration - M.holdTime)}s)`;
  return label;
}

// Where the objective marker sits on the map (for the minimap + arrow).
export function objectivePoint(G) {
  const M = G.missions;
  if (M.done || !M.active) return null;
  const step = currentStep(M);
  if (!step) return null;
  if (step.type === 'collect') {
    for (const pt of step.points) {
      if (!M.collectedSet.has(pt.x + ',' + pt.y)) return pt;
    }
    return step.points[step.points.length - 1];
  }
  return { x: step.x, y: step.y };
}

function beginStep(G) {
  const M = G.missions;
  const step = currentStep(M);
  if (!step) return;
  M.holdTime = 0;
  M.collected = 0;
  M.collectedSet = new Set();
  M.heatStarted = false;
  M.escapeStarted = false;
  if (step.type === 'heat' && !M.heatStarted) {
    M.heatStarted = true;
    addWanted(G, step.wanted, 'the cops made your plates');
  }
  if (step.type === 'escape' && !M.escapeStarted) {
    M.escapeStarted = true;
    addWanted(G, step.wanted, 'bank alarm tripped');
  }
}

function completeStep(G) {
  const M = G.missions;
  const mission = currentMission(M);
  M.stepIndex++;
  if (M.stepIndex >= mission.steps.length) {
    // Mission complete: pay out, autosave, start the next one.
    G.player.money += mission.reward;
    G.sound.cash();
    G.sound.missionDone();
    G.hud.toast(mission.title + ' complete — +$' + mission.reward);
    G.hud.saveGame();
    M.index++;
    M.stepIndex = 0;
    if (M.index >= MISSIONS.length) {
      M.done = true;
      M.active = false;
      // main.js picks up M.done on the next frame and shows the win screen.
      return;
    }
    showIntro(G);
  }
  beginStep(G);
}

function showIntro(G) {
  const M = G.missions;
  const mission = currentMission(M);
  if (!mission) return;
  M.banner = { title: mission.title, story: mission.story };
  M.introTimer = 4.5;
}

export function updateMissions(G, dt) {
  const M = G.missions;
  if (M.introTimer > 0) {
    M.introTimer -= dt;
    if (M.introTimer <= 0) M.banner = null;
  }
  if (!M.active || M.done) return;
  const p = G.player;
  const step = currentStep(M);
  if (!step) return;

  if (step.type === 'goto' || step.type === 'driveTo') {
    const ok = step.type === 'goto' || !p.onFoot;
    if (ok && dist(p.x, p.y, step.x, step.y) < step.radius) completeStep(G);
  } else if (step.type === 'collect') {
    for (const pt of step.points) {
      const key = pt.x + ',' + pt.y;
      if (!M.collectedSet.has(key) && dist(p.x, p.y, pt.x, pt.y) < step.radius) {
        M.collectedSet.add(key);
        M.collected++;
        G.sound.pickup();
        G.hud.toast(`Package ${M.collected}/${step.points.length} collected`);
        if (M.collected === step.points.length) {
          // Ambush at the last package: thugs want them back.
          spawnThug(G, pt.x + 90, pt.y + 40);
          spawnThug(G, pt.x - 80, pt.y + 70);
          G.hud.toast('Ambush! Take them down!');
        }
      }
    }
    if (M.collected >= step.points.length) completeStep(G);
  } else if (step.type === 'hold') {
    if (dist(p.x, p.y, step.x, step.y) < step.radius) {
      M.holdTime += dt;
      if (M.holdTime >= step.duration) completeStep(G);
    } else {
      M.holdTime = Math.max(0, M.holdTime - dt * 2);
    }
  } else if (step.type === 'heat') {
    // Reach the safehouse, then the wanted level has to fall to zero.
    if (dist(p.x, p.y, step.x, step.y) < step.radius && G.police.stars === 0) {
      completeStep(G);
    }
  } else if (step.type === 'escape') {
    if (dist(p.x, p.y, step.x, step.y) < step.radius && G.police.stars <= 1) {
      completeStep(G);
    }
  }
}

// Restore mission progress from a save (index only; steps restart).
export function restoreMissions(G, missionIndex) {
  const M = G.missions;
  M.index = Math.min(missionIndex, MISSIONS.length - 1);
  M.stepIndex = 0;
  M.done = false;
  M.active = true;
  beginStep(G);
  showIntro(G);
}
