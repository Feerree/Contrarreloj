// Configuración de partida en tres pasos: modalidad → equipos → opciones.

import { html, esc, onAction, toast, teamClass } from '../ui/dom.js';
import { MODES, MODE_ORDER } from '../core/modes.js';
import { DEFAULT_CONFIG, TEAM_COLORS, createGame, normalizeConfig } from '../core/game.js';
import { unseenCount } from '../core/words.js';
import { sound } from '../ui/feedback.js';

const DEFAULT_TEAM_NAMES = { coral: 'Rojo', cyan: 'Azul', lime: 'Verde', violet: 'Violeta', amber: 'Amarillo', pink: 'Rosa' };

function initialConfig(app) {
  const base = structuredClone(app.settings.lastConfig || DEFAULT_CONFIG);
  base.roundSeconds = app.settings.roundSeconds;
  base.boardSize = app.settings.boardSize;
  const enabled = new Set(app.enabledCategories().map((c) => c.id));
  base.categories = (base.categories?.length ? base.categories : [...enabled]).filter((c) => enabled.has(c));
  if (!base.categories.length) base.categories = [...enabled];
  return base;
}

export function setupScreen(app, { step = 1, config } = {}) {
  const cfg = config || initialConfig(app);
  const el = html('<section class="screen" aria-label="Configuración de partida"></section>');
  let current = step;

  const render = () => {
    const parts = [
      `<header class="topbar"><button class="icon-btn" data-act="back" aria-label="Volver">←</button><h2>${['Modalidad', 'Equipos', 'Opciones'][current - 1]}</h2><span class="muted small">Paso ${current} de 3</span></header>`,
      `<div class="steps" aria-hidden="true">${[1, 2, 3].map((i) => `<i class="${i <= current ? 'on' : ''}"></i>`).join('')}</div>`,
    ];
    if (current === 1) parts.push(stepMode(cfg));
    if (current === 2) parts.push(stepTeams(cfg));
    if (current === 3) parts.push(stepOptions(app, cfg));
    const next =
      current < 3
        ? `<button class="btn primary big block" data-act="next">Siguiente →</button>`
        : `<button class="btn primary big block" data-act="start">¡Empezar partida! 🎲</button>`;
    parts.push(`<div class="grow"></div><div class="sticky-bottom">${next}</div>`);
    el.innerHTML = parts.join('');
    if (current === 3) updatePool();
  };

  const updatePool = () => {
    const box = el.querySelector('#pool');
    if (!box) return;
    const levels = MODES[cfg.mode].progressive ? [1, 2, 3] : cfg.levels;
    const filter = { categories: cfg.categories, levels };
    const total = app.bank.count(filter);
    const fresh = unseenCount(app.bank, filter, app.history);
    box.innerHTML = `<div><b>${total.toLocaleString('es-UY')}</b> <span class="muted small">palabras disponibles</span></div><span class="small muted">${fresh.toLocaleString('es-UY')} nunca vistas</span>`;
    el.querySelector('[data-act="start"]')?.toggleAttribute('disabled', total < 10);
    if (total < 10) box.innerHTML += '<span class="small" style="color:var(--bad)">Elegí más categorías o niveles</span>';
  };

  onAction(el, {
    back: () => (current > 1 ? ((current -= 1), render()) : app.go('menu')),
    mode: (b) => {
      cfg.mode = b.dataset.mode;
      sound.tap();
      render();
    },
    next: () => {
      if (current === 2) {
        const issue = validateTeams(cfg);
        if (issue) return toast(issue);
      }
      current += 1;
      render();
    },
    'team-count': (b) => {
      const n = Math.max(2, Math.min(6, cfg.teams.length + Number(b.dataset.d)));
      while (cfg.teams.length < n) {
        const used = new Set(cfg.teams.map((t) => t.color));
        const color = TEAM_COLORS.find((c) => !used.has(c)) || TEAM_COLORS[0];
        cfg.teams.push({ name: `Equipo ${DEFAULT_TEAM_NAMES[color]}`, color, players: ['', '', ''] });
      }
      cfg.teams.length = n;
      render();
    },
    'player-count': (b) => {
      const t = cfg.teams[Number(b.dataset.t)];
      const n = Math.max(2, Math.min(8, t.players.length + Number(b.dataset.d)));
      while (t.players.length < n) t.players.push('');
      t.players.length = n;
      render();
    },
    color: (b) => {
      const t = cfg.teams[Number(b.dataset.t)];
      const old = t.color;
      const other = cfg.teams.find((x) => x !== t && x.color === b.dataset.color);
      if (other) other.color = old; // intercambia para que no se repitan
      if (t.name === `Equipo ${DEFAULT_TEAM_NAMES[old]}`) t.name = `Equipo ${DEFAULT_TEAM_NAMES[b.dataset.color]}`;
      t.color = b.dataset.color;
      render();
    },
    cat: (b) => {
      const id = b.dataset.cat;
      const set = new Set(cfg.categories);
      set.has(id) ? set.delete(id) : set.add(id);
      cfg.categories = [...set];
      b.setAttribute('aria-pressed', set.has(id));
      updatePool();
    },
    'cats-all': () => {
      cfg.categories = app.enabledCategories().map((c) => c.id);
      render();
    },
    'cats-none': () => {
      cfg.categories = [];
      render();
    },
    level: (b) => {
      const l = Number(b.dataset.level);
      const set = new Set(cfg.levels);
      set.has(l) ? set.delete(l) : set.add(l);
      cfg.levels = [...set].sort();
      b.setAttribute('aria-pressed', set.has(l));
      updatePool();
    },
    num: (b) => {
      const key = b.dataset.key;
      const step = Number(b.dataset.step);
      const [min, max] = b.dataset.range.split(',').map(Number);
      cfg[key] = Math.max(min, Math.min(max, Number(cfg[key]) + step));
      el.querySelector(`output[data-key="${key}"]`).textContent = fmtValue(key, cfg[key]);
    },
    usedie: (b) => {
      cfg.useDie = b.checked;
    },
    start: () => {
      if (!cfg.categories.length) return toast('Elegí al menos una categoría');
      if (!MODES[cfg.mode].progressive && !cfg.levels.length) return toast('Elegí al menos un nivel de dificultad');
      let normalized;
      try {
        normalized = normalizeConfig(cfg);
      } catch (e) {
        return toast(e.message);
      }
      app.saveSettings({ lastConfig: normalized });
      app.game = createGame(normalized);
      app.saveGame();
      sound.start();
      app.go('board');
    },
  });

  // Inputs de texto: se guardan sin volver a dibujar (para no perder el foco).
  el.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.field === 'team') cfg.teams[Number(t.dataset.t)].name = t.value;
    if (t.dataset.field === 'player') cfg.teams[Number(t.dataset.t)].players[Number(t.dataset.p)] = t.value;
  });
  el.addEventListener('change', (e) => {
    if (e.target.dataset.act === 'usedie') cfg.useDie = e.target.checked;
  });

  render();
  return { el, onBack: () => el.querySelector('[data-act="back"]').click() };
}

