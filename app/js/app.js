// Contexto global de la aplicación: datos, persistencia y navegación entre pantallas.

import { CATEGORIES, WORDS, BANK_VERSION } from '../data/bank.js';
import { WordBank, pickWord } from './core/words.js';
import { Store, KEYS, loadHistory, saveHistory, historyStamp } from './core/storage.js';
import { summarize } from './core/game.js';
import { configureFeedback } from './ui/feedback.js';

export const DEFAULT_SETTINGS = {
  roundSeconds: 60,
  boardSize: 34,
  cardSize: 5,
  sound: true,
  vibration: true,
  keepAwake: true,
  countdown: true,
  disabledCategories: [],
  lastConfig: null,
};

class App {
  constructor() {
    this.store = new Store();
    this.bank = new WordBank({ categories: CATEGORIES, words: WORDS });
    this.bankVersion = BANK_VERSION;
    this.settings = { ...DEFAULT_SETTINGS, ...this.store.read(KEYS.settings, {}) };
    this.bank.setCustom(this.store.read(KEYS.custom, []));
    this.history = loadHistory(this.store);
    this.game = this.store.read(KEYS.game, null);
    this.screens = {};
    this.flags = {}; // avisos de la sesión (p. ej. historial agotado)
    this.current = null;
    this.root = null;
    configureFeedback(this.settings);
  }

  /* ---------- Navegación ---------- */
  register(name, renderFn) {
    this.screens[name] = renderFn;
  }

  go(name, params = {}) {
    const render = this.screens[name];
    if (!render) throw new Error(`Pantalla desconocida: ${name}`);
    if (this.current?.destroy) this.current.destroy();
    document.querySelectorAll('.sheet-backdrop, .overlay').forEach((n) => n.remove());
    const result = render(this, params) || {};
    this.root.replaceChildren(result.el);
    this.current = { name, ...result };
    window.scrollTo(0, 0);
    result.mounted?.();
  }

  /** Botón "atrás" del sistema: la pantalla decide; si no, vuelve al menú. */
  back() {
    if (document.querySelector('.sheet-backdrop')) {
      document.querySelector('.sheet-backdrop').click();
      return;
    }
    if (this.current?.onBack) this.current.onBack();
    else if (this.current?.name !== 'menu') this.go('menu');
  }

  /* ---------- Configuración ---------- */
  saveSettings(patch = {}) {
    Object.assign(this.settings, patch);
    this.store.write(KEYS.settings, this.settings);
    configureFeedback(this.settings);
  }

  enabledCategories() {
    const off = new Set(this.settings.disabledCategories);
    return this.bank.categories.filter((c) => !off.has(c.id) && this.bank.count({ categories: [c.id] }) > 0);
  }

  /* ---------- Partida ---------- */
  saveGame() {
    if (!this.game) {
      this.store.remove(KEYS.game);
      return;
    }
    this.game.updatedAt = Date.now();
    this.store.write(KEYS.game, this.game);
  }

  hasActiveGame() {
    return !!this.game && !this.game.finished;
  }

  /** Registra la partida terminada en el historial (una sola vez). */
  recordFinishedGame() {
    if (!this.game?.finished) return;
    const games = this.store.read(KEYS.games, []);
    if (games.some((g) => g.id === this.game.id)) return;
    games.unshift(summarize(this.game));
    this.store.write(KEYS.games, games.slice(0, 300));
  }

  finishedGames() {
    return this.store.read(KEYS.games, []);
  }

  clearFinishedGames() {
    this.store.remove(KEYS.games);
  }

  /* ---------- Palabras ---------- */
  /** Elige la siguiente palabra para el filtro dado y la registra en el historial. */
  nextWord(filter, extraUsed = []) {
    const used = new Set([...this.game.usedIds, ...extraUsed]);
    const r = pickWord(this.bank, { ...filter, usedInGame: used, history: this.history });
    if (r) {
      this.history.set(r.word.id, historyStamp());
      saveHistory(this.store, this.history);
    }
    return r;
  }

  /** Elige hasta n palabras distintas para una tarjeta. Devuelve { words, historyExhausted }. */
  nextCard(filter, n) {
    const words = [];
    let historyExhausted = false;
    for (let i = 0; i < n; i++) {
      const r = this.nextWord(filter, words.map((w) => w.id));
      if (!r) break;
      words.push(r.word);
      historyExhausted ||= r.historyExhausted;
    }
    return { words, historyExhausted };
  }

  resetHistory() {
    this.history.clear();
    saveHistory(this.store, this.history);
  }

  customWords() {
    return this.store.read(KEYS.custom, []);
  }

  saveCustomWords(list) {
    this.store.write(KEYS.custom, list);
    this.bank.setCustom(list);
  }
}

export const app = new App();
