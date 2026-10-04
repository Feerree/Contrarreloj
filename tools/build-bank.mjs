#!/usr/bin/env node
// Construye app/data/bank.js a partir de data/words/*.txt.
//
// Formato de cada archivo de categoría:
//   # id: animales          ← identificador estable (no cambiar una vez publicado)
//   # nombre: Animales
//   # icono: 🦁
//   # facil | # intermedio | # dificil   ← sección de dificultad
//   Una palabra o concepto por línea.
//
// Validaciones:
//   - Error: duplicado exacto (sin importar mayúsculas, tildes ni signos).
//   - Error: palabra fuera de una sección de dificultad, caracteres inválidos o largo excesivo.
//   - Aviso: duplicado aproximado (singular/plural, artículos, una letra de diferencia).
//
// Uso:
//   node tools/build-bank.mjs            → valida y genera
//   node tools/build-bank.mjs --check    → solo valida (sale con código 1 si hay errores)
//   node tools/build-bank.mjs --strict   → además avisa por una letra de diferencia y cuando un concepto contiene a otro ("Oso" / "Oso polar")

import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeKey, looseKey } from '../app/js/core/text.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'data', 'words');
const OUT = join(ROOT, 'app', 'data', 'bank.js');
const REPORT = join(ROOT, 'docs', 'BANCO.md');

const args = new Set(process.argv.slice(2));
const CHECK_ONLY = args.has('--check');
const STRICT = args.has('--strict');

const LEVELS = { facil: 1, intermedio: 2, dificil: 3 };
const LEVEL_NAMES = ['', 'Fácil', 'Intermedio', 'Difícil'];
const VALID = /^[\p{L}\p{N} .,'’&¡!¿?:\-–+°/()]+$/u;
const MAX_LEN = 56;

const errors = [];
const warnings = [];
const categories = [];
const words = []; // { text, cat, level, file, line }

const files = readdirSync(SRC).filter((f) => f.endsWith('.txt')).sort();

for (const file of files) {
  const lines = readFileSync(join(SRC, file), 'utf8').split(/\r?\n/);
  const meta = {};
  let level = 0;
  let catIndex = -1;
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    if (line.startsWith('#')) {
      const body = line.slice(1).trim();
      const m = body.match(/^(id|nombre|icono|orden)\s*:\s*(.+)$/);
      if (m) {
        meta[m[1]] = m[2].trim();
        return;
      }
      const lvl = LEVELS[normalizeKey(body)];
      if (lvl) {
        level = lvl;
        if (catIndex === -1) {
          if (!meta.id || !meta.nombre) {
            errors.push(`${file}: falta "# id:" o "# nombre:" antes de las palabras`);
          }
          catIndex = categories.length;
          categories.push({ id: meta.id, name: meta.nombre, icon: meta.icono || '•' });
        }
        return;
      }
      return; // comentario libre
    }
    if (!level) {
      errors.push(`${file}:${i + 1}: "${line}" está fuera de una sección de dificultad`);
      return;
    }
    if (!VALID.test(line)) errors.push(`${file}:${i + 1}: caracteres inválidos en "${line}"`);
    if (line.length > MAX_LEN) errors.push(`${file}:${i + 1}: "${line}" supera ${MAX_LEN} caracteres`);
    words.push({ text: line, cat: catIndex, level, file, line: i + 1 });
  });
}

// Duplicados exactos
const byKey = new Map();
for (const w of words) {
  const k = normalizeKey(w.text);
  if (byKey.has(k)) {
    const o = byKey.get(k);
    errors.push(`Duplicado: "${w.text}" (${w.file}:${w.line}) = "${o.text}" (${o.file}:${o.line})`);
  } else byKey.set(k, w);
}

// Duplicados aproximados (salvo los pares aceptados en data/similares-permitidos.txt)
const allowed = new Set();
try {
  for (const raw of readFileSync(join(ROOT, 'data', 'similares-permitidos.txt'), 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || !line.includes('|')) continue;
    allowed.add(line.split('|').map((x) => normalizeKey(x)).sort().join('|'));
  }
} catch {
  /* archivo opcional */
}
const isAllowed = (a, b) => allowed.has([normalizeKey(a), normalizeKey(b)].sort().join('|'));
const byLoose = new Map();
for (const w of words) {
  const k = looseKey(w.text);
  if (byLoose.has(k)) {
    const o = byLoose.get(k);
    if (normalizeKey(o.text) !== normalizeKey(w.text) && !isAllowed(o.text, w.text)) {
      warnings.push(`Similar: "${w.text}" (${w.file}:${w.line}) ≈ "${o.text}" (${o.file}:${o.line})`);
    }
  } else byLoose.set(k, w);
}

