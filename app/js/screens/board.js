// Tablero: posiciones, turno actual, desafío/categoría y elección del narrador.
// También da acceso al historial de rondas (con corrección), a pausar y a terminar la partida.

import { html, esc, onAction, sheet, confirmDialog, teamClass, toast } from '../ui/dom.js';
import { createBoard } from '../ui/board.js';
import { MODES, getChallenge } from '../core/modes.js';
import * as G from '../core/game.js';
import { levelName } from '../core/words.js';
import { sound, buzz } from '../ui/feedback.js';

export function boardScreen(app, { animateFrom } = {}) {
  const game = app.game;
  if (!game) return app.go('menu');
  if (game.finished) return app.go('victory');
  const mode = G.modeOf(game);
  const ev = G.evaluate(game);
  const cur = game.current;
  const team = game.config.teams[cur.team];

  const el = html(`<section class="screen" aria-label="Tablero">
    <header class="topbar">
      <button class="icon-btn" data-act="menu" aria-label="Opciones de la partida">☰</button>
      <h2>${mode.icon} ${esc(mode.name)}</h2>
      <span class="info-pill">Ronda ${G.roundNumber(game)}</span>
    </header>
    <div id="board-slot"></div>
    <div class="standings" id="standings"></div>
    <div id="turn" class="stack"></div>
  </section>`);

  // Tablero o marcador
  let board = null;
  if (mode.board) {
    board = createBoard({
      boardSize: game.config.boardSize,
      teams: game.config.teams,
      positions: animateFrom || ev.pos,
      current: cur.team,
      challenges: !!mode.challenges,
      progressive: !!mode.progressive,
    });
    el.querySelector('#board-slot').append(board.el);
  }
  renderStandings(el.querySelector('#standings'), game, ev);

  // Panel del turno
  const ch = getChallenge(cur.challenge);
  const cat = cur.category ? app.bank.category(cur.category) : null;
  const describers = team.players
    .map(
      (p, i) => `<button class="chip" data-act="describer" data-i="${i}" aria-pressed="${i === cur.describer}" ${ch?.randomDescriber ? 'disabled' : ''}>${esc(G.playerName(team, i))}</button>`,
    )
    .join('');
  const extras = [];
  if (cur.level && !ch?.difficulty) extras.push(`<span class="info-pill"><span class="level-badge level-${cur.level}">${levelName(cur.level)}</span> según tu posición</span>`);
  if (cat && mode.roulette) extras.push(`<span class="info-pill">🎡 Categoría: se sortea antes de tirar el dado</span>`);
  if (mode.survival) extras.push(`<span class="info-pill">❤️ ${ev.livesLeft[cur.team]} vidas · objetivo ${game.config.targetPoints} puntos</span>`);
  if (mode.fixedRounds) extras.push(`<span class="info-pill">Ronda ${ev.roundsPlayed[cur.team] + 1} de ${game.config.roundsPerTeam}</span>`);

  const turn = el.querySelector('#turn');
  turn.innerHTML = `
    <div class="team-banner ${teamClass(team)}">
      <div class="label">Le toca a</div>
      <h2>${esc(team.name)}</h2>
    </div>
    ${ch ? `<div class="challenge-card"><span class="ico">${ch.icon}</span><b>Desafío: ${esc(ch.name)}</b><span>${esc(ch.text)}</span></div>` : ''}
    ${extras.length ? `<div class="row wrap">${extras.join('')}</div>` : ''}
    <div class="card stack">
      <div class="row between"><b>¿Quién describe?</b>${ch?.randomDescriber ? '<span class="small muted">Lo eligió la app</span>' : '<span class="small muted">Rota solo</span>'}</div>
      <div class="describers ${teamClass(team)}">${describers}</div>
    </div>
    <button class="btn primary big block" data-act="go">${game.phase !== 'turn' ? '▶ Continuar el turno' : G.usesDie(game) ? '🎲 Tirar el dado' : '▶ Empezar la ronda'}</button>`;

  onAction(el, {
    describer: (b) => {
      if (game.phase !== 'turn') return toast('El narrador ya está elegido para esta ronda');
      cur.describer = Number(b.dataset.i);
      el.querySelectorAll('[data-act="describer"]').forEach((x) => x.setAttribute('aria-pressed', x === b));
      app.saveGame();
      sound.tap();
    },
    go: () => {
      if (game.phase === 'turn') {
        G.chooseDescriber(game, cur.describer);
        app.saveGame();
      }
      app.go(game.phase === 'ready' && !G.usesDie(game) ? 'dice' : game.phase === 'play' ? 'play' : 'dice');
    },
    menu: () => openGameMenu(app),
  });

  const mounted = async () => {
    if (animateFrom && board) {
      el.querySelector('[data-act="go"]').disabled = true;
      await new Promise((r) => setTimeout(r, 350));
      await board.animateTo(ev.pos);
      el.querySelector('[data-act="go"]').disabled = false;
      buzz(30);
    }
    if (ch) {
      sound.warn();
      buzz([40, 60, 40]);
    }
  };

  return {
    el,
    mounted,
    destroy: () => board?.destroy(),
    onBack: () => openGameMenu(app),
  };
}

