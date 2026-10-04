// Modalidades de juego y desafíos.

export const MODES = {
  clasico: {
    id: 'clasico',
    name: 'Clásico',
    icon: '🎲',
    short: 'Las reglas de siempre: aciertos menos dado.',
    description:
      'Cada equipo describe durante el tiempo de la ronda. Al terminar, se restan los puntos del dado y la ficha avanza esa cantidad. Gana quien llega primero a la meta.',
    board: true,
    die: 'always',
  },
  progresivo: {
    id: 'progresivo',
    name: 'Progresivo',
    icon: '📈',
    short: 'Cuanto más avanzás, más difíciles las palabras.',
    description:
      'Igual que el clásico, pero la dificultad depende de dónde está tu ficha: primer tercio fácil, segundo intermedio y último tercio difícil. Los que vienen atrás la tienen más fácil.',
    board: true,
    die: 'always',
    progressive: true,
  },
  desafio: {
    id: 'desafio',
    name: 'Desafío',
    icon: '⚡',
    short: 'Casilleros con reglas especiales.',
    description:
      'Tablero clásico con casilleros ⚡. Si tu equipo empieza el turno parado en uno, se sortea un desafío: menos tiempo, sin pasar, mímica, doble o nada y más.',
    board: true,
    die: 'always',
    challenges: true,
  },
  ruleta: {
    id: 'ruleta',
    name: 'Ruleta temática',
    icon: '🎡',
    short: 'Cada turno se sortea una categoría.',
    description:
      'Antes de cada turno gira la ruleta y sale una categoría. Todas las palabras de esa ronda son de ese tema. Se juega en el tablero con las reglas del clásico.',
    board: true,
    die: 'always',
    roulette: true,
  },
  libre: {
    id: 'libre',
    name: 'Libre',
    icon: '🏆',
    short: 'Sin tablero: gana quien suma más aciertos.',
    description:
      'Se juega una cantidad fija de rondas por equipo y se suman los aciertos. El dado es opcional. Ideal para partidas cortas o con muchos equipos.',
    board: false,
    die: 'optional',
    fixedRounds: true,
  },
  supervivencia: {
    id: 'supervivencia',
    name: 'Supervivencia',
    icon: '❤️',
    short: 'Cada palabra pasada cuesta una vida.',
    description:
      'Cada equipo tiene vidas para toda la partida y cada palabra que pasa le quita una. Si se queda sin vidas, queda eliminado. Gana el primero que llega al objetivo de puntos o el último que sobrevive.',
    board: false,
    die: 'never',
    survival: true,
  },
};

export const MODE_ORDER = ['clasico', 'progresivo', 'desafio', 'ruleta', 'libre', 'supervivencia'];

/**
 * Desafíos del modo Desafío. Los campos con efecto real en el juego:
 *  timeFactor   → multiplica la duración de la ronda
 *  noDie        → no se tira el dado (vale 0)
 *  doubleDie    → se tiran dos dados y se suman
 *  noSkip       → el botón Pasar queda deshabilitado
 *  difficulty   → fuerza un nivel de dificultad
 *  bonus        → casilleros extra si hubo al menos un acierto
 *  singleCategory → todas las palabras de una categoría sorteada
 *  randomDescriber → la app elige al narrador
 *  doubleOrNothing → con 6+ aciertos el avance se duplica; si no, no avanza
 */
export const CHALLENGES = [
  {
    id: 'relampago',
    name: 'Relámpago',
    icon: '⚡',
    text: 'La mitad del tiempo, pero sin dado.',
    timeFactor: 0.5,
    noDie: true,
  },
  {
    id: 'sinpasar',
    name: 'Sin pasar',
    icon: '🚫',
    text: 'Prohibido pasar palabras. Hasta adivinarla, no sale otra.',
    noSkip: true,
  },
  {
    id: 'mimica',
    name: 'Mímica',
    icon: '🤐',
    text: 'Solo gestos: el narrador no puede hablar ni hacer sonidos. A cambio, no se tira el dado.',
    noDie: true,
  },
  {
    id: 'unapalabra',
    name: 'Una palabra',
    icon: '☝️',
    text: 'Cada pista tiene que ser una sola palabra. A cambio, no se tira el dado.',
    noDie: true,
  },
  {
    id: 'dificiles',
    name: 'Nivel experto',
    icon: '🧠',
    text: 'Todas las palabras son difíciles. Si acertás al menos una, sumás 2 casilleros extra.',
    difficulty: 3,
    bonus: 2,
  },
  {
    id: 'tema',
    name: 'Tema único',
    icon: '🎯',
    text: 'Todas las palabras de la ronda son de una misma categoría sorteada.',
    singleCategory: true,
  },
  {
    id: 'sorpresa',
    name: 'Narrador sorpresa',
    icon: '🎭',
    text: 'La app elige quién describe. Sin discusión.',
    randomDescriber: true,
  },
  {
    id: 'doble',
    name: 'Doble o nada',
    icon: '💥',
    text: 'Con 6 o más aciertos tu avance se duplica. Con menos, no avanzás.',
    doubleOrNothing: true,
  },
  {
    id: 'dosdados',
    name: 'Dado doble',
    icon: '🎲',
    text: 'Mala suerte: se tiran dos dados y se restan los dos.',
    doubleDie: true,
  },
];

export function getChallenge(id) {
  return CHALLENGES.find((c) => c.id === id) || null;
}

export const DOUBLE_OR_NOTHING_MIN = 6;
