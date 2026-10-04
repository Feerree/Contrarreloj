// Estado de una partida y sus transiciones. Funciones puras sobre objetos serializables (JSON),
// para poder guardar la partida en cualquier momento y retomarla exactamente igual.
//
// Fases: 'turn' (elige narrador) → 'dice' (tira el dado; se saltea si el modo no usa dado)
//        → 'ready' (a punto de arrancar) → 'play' (ronda en curso) → 'result' (revisión y
//        corrección) → 'turn' del siguiente equipo … → 'finished'

import { MODES, getChallenge, CHALLENGES, DOUBLE_OR_NOTHING_MIN } from './modes.js';
import { computeAdvance, rollDie, difficultyForPosition, isChallengeSquare } from './rules.js';
import { randomInt } from './random.js';

export const GAME_VERSION = 1;

export const TEAM_COLORS = ['coral', 'cyan', 'lime', 'violet', 'amber', 'pink'];

export const DEFAULT_CONFIG = {
  mode: 'clasico',
  teams: [
    { name: 'Equipo Rojo', color: 'coral', players: ['', '', ''] },
    { name: 'Equipo Azul', color: 'cyan', players: ['', '', ''] },
  ],
  roundSeconds: 60,
  boardSize: 34,
  categories: [], // vacío = todas las activas
  levels: [1, 2, 3],
  useDie: false, // solo modo libre
  roundsPerTeam: 5, // solo modo libre
  lives: 5, // solo supervivencia
  targetPoints: 25, // solo supervivencia
  cardSize: 5, // palabras por tarjeta
};

const clampInt = (v, min, max, def) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};

export function normalizeConfig(cfg = {}) {
  const c = { ...DEFAULT_CONFIG, ...cfg };
  const mode = MODES[c.mode] ? c.mode : 'clasico';
  const teams = (c.teams || []).slice(0, 6).map((t, i) => {
    const players = (t.players || []).slice(0, 8).map((p) => String(p || '').trim().slice(0, 24));
    while (players.length < 2) players.push('');
    return {
      name: String(t.name || '').trim().slice(0, 24) || `Equipo ${i + 1}`,
      color: TEAM_COLORS.includes(t.color) ? t.color : TEAM_COLORS[i % TEAM_COLORS.length],
      players,
    };
  });
  if (teams.length < 2) throw new Error('Se necesitan al menos 2 equipos');
  return {
    mode,
    teams,
    roundSeconds: clampInt(c.roundSeconds, 15, 300, 60),
    boardSize: clampInt(c.boardSize, 10, 80, 34),
    categories: Array.isArray(c.categories) ? [...c.categories] : [],
    levels: (Array.isArray(c.levels) ? c.levels : [1, 2, 3]).filter((l) => [1, 2, 3].includes(l)).sort(),
    useDie: !!c.useDie,
    roundsPerTeam: clampInt(c.roundsPerTeam, 1, 20, 5),
    lives: clampInt(c.lives, 1, 20, 5),
    targetPoints: clampInt(c.targetPoints, 5, 200, 25),
    cardSize: clampInt(c.cardSize, 1, 6, 5),
  };
}

export function playerName(team, i) {
  return team.players[i] || `Jugador ${i + 1}`;
}

export function createGame(config, { now = Date.now(), id } = {}) {
  const cfg = normalizeConfig(config);
  if (!cfg.levels.length) cfg.levels = [1, 2, 3];
  const state = {
    version: GAME_VERSION,
    id: id || `g${now.toString(36)}${randomInt(1e6).toString(36)}`,
    createdAt: now,
    updatedAt: now,
    config: cfg,
    rounds: [],
    usedIds: [],
    phase: 'turn',
    current: null,
    finished: false,
    winners: [],
    endedEarly: false,
    finishedAt: null,
  };
  prepareTurn(state);
  return state;
}

export const modeOf = (state) => MODES[state.config.mode];

/** El dado se usa en todos los modos de tablero, opcionalmente en libre y nunca en supervivencia. */
export function usesDie(state) {
  const m = modeOf(state);
  if (m.die === 'always') return true;
  if (m.die === 'optional') return !!state.config.useDie;
  return false;
}

/* ---------- Derivados: posiciones, puntos, vidas ---------- */