export function renderStandings(box, game, ev = G.evaluate(game)) {
  const mode = G.modeOf(game);
  const max = mode.board ? game.config.boardSize : mode.survival ? game.config.targetPoints : Math.max(1, ...ev.points);
  box.innerHTML = G.standings(game)
    .map((s) => {
      const pct = Math.min(100, Math.round((s.value / max) * 100));
      const lives = mode.survival ? `<span class="lives" title="Vidas">${'❤️'.repeat(s.lives) || '💀'}</span>` : '';
      return `<div class="standing ${teamClass(s.team)}${s.eliminated ? ' out' : ''}">
        <span class="team-dot"></span><span class="team-name">${esc(s.team.name)}</span>${lives}
        <span class="bar"><i style="width:${pct}%"></i></span><b>${s.value}</b></div>`;
    })
    .join('');
}

/* ---------- Menú de la partida ---------- */
export function openGameMenu(app) {
  const game = app.game;
  const mode = MODES[game.config.mode];
  const el = html(`<div class="stack">
    <h3>Partida</h3>
    <button class="btn block" data-act="history">📝 Rondas jugadas y correcciones</button>
    <button class="btn block" data-act="rules">📖 Reglas de ${esc(mode.name)}</button>
    <button class="btn block" data-act="save">💾 Guardar y salir al menú</button>
    <button class="btn block bad" data-act="end">🏁 Terminar partida ahora</button>
    <button class="btn block ghost" data-act="close">Volver al juego</button>
  </div>`);
  const close = sheet(el);
  onAction(el, {
    close,
    history: () => {
      close();
      openRoundsSheet(app);
    },
    rules: () => {
      close();
      const r = html(`<div class="stack"><h3>${mode.icon} ${esc(mode.name)}</h3><p>${esc(mode.description)}</p>
        <p class="muted small">Avance = máximo(0, aciertos − dado). La penalización nunca hace retroceder.</p>
        <button class="btn block ghost" data-act="x">Cerrar</button></div>`);
      const c = sheet(r);
      onAction(r, { x: c });
    },
    save: () => {
      close();
      app.saveGame();
      toast('Partida guardada. Podés seguirla desde el menú.');
      app.go('menu');
    },
    end: async () => {
      close();
      const ok = await confirmDialog({
        title: '¿Terminar la partida?',
        text: 'Gana el equipo que va adelante (si hay empate, ganan los empatados). Queda registrada en las estadísticas.',
        ok: 'Terminar',
        danger: true,
      });
      if (!ok) return;
      G.endEarly(game);
      app.saveGame();
      app.recordFinishedGame();
      app.go('victory');
    },
  });
}

/** Lista de rondas jugadas con opción de corregir aciertos y dado. */
export function openRoundsSheet(app) {
  const game = app.game;
  const mode = G.modeOf(game);
  const rows = game.rounds
    .map((r, i) => {
      const t = game.config.teams[r.team];
      const o = G.roundOutcome(game, r);
      const effect = mode.board ? `+${o.advance}` : mode.survival ? `+${o.points} · −${o.livesLost}❤️` : `+${o.points}`;
      return `<div class="word-row ${teamClass(t)}">
        <span class="team-dot"></span>
        <span class="txt">${esc(t.name)} · ${esc(r.describerName)}${r.corrected ? ' ✏️' : ''}<small>${o.hits} aciertos${r.die !== null ? ` − dado ${r.die}` : ''} → ${effect}</small></span>
        <button class="chip" data-act="fix" data-i="${i}">Corregir</button></div>`;
    })
    .reverse()
    .join('');
  const el = html(`<div class="stack">
    <h3>Rondas jugadas</h3>
    ${rows || '<p class="muted">Todavía no se jugó ninguna ronda.</p>'}
    <button class="btn block ghost" data-act="close">Cerrar</button></div>`);
  const close = sheet(el);
  onAction(el, {
    close,
    fix: (b) => {
      close();
      openCorrection(app, Number(b.dataset.i));
    },
  });
}

