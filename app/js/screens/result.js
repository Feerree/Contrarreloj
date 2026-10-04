// Resultado de la ronda: cálculo con penalización, revisión de palabras y confirmación.

import { html, esc, onAction, teamClass, confirmDialog, toast } from '../ui/dom.js';
import * as G from '../core/game.js';
import { getChallenge } from '../core/modes.js';
import { sound, buzz } from '../ui/feedback.js';
import { wordToggleRow } from './board.js';

export function resultScreen(app) {
  const game = app.game;
  if (!game || game.phase !== 'result') return app.go(game?.finished ? 'victory' : 'board');
  const cur = game.current;
  const team = game.config.teams[cur.team];
  const mode = G.modeOf(game);
  const ch = getChallenge(cur.challenge);
  const el = html(`<section class="screen" aria-label="Resultado de la ronda">
    <div class="team-banner ${teamClass(team)}"><div class="label">Resultado de la ronda</div><h2>${esc(team.name)}</h2>
      <p class="muted">Describió ${esc(G.playerName(team, cur.describer))}</p></div>
    <div id="calc"></div>
    <div id="exhausted"></div>
    <div class="card stack">
      <div class="row between"><h3 style="margin:0">Palabras de la ronda</h3><span class="small muted">Tocá para corregir</span></div>
      <div class="word-list" id="words"></div>
      <div class="row between"><div><b>Ajuste manual</b><p class="small muted">Si se contó mal algún acierto</p></div>
        <div class="stepper"><button data-act="adj" data-d="-1" aria-label="Restar acierto">−</button><output id="adj">0</output><button data-act="adj" data-d="1" aria-label="Sumar acierto">+</button></div></div>
    </div>
    <div class="grow"></div>
    <div class="sticky-bottom"><button class="btn primary big block" data-act="confirm">${mode.board ? 'Confirmar y mover la ficha' : 'Confirmar resultado'}</button></div>
  </section>`);

  const render = () => {
    const o = G.roundOutcome(game, cur);
    const usesDie = G.usesDie(game);
    let calc;
    if (mode.board || (mode.fixedRounds && usesDie)) {
      const value = mode.board ? o.advance : o.points;
      const unit = mode.board ? (value === 1 ? 'casillero' : 'casilleros') : value === 1 ? 'punto' : 'puntos';
      calc = `<div class="formula" aria-label="${o.hits} aciertos menos ${o.die} del dado: ${value} ${unit}">
        <div class="term hits"><b>${o.hits}</b><span>aciertos</span></div><span class="op">−</span>
        <div class="term penalty"><b>${o.die}</b><span>dado</span></div><span class="op">=</span>
        <div class="term res"><b>${value}</b><span>${unit}</span></div></div>`;
      if (o.hits < o.die) calc += '<p class="result-note">No avanza, pero nunca retrocede.</p>';
    } else if (mode.survival) {
      const left = G.evaluate(game).livesLeft[cur.team] - o.livesLost;
      calc = `<div class="formula"><div class="term hits"><b>+${o.points}</b><span>puntos</span></div><span class="op"></span>
        <div class="term penalty"><b>−${o.livesLost}</b><span>vidas</span></div><span class="op"></span>
        <div class="term res"><b>${Math.max(0, left)}</b><span>vidas restantes</span></div></div>`;
    } else {
      calc = `<div class="formula"><div class="term hits" style="grid-column: span 5"><b>+${o.points}</b><span>puntos</span></div></div>`;
    }
    if (o.note) calc += `<p class="result-note">${esc(o.note)}</p>`;
    if (ch) calc += `<p class="center-text small muted">Desafío: ${ch.icon} ${esc(ch.name)}</p>`;
    el.querySelector('#calc').innerHTML = calc;
    el.querySelector('#words').innerHTML =
      cur.words.map((w, i) => wordToggleRow(w, w.result, i)).join('') || '<p class="muted">No se mostró ninguna palabra.</p>';
    el.querySelector('#adj').textContent = (cur.adjust > 0 ? '+' : '') + cur.adjust;
    if (app.flags.historyExhausted) {
      el.querySelector('#exhausted').innerHTML = `<div class="banner stack"><span>Ya aparecieron todas las palabras de estos filtros en partidas anteriores. Se están repitiendo las más viejas.</span>
        <button class="btn block" data-act="reset-history">Reiniciar historial de palabras</button></div>`;
    }
  };

  onAction(el, {
    res: (b) => {
      const v = b.dataset.v;
      G.toggleWordResult(game, Number(b.dataset.i), v === 'none' ? null : v);
      app.saveGame();
      sound.tap();
      render();
    },
    adj: (b) => {
      G.setAdjust(game, cur.adjust + Number(b.dataset.d));
      app.saveGame();
      render();
    },
    'reset-history': async () => {
      const ok = await confirmDialog({
        title: '¿Reiniciar el historial?',
        text: 'Todas las palabras vuelven a contar como no vistas. En esta partida igual no se repiten.',
        ok: 'Reiniciar',
      });
      if (!ok) return;
      app.resetHistory();
      app.flags.historyExhausted = false;
      toast('Historial reiniciado');
      render();
      el.querySelector('#exhausted').innerHTML = '';
    },
    confirm: () => {
      const before = G.evaluate(game).pos;
      G.confirmRound(game);
      app.saveGame();
      sound.tap();
      buzz(40);
      if (game.finished) {
        app.recordFinishedGame();
        if (mode.board) app.go('board-final', { animateFrom: before });
        else app.go('victory');
      } else {
        app.go('board', { animateFrom: mode.board ? before : undefined });
      }
    },
  });

  render();
  return { el, onBack: () => toast('Confirmá el resultado para seguir') };
}
