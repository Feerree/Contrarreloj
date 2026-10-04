// Persistencia local. Todo queda en el dispositivo (localStorage), con claves versionadas.
// Si el almacenamiento no está disponible (modo privado estricto), funciona en memoria.

const PREFIX = 'contrarreloj.';
export const KEYS = {
  settings: 'settings.v1',
  game: 'game.v1',
  history: 'history.v1',
  games: 'games.v1',
  custom: 'custom.v1',
};

function makeBackend() {
  try {
    const ls = globalThis.localStorage;
    const probe = PREFIX + 'probe';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return ls;
  } catch {
    const mem = new Map();
    return {
      getItem: (k) => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => mem.set(k, String(v)),
      removeItem: (k) => mem.delete(k),
      memory: true,
    };
  }
}

export class Store {
  constructor(backend = makeBackend()) {
    this.backend = backend;
  }

  get persistent() {
    return !this.backend.memory;
  }

  read(key, fallback) {
    try {
      const raw = this.backend.getItem(PREFIX + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  write(key, value) {
    try {
      this.backend.setItem(PREFIX + key, JSON.stringify(value));
      return true;
    } catch (err) {
      console.warn('No se pudo guardar', key, err);
      return false;
    }
  }

  remove(key) {
    try {
      this.backend.removeItem(PREFIX + key);
    } catch {
      /* sin efecto */
    }
  }

  /** Respaldo completo para exportar. */
  exportAll() {
    const data = {};
    for (const k of Object.values(KEYS)) data[k] = this.read(k, null);
    return { app: 'contrarreloj', exportedAt: new Date().toISOString(), data };
  }

  importAll(backup) {
    if (!backup || backup.app !== 'contrarreloj' || typeof backup.data !== 'object') {
      throw new Error('El archivo no es un respaldo de Contrarreloj');
    }
    for (const k of Object.values(KEYS)) {
      if (k in backup.data) {
        if (backup.data[k] === null) this.remove(k);
        else this.write(k, backup.data[k]);
      }
    }
  }
}

/* Historial de palabras: { id: minutos desde epoch } para ocupar poco espacio. */
export function loadHistory(store) {
  const obj = store.read(KEYS.history, {});
  return new Map(Object.entries(obj || {}));
}

export function saveHistory(store, map) {
  store.write(KEYS.history, Object.fromEntries(map));
}

export const historyStamp = (now = Date.now()) => Math.floor(now / 60000);
