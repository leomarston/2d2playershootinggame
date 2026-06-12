'use strict';
/* ============================================================
   RECOIL RUMBLE — input.js
   Keyboard + mouse. `down` is level state, `pressed` is
   edge-triggered and cleared at the end of each frame.
   ============================================================ */

const Input = {
  down: Object.create(null),
  pressed: Object.create(null),
  mouse: { x: -999, y: -999, clicked: false, downNow: false, moved: false },
  anyPressed: false,

  init(canvas, toGameCoords) {
    window.addEventListener('keydown', e => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (!this.down[e.code]) this.pressed[e.code] = true;
      this.down[e.code] = true;
      this.anyPressed = true;
      Sound.init();
    });
    window.addEventListener('keyup', e => { this.down[e.code] = false; });
    window.addEventListener('blur', () => { this.down = Object.create(null); });

    canvas.addEventListener('mousemove', e => {
      const p = toGameCoords(e.clientX, e.clientY);
      this.mouse.x = p.x; this.mouse.y = p.y; this.mouse.moved = true;
    });
    canvas.addEventListener('mousedown', e => {
      const p = toGameCoords(e.clientX, e.clientY);
      this.mouse.x = p.x; this.mouse.y = p.y;
      this.mouse.clicked = true; this.mouse.downNow = true;
      Sound.init();
    });
    window.addEventListener('mouseup', () => { this.mouse.downNow = false; });
  },

  isDown(codes) {
    if (Array.isArray(codes)) return codes.some(c => this.down[c]);
    return !!this.down[codes];
  },
  wasPressed(codes) {
    if (Array.isArray(codes)) return codes.some(c => this.pressed[c]);
    return !!this.pressed[codes];
  },

  /* call once per frame, after game update */
  endFrame() {
    this.pressed = Object.create(null);
    this.mouse.clicked = false;
    this.mouse.moved = false;
    this.anyPressed = false;
  }
};

/* Control schemes */
const CONTROLS = {
  p1: {
    left: ['KeyA'], right: ['KeyD'], jump: ['KeyW'], down: ['KeyS'],
    shoot: ['KeyF'], grenade: ['KeyG'],
    labels: { move: 'W A S D', shoot: 'F', grenade: 'G' }
  },
  p2: {
    left: ['ArrowLeft'], right: ['ArrowRight'], jump: ['ArrowUp'], down: ['ArrowDown'],
    shoot: ['KeyL', 'Period'], grenade: ['KeyK', 'Comma'],
    labels: { move: 'ARROWS', shoot: 'L or .', grenade: 'K or ,' }
  }
};