/** Recorre las rondas en orden y calcula todo lo derivado (posiciones, puntos, vidas, ganador). */
export function evaluate(state) {
  const { config } = state;
  const mode = modeOf(state);
  const n = config.teams.length;
  const pos = Array(n).fill(0);
  const points = Array(n).fill(0);
  const livesLeft = Array(n).fill(config.lives);
  const eliminated = Array(n).fill(false);
  const roundsPlayed = Array(n).fill(0);
  let winners = [];

  for (const r of state.rounds) {
    const out = roundOutcome(state, r);
    roundsPlayed[r.team]++;
    if (mode.board) {
      pos[r.team] = Math.min(config.boardSize, pos[r.team] + out.advance);
      if (!winners.length && pos[r.team] >= config.boardSize) winners = [r.team];
    } else {
      points[r.team] += out.points;
    }
    if (mode.survival) {
      livesLeft[r.team] = Math.max(0, livesLeft[r.team] - out.livesLost);
      if (livesLeft[r.team] === 0) eliminated[r.team] = true;
      if (!winners.length) {
        if (points[r.team] >= config.targetPoints && !eliminated[r.team]) winners = [r.team];
        const alive = eliminated.map((e, i) => (e ? -1 : i)).filter((i) => i >= 0);
        if (alive.length === 1) winners = alive;
        if (alive.length === 0) winners = []; // no debería pasar: juegan de a uno
      }
    }
  }

  if (mode.fixedRounds && !winners.length && state.rounds.length >= config.roundsPerTeam * n) {
    const best = Math.max(...points);
    winners = points.map((p, i) => (p === best ? i : -1)).filter((i) => i >= 0);
  }

  return { pos, points, livesLeft, eliminated, roundsPlayed, winners };
}

/** Puntaje de cada equipo para mostrar (posición en el tablero o puntos). */
export function standings(state) {
  const ev = evaluate(state);
  const board = modeOf(state).board;
  return state.config.teams
    .map((t, i) => ({
      index: i,
      team: t,
      value: board ? ev.pos[i] : ev.points[i],
      lives: ev.livesLeft[i],
      eliminated: ev.eliminated[i],
      rounds: ev.roundsPlayed[i],
    }))
    .sort((a, b) => b.value - a.value || a.index - b.index);
}

/** Equipo que juega a continuación: el siguiente al último que jugó, salteando eliminados. */
export function nextTeamIndex(state) {
  const n = state.config.teams.length;
  const { eliminated } = evaluate(state);
  const last = state.rounds.length ? state.rounds[state.rounds.length - 1].team : -1;
  for (let k = 1; k <= n; k++) {
    const i = (last + k + n) % n;
    if (!eliminated[i]) return i;
  }
  return 0;
}

/** Narrador sugerido: rota según cuántas rondas jugó el equipo. */
export function suggestedDescriber(state, teamIndex) {
  const team = state.config.teams[teamIndex];
  const played = state.rounds.filter((r) => r.team === teamIndex).length;
  return played % team.players.length;
}

export function roundNumber(state) {
  return Math.floor(state.rounds.length / state.config.teams.length) + 1;
}

/* ---------- Turno ---------- */

/** Prepara el turno del próximo equipo: sortea desafío o categoría si el modo lo requiere. */
export function prepareTurn(state, rng = randomInt) {
  const team = nextTeamIndex(state);
  const mode = modeOf(state);
  const ev = evaluate(state);
  const current = {
    team,
    describer: suggestedDescriber(state, team),
    challenge: null,
    category: null,
    level: null,
    die: null,
    dieFaces: [],
    words: [],
    adjust: 0,
    timer: null,
    startedAt: null,
    endedAt: null,
    endReason: null,
  };
  if (mode.challenges && isChallengeSquare(ev.pos[team], state.config.boardSize)) {
    current.challenge = CHALLENGES[rng(CHALLENGES.length)].id;
  }
  const ch = getChallenge(current.challenge);
  if (mode.roulette || ch?.singleCategory) {
    const cats = state.config.categories;
    if (cats.length) current.category = cats[rng(cats.length)];
  }
  if (mode.progressive) current.level = difficultyForPosition(ev.pos[team], state.config.boardSize);
  if (ch?.difficulty) current.level = ch.difficulty;
  if (ch?.randomDescriber) current.describer = rng(state.config.teams[team].players.length);
  state.current = current;
  state.phase = 'turn';
  return current;
}

