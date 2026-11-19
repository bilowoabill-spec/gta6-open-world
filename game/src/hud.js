// HUD and menus for Solara Bay: health, money, wanted stars, objective
// text, toasts, the start / pause / game-over / win screens, and saving
// the game to localStorage.
import { GAME_TITLE, GAME_SUBTITLE, START_MONEY } from './config.js';
import { objectiveText, restoreMissions } from './missions.js';
import { drawMinimap } from './render.js';

const SAVE_KEY = 'solara-bay-save-v1';

export class Hud {
  constructor(G) {
    this.G = G;
    this.el = {
      health: document.getElementById('health-fill'),
      healthText: document.getElementById('health-text'),
      money: document.getElementById('money'),
      stars: document.getElementById('stars'),
      objective: document.getElementById('objective'),
      speed: document.getElementById('speed'),
      toast: document.getElementById('toast'),
      banner: document.getElementById('mission-banner'),
      bannerTitle: document.getElementById('banner-title'),
      bannerStory: document.getElementById('banner-story'),
      menu: document.getElementById('menu'),
      menuTitle: document.getElementById('menu-title'),
      menuStory: document.getElementById('menu-story'),
      menuButtons: document.getElementById('menu-buttons'),
      minimap: document.getElementById('minimap'),
      hint: document.getElementById('hint'),
    };
    this.toastTimer = 0;
    this.lastToast = '';
  }

  toast(text) {
    if (text === this.lastToast) return;
    this.lastToast = text;
    this.el.toast.textContent = text;
    this.el.toast.classList.add('show');
    this.toastTimer = 3;
  }

  update(dt) {
    const G = this.G;
    const p = G.player;
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.el.toast.classList.remove('show');
    }
    // Health + money.
    this.el.health.style.width = Math.max(0, p.health) + '%';
    this.el.healthText.textContent = Math.ceil(Math.max(0, p.health)) + ' HP';
    this.el.money.textContent = '$' + Math.floor(p.money);
    // Wanted stars.
    const stars = G.police.stars;
    let html = '';
    for (let i = 0; i < 5; i++) html += `<span class="${i < stars ? 'star on' : 'star'}">★</span>`;
    this.el.stars.innerHTML = html;
    // Objective.
    this.el.objective.textContent = objectiveText(G);
    // Speed.
    if (!p.onFoot && p.car) {
      const kmh = Math.round(Math.abs(p.car.speed) * 0.32);
      this.el.speed.textContent = kmh + ' km/h — ' + p.car.model.name;
    } else {
      this.el.speed.textContent = 'On foot — press E near a car to drive';
    }
    // Mission intro banner.
    const M = G.missions;
    if (M.banner) {
      this.el.bannerTitle.textContent = M.banner.title;
      this.el.bannerStory.textContent = M.banner.story;
      this.el.banner.classList.add('show');
    } else {
      this.el.banner.classList.remove('show');
    }
    // Minimap.
    drawMinimap(this.el.minimap, G);
  }

  // --- Menus ---------------------------------------------------------------
  showStart() {
    const G = this.G;
    const save = this.loadSave();
    this.el.menuTitle.textContent = GAME_TITLE;
    this.el.menuStory.textContent = GAME_SUBTITLE + ' — Jax Marlowe, wheelman for hire. Four jobs for Mama Rosa. One city that never sleeps.';
    this.el.menuButtons.innerHTML = '';
    const start = this.button(save ? 'Continue Story' : 'Start Story', () => {
      G.sound.init();
      if (save) this.applySave(save);
      G.startStory();
      this.hideMenu();
    });
    this.el.menuButtons.appendChild(start);
    if (save) {
      const fresh = this.button('New Game', () => {
        G.sound.init();
        localStorage.removeItem(SAVE_KEY);
        G.startStory();
        this.hideMenu();
      });
      this.el.menuButtons.appendChild(fresh);
    }
    const free = this.button('Free Roam', () => {
      G.sound.init();
      G.startFreeRoam();
      this.hideMenu();
    });
    this.el.menuButtons.appendChild(free);
    this.el.menu.classList.add('show');
    this.el.hint.innerHTML = 'WASD move / drive &nbsp;·&nbsp; E enter car &nbsp;·&nbsp; Mouse aim, click shoot &nbsp;·&nbsp; Shift sprint &nbsp;·&nbsp; P pause &nbsp;·&nbsp; M mute';
  }

  showPause() {
    const G = this.G;
    this.el.menuTitle.textContent = 'Paused';
    this.el.menuStory.textContent = 'Take a breath. Solara Bay waits.';
    this.el.menuButtons.innerHTML = '';
    this.el.menuButtons.appendChild(this.button('Resume', () => { G.state = 'playing'; this.hideMenu(); }));
    this.el.menuButtons.appendChild(this.button('Save Game', () => { this.saveGame(); this.toast('Game saved.'); }));
    this.el.menuButtons.appendChild(this.button('Quit to Menu', () => { G.state = 'menu'; this.showStart(); }));
    this.el.menu.classList.add('show');
  }

  showGameOver(busted) {
    const G = this.G;
    this.el.menuTitle.textContent = busted ? 'BUSTED!' : 'WASTED!';
    this.el.menuStory.textContent = busted
      ? 'The Solara Bay PD caught up with you. Mama Rosa will bail you out — for a price.'
      : 'Jax went down in the streets of Solara Bay. The city keeps moving.';
    this.el.menuButtons.innerHTML = '';
    this.el.menuButtons.appendChild(this.button('Try Again', () => {
      G.resetRun();
      this.hideMenu();
    }));
    this.el.menuButtons.appendChild(this.button('Main Menu', () => { G.state = 'menu'; this.showStart(); }));
    this.el.menu.classList.add('show');
  }

  showWin() {
    const G = this.G;
    this.el.menuTitle.textContent = 'STORY COMPLETE';
    this.el.menuStory.textContent = 'The Big Score is done. $1,000 richer, the cops in the rear-view mirror — Solara Bay is yours, Jax.';
    this.el.menuButtons.innerHTML = '';
    this.el.menuButtons.appendChild(this.button('Keep Playing (Free Roam)', () => { G.state = 'playing'; this.hideMenu(); }));
    this.el.menuButtons.appendChild(this.button('Main Menu', () => { G.state = 'menu'; this.showStart(); }));
    this.el.menu.classList.add('show');
  }

  hideMenu() { this.el.menu.classList.remove('show'); }

  button(label, onClick) {
    const b = document.createElement('button');
    b.className = 'menu-btn';
    b.textContent = label;
    b.addEventListener('click', () => { this.G.sound.click(); onClick(); });
    return b;
  }

  // --- Save / load ----------------------------------------------------------
  saveGame() {
    const G = this.G;
    const data = {
      money: Math.floor(G.player.money),
      health: Math.ceil(G.player.health),
      missionIndex: G.missions.index,
      x: Math.round(G.player.x),
      y: Math.round(G.player.y),
      savedAt: Date.now(),
    };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) { /* storage unavailable */ }
  }

  loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  applySave(save) {
    const G = this.G;
    G.player.money = save.money ?? START_MONEY;
    G.player.health = save.health ?? 100;
    G.player.x = save.x ?? G.player.x;
    G.player.y = save.y ?? G.player.y;
    restoreMissions(G, save.missionIndex ?? 0);
    G.player.onFoot = true;
    G.player.car = null;
  }
}
