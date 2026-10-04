// Pruebas de la lógica pura. Ejecutar con: npm test  (o node --test tests/)

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { computeAdvance, rollDie, DIE_FACES, difficultyForPosition, isChallengeSquare } from '../app/js/core/rules.js';
import { randomInt, shuffle } from '../app/js/core/random.js';
import { normalizeKey, looseKey } from '../app/js/core/text.js';
import { WordBank, pickWord } from '../app/js/core/words.js';
import * as G from '../app/js/core/game.js';
import { computeStats } from '../app/js/core/stats.js';
import { Store, KEYS } from '../app/js/core/storage.js';
import { CATEGORIES, WORDS } from '../app/data/bank.js';

/* ---------- Penalización ---------- */

test('avance = máx(0, aciertos − dado) con los ejemplos del reglamento', () => {
  assert.equal(computeAdvance(5, 1), 4);
  assert.equal(computeAdvance(3, 2), 1);
  assert.equal(computeAdvance(0, 0), 0);
  assert.equal(computeAdvance(2, 2), 0);
});

test('la penalización nunca hace retroceder', () => {
  for (let hits = 0; hits <= 3; hits++) {
    for (let die = 0; die <= 4; die++) assert.ok(computeAdvance(hits, die) >= 0);
  }
  assert.equal(computeAdvance(1, 2), 0);
  assert.equal(computeAdvance(0, 2), 0);
  assert.equal(computeAdvance(-3, 0), 0);
});

/* ---------- Dado ---------- */

test('el dado solo devuelve 0, 1 o 2', () => {
  for (let i = 0; i < 2000; i++) {
    const { value, face } = rollDie();
    assert.ok([0, 1, 2].includes(value));
    assert.equal(DIE_FACES[face], value);
  }
});

test('el dado es aproximadamente uniforme (chi-cuadrado, 30.000 tiradas)', () => {
  const N = 30000;
  const counts = [0, 0, 0];
  for (let i = 0; i < N; i++) counts[rollDie().value]++;
  const expected = N / 3;
  const chi = counts.reduce((s, c) => s + (c - expected) ** 2 / expected, 0);
  // 2 grados de libertad: valor crítico 13.8 para p = 0.001
  assert.ok(chi < 13.8, `chi² = ${chi.toFixed(2)}, conteos ${counts}`);
});

test('randomInt respeta el rango y shuffle conserva elementos', () => {
  for (let i = 0; i < 1000; i++) {
    const v = randomInt(7);
    assert.ok(v >= 0 && v < 7 && Number.isInteger(v));
  }
  const arr = [1, 2, 3, 4, 5];
  assert.deepEqual(shuffle(arr).sort(), arr);
});

/* ---------- Texto ---------- */

test('normalizeKey ignora tildes y mayúsculas pero conserva la ñ', () => {
  assert.equal(normalizeKey('Árbol'), 'arbol');
  assert.equal(normalizeKey('  Ñandú '), 'ñandu');
  assert.notEqual(normalizeKey('Pena'), normalizeKey('Peña'));
  assert.equal(looseKey('Las pirámides de Egipto'), looseKey('Pirámide de Egipto'));
  assert.equal(looseKey('Flores'), looseKey('Flor'));
  assert.notEqual(looseKey('Arnés'), looseKey('ARN'));
  assert.notEqual(looseKey('La Paz'), looseKey('Paz'));
});

/* ---------- Banco ---------- */

test('el banco tiene más de 5.000 conceptos únicos', () => {
  const bank = new WordBank({ categories: CATEGORIES, words: WORDS });
  assert.ok(bank.all.length >= 5000, `solo ${bank.all.length}`);
  assert.equal(new Set(bank.all.map((w) => w.id)).size, bank.all.length);
});

test('cada concepto tiene categoría válida y dificultad 1-3', () => {
  const bank = new WordBank({ categories: CATEGORIES, words: WORDS });
  for (const w of bank.all) {
    assert.ok(bank.categoryById.has(w.cat), w.text);
    assert.ok([1, 2, 3].includes(w.level), w.text);
    assert.ok(w.text.trim().length > 0);
  }
});