function openCorrection(app, index) {
  const game = app.game;
  const r = game.rounds[index];
  const draft = { adjust: r.adjust || 0, die: r.die, words: r.words.map((w) => w.result) };
  const el = html('<div class="stack"></div>');
  const render = () => {
    const fake = { ...r, adjust: draft.adjust, die: draft.die, words: r.words.map((w, i) => ({ ...w, result: draft.words[i] })) };
    const o = G.roundOutcome(game, fake);
    const mode = G.modeOf(game);
    el.innerHTML = `<h3>Corregir ronda ${index + 1}</h3>
      <p class="muted small">${esc(game.config.teams[r.team].name)} · describió ${esc(r.describerName)}</p>
      <div class="word-list">${r.words.map((w, i) => wordToggleRow(w, draft.words[i], i)).join('') || '<p class="muted">Sin palabras</p>'}</div>
      <div class="row between"><b>Ajuste manual de aciertos</b><div class="stepper"><button data-act="adj" data-d="-1">−</button><output>${draft.adjust > 0 ? '+' : ''}${draft.adjust}</output><button data-act="adj" data-d="1">+</button></div></div>
      ${r.die !== null ? `<div class="row between"><b>Dado</b><div class="row">${[0, 1, 2].map((v) => `<button class="chip" data-act="die" data-v="${v}" aria-pressed="${draft.die === v}">${v}</button>`).join('')}</div></div>` : ''}
      <div class="banner">Resultado: <b>${o.hits}</b> aciertos${r.die !== null ? ` − dado <b>${draft.die}</b>` : ''} → ${mode.board ? `avanza <b>${o.advance}</b>` : `<b>${o.points}</b> puntos`}${mode.survival ? ` · pierde <b>${o.livesLost}</b> vidas` : ''}</div>
      <button class="btn primary block" data-act="save">Guardar corrección</button>
      <button class="btn ghost block" data-act="close">Cancelar</button>`;
  };
  render();
  const close = sheet(el);
  onAction(el, {
    close,
    adj: (b) => {
      draft.adjust = Math.max(-50, Math.min(50, draft.adjust + Number(b.dataset.d)));
      render();
    },
    die: (b) => {
      draft.die = Number(b.dataset.v);
      render();
    },
    res: (b) => {
      draft.words[Number(b.dataset.i)] = b.dataset.v === 'none' ? null : b.dataset.v;
      render();
    },
    save: () => {
      close();
      G.correctRound(game, index, draft);
      app.saveGame();
      if (game.finished) {
        app.recordFinishedGame();
        toast('Con la corrección, la partida tiene ganador');
        app.go('victory');
      } else {
        toast('Ronda corregida. El tablero se actualizó.');
        app.go('board');
      }
    },
  });
}

export function wordToggleRow(w, result, i) {
  const { main, hint } = splitText(w.text);
  return `<div class="word-row"><span class="txt">${esc(main)}${hint ? ` <small>${esc(hint)}</small>` : ''}</span>
    <div class="seg" role="group" aria-label="Resultado de ${esc(main)}">
      <button class="hit" data-act="res" data-i="${i}" data-v="hit" aria-pressed="${result === 'hit'}" aria-label="Acertada">✓</button>
      <button class="skip" data-act="res" data-i="${i}" data-v="skip" aria-pressed="${result === 'skip'}" aria-label="Pasada">✗</button>
      <button class="none" data-act="res" data-i="${i}" data-v="none" aria-pressed="${result === null}" aria-label="Sin responder">?</button>
    </div></div>`;
}

function splitText(text) {
  const m = String(text).match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  return m ? { main: m[1], hint: m[2] } : { main: text, hint: '' };
}
