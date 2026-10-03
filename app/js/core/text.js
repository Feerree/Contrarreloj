// Normalización de texto compartida por la app y por la herramienta del banco.

const ARTICLES = new Set(['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas']);

/** Clave estable: minúsculas, sin tildes (conserva la ñ), sin signos, espacios simples. */
export function normalizeKey(text) {
  return String(text)
    .toLowerCase()
    .replace(/ñ/g, '\u0001')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0001/g, 'ñ')
    .replace(/[^a-z0-9ñ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function singular(word) {
  // Las palabras agudas terminadas en "és" (arnés, inglés) ya están en singular.
  if (/és$/.test(word)) return normalizeKey(word);
  word = normalizeKey(word);
  if (word.length > 4 && /[^aeiou]es$/.test(word)) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s')) return word.slice(0, -1);
  return word;
}

/** Clave laxa para detectar conceptos casi iguales (plurales y artículos). */
export function looseKey(text) {
  const parts = String(text).toLowerCase().split(/[\s\-–/]+/).filter((p) => normalizeKey(p));
  // Solo se quita el artículo si quedan dos o más palabras ("La Paz" no debe igualarse a "Paz").
  while (parts.length > 2 && ARTICLES.has(normalizeKey(parts[0]))) parts.shift();
  return parts.map(singular).join(' ');
}