test('filtros por categoría y dificultad', () => {
  const bank = new WordBank({ categories: CATEGORIES, words: WORDS });
  const list = bank.filter({ categories: ['animales'], levels: [1] });
  assert.ok(list.length > 20);
  assert.ok(list.every((w) => w.cat === 'animales' && w.level === 1));
  const combo = bank.filter({ categories: ['animales', 'deportes'], levels: [2, 3] });
  assert.ok(combo.every((w) => ['animales', 'deportes'].includes(w.cat) && w.level > 1));
});

test('palabras personalizadas: se agregan, se detectan duplicados y se eliminan', () => {
  const bank = new WordBank({ categories: CATEGORIES, words: WORDS });
  assert.ok(bank.findDuplicate('perro')); // ya existe en el banco
  bank.setCustom([{ text: 'Tía Marta', cat: 'mis', level: 1 }]);
  assert.ok(bank.get('c:tia marta'));
  assert.ok(bank.findDuplicate('tia  MARTA'));
  bank.setCustom([]);
  assert.equal(bank.get('c:tia marta'), null);
});

test('nunca se repite una palabra dentro de la partida', () => {
  const bank = new WordBank({ categories: CATEGORIES, words: WORDS });
  const used = new Set();
  const history = new Map();
  const filter = { categories: ['uruguay'], levels: [3] };
  const total = bank.count(filter);
  for (let i = 0; i < total; i++) {
    const r = pickWord(bank, { ...filter, usedInGame: used, history });
    assert.ok(r, `faltó palabra en la vuelta ${i}`);
    assert.ok(!used.has(r.word.id), 'palabra repetida');
    used.add(r.word.id);
  }
  assert.equal(pickWord(bank, { ...filter, usedInGame: used, history }), null);
});

test('prioriza las palabras nunca vistas y avisa cuando el historial se agota', () => {
  const bank = new WordBank({ categories: CATEGORIES, words: WORDS });
  const filter = { categories: ['latam'], levels: [1] };
  const pool = bank.filter(filter);
  const history = new Map(pool.slice(1).map((w, i) => [w.id, i + 1]));
  const r = pickWord(bank, { ...filter, usedInGame: new Set(), history });
  assert.equal(r.word.id, pool[0].id);
  assert.equal(r.historyExhausted, false);
  history.set(pool[0].id, 999);
  const r2 = pickWord(bank, { ...filter, usedInGame: new Set(), history });
  assert.equal(r2.historyExhausted, true);
  // elige entre las vistas hace más tiempo
  assert.ok(history.get(r2.word.id) <= Math.ceil(pool.length * 0.1));
});

/* ---------- Partida ---------- */

const fixedRng = (seq) => {
  let i = 0;
  return () => seq[i++ % seq.length];
};

function playRound(state, { hits, skips = 0, rngDie = [0] }) {
  G.chooseDescriber(state, state.current.describer);
  if (state.phase === 'dice') G.rollForTurn(state, fixedRng(rngDie));
  G.startRound(state, 1000);
  let n = 0;
  for (let i = 0; i < hits; i++) {
    G.showWord(state, { id: `w${state.usedIds.length}`, text: 'x', cat: 'animales', level: 1 });
    G.markWord(state, 'hit');
    n++;
  }
  for (let i = 0; i < skips; i++) {
    G.showWord(state, { id: `w${state.usedIds.length}`, text: 'x', cat: 'animales', level: 1 });
    const { roundOver } = G.markWord(state, 'skip');
    if (roundOver) break;
  }
  G.finishRound(state, 'time', 61000);
  G.confirmRound(state, 62000, fixedRng([0]));
  return n;
}

const twoTeams = (extra = {}) =>
  G.createGame(
    {
      teams: [
        { name: 'A', players: ['Ana', 'Beto', 'Caro'] },
        { name: 'B', players: ['Dani', 'Eli', 'Fede'] },
      ],
      ...extra,
    },
    { now: 0 },
  );