export function chooseDescriber(state, index) {
  assertPhase(state, 'turn');
  const team = state.config.teams[state.current.team];
  const ch = getChallenge(state.current.challenge);
  if (!ch?.randomDescriber && index >= 0 && index < team.players.length) state.current.describer = index;
  state.phase = usesDie(state) ? 'dice' : 'ready';
}

/** Tira el dado del turno (uno o dos según el desafío). No se puede volver a tirar. */
export function rollForTurn(state, rng = randomInt) {
  assertPhase(state, 'dice');
  if (state.current.die !== null) return state.current;
  const ch = getChallenge(state.current.challenge);
  if (ch?.noDie) {
    state.current.die = 0;
    state.current.dieFaces = [];
  } else {
    const rolls = ch?.doubleDie ? [rollDie(rng), rollDie(rng)] : [rollDie(rng)];
    state.current.die = rolls.reduce((s, r) => s + r.value, 0);
    state.current.dieFaces = rolls.map((r) => r.face);
  }
  state.phase = 'ready';
  return state.current;
}

/** Duración efectiva de la ronda (en ms) considerando desafíos. */
export function roundDurationMs(state) {
  const ch = getChallenge(state.current?.challenge);
  const secs = state.config.roundSeconds * (ch?.timeFactor || 1);
  return Math.round(secs) * 1000;
}

/** Filtro de palabras para la ronda actual. */
export function roundFilter(state) {
  const c = state.current;
  const categories = c?.category ? [c.category] : state.config.categories;
  const levels = c?.level ? [c.level] : state.config.levels;
  return { categories, levels };
}

export function canSkip(state) {
  return !getChallenge(state.current?.challenge)?.noSkip;
}

/* ---------- Ronda y cronómetro ---------- */

export function startRound(state, now = Date.now()) {
  assertPhase(state, 'ready');
  const ms = roundDurationMs(state);
  state.current.timer = { durationMs: ms, endAt: now + ms, remainingMs: ms, running: true };
  state.current.startedAt = now;
  state.phase = 'play';
}

export function remainingMs(state, now = Date.now()) {
  const t = state.current?.timer;
  if (!t) return 0;
  return Math.max(0, t.running ? t.endAt - now : t.remainingMs);
}

export function pauseTimer(state, now = Date.now()) {
  const t = state.current?.timer;
  if (!t || !t.running) return;
  t.remainingMs = Math.max(0, t.endAt - now);
  t.running = false;
}

export function resumeTimer(state, now = Date.now()) {
  const t = state.current?.timer;
  if (!t || t.running) return;
  t.endAt = now + t.remainingMs;
  t.running = true;
}

export function isPaused(state) {
  return !!state.current?.timer && !state.current.timer.running;
}

/* ---------- Tarjetas ----------
 * Como en el juego físico, se muestran tarjetas de varias palabras (5 por defecto).
 * Quien describe elige el orden; cada palabra adivinada se marca con un toque.
 * "Pasar tarjeta" descarta las palabras que faltan (cuentan como pasadas) y saca otra.
 * Si se aciertan todas, sale la siguiente tarjeta automáticamente.
 */

/** Número de la tarjeta en juego (o -1 si todavía no salió ninguna). */
export function currentCardIndex(state) {
  const w = state.current?.words || [];
  return w.length ? w[w.length - 1].card ?? w.length - 1 : -1;
}

/** Palabras de la tarjeta en juego (con su índice dentro de la ronda). */
export function currentCard(state) {
  const n = currentCardIndex(state);
  if (n < 0) return [];
  return state.current.words.map((w, i) => ({ ...w, index: i })).filter((w) => (w.card ?? w.index) === n);
}

/** ¿La tarjeta en juego está completa (todas acertadas o pasadas)? */
export function cardDone(state) {
  const card = currentCard(state);
  return !card.length || card.every((w) => w.result !== null);
}

/** Agrega una tarjeta nueva con las palabras ya elegidas (pickWord). */
export function showCard(state, words) {
  assertPhase(state, 'play');
  if (!cardDone(state)) throw new Error('Todavía hay una tarjeta en juego');
  const n = currentCardIndex(state) + 1;
  for (const word of words) {
    state.current.words.push({ id: word.id, text: word.text, cat: word.cat, level: word.level, result: null, card: n });
    state.usedIds.push(word.id);
  }
}

/** Compatibilidad: una tarjeta de una sola palabra. */
export function showWord(state, word) {
  showCard(state, [word]);
}

