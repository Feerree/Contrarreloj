// Lanzamiento del dado (y ruleta de categoría cuando corresponde) antes de la ronda.

import { html, esc, onAction, teamClass } from '../ui/dom.js';
import { createDie } from '../ui/dice.js';
import { getChallenge } from '../core/modes.js';
import * as G from '../core/game.js';
import { sound, buzz } from '../ui/feedback.js';
import { openGameMenu } from './board.js';
import { randomInt } from '../core/random.js';

export function diceScreen(app) {
  const game = app.game;
  if (!game || !['dice', 'ready'].includes(game.phase)) return app.go('board');
  const cur = game.current;
  const team = game.config.teams[cur.team];
  const ch = getChallenge(cur.challenge);
  const mode = G.modeOf(game);
  const describer = G.playerName(team, cur.describer);
  const showRoulette = !!cur.category && (mode.roulette || ch?.singleCategory);
  const hasDie = G.usesDie(game) && !ch?.noDie;
  const dieCount = ch?.doubleDie ? 2 : 1;

  const el = html(`<section class="screen" aria-label="Dado">
    <header class="topbar">
      <button class="icon-btn" data-act="menu" aria-label="Opciones de la partida">☰</button>
      <div class="grow"></div>
    </header>
    <div class="team-banner ${teamClass(team)}"><div class="label">Describe</div><h2>${esc(describer)}</h2><p class="muted">${esc(team.name)}</p></div>
    ${ch ? `<div class="challenge-card"><span class="ico">${ch.icon}</span><b>${esc(ch.name)}</b><span>${esc(ch.text)}</span></div>` : ''}
    ${showRoulette ? '<div class="roulette" id="roulette"><div class="ico">🎡</div><div class="name">¿Qué tema sale?</div></div>' : ''}
    <div class="dice-stage" id="stage"></div>
    <div id="dice-result" aria-live="polite"></div>
    <div class="grow"></div>
    <div id="cta"></div>
  </section>`);

  const stage = el.querySelector('#stage');
  const dice = [];
  if (hasDie) {
    const row = html('<div class="dice-row"></div>');
    for (let i = 0; i < dieCount; i++) {
      const d = createDie({ small: dieCount > 1 });
      dice.push(d);
      row.append(d.el);
    }
    stage.append(row, html('<div class="die-shadow"></div>'));
  } else {
    stage.innerHTML = `<p class="muted center-text">${ch?.noDie ? 'En este desafío no se tira el dado.' : ''}</p>`;
    stage.style.minHeight = '0';
  }

  const cta = el.querySelector('#cta');
  const resultBox = el.querySelector('#dice-result');

  const showResult = () => {
    if (hasDie) {
      const v = cur.die;
      const msg = v === 0 ? '¡Sin penalización!' : `Se va${v === 1 ? '' : 'n'} a restar ${v} acierto${v === 1 ? '' : 's'}`;
      resultBox.innerHTML = `<div class="dice-result"><p class="big">Dado: <b>${v}</b></p><p class="muted">${msg}</p></div>`;
    }
    cta.innerHTML = `<button class="btn ok big block" data-act="play">¡A jugar! ⏱</button>`;
  };

  const roll = async () => {
    cta.innerHTML = '';
    G.rollForTurn(game);
    app.saveGame();
    if (hasDie) {
      sound.dice();
      buzz([20, 40, 20, 40, 20]);
      await Promise.all(dice.map((d, i) => d.show(cur.dieFaces[i])));
      buzz(60);
    }
    showResult();
  };

  const spinRoulette = async () => {
    const box = el.querySelector('#roulette');
    if (!box) return;
    const final = app.bank.category(cur.category);
    const cats = game.config.categories.map((id) => app.bank.category(id));
    if (game.phase === 'ready') {
      box.innerHTML = `<div class="ico">${final.icon}</div><div class="name">${esc(final.name)}</div>`;
      return;
    }
    box.classList.add('spinning');
    const steps = 14;
    for (let i = 0; i < steps; i++) {
      const c = i === steps - 1 ? final : cats[randomInt(cats.length)];
      box.innerHTML = `<div class="ico">${c.icon}</div><div class="name">${esc(c.name)}</div>`;
      sound.tick();
      await new Promise((r) => setTimeout(r, 60 + i * 14));
    }
    box.classList.remove('spinning');
    sound.hit();
  };

  onAction(el, {
    roll,
    play: () => app.go('play'),
    menu: () => openGameMenu(app),
  });

  const mounted = async () => {
    if (game.phase === 'ready') {
      // Ya se tiró (por ejemplo, después de recargar la página): se muestra el resultado sin volver a tirar.
      dice.forEach((d, i) => d.show(cur.dieFaces[i] ?? 0, { animate: false }));
      await spinRoulette();
      showResult();
      return;
    }
    await spinRoulette();
    if (hasDie) cta.innerHTML = `<button class="btn primary big block" data-act="roll">🎲 Tirar el dado</button>`;
    else roll();
  };

  return { el, mounted, onBack: () => openGameMenu(app) };
}