test('los equipos se alternan y nadie juega dos turnos seguidos', () => {
  const s = twoTeams();
  const order = [];
  for (let i = 0; i < 6; i++) {
    order.push(s.current.team);
    playRound(s, { hits: 1 });
  }
  assert.deepEqual(order, [0, 1, 0, 1, 0, 1]);
});

test('el narrador rota dentro del equipo', () => {
  const s = twoTeams();
  const describers = [];
  for (let i = 0; i < 6; i++) {
    describers.push(`${s.current.team}:${s.current.describer}`);
    playRound(s, { hits: 0 });
  }
  assert.deepEqual(describers, ['0:0', '1:0', '0:1', '1:1', '0:2', '1:2']);
});

test('el avance usa la fórmula y las fichas se actualizan', () => {
  const s = twoTeams();
  // dado: cara 1 → valor 1 ; cara 2 → valor 2
  playRound(s, { hits: 5, rngDie: [1] }); // A: 5 − 1 = 4
  playRound(s, { hits: 3, rngDie: [2] }); // B: 3 − 2 = 1
  playRound(s, { hits: 1, rngDie: [2] }); // A: 1 − 2 → 0
  const ev = G.evaluate(s);
  assert.deepEqual(ev.pos, [4, 1]);
});

test('victoria al llegar a la meta (34 casilleros)', () => {
  const s = twoTeams();
  for (let i = 0; i < 20 && !s.finished; i++) playRound(s, { hits: 9, rngDie: [0] });
  assert.equal(s.finished, true);
  assert.deepEqual(s.winners, [0]); // A llega primero: 9·4 = 36 ≥ 34
  assert.equal(G.evaluate(s).pos[0], 34); // la ficha se queda en la meta
  assert.equal(s.phase, 'finished');
});

test('corregir una ronda recalcula posiciones', () => {
  const s = twoTeams();
  playRound(s, { hits: 3, rngDie: [0] });
  playRound(s, { hits: 2, rngDie: [0] });
  G.correctRound(s, 0, { adjust: 2 }); // A pasa de 3 a 5
  assert.deepEqual(G.evaluate(s).pos, [5, 2]);
  G.correctRound(s, 1, { die: 2 }); // B: 2 − 2 = 0
  assert.deepEqual(G.evaluate(s).pos, [5, 0]);
  assert.equal(s.current.team, 0); // el turno sigue siendo de A
});

test('en la revisión se puede marcar como acertada una palabra que quedó sin responder', () => {
  const s = twoTeams();
  G.chooseDescriber(s, 0);
  G.rollForTurn(s, fixedRng([0]));
  G.startRound(s, 0);
  G.showWord(s, { id: 'a', text: 'a', cat: 'animales', level: 1 });
  G.markWord(s, 'hit');
  G.showWord(s, { id: 'b', text: 'b', cat: 'animales', level: 1 });
  G.finishRound(s, 'time', 60000);
  assert.equal(G.roundOutcome(s, s.current).hits, 1);
  G.toggleWordResult(s, 1, 'hit');
  assert.equal(G.roundOutcome(s, s.current).hits, 2);
});

test('el cronómetro se basa en la hora real: pausa y reanudación exactas', () => {
  const s = twoTeams();
  G.chooseDescriber(s, 0);
  G.rollForTurn(s, fixedRng([0]));
  G.startRound(s, 10_000);
  assert.equal(G.remainingMs(s, 10_000), 60_000);
  assert.equal(G.remainingMs(s, 25_000), 45_000);
  G.pauseTimer(s, 25_000);
  assert.equal(G.remainingMs(s, 99_000), 45_000); // en pausa no corre
  G.resumeTimer(s, 100_000);
  assert.equal(G.remainingMs(s, 130_000), 15_000);
  assert.equal(G.remainingMs(s, 500_000), 0); // nunca negativo
  // La partida guardada y recargada conserva el tiempo (JSON ida y vuelta)
  const copy = JSON.parse(JSON.stringify(s));
  assert.equal(G.remainingMs(copy, 130_000), 15_000);
});

