// Keyboard and mouse input for Solara Bay. Tracks held keys, the mouse
// position in screen space, and edge-triggered presses (E to enter a car,
// P to pause) so the game loop can consume them once.
export class Input {
  constructor(canvas) {
    this.keys = {};
    this.pressed = {};
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDown = false;
    this.mouseClicked = false;
    this.canvas = canvas;
    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
      if (!this.keys[k]) this.pressed[k] = true;
      this.keys[k] = true;
    });
    window.addEventListener('keyup', (e) => { this.keys[e.key.toLowerCase()] = false; });
    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouseX = e.clientX - r.left;
      this.mouseY = e.clientY - r.top;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) { this.mouseDown = true; this.mouseClicked = true; }
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) this.mouseDown = false; });
    window.addEventListener('blur', () => { this.keys = {}; this.mouseDown = false; });
  }

  down(...names) { return names.some((n) => !!this.keys[n]); }
  // True once, on the frame the key went down.
  wasPressed(...names) { return names.some((n) => !!this.pressed[n]); }
  // Movement vector from WASD / arrows, normalized.
  moveVector() {
    let x = 0, y = 0;
    if (this.down('a', 'arrowleft')) x -= 1;
    if (this.down('d', 'arrowright')) x += 1;
    if (this.down('w', 'arrowup')) y -= 1;
    if (this.down('s', 'arrowdown')) y += 1;
    if (x !== 0 && y !== 0) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
    return { x, y };
  }
  endFrame() { this.pressed = {}; this.mouseClicked = false; }
}