// Una letra de diferencia (solo con --strict: genera falsos positivos como Panadero/Ganadero)
const longOnes = !STRICT ? [] : [...byKey.entries()].filter(([k]) => k.length >= 7);
const buckets = new Map();
for (const [k, w] of longOnes) {
  for (let i = 0; i < k.length; i++) {
    const sig = k.slice(0, i) + '*' + k.slice(i + 1);
    if (!buckets.has(sig)) buckets.set(sig, []);
    buckets.get(sig).push(w);
  }
}
const seenPairs = new Set();
for (const list of buckets.values()) {
  if (list.length < 2) continue;
  for (let a = 0; a < list.length; a++) {
    for (let b = a + 1; b < list.length; b++) {
      const pair = [list[a].text, list[b].text].sort().join('|');
      if (seenPairs.has(pair)) continue;
      seenPairs.add(pair);
      warnings.push(`Una letra: "${list[a].text}" (${list[a].file}) ~ "${list[b].text}" (${list[b].file})`);
    }
  }
}

if (STRICT) {
  const keys = new Map([...byKey.entries()].map(([k, w]) => [looseKey(w.text), w]));
  for (const w of words) {
    const parts = looseKey(w.text).split(' ');
    for (let n = 1; n < parts.length; n++) {
      const head = parts.slice(0, n).join(' ');
      if (keys.has(head)) warnings.push(`Contiene: "${w.text}" (${w.file}) ⊃ "${keys.get(head).text}" (${keys.get(head).file})`);
    }
  }
}

for (const w of warnings) console.warn('⚠️  ' + w);
for (const e of errors) console.error('❌ ' + e);

const total = byKey.size;
console.log(`\n${categories.length} categorías · ${total} conceptos · ${errors.length} errores · ${warnings.length} avisos`);

if (errors.length) process.exit(1);
if (CHECK_ONLY) process.exit(0);

// Salida compacta: [texto, índiceCategoría, nivel]
const unique = [...byKey.values()];
const rows = unique.map((w) => [w.text, w.cat, w.level]);
const header = '// ARCHIVO GENERADO por tools/build-bank.mjs — no editar a mano.\n' +
  '// Fuente: data/words/*.txt\n';
// Versión estable: cambia solo si cambia el contenido (hash FNV-1a de las filas).
let hash = 0x811c9dc5;
for (const ch of JSON.stringify(rows)) {
  hash ^= ch.codePointAt(0);
  hash = Math.imul(hash, 0x01000193) >>> 0;
}
const body =
  `export const BANK_VERSION = ${JSON.stringify(total + '-' + hash.toString(16))};\n` +
  `export const CATEGORIES = ${JSON.stringify(categories)};\n` +
  `export const WORDS = [\n${rows.map((r) => JSON.stringify(r)).join(',\n')}\n];\n`;
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, header + body);

// Reporte legible
const table = categories.map((c, i) => {
  const counts = [0, 0, 0, 0];
  for (const w of unique) if (w.cat === i) counts[w.level]++;
  return { c, counts, sum: counts[1] + counts[2] + counts[3] };
});
const totals = [1, 2, 3].map((l) => unique.filter((w) => w.level === l).length);
let md = '# Banco de palabras — resumen\n\n';
md += 'Generado automáticamente por `tools/build-bank.mjs`. No editar a mano.\n\n';
md += `**Total: ${total} conceptos únicos en ${categories.length} categorías.**\n\n`;
md += `| Categoría | ${LEVEL_NAMES.slice(1).join(' | ')} | Total |\n| --- | ---: | ---: | ---: | ---: |\n`;
for (const { c, counts, sum } of table) md += `| ${c.icon} ${c.name} | ${counts[1]} | ${counts[2]} | ${counts[3]} | ${sum} |\n`;
md += `| **Total** | **${totals[0]}** | **${totals[1]}** | **${totals[2]}** | **${total}** |\n`;
writeFileSync(REPORT, md);
console.log(`Generado ${OUT.replace(ROOT + '/', '')} y ${REPORT.replace(ROOT + '/', '')}`);