function validateTeams(cfg) {
  const names = cfg.teams.map((t) => t.name.trim().toLowerCase()).filter(Boolean);
  if (new Set(names).size !== names.length) return 'Hay dos equipos con el mismo nombre';
  return '';
}

function stepMode(cfg) {
  const cards = MODE_ORDER.map((id) => {
    const m = MODES[id];
    return `<button class="mode-card" data-act="mode" data-mode="${id}" aria-pressed="${cfg.mode === id}">
      <span class="ico">${m.icon}</span><b>${esc(m.name)}</b><span>${esc(m.short)}</span></button>`;
  }).join('');
  return `<div class="mode-list">${cards}</div>
    <div class="card"><p class="mode-desc">${esc(MODES[cfg.mode].description)}</p></div>`;
}

function stepTeams(cfg) {
  const teams = cfg.teams
    .map((t, i) => {
      const swatches = TEAM_COLORS.map(
        (c) => `<button class="swatch" style="--c:var(--team-${c})" data-act="color" data-t="${i}" data-color="${c}" aria-pressed="${t.color === c}" aria-label="Color ${DEFAULT_TEAM_NAMES[c]}"></button>`,
      ).join('');
      const players = t.players
        .map(
          (p, j) => `<input class="input" maxlength="24" data-field="player" data-t="${i}" data-p="${j}" value="${esc(p)}" placeholder="Jugador ${j + 1}" aria-label="Jugador ${j + 1} de ${esc(t.name)}">`,
        )
        .join('');
      return `<div class="card team-editor ${teamClass(t)} stack">
        <input class="input" maxlength="24" data-field="team" data-t="${i}" value="${esc(t.name)}" aria-label="Nombre del equipo ${i + 1}" style="font-weight:700;font-size:19px">
        <div class="swatches">${swatches}</div>
        <div class="row between"><span class="small muted">Integrantes</span>
          <div class="stepper"><button data-act="player-count" data-t="${i}" data-d="-1" aria-label="Quitar integrante">−</button><output>${t.players.length}</output><button data-act="player-count" data-t="${i}" data-d="1" aria-label="Agregar integrante">+</button></div>
        </div>
        <div class="players">${players}</div>
      </div>`;
    })
    .join('');
  return `<div class="card row between"><b>Cantidad de equipos</b>
      <div class="stepper"><button data-act="team-count" data-d="-1" aria-label="Quitar equipo">−</button><output>${cfg.teams.length}</output><button data-act="team-count" data-d="1" aria-label="Agregar equipo">+</button></div>
    </div>
    <p class="small muted">Los nombres son opcionales. El narrador rota solo en cada turno, en el orden de la lista.</p>
    ${teams}`;
}

