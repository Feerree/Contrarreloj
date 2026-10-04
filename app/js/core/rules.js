// Reglas puras del juego. Sin DOM ni almacenamiento: se prueban con node --test.

import { randomInt } from './random.js';

export const DIE_FACES = [0, 1, 2, 0, 1, 2]; // dado de seis caras con 0, 1 y 2 repetidos

/** Tira el dado: devuelve { value, face } donde face es la cara física (0..5) para la animación. */
export function rollDie(rng = randomInt) {
  const face = rng(DIE_FACES.length);
  return { value: DIE_FACES[face], face };
}

/** Avance = máx(0, aciertos − dado). Nunca negativo: la penalización no hace retroceder. */
export function computeAdvance(hits, die) {
  const h = Math.max(0, Math.floor(Number(hits) || 0));
  const d = Math.max(0, Math.floor(Number(die) || 0));
  return Math.max(0, h - d);
}

/** Posición final acotada a la meta. */
export function clampPosition(pos, boardSize) {
  return Math.min(boardSize, Math.max(0, pos));
}

/** Nivel de dificultad según la posición (modo progresivo): tercios del tablero. */
export function difficultyForPosition(pos, boardSize) {
  const ratio = pos / boardSize;
  if (ratio < 1 / 3) return 1;
  if (ratio < 2 / 3) return 2;
  return 3;
}

/** Casilleros de desafío: cada 4 casilleros, sin incluir la meta. */
export function isChallengeSquare(pos, boardSize) {
  return pos > 0 && pos < boardSize && pos % 4 === 0;
}
