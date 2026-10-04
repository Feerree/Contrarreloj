// Pantalla de juego: cronómetro, palabra actual, aciertos y pasadas.
// El tiempo se calcula con la hora real (endAt), así que no se desfasa si la pantalla
// se recarga o la app pasa a segundo plano.

import { html, esc, onAction, teamClass, wordSize, splitHint, toast } from '../ui/dom.js';
import * as G from '../core/game.js';
import { levelName } from '../core/words.js';
import { sound, buzz, keepAwake } from '../ui/feedback.js';

const RING = 2 * Math.PI * 42;

export function playScreen(app) {
  const game = app.game;
  if (!game || !['ready', 'play'].includes(game.phase)) return app.go('board');
  const cur = game.current;
  const team = game.config.teams[cur.team];
  const mode = G.modeOf(game);
  const ev = G.evaluate(game);
  const describer = G.playerName(team, cur.describer);
  const startLives = ev.livesLeft[cur.team];

  const el = html(`<section class="screen play ${teamClass(team)}" aria-label="Ronda en juego">
    <div class="play-top">
      <div class="timer" id="timer" role="timer" aria-live="off">
        <svg viewBox="0 0 100 100"><circle class="track" cx="50" cy="50" r="42"/><circle class="prog" cx="50" cy="50" r="42" stroke-dasharray="${RING}" stroke-dashoffset="0"/></svg>
        <div class="num">--</div>
      </div>
      <div class="who"><b class="team-name">${esc(team.name)}</b><span>Describe ${esc(describer)}${cur.die ? ` · dado ${cur.die}` : ''}</span></div>
      <button class="icon-btn" data-act="pause" aria-label="Pausar">⏸</button>
    </div>
    <div class="counters">
      <div class="counter ok"><span>Aciertos</span><b id="hits">0</b></div>
      <div class="counter bad"><span>${mode.survival ? 'Vidas' : 'Pasadas'}</span><b id="skips">0</b></div>
    </div>
    <div class="word-card" id="card" aria-live="polite"></div>
    <div class="play-actions">
      <button class="btn bad" data-act="skip" id="btn-skip"><span class="ico">✗</span>${G.canSkip(game) ? 'Pasar' : 'Sin pasar'}</button>
      <button class="btn ok" data-act="hit" id="btn-hit"><span class="ico">✓</span>¡Acierto!</button>
    </div>
    <p class="tiny muted center-text kbd-hint">Teclado: → o espacio = acierto · ← = pasar · P = pausa</p>
  </section>`);

  const $timer = el.querySelector('#timer');
  const $num = $timer.querySelector('.num');
  const $prog = $timer.querySelector('.prog');
  const $card = el.querySelector('#card');
  const $hits = el.querySelector('#hits');
  const $skips = el.querySelector('#skips');
  const $btnSkip = el.querySelector('#btn-skip');
  const $btnHit = el.querySelector('#btn-hit');
  if (!G.canSkip(game)) $btnSkip.disabled = true;

  let interval = null;
  let lastSecond = null;
  let lockUntil = 0;
  let ended = false;
  let overlay = null;
  let fallbackNotified = false;

  const updateCounters = () => {
    const { hits, skips } = G.countResults(cur.words);
    $hits.textContent = hits;
    $skips.textContent = mode.survival ? Math.max(0, startLives - skips) : skips;
  };

  const renderWord = (animate = true) => {
    const w = G.currentWord(game);
    if (!w) {
      $card.innerHTML = `<p class="muted">No quedan palabras disponibles con estos filtros.</p>
        <button class="btn primary" data-act="end-now">Terminar la ronda</button>`;
      $btnHit.disabled = $btnSkip.disabled = true;
      return;
    }
    const cat = app.bank.category(w.cat);
    const { main, hint } = splitHint(w.text);
    $card.classList.remove('enter');
    $card.innerHTML = `<div class="meta"><span>${cat.icon} ${esc(cat.name)}</span><span class="level-badge level-${w.level}">${levelName(w.level)}</span></div>
      <div class="word" style="--size:${wordSize(main)}px">${esc(main)}</div>${hint ? `<div class="word-hint">${esc(hint)}</div>` : ''}`;
    if (animate) {
      void $card.offsetWidth;
      $card.classList.add('enter');
    }
  };

  /** Pide la próxima palabra respetando el filtro de la ronda (con alternativa si se agota). */
  const nextWord = () => {
    let r = app.nextWord(G.roundFilter(game));
    if (!r && cur.category) {
      // La categoría sorteada se agotó: se sigue con todas las categorías de la partida.
      r = app.nextWord({ categories: game.config.categories, levels: G.roundFilter(game).levels });
      if (r && !fallbackNotified) {
        toast('Se agotaron las palabras de esa categoría: siguen otras.');
        fallbackNotified = true;
      }
    }
    if (!r) return false;
    if (r.historyExhausted) app.flags.historyExhausted = true;
    G.showWord(game, r.word);
    return true;
  };

  const tick = () => {
    if (ended) return;
    const ms = G.remainingMs(game);
    const secs = Math.ceil(ms / 1000);
    const total = cur.timer.durationMs;
    $prog.style.strokeDashoffset = String(RING * (1 - ms / total));
    if (secs !== lastSecond) {
      $num.textContent = secs;
      $timer.classList.toggle('warn', secs <= 10);
      if (lastSecond !== null && secs < lastSecond && cur.timer.running) {
        if (secs === 10) {
          sound.warn();
          buzz([80, 60, 80]);
        } else if (secs < 10 && secs > 0) sound.tick();
      }
      lastSecond = secs;
    }
    if (ms <= 0 && cur.timer.running) endRound('time');
  };

  const startTicking = () => {
    stopTicking();
    tick();
    interval = setInterval(tick, 100);
  };
  const stopTicking = () => {
    clearInterval(interval);
    interval = null;
  };

  const endRound = (reason) => {
    if (ended) return;
    ended = true;
    stopTicking();
    G.finishRound(game, reason);
    app.saveGame();
    keepAwake(false);
    sound.end();
    buzz([300, 100, 300]);
    showOverlay(`<div class="time-up">${reason === 'lives' ? '¡Sin vidas!' : reason === 'time' ? '¡Tiempo!' : 'Ronda terminada'}</div>`);
    setTimeout(() => app.go('result'), 1300);
  };

  const mark = (result) => {
    if (ended || !cur.timer?.running || Date.now() < lockUntil) return;
    if (result === 'skip' && !G.canSkip(game)) return;
    if (!G.currentWord(game)) return;
    lockUntil = Date.now() + 180; // evita contar dos veces un doble toque accidental
    const { roundOver } = G.markWord(game, result);
    if (result === 'hit') {
      sound.hit();
      buzz(25);
    } else {
      sound.skip();
      buzz([15, 40, 15]);
    }
    $card.classList.remove('flash-ok', 'flash-skip');
    void $card.offsetWidth;
    $card.classList.add(result === 'hit' ? 'flash-ok' : 'flash-skip');
    updateCounters();
    if (roundOver) {
      app.saveGame();
      return endRound('lives');
    }
    nextWord();
    app.saveGame();
    renderWord();
  };

  /* ---------- Superposiciones ---------- */
  const showOverlay = (inner) => {
    overlay?.remove();
    overlay = html(`<div class="overlay">${inner}</div>`);
    onAction(overlay, handlers);
    document.body.append(overlay);
    return overlay;
  };
  const hideOverlay = () => {
    overlay?.remove();
    overlay = null;
  };

  const showReady = () => {
    const extra = cur.category ? `<p class="muted">Tema: ${app.bank.category(cur.category).icon} ${esc(app.bank.category(cur.category).name)}</p>` : '';
    showOverlay(`<p class="section-title">${esc(team.name)}</p>
      <h2>Describe ${esc(describer)}</h2>
      <p class="muted">Pasale el celular. Solo quien describe mira la pantalla.</p>${extra}
      <button class="btn ok big" data-act="begin">¡Empezar! ⏱</button>
      <button class="btn ghost" data-act="back-board">Volver al tablero</button>`);
  };

  const countdown = async () => {
    if (!app.settings.countdown) return;
    for (const n of [3, 2, 1]) {
      showOverlay(`<div class="countdown-num" aria-live="assertive">${n}</div>`);
      sound.count();
      await new Promise((r) => setTimeout(r, 800));
    }
  };

  const begin = async () => {
    hideOverlay();
    await countdown();
    hideOverlay();
    G.startRound(game);
    if (!nextWord()) toast('No hay palabras disponibles con estos filtros');
    app.saveGame();
    sound.go();
    buzz(120);
    if (app.settings.keepAwake) keepAwake(true);
    renderWord();
    updateCounters();
    startTicking();
  };

  const pause = () => {
    if (ended || !cur.timer?.running) return;
    G.pauseTimer(game);
    app.saveGame();
    stopTicking();
    showPaused();
  };

  const showPaused = () => {
    tick();
    const secs = Math.ceil(G.remainingMs(game) / 1000);
    showOverlay(`<h2>Pausa</h2><p class="muted">Quedan ${secs} segundos. La palabra está oculta.</p>
      <button class="btn ok big" data-act="resume">▶ Reanudar</button>
      <button class="btn" data-act="end-now">Terminar la ronda ahora</button>
      <button class="btn ghost" data-act="exit">Guardar y salir al menú</button>`);
  };

  const handlers = {
    begin,
    'back-board': () => {
      hideOverlay();
      app.go('board');
    },
    resume: () => {
      hideOverlay();
      G.resumeTimer(game);
      app.saveGame();
      startTicking();
    },
    'end-now': () => {
      hideOverlay();
      endRound('manual');
    },
    exit: () => {
      hideOverlay();
      app.saveGame();
      app.go('menu');
    },
    hit: () => mark('hit'),
    skip: () => mark('skip'),
    pause,
  };
  // En "ready" se puede volver al tablero sin consumir el dado: la fase sigue siendo 'ready'.
  onAction(el, handlers);

  const onKey = (e) => {
    if (overlay || e.repeat) return;
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      mark('hit');
    } else if (e.key === 'ArrowLeft' || e.key === 'Backspace') {
      e.preventDefault();
      mark('skip');
    } else if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') pause();
  };
  const onVisible = () => {
    if (document.visibilityState === 'visible' && cur.timer?.running) tick();
  };
  document.addEventListener('keydown', onKey);
  document.addEventListener('visibilitychange', onVisible);

  const mounted = () => {
    if (game.phase === 'ready') {
      $num.textContent = Math.round(G.roundDurationMs(game) / 1000);
      $card.innerHTML = '<p class="muted">La palabra aparece cuando empieza el tiempo.</p>';
      showReady();
      return;
    }
    // Retomando una ronda en curso (por ejemplo, después de recargar).
    updateCounters();
    if (!G.currentWord(game) && G.remainingMs(game) > 0) nextWord();
    if (cur.timer.running) {
      renderWord(false);
      if (app.settings.keepAwake) keepAwake(true);
      startTicking();
      if (G.remainingMs(game) <= 0) endRound('time');
    } else {
      renderWord(false);
      showPaused();
    }
  };

  return {
    el,
    mounted,
    destroy: () => {
      stopTicking();
      overlay?.remove();
      keepAwake(false);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onVisible);
    },
    onBack: () => (game.phase === 'play' ? pause() : app.go('board')),
  };
}
