// Banco de palabras en memoria y selección aleatoria sin repeticiones.

import { normalizeKey } from './text.js';
import { randomInt } from './random.js';

export const CUSTOM_CATEGORY = { id: 'mis', name: 'Mis palabras', icon: '✍️' };
export const LEVELS = [
  { id: 1, name: 'Fácil', short: 'F' },
  { id: 2, name: 'Intermedio', short: 'I' },
  { id: 3, name: 'Difícil', short: 'D' },
];

export function levelName(level) {
  return LEVELS.find((l) => l.id === level)?.name || '';
}

export class WordBank {
  /**
   * @param {{categories: {id,name,icon}[], words: [string, number, number][]}} data
   */
  constructor(data) {
    this.categories = [...data.categories, CUSTOM_CATEGORY];
    this.categoryById = new Map(this.categories.map((c) => [c.id, c]));
    this.base = data.words.map(([text, catIndex, level]) => ({
      id: normalizeKey(text),
      text,
      cat: data.categories[catIndex].id,
      level,
      custom: false,
    }));
    this.baseIds = new Set(this.base.map((w) => w.id));
    this.custom = [];
    this.rebuild();
  }

  rebuild() {
    this.all = [...this.base, ...this.custom];
    this.byId = new Map(this.all.map((w) => [w.id, w]));
  }

  /** Reemplaza la lista de palabras personalizadas ({text, cat, level}). */
  setCustom(list) {
    this.custom = (list || [])
      .filter((w) => w && w.text && normalizeKey(w.text))
      .map((w) => ({
        id: 'c:' + normalizeKey(w.text),
        text: String(w.text).trim(),
        cat: this.categoryById.has(w.cat) ? w.cat : CUSTOM_CATEGORY.id,
        level: [1, 2, 3].includes(w.level) ? w.level : 2,
        custom: true,
      }));
    this.rebuild();
  }

  /** ¿Ya existe un concepto equivalente (banco o personalizado)? Devuelve la entrada o null. */
  findDuplicate(text) {
    const key = normalizeKey(text);
    if (!key) return null;
    return this.byId.get(key) || this.byId.get('c:' + key) || null;
  }

  get(id) {
    return this.byId.get(id) || null;
  }

  category(id) {
    return this.categoryById.get(id) || CUSTOM_CATEGORY;
  }

  /** Filtra por categorías (ids) y niveles. Listas vacías o ausentes = sin filtro. */
  filter({ categories, levels } = {}) {
    const cats = categories && categories.length ? new Set(categories) : null;
    const lv = levels && levels.length ? new Set(levels) : null;
    return this.all.filter((w) => (!cats || cats.has(w.cat)) && (!lv || lv.has(w.level)));
  }

  count(opts) {
    return this.filter(opts).length;
  }
}

/**
 * Elige la próxima palabra.
 *  - Nunca repite una palabra ya usada en la partida (usedInGame).
 *  - Prioriza las que nunca aparecieron (history: Map id → marca de tiempo).
 *  - Si todas ya aparecieron alguna vez, toma las vistas hace más tiempo y avisa (historyExhausted).
 *  - Si no queda ninguna disponible en la partida, devuelve null.
 */
export function pickWord(bank, { categories, levels, usedInGame, history, rng = randomInt }) {
  const pool = bank.filter({ categories, levels }).filter((w) => !usedInGame.has(w.id));
  if (!pool.length) return null;
  const unseen = pool.filter((w) => !history.has(w.id));
  if (unseen.length) {
    return { word: unseen[rng(unseen.length)], historyExhausted: false, remainingUnseen: unseen.length - 1 };
  }
  const oldest = [...pool].sort((a, b) => history.get(a.id) - history.get(b.id));
  const slice = oldest.slice(0, Math.max(1, Math.ceil(oldest.length * 0.1)));
  return { word: slice[rng(slice.length)], historyExhausted: true, remainingUnseen: 0 };
}

/** Cantidad de palabras de un filtro que todavía no aparecieron nunca. */
export function unseenCount(bank, filter, history) {
  return bank.filter(filter).filter((w) => !history.has(w.id)).length;
}