test('modo libre: rondas fijas, puntos y empate', () => {
  const s = twoTeams({ mode: 'libre', roundsPerTeam: 2 });
  assert.equal(G.usesDie(s), false);
  playRound(s, { hits: 4 });
  playRound(s, { hits: 3 });
  playRound(s, { hits: 2 });
  assert.equal(s.finished, false);
  playRound(s, { hits: 3 });
  assert.equal(s.finished, true);
  assert.deepEqual(s.winners, [0, 1]); // 6 a 6
});

test('modo libre con dado opcional aplica la penalización', () => {
  const s = twoTeams({ mode: 'libre', roundsPerTeam: 1, useDie: true });
  playRound(s, { hits: 4, rngDie: [2] }); // 4 − 2
  playRound(s, { hits: 1, rngDie: [1] }); // 1 − 1
  assert.deepEqual(G.evaluate(s).points, [2, 0]);
  assert.deepEqual(s.winners, [0]);
});

test('supervivencia: cada pasada cuesta una vida y sin vidas se termina', () => {
  const s = twoTeams({ mode: 'supervivencia', lives: 2, targetPoints: 50 });
  assert.equal(G.usesDie(s), false);
  playRound(s, { hits: 3, skips: 1 }); // A: 1 vida
  playRound(s, { hits: 1 });
  playRound(s, { hits: 2, skips: 5 }); // A pierde la última vida en la primera pasada
  assert.equal(s.finished, true);
  assert.deepEqual(s.winners, [1]);
  assert.equal(s.rounds[2].words.filter((w) => w.result === 'skip').length, 1);
});

test('supervivencia: gana quien llega al objetivo', () => {
  const s = twoTeams({ mode: 'supervivencia', lives: 3, targetPoints: 6 });
  playRound(s, { hits: 6 });
  assert.deepEqual(s.winners, [0]);
});

test('progresivo: la dificultad depende de la posición', () => {
  assert.equal(difficultyForPosition(0, 34), 1);
  assert.equal(difficultyForPosition(12, 34), 2);
  assert.equal(difficultyForPosition(30, 34), 3);
  const s = twoTeams({ mode: 'progresivo' });
  assert.equal(s.current.level, 1);
  playRound(s, { hits: 13 });
  playRound(s, { hits: 0 });
  assert.equal(s.current.level, 2);
});

test('desafío: casilleros cada 4 y efectos sobre el resultado', () => {
  assert.equal(isChallengeSquare(4, 34), true);
  assert.equal(isChallengeSquare(5, 34), false);
  assert.equal(isChallengeSquare(0, 34), false);
  const s = twoTeams({ mode: 'desafio' });
  playRound(s, { hits: 4 }); // A queda en 4 (casillero ⚡)
  playRound(s, { hits: 0 });
  assert.ok(s.current.challenge, 'debería haber desafío');
  // doble o nada
  s.current.challenge = 'doble';
  const fake = { words: Array(6).fill({ result: 'hit' }), adjust: 0, die: 1, challenge: 'doble' };
  assert.equal(G.roundOutcome(s, fake).advance, 10);
  assert.equal(G.roundOutcome(s, { ...fake, words: Array(5).fill({ result: 'hit' }) }).advance, 0);
  // relámpago: mitad del tiempo
  s.current.challenge = 'relampago';
  assert.equal(G.roundDurationMs(s), 30_000);
  // sin pasar
  s.current.challenge = 'sinpasar';
  assert.equal(G.canSkip(s), false);
});

test('ruleta: cada turno tiene una categoría sorteada', () => {
  const s = twoTeams({ mode: 'ruleta', categories: ['animales', 'deportes'] });
  assert.ok(['animales', 'deportes'].includes(s.current.category));
  assert.deepEqual(G.roundFilter(s).categories, [s.current.category]);
});

test('terminar anticipadamente: gana quien va adelante', () => {
  const s = twoTeams();
  playRound(s, { hits: 5 });
  playRound(s, { hits: 2 });
  G.endEarly(s, 5);
  assert.equal(s.finished, true);
  assert.equal(s.endedEarly, true);
  assert.deepEqual(s.winners, [0]);
});

test('no se puede jugar fuera de fase', () => {
  const s = twoTeams();
  assert.throws(() => G.startRound(s));
  assert.throws(() => G.confirmRound(s));
});

