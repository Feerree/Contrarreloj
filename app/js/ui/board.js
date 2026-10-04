// Tablero serpenteante con fichas animadas.

import { esc, html, teamClass } from './dom.js';
import { isChallengeSquare, difficultyForPosition } from '../core/rules.js';
import { sound } from './feedback.js';

/** Letra de la ficha: inicial de la última palabra del nombre ("Equipo Rojo" → R). */
function tokenLetter(name, i) {
  const words = String(name).trim().split(/\s+/).filter(Boolean);
  return (words[words.length - 1] || '')[0]?.toUpperCase() || String(i + 1);
}

function columnsFor(total) {
  if (total <= 42) return 6;
  if (total <= 64) return 7;
  return 9;
}

/**
 * Crea el tablero.
 * @param {{boardSize:number, teams:object[], positions:number[], current?:number, challenges?:boolean, progressive?:boolean}} opts
 */
export function createBoard({ boardSize, teams, positions, current = -1, challenges = false, progressive = false }) {
  const total = boardSize + 1;
  const cols = columnsFor(total);
  const cells = [];
  for (let i = 0; i < total; i++) {
    const row = Math.floor(i / cols);
    const col = row % 2 === 0 ? i % cols : cols - 1 - (i % cols);
    let cls = 'cell';
    let label = String(i);
    let extra = '';
    if (i === 0) {
      cls += ' start';
      label = 'Salida';
    } else if (i === boardSize) {
      cls += ' goal';
      label = '<span>META</span>';
    } else {
      if (progressive) cls += ` t${difficultyForPosition(i, boardSize)}`;
      if (challenges && isChallengeSquare(i, boardSize)) extra = '<i class="bolt" aria-hidden="true">⚡</i>';
    }
    cells.push(
      `<div class="${cls}" data-i="${i}" style="grid-row:${row + 1};grid-column:${col + 1}">${i === boardSize ? label : esc(label)}${extra}</div>`,
    );
  }
  const el = html(`<div class="board-wrap">
    <div class="board" style="--cols:${cols}" role="img" aria-label="Tablero de ${boardSize} casilleros">${cells.join('')}</div>
  </div>`);
  const tokens = teams.map((t, i) =>
    html(`<div class="token ${teamClass(t)}${i === current ? ' current' : ''}" title="${esc(t.name)}">${esc(tokenLetter(t.name, i))}</div>`),
  );
  tokens.forEach((tk) => el.append(tk));
  const pos = [...positions];

  function place(teamIndex, square) {
    const cell = el.querySelector(`.cell[data-i="${Math.min(square, boardSize)}"]`);
    if (!cell) return;
    const size = Math.max(16, Math.min(28, cell.offsetWidth * 0.42));
    const slotsPerRow = cell.offsetWidth > 3 * size ? 3 : 2;
    const slot = teamIndex;
    const sx = (slot % slotsPerRow) * (size * 0.72);
    const sy = Math.floor(slot / slotsPerRow) * (size * 0.6);
    const tk = tokens[teamIndex];
    tk.style.width = tk.style.height = `${size}px`;
    tk.style.fontSize = `${Math.round(size * 0.45)}px`;
    tk.style.left = `${cell.offsetLeft + cell.offsetWidth - size - 3 - sx}px`;
    tk.style.top = `${cell.offsetTop + cell.offsetHeight - size - 3 - sy}px`;
  }

  function layout() {
    pos.forEach((p, i) => place(i, p));
  }

  const ro = new ResizeObserver(layout);
  ro.observe(el);
  requestAnimationFrame(layout);

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  /** Mueve las fichas casillero por casillero hasta las nuevas posiciones. */
  async function animateTo(target) {
    for (let i = 0; i < target.length; i++) {
      const step = target[i] > pos[i] ? 1 : -1;
      while (pos[i] !== target[i]) {
        pos[i] += step;
        tokens[i].classList.add('hop');
        place(i, pos[i]);
        sound.step();
        await wait(150);
        tokens[i].classList.remove('hop');
        await wait(90);
      }
    }
  }

  function setCurrent(index) {
    tokens.forEach((t, i) => t.classList.toggle('current', i === index));
  }

  return { el, animateTo, setCurrent, destroy: () => ro.disconnect() };
}
