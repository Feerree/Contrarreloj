#!/usr/bin/env node
// Genera los íconos PNG de la PWA a partir de app/icons/icon.svg usando Chromium (Playwright).
// Solo hace falta correrlo si cambia el diseño del ícono.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'app', 'icons');
const svg = readFileSync(join(DIR, 'icon.svg'), 'utf8');
const targets = [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['apple-touch-icon.png', 180, true],
  ['icon-maskable-512.png', 512, true],
];
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, size, fullBleed] of targets) {
  // Los íconos "maskable" y de iOS necesitan fondo completo y margen de seguridad.
  const inner = fullBleed ? Math.round(size * 0.78) : size;
  const html = `<html><body style="margin:0;width:${size}px;height:${size}px;display:grid;place-items:center;background:${fullBleed ? '#ffb627' : 'transparent'}">
    <div style="width:${inner}px;height:${inner}px">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `).replace(fullBleed ? /<rect width="64" height="64" rx="15" fill="url\(#g\)"\/>/ : /$^/, '')}</div></body></html>`;
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(html);
  await page.screenshot({ path: join(DIR, name), omitBackground: !fullBleed });
  console.log('Generado', name);
}
await browser.close();
