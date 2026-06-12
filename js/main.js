'use strict';
/* ============================================================
   RECOIL RUMBLE — main.js
   Boot, canvas scaling, main loop.
   ============================================================ */

(function boot() {
  const canvas = document.getElementById('game');
  canvas.width = GAME_W;
  canvas.height = GAME_H;
  const ctx = canvas.getContext('2d');

  /* fit canvas to window, preserving aspect */
  let viewScale = 1, viewX = 0, viewY = 0;
  function resize() {
    const ww = window.innerWidth, wh = window.innerHeight;
    viewScale = Math.min(ww / GAME_W, wh / GAME_H);
    const cw = Math.floor(GAME_W * viewScale);
    const ch = Math.floor(GAME_H * viewScale);
    canvas.style.width = cw + 'px';
    canvas.style.height = ch + 'px';
    const rect = canvas.getBoundingClientRect();
    viewX = rect.left; viewY = rect.top;
  }
  window.addEventListener('resize', resize);
  resize();

  function toGameCoords(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / viewScale,
      y: (clientY - rect.top) / viewScale
    };
  }

  Input.init(canvas, toGameCoords);

  const game = new Game();
  window.__game = game; // handy for debugging

  /* music starts on the first user gesture */
  const startAudio = () => {
    Sound.init();
    Music.start();
    window.removeEventListener('keydown', startAudio);
    window.removeEventListener('mousedown', startAudio);
  };
  window.addEventListener('keydown', startAudio);
  window.addEventListener('mousedown', startAudio);

  let last = performance.now();
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;

    if (Input.wasPressed('KeyM')) {
      const muted = Sound.toggleMute();
      game.fx.text(GAME_W / 2, GAME_H - 60, muted ? 'MUTED' : 'SOUND ON', '#fff', { size: 18, life: 0.8 });
    }

    game.update(dt);
    game.draw(ctx);
    Input.endFrame();

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
