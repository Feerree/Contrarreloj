// Números aleatorios. Usa crypto cuando está disponible (mejor distribución que Math.random).

/** Entero uniforme en [0, max). */
export function randomInt(max) {
  if (max <= 0) return 0;
  const c = globalThis.crypto;
  if (c && c.getRandomValues) {
    // Rechazo para evitar sesgo de módulo.
    const limit = Math.floor(0x100000000 / max) * max;
    const buf = new Uint32Array(1);
    do c.getRandomValues(buf);
    while (buf[0] >= limit);
    return buf[0] % max;
  }
  return Math.floor(Math.random() * max);
}

export function pick(list, rng = randomInt) {
  return list[rng(list.length)];
}

export function shuffle(list, rng = randomInt) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
