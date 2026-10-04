// Pantalla de victoria y animación final del tablero.

import { html, esc, onAction, teamClass, formatDuration } from '../ui/dom.js';
import { createBoard } from '../ui/board.js';
import { confetti } from '../ui/confetti.js';
import * as G from '../core/game.js';
import { MODES } from '../core/modes.js';
import { sound, buzz } from '../ui/feedback.js';
import { renderStandings } from './board.js';

/** Muestra la ficha ganadora llegando a la meta antes de la celebración. */
export function boardFinalScreen(app, { animateFrom }) {
  const game = app.game;
  const ev = G.evaluate(game);
  const board = createBoard({
    boardSize: game.config.boardSize,
    teams: game.config.teams,
    positions: animateFrom || ev.pos,
    current: game.winners[0] ?? -1,
    challenges: !!G.modeOf(game).challenges,
    progressive: !!G.modeOf(game).progressive,
  });
  const el = html('<section class="screen center" aria-label="Llegada a la meta"><h2 class="center-text">¡Llegada a la meta!</h2></section>');
  el.append(board.el);
  return {
    el,
    destroy: board.destroy,
    mounted: async () => {
      await new Promise((r) => setTimeout(r, 300));
      await board.animateTo(ev.pos);
      setTimeout(() => app.go('victory'), 600);
    },
  };
}

export function victoryScreen(app) {
  const game = app.game;
  if (!game || !game.finished) return app.go('menu');
  const mode = G.modeOf(game);
  const sum = G.summarize(game);
  const winners = game.winners.map((i) => game.config.teams[i]);
  const main = winners[0];
  const colorVar = main ? `var(--team-${main.color})` : 'var(--accent)';

  let title;
  if (!winners.length) title = 'Sin ganador';
  else if (winners.length > 1) title = `¡Empate entre ${winners.map((w) => esc(w.name)).join(' y ')}!`;
  else title = `¡Ganó ${esc(main.name)}!`;

  const best = sum.rounds.reduce((b, r) => (!b || r.hits > b.hits ? r : b), null);
  const duration = (game.finishedAt || Date.now()) - game.createdAt;

  const el = html(`<section class="screen victory ${main ? teamClass(main) : ''}" aria-label="Victoria">
    <div class="trophy" aria-hidden="true">${winners.length ? '🏆' : '🤝'}</div>
    <h1 style="color:${colorVar}">${title}</h1>
    <p class="muted">${MODES[game.config.mode].icon} ${esc(MODES[game.config.mode].name)}${game.endedEarly ? ' · terminada antes de tiempo' : ''}</p>
    <div class="standings" id="standings"></div>
    <div class="highlights">
      <div class="stat"><b>${sum.hits}</b><span>palabras acertadas</span></div>
      <div class="stat"><b>${sum.rounds.length}</b><span>rondas jugadas</span></div>
      <div class="stat"><b>${best ? best.hits : 0}</b><span>mejor ronda${best ? ` (${esc(best.describer)})` : ''}</span></div>
      <div class="stat"><b>${formatDuration(duration)}</b><span>de partida</span></div>
    </div>
    <div class="grow"></div>
    <div class="btn-col">
      <button class="btn primary big block" data-act="rematch">🔁 Revancha</button>
      <button class="btn block" data-act="new">Nueva partida</button>
      <button class="btn ghost block" data-act="menu">Menú principal</button>
    </div>
  </section>`);
  renderStandings(el.querySelector('#standings'), game);

  let stopConfetti = () => {};
  onAction(el, {
    rematch: () => {
      app.game = G.createGame(game.config);
      app.saveGame();
      sound.start();
      app.go('board');
    },
    new: () => {
      app.game = null;
      app.saveGame();
      app.go('setup');
    },
    menu: () => {
      app.game = null;
      app.saveGame();
      app.go('menu');
    },
  });

  return {
    el,
    mounted: () => {
      app.recordFinishedGame();
      if (winners.length) {
        sound.win();
        buzz([100, 60, 100, 60, 300]);
        const colors = winners.map((w) => getComputedStyle(document.documentElement).getPropertyValue(`--team-${w.color}`).trim());
        stopConfetti = confetti([...colors, '#ffb627', '#f6f2e7']);
      }
    },
    destroy: () => stopConfetti(),
    onBack: () => el.querySelector('[data-act="menu"]').click(),
  };
}