/** Primera palabra sin responder de la tarjeta en juego, o null. */
export function currentWord(state) {
  return currentCard(state).find((w) => w.result === null) || null;
}

/** Acierto en una palabra de la tarjeta (toca de nuevo para deshacerlo). */
export function toggleHit(state, wordIndex) {
  assertPhase(state, 'play');
  const card = currentCard(state);
  const w = card.find((x) => x.index === wordIndex);
  if (!w || w.result === 'skip') return;
  state.current.words[wordIndex].result = w.result === 'hit' ? null : 'hit';
}

/** Cantidad de tarjetas pasadas en una lista de palabras (en supervivencia, cada una cuesta una vida). */
export function passedCards(words) {
  const cards = new Set();
  words.forEach((w, i) => w.result === 'skip' && cards.add(w.card ?? `w${i}`));
  return cards.size;
}

/**
 * Pasa la tarjeta: las palabras sin acertar cuentan como pasadas.
 * Devuelve { roundOver } si en supervivencia el equipo se quedó sin vidas.
 */
export function passCard(state) {
  assertPhase(state, 'play');
  if (!canSkip(state) || cardDone(state)) return { roundOver: false };
  for (const w of currentCard(state)) if (w.result === null) state.current.words[w.index].result = 'skip';
  if (modeOf(state).survival) {
    const ev = evaluate(state);
    if (ev.livesLeft[state.current.team] - passedCards(state.current.words) <= 0) return { roundOver: true };
  }
  return { roundOver: false };
}

/** Compatibilidad con tarjetas de una palabra: acierta o pasa la palabra actual. */
export function markWord(state, result) {
  const w = currentWord(state);
  if (!w) return { roundOver: false };
  if (result === 'hit') {
    toggleHit(state, w.index);
    return { roundOver: false };
  }
  return passCard(state);
}

/** Termina la ronda (por tiempo, sin vidas o a pedido) y pasa a la revisión. */
export function finishRound(state, reason = 'time', now = Date.now()) {
  assertPhase(state, 'play');
  pauseTimer(state, now);
  state.current.endedAt = now;
  state.current.endReason = reason;
  state.phase = 'result';
}

/* ---------- Resultado ---------- */

export function countResults(words, adjust = 0) {
  let hits = 0;
  let skips = 0;
  for (const w of words) {
    if (w.result === 'hit') hits++;
    else if (w.result === 'skip') skips++;
  }
  return { hits: Math.max(0, hits + (adjust || 0)), skips };
}

/** Calcula el efecto de una ronda (actual o ya jugada) según el modo y el desafío. */
export function roundOutcome(state, r) {
  const mode = modeOf(state);
  const ch = getChallenge(r.challenge);
  const { hits, skips } = countResults(r.words, r.adjust);
  const die = r.die || 0;
  let advance = 0;
  let points = 0;
  let livesLost = 0;
  let note = '';
  if (mode.board) {
    advance = computeAdvance(hits, die);
    if (ch?.doubleOrNothing) {
      if (hits >= DOUBLE_OR_NOTHING_MIN) {
        advance *= 2;
        note = 'Doble o nada: ¡avance duplicado!';
      } else {
        advance = 0;
        note = `Doble o nada: hacían falta ${DOUBLE_OR_NOTHING_MIN} aciertos.`;
      }
    }
    if (ch?.bonus && hits > 0) {
      advance += ch.bonus;
      note = `Bonus de desafío: +${ch.bonus}`;
    }
  } else if (mode.survival) {
    points = hits;
    livesLost = passedCards(r.words);
  } else {
    points = usesDie(state) ? computeAdvance(hits, die) : hits;
  }
  return { hits, skips, die, advance, points, livesLost, note };
}

/** Cambia el resultado de una palabra en la revisión (acierto ↔ pasada ↔ sin responder). */
export function toggleWordResult(state, wordIndex, result) {
  assertPhase(state, 'result');
  const w = state.current.words[wordIndex];
  if (!w) return;
  w.result = result === 'hit' || result === 'skip' ? result : null;
}

export function setAdjust(state, adjust) {
  assertPhase(state, 'result');
  state.current.adjust = Math.max(-50, Math.min(50, Math.round(adjust) || 0));
}