function fmtValue(key, v) {
  if (key === 'roundSeconds') return `${v} s`;
  return String(v);
}

function numberRow(label, key, value, step, min, max, hint = '') {
  return `<div class="row between"><div><b>${label}</b>${hint ? `<p class="small muted">${hint}</p>` : ''}</div>
    <div class="stepper"><button data-act="num" data-key="${key}" data-step="${-step}" data-range="${min},${max}" aria-label="Menos">−</button><output data-key="${key}">${fmtValue(key, value)}</output><button data-act="num" data-key="${key}" data-step="${step}" data-range="${min},${max}" aria-label="Más">+</button></div></div>`;
}

function stepOptions(app, cfg) {
  const m = MODES[cfg.mode];
  const rows = [numberRow('Duración de la ronda', 'roundSeconds', cfg.roundSeconds, 5, 15, 300)];
  if (m.board) rows.push(numberRow('Casilleros', 'boardSize', cfg.boardSize, 2, 10, 80, 'El original tiene 34'));
  if (m.fixedRounds) {
    rows.push(numberRow('Rondas por equipo', 'roundsPerTeam', cfg.roundsPerTeam, 1, 1, 20));
    rows.push(`<label class="switch"><span><b>Usar dado</b><p class="small muted">Resta 0, 1 o 2 aciertos por ronda</p></span><span class="toggle"><input type="checkbox" data-act="usedie" ${cfg.useDie ? 'checked' : ''}><span></span></span></label>`);
  }
  if (m.survival) {
    rows.push(numberRow('Vidas por equipo', 'lives', cfg.lives, 1, 1, 20, 'Cada palabra pasada resta una'));
    rows.push(numberRow('Puntos para ganar', 'targetPoints', cfg.targetPoints, 5, 5, 200));
  }
  const cats = app
    .enabledCategories()
    .map(
      (c) => `<button class="chip" data-act="cat" data-cat="${c.id}" aria-pressed="${cfg.categories.includes(c.id)}">${c.icon} ${esc(c.name)}</button>`,
    )
    .join('');
  const levels = m.progressive
    ? '<p class="small muted">En el modo progresivo la dificultad la define la posición de cada equipo.</p>'
    : `<div class="row wrap">${[
        [1, 'Fácil'],
        [2, 'Intermedio'],
        [3, 'Difícil'],
      ]
        .map(([l, n]) => `<button class="chip" data-act="level" data-level="${l}" aria-pressed="${cfg.levels.includes(l)}">${n}</button>`)
        .join('')}</div>`;
  return `<div class="card stack">${rows.join('')}</div>
    <div class="card stack"><div class="row between"><h3 style="margin:0">Dificultad</h3></div>${levels}</div>
    <div class="card stack">
      <div class="row between"><h3 style="margin:0">Categorías</h3>
        <div class="row"><button class="chip" data-act="cats-all">Todas</button><button class="chip" data-act="cats-none">Ninguna</button></div></div>
      <div class="cat-grid">${cats}</div>
    </div>
    <div class="pool-info" id="pool" aria-live="polite"></div>`;
}
