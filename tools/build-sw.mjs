#!/usr/bin/env node
// Genera app/sw.js con la lista de archivos a guardar para uso sin conexión y una versión
// calculada a partir del contenido. Si cambia cualquier archivo, cambia la versión y los
// celulares descargan la actualización la próxima vez que abran la app con Internet.

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'app');
const SKIP = new Set(['sw.js']);

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return SKIP.has(name) || name.startsWith('.') ? [] : [full];
  });
}

const files = walk(ROOT).sort();
const hash = createHash('sha256');
for (const f of files) hash.update(relative(ROOT, f)).update(readFileSync(f));
const version = hash.digest('hex').slice(0, 10);
const assets = ['./', ...files.map((f) => './' + relative(ROOT, f).split('\\').join('/'))];

const sw = `// ARCHIVO GENERADO por tools/build-sw.mjs — no editar a mano.
// Estrategia: precarga de todos los archivos y "cache first" (funciona 100% sin conexión).
const VERSION = '${version}';
const CACHE = 'contrarreloj-' + VERSION;
const ASSETS = ${JSON.stringify(assets, null, 2)};

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('contrarreloj-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(req)
        .then((res) => {
          if (res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()));
    }),
  );
});
`;
writeFileSync(join(ROOT, 'sw.js'), sw);
console.log(`sw.js generado: versión ${version}, ${assets.length} archivos`);
