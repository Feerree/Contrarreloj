// Punto de entrada: registra pantallas, maneja el botón "atrás" y el service worker.

import { app } from './app.js';
import { splashScreen, menuScreen, resumeTarget } from './screens/home.js';
import { setupScreen } from './screens/setup.js';
import { boardScreen } from './screens/board.js';
import { diceScreen } from './screens/dice.js';
import { playScreen } from './screens/play.js';
import { resultScreen } from './screens/result.js';
import { victoryScreen, boardFinalScreen } from './screens/victory.js';
import { statsScreen } from './screens/stats.js';
import { settingsScreen } from './screens/settings.js';
import { bankScreen } from './screens/bank.js';
import { rulesScreen } from './screens/rules.js';
import { unlockAudio } from './ui/feedback.js';
import { html, toast } from './ui/dom.js';

app.root = document.getElementById('app');

const screens = {
  splash: splashScreen,
  menu: menuScreen,
  setup: setupScreen,
  board: boardScreen,
  dice: diceScreen,
  play: playScreen,
  result: resultScreen,
  'board-final': boardFinalScreen,
  victory: victoryScreen,
  stats: statsScreen,
  settings: settingsScreen,
  bank: bankScreen,
  rules: rulesScreen,
};
for (const [name, fn] of Object.entries(screens)) app.register(name, fn);

// Cualquier toque habilita el audio (requisito de los navegadores).
document.addEventListener('pointerdown', unlockAudio, { capture: true });

// Botón "atrás" del sistema: se intercepta para no salir de la app por accidente.
history.replaceState({ app: true }, '');
history.pushState({ app: true }, '');
window.addEventListener('popstate', () => {
  history.pushState({ app: true }, '');
  app.back();
});

// Instalación como app (Android/Chrome). En iOS se usa "Compartir → Agregar a inicio".
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  app.canInstall = true;
  app.promptInstall = async () => {
    e.prompt();
    await e.userChoice;
    app.canInstall = false;
    if (app.current?.name === 'menu') app.go('menu');
  };
  if (app.current?.name === 'menu') app.go('menu');
});

// Service worker: modo sin conexión y aviso de actualización.
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js');
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        nw?.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) showUpdateBanner(nw);
        });
      });
    } catch (err) {
      console.warn('Service worker no registrado', err);
    }
  });
  // Solo se recarga cuando una versión nueva reemplaza a otra (no en la primera instalación).
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading || !hadController) return;
    reloading = true;
    location.reload();
  });
}

function showUpdateBanner(worker) {
  // No se interrumpe una ronda en curso: se avisa y la persona decide.
  const bar = html(`<div class="toast" role="status" style="display:flex;gap:10px;align-items:center">
    Hay una versión nueva <button class="chip" style="background:var(--accent);color:#1d1400">Actualizar</button></div>`);
  bar.querySelector('button').addEventListener('click', () => {
    if (app.current?.name === 'play') return toast('Terminá la ronda antes de actualizar');
    worker.postMessage('skip-waiting');
  });
  document.body.append(bar);
}

// Arranque: si hay una ronda en curso, se vuelve directo a ella.
if (app.game && !app.game.finished && ['play', 'result'].includes(app.game.phase)) {
  app.go(resumeTarget(app.game));
} else {
  app.go('splash');
}

// Acceso para pruebas automatizadas y depuración desde la consola.
window.__contrarreloj = app;