/* ---------- Estadísticas y almacenamiento ---------- */

test('estadísticas por equipo y promedios', () => {
  const s1 = twoTeams();
  for (let i = 0; i < 20 && !s1.finished; i++) playRound(s1, { hits: 9 });
  const s2 = twoTeams({ mode: 'libre', roundsPerTeam: 1 });
  playRound(s2, { hits: 1 });
  playRound(s2, { hits: 4 });
  const st = computeStats([G.summarize(s1), G.summarize(s2)]);
  assert.equal(st.played, 2);
  const a = st.teams.find((t) => t.name === 'A');
  const b = st.teams.find((t) => t.name === 'B');
  assert.equal(a.won, 1);
  assert.equal(b.won, 1);
  assert.equal(a.pct, 50);
  assert.ok(st.avgHits > 0);
  assert.equal(st.topCategories[0].cat, 'animales');
});

test('almacenamiento: guarda, lee y exporta/importa respaldos', () => {
  const mem = new Map();
  const backend = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) };
  const store = new Store(backend);
  const s = twoTeams();
  store.write(KEYS.game, s);
  assert.deepEqual(store.read(KEYS.game), JSON.parse(JSON.stringify(s)));
  const backup = store.exportAll();
  const store2 = new Store({ getItem: () => null, setItem: (k, v) => mem.set('2' + k, v), removeItem() {} });
  store2.importAll(backup);
  assert.ok(mem.has('2contrarreloj.' + KEYS.game));
  assert.throws(() => store2.importAll({ foo: 1 }));
});

/* ---------- Tarjetas de varias palabras ---------- */

const card = (prefix, n = 5) => Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}`, text: `${prefix}${i}`, cat: 'animales', level: 1 }));

test('tarjeta de 5: se marcan aciertos en cualquier orden, se deshacen y pasar cuenta las restantes', () => {
  const s = twoTeams();
  assert.equal(s.config.cardSize, 5);
  G.chooseDescriber(s, 0);
  G.rollForTurn(s, fixedRng([0]));
  G.startRound(s, 0);
  G.showCard(s, card('a'));
  assert.equal(G.currentCard(s).length, 5);
  assert.throws(() => G.showCard(s, card('b')), 'no se puede sacar otra con la tarjeta en juego');
  G.toggleHit(s, 3);
  G.toggleHit(s, 0);
  G.toggleHit(s, 4);
  G.toggleHit(s, 4); // deshacer
  assert.equal(G.countResults(s.current.words).hits, 2);
  G.passCard(s);
  assert.deepEqual(G.countResults(s.current.words), { hits: 2, skips: 3 });
  assert.equal(G.cardDone(s), true);
  G.showCard(s, card('b'));
  for (let i = 5; i < 10; i++) G.toggleHit(s, i);
  assert.equal(G.cardDone(s), true, 'tarjeta completa');
  assert.equal(G.currentCardIndex(s), 1);
  assert.equal(new Set(s.usedIds).size, 10);
});

test('supervivencia con tarjetas: cada tarjeta pasada cuesta una sola vida', () => {
  const s = twoTeams({ mode: 'supervivencia', lives: 2, targetPoints: 50 });
  G.chooseDescriber(s, 0);
  G.startRound(s, 0);
  G.showCard(s, card('a'));
  G.toggleHit(s, 0);
  assert.equal(G.passCard(s).roundOver, false); // 4 palabras pasadas = 1 vida
  G.showCard(s, card('b'));
  assert.equal(G.passCard(s).roundOver, true); // segunda tarjeta: sin vidas
  G.finishRound(s, 'lives', 1000);
  assert.equal(G.roundOutcome(s, s.current).livesLost, 2);
});

test('"sin pasar" impide pasar la tarjeta', () => {
  const s = twoTeams();
  s.current.challenge = 'sinpasar';
  G.chooseDescriber(s, 0);
  G.rollForTurn(s, fixedRng([0]));
  G.startRound(s, 0);
  G.showCard(s, card('a'));
  G.passCard(s);
  assert.equal(G.countResults(s.current.words).skips, 0);
});
