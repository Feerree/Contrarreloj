// Pantalla de inicio y menú principal.

import { html, esc, onAction, confirmDialog, teamClass } from '../ui/dom.js';
import { unlockAudio, sound } from '../ui/feedback.js';
import { MODES } from '../core/modes.js';
import { standings, roundNumber, modeOf } from '../core/game.js';

export const LOGO_SVG = `<svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
  <rect x="26" y="4" width="12" height="7" rx="3" fill="#1b1d3a"/>
  <rect x="44" y="12" width="9" height="6" rx="3" transform="rotate(40 48 15)" fill="#1b1d3a"/>
  <circle cx="32" cy="36" r="22" fill="#1b1d3a"/>
  <circle cx="32" cy="36" r="17" fill="#fff6e0"/>
  <path d="M32 36 L32 23" stroke="#1b1d3a" stroke-width="4" stroke-linecap="round"/>
  <path d="M32 36 L41 41" stroke="#ff5a5f" stroke-width="4" stroke-linecap="round"/>
  <circle cx="32" cy="36" r="3.4" fill="#1b1d3a"/>
</svg>`;

export function splashScreen(app) {
  const el = html(`<section class="screen splash" aria-label="Inicio">
    <div class="logo">
      <div class="logo-mark">${LOGO_SVG}</div>
      <h1 class="logo-word">Contra<em>rreloj</em></h1>
      <p class="logo-tag">Describí, adiviná y llegá primero a la meta</p>
    </div>
    <p class="tap-hint">Tocá para empezar</p>
  </section>`);
  const go = () => {
    unlockAudio();
    sound.tap();
    app.go('menu');
  };
  el.addEventListener('click', go);
  const onKey = (e) => (e.key === 'Enter' || e.key === ' ') && go();
  document.addEventListener('keydown', onKey);
  return { el, destroy: () => document.removeEventListener('keydown', onKey) };
}

export function menuScreen(app) {
  const g = app.hasActiveGame() ? app.game : null;
  let continueCard = '';
  if (g) {
    const st = standings(g);
    const board = modeOf(g).board;
    continueCard = `<div class="card continue-card">
      <div class="row between"><span class="section-title">Partida en curso</span><span class="info-pill">${MODES[g.config.mode].icon} ${esc(MODES[g.config.mode].name)} · Ronda ${roundNumber(g)}</span></div>
      <div class="standings">${st
        .map(
          (s) => `<div class="standing ${teamClass(s.team)}"><span class="team-dot"></span><span class="team-name">${esc(s.team.name)}</span><span class="grow"></span><b>${s.value}</b><span class="muted small">${board ? 'casilleros' : 'puntos'}</span></div>`,
        )
        .join('')}</div>
      <button class="btn primary big block" data-act="continue">▶ Continuar partida</button>
    </div>`;
  }
  const el = html(`<section class="screen" aria-label="Menú principal">
    <header class="menu-head">
      <div class="logo-mark">${LOGO_SVG}</div>
      <div><h1>Contrarreloj</h1><p class="muted small">${app.bank.all.length.toLocaleString('es-UY')} palabras · 100% offline</p></div>
    </header>
    ${continueCard}
    <button class="btn ${g ? '' : 'primary'} big block" data-act="new">🎲 Nueva partida</button>
    <div class="menu-grid">
      <button class="tile" data-act="stats"><span class="ico">📊</span><b>Estadísticas</b><span>Victorias, promedios e historial</span></button>
      <button class="tile" data-act="bank"><span class="ico">📚</span><b>Palabras</b><span>Categorías, filtros y palabras propias</span></button>
      <button class="tile" data-act="rules"><span class="ico">📖</span><b>Cómo se juega</b><span>Reglas y modalidades</span></button>
      <button class="tile" data-act="settings"><span class="ico">⚙️</span><b>Configuración</b><span>Tiempo, sonido, respaldo</span></button>
    </div>
    <div class="grow"></div>
    <div id="install-slot"></div>
  </section>`);

  onAction(el, {
    continue: () => app.go(resumeTarget(app.game)),
    new: async () => {
      if (g) {
        const ok = await confirmDialog({
          title: '¿Empezar una partida nueva?',
          text: 'La partida en curso se va a descartar. Si querés conservarla en las estadísticas, terminala desde el tablero.',
          ok: 'Sí, empezar otra',
          danger: true,
        });
        if (!ok) return;
      }
      app.go('setup');
    },
    stats: () => app.go('stats'),
    bank: () => app.go('bank'),
    rules: () => app.go('rules'),
    settings: () => app.go('settings'),
    install: () => app.promptInstall?.(),
  });

  const mounted = () => {
    if (app.canInstall) {
      el.querySelector('#install-slot').replaceChildren(
        html('<button class="btn ghost block" data-act="install">📲 Instalar en la pantalla de inicio</button>'),
      );
    }
  };
  return { el, mounted };
}

/** Pantalla a la que vuelve una partida guardada según su fase. */
export function resumeTarget(game) {
  if (!game) return 'menu';
  switch (game.phase) {
    case 'dice':
    case 'ready':
      return 'dice';
    case 'play':
      return 'play';
    case 'result':
      return 'result';
    case 'finished':
      return 'victory';
    default:
      return 'board';
  }
}