/** Confirma la ronda: queda registrada, se recalcula el tablero y se prepara el próximo turno. */
export function confirmRound(state, now = Date.now(), rng = randomInt) {
  assertPhase(state, 'result');
  const c = state.current;
  state.rounds.push({
    team: c.team,
    describer: c.describer,
    describerName: playerName(state.config.teams[c.team], c.describer),
    die: usesDie(state) ? c.die : null,
    dieFaces: c.dieFaces,
    words: c.words,
    adjust: c.adjust,
    challenge: c.challenge,
    category: c.category,
    level: c.level,
    startedAt: c.startedAt,
    endedAt: c.endedAt || now,
    endReason: c.endReason,
    corrected: false,
  });
  state.current = null;
  state.updatedAt = now;
  return afterChange(state, now, rng);
}

/** Corrige una ronda ya confirmada (aciertos con ajuste, dado). Recalcula todo. */
export function correctRound(state, roundIndex, { adjust, die, words } = {}, now = Date.now()) {
  const r = state.rounds[roundIndex];
  if (!r) throw new Error('Ronda inexistente');
  if (state.finished) throw new Error('La partida ya terminó');
  if (typeof adjust === 'number') r.adjust = Math.max(-50, Math.min(50, Math.round(adjust)));
  if (typeof die === 'number' && r.die !== null) r.die = Math.max(0, Math.min(4, Math.round(die)));
  if (Array.isArray(words)) {
    words.forEach((res, i) => {
      if (r.words[i]) r.words[i].result = res === 'hit' || res === 'skip' ? res : null;
    });
  }
  r.corrected = true;
  state.updatedAt = now;
  const ev = evaluate(state);
  if (ev.winners.length) return finish(state, ev.winners, false, now);
  // El turno en curso se conserva (no se vuelve a sortear desafío, categoría ni dado);
  // solo se actualiza la dificultad del modo progresivo si la ronda todavía no empezó.
  const c = state.current;
  if (c && ev.eliminated[c.team] && ['turn', 'dice'].includes(state.phase)) {
    prepareTurn(state); // el equipo quedó eliminado por la corrección: juega el siguiente
    return state;
  }
  if (c && modeOf(state).progressive && ['turn', 'dice'].includes(state.phase) && !getChallenge(c.challenge)?.difficulty) {
    c.level = difficultyForPosition(ev.pos[c.team], state.config.boardSize);
  }
  return state;
}

function afterChange(state, now, rng) {
  const ev = evaluate(state);
  if (ev.winners.length) return finish(state, ev.winners, false, now);
  prepareTurn(state, rng);
  return state;
}

function finish(state, winners, early, now) {
  state.finished = true;
  state.phase = 'finished';
  state.winners = winners;
  state.endedEarly = early;
  state.finishedAt = now;
  state.current = null;
  return state;
}

/**
 * Termina la partida antes de tiempo. Gana el equipo que va adelante; si hay empate,
 * quedan todos los empatados. Una ronda en curso se descarta.
 */
export function endEarly(state, now = Date.now()) {
  if (state.finished) return state;
  const st = standings(state).filter((s) => !s.eliminated);
  const best = st.length ? st[0].value : 0;
  const winners = best > 0 ? st.filter((s) => s.value === best).map((s) => s.index) : [];
  return finish(state, winners, true, now);
}

function assertPhase(state, ...phases) {
  if (!phases.includes(state.phase)) {
    throw new Error(`Acción no válida en la fase "${state.phase}"`);
  }
}

/** Resumen para el historial y las estadísticas. */
export function summarize(state) {
  const ev = evaluate(state);
  const board = modeOf(state).board;
  const catCounts = {};
  let hits = 0;
  let skips = 0;
  const rounds = state.rounds.map((r) => {
    const o = roundOutcome(state, r);
    hits += o.hits;
    skips += o.skips;
    for (const w of r.words) catCounts[w.cat] = (catCounts[w.cat] || 0) + 1;
    return { team: r.team, describer: r.describerName, hits: o.hits, skips: o.skips, die: r.die, advance: o.advance, points: o.points };
  });
  return {
    id: state.id,
    mode: state.config.mode,
    createdAt: state.createdAt,
    finishedAt: state.finishedAt,
    endedEarly: state.endedEarly,
    teams: state.config.teams.map((t, i) => ({
      name: t.name,
      color: t.color,
      players: t.players.map((p, j) => p || `Jugador ${j + 1}`),
      score: board ? ev.pos[i] : ev.points[i],
    })),
    winners: state.winners,
    boardSize: state.config.boardSize,
    rounds,
    hits,
    skips,
    catCounts,
  };
}
