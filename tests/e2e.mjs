// Prueba de punta a punta en Chromium (Playwright).
// Requiere el servidor local:  npm start   (http://localhost:5173)
// Ejecutar:                    npm run test:e2e
//
// Verifica: tarjetas de 5 palabras, flujo completo hasta la victoria, dado coherente con la cara visible,
// sin palabras repetidas, guardado y recarga a mitad de ronda, modo sin conexión,
// otras modalidades y ausencia de scroll horizontal en distintos tamaños de pantalla.

import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const URL = process.env.APP_URL || 'http://localhost:5173/';
const SHOTS = process.env.SHOTS || '';
let failures = 0;

async function step(name, fn) {
  try {
    await fn();
    console.log(`✔ ${name}`);
  } catch (err) {
    failures++;
    console.error(`✘ ${name}\n  ${err.stack || err}`);
  }
}

async function newPage(browser, viewport = { width: 390, height: 844 }) {
  const ctx = await browser.newContext({ viewport, hasTouch: true, isMobile: viewport.width < 600 });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && page.errors.push(m.text()));
  return { ctx, page };
}

const game = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__contrarreloj.game)));

async function startGame(page, mode = 'clasico', setup = async () => {}) {
  await page.goto(URL);
  await page.click('.splash');
  await page.click('[data-act="new"]');
  await page.click(`[data-act="mode"][data-mode="${mode}"]`);
  await page.click('[data-act="next"]');
  await page.fill('[data-field="team"][data-t="0"]', 'Los Teros');
  await page.fill('[data-field="team"][data-t="1"]', 'Las Garzas');
  await page.click('[data-act="next"]');
  await setup();
  await page.click('[data-act="start"]');
}

/** Juega una ronda completa con la cantidad de aciertos indicada. */
async function playRound(page, hits, skips = 0) {
  await page.click('[data-act="go"]');
  const roll = page.locator('[data-act="roll"]');
  const play = page.locator('[data-act="play"]');
  await Promise.race([roll.waitFor(), play.waitFor()]);
  if (await roll.isVisible()) {
    await roll.click();
    await page.clock.runFor(1700);
  }
  await play.click();
  await page.click('[data-act="begin"]');
  await page.clock.runFor(2600);
  for (let i = 0; i < hits; i++) {
    // El reloj simulado de Playwright a veces avanza menos de lo pedido y el bloqueo
    // anti doble toque descarta el toque: se reintenta hasta que el contador sube.
    const before = Number(await page.locator('#hits').textContent());
    for (let t = 0; t < 4; t++) {
      await page.clock.runFor(600);
      await page.locator('.card-word:not(.done)').first().click();
      if (Number(await page.locator('#hits').textContent()) > before) break;
    }
  }
  for (let i = 0; i < skips; i++) {
    await page.clock.runFor(600);
    if ((await game(page)).phase !== 'play') break; // en supervivencia la ronda puede terminar antes
    await page.click('[data-act="skip"]');
  }
  const g = await game(page);
  if (g.phase === 'play') await page.clock.runFor(61_000);
  await page.clock.runFor(1500);
  await page.locator('[data-act="confirm"]').waitFor();
  await page.click('[data-act="confirm"]');
  await page.clock.runFor(15_000); // animación de fichas
}

const browser = await chromium.launch();

await step('Partida clásica completa: penalización, alternancia, sin repeticiones y victoria', async () => {
  const { page, ctx } = await newPage(browser);
  await page.clock.install();
  await startGame(page);
  const teamsOrder = [];
  for (let r = 0; r < 20; r++) {
    const g = await game(page);
    if (g.finished) break;
    teamsOrder.push(g.current.team);
    await playRound(page, 9, 1);
    const after = await game(page);
    const last = after.rounds[after.rounds.length - 1];
    const hits = last.words.filter((w) => w.result === 'hit').length;
    assert.equal(hits, 9, 'aciertos registrados');
    assert.ok([0, 1, 2].includes(last.die), 'dado 0-2');
  }
  const g = await game(page);
  assert.equal(g.finished, true, 'la partida termina');
  // Gana el primero que llega a 34 según el orden real de las rondas (depende de los dados)
  const pos = [0, 0];
  let expected = null;
  for (const r of g.rounds) {
    pos[r.team] += Math.max(0, 9 - r.die);
    if (expected === null && pos[r.team] >= 34) expected = r.team;
  }
  assert.deepEqual(g.winners, [expected], 'gana el primero en llegar');
  for (let i = 1; i < teamsOrder.length; i++) assert.notEqual(teamsOrder[i], teamsOrder[i - 1], 'alternancia');
  assert.equal(new Set(g.usedIds).size, g.usedIds.length, 'sin palabras repetidas');
  await page.clock.runFor(3000);
  await page.locator('.victory').waitFor();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/e2e-victory.png` });
  const stats = await page.evaluate(() => window.__contrarreloj.finishedGames().length);
  assert.equal(stats, 1, 'queda registrada en el historial');
  assert.deepEqual(page.errors, []);
  await ctx.close();
});

await step('El dado muestra la cara que corresponde al resultado', async () => {
  const { page, ctx } = await newPage(browser);
  await startGame(page);
  await page.click('[data-act="go"]');
  await page.click('[data-act="roll"]');
  await page.waitForTimeout(1900); // animación real
  const visible = await page.evaluate(() => {
    const faces = [...document.querySelectorAll('.die-face')];
    // La cara de frente es la que ocupa más área en pantalla
    const best = faces.map((f) => ({ f, a: f.getBoundingClientRect().width * f.getBoundingClientRect().height })).sort((x, y) => y.a - x.a)[0];
    return Number(best.f.textContent);
  });
  const g = await game(page);
  assert.equal(visible, g.current.die);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/e2e-dice.png` });
  await ctx.close();
});

await step('Recargar a mitad de ronda conserva tiempo, palabra y aciertos', async () => {
  const { page, ctx } = await newPage(browser);
  await page.clock.install();
  await startGame(page);
  await page.click('[data-act="go"]');
  await page.click('[data-act="roll"]');
  await page.clock.runFor(1700);
  await page.click('[data-act="play"]');
  await page.click('[data-act="begin"]');
  await page.clock.runFor(2600);
  await page.clock.runFor(600);
  await page.locator('.card-word').nth(2).click();
  await page.clock.runFor(20_000);
  const before = await game(page);
  const word = await page.locator('.card-words').textContent();
  await page.reload();
  await page.locator('.card-words').waitFor();
  const secs = Number(await page.locator('#timer .num').textContent());
  assert.ok(secs <= 40 && secs >= 37, `quedan ~40 s, muestra ${secs}`);
  assert.equal(await page.locator('.card-words').textContent(), word, 'misma tarjeta con la palabra marcada');
  assert.equal(await page.locator('.card-word.done').count(), 1);
  assert.equal(await page.locator('#hits').textContent(), '1');
  // Pausa: la palabra se oculta y el tiempo no corre
  await page.click('[data-act="pause"]');
  await page.clock.runFor(30_000);
  await page.click('[data-act="resume"]');
  const secs2 = Number(await page.locator('#timer .num').textContent());
  assert.ok(Math.abs(secs2 - secs) <= 1, 'la pausa congela el reloj');
  assert.equal((await game(page)).rounds.length, before.rounds.length);
  await ctx.close();
});

await step('Corrección de una ronda confirmada actualiza el tablero', async () => {
  const { page, ctx } = await newPage(browser);
  await page.clock.install();
  await startGame(page);
  await playRound(page, 4);
  const g1 = await game(page);
  await page.click('[data-act="menu"]');
  await page.click('[data-act="history"]');
  await page.click('[data-act="fix"]');
  await page.click('[data-act="adj"][data-d="1"]');
  await page.click('[data-act="adj"][data-d="1"]');
  await page.click('[data-act="save"]');
  const g2 = await game(page);
  const pos = (g) => g.rounds.filter((r) => r.team === 0).reduce((s, r) => s + Math.max(0, r.words.filter((w) => w.result === 'hit').length + (r.adjust || 0) - r.die), 0);
  assert.equal(pos(g2), pos(g1) + 2); // 4 aciertos − dado (≤ 2) nunca es negativo
  assert.equal(g2.current.team, 1, 'el turno no cambia');
  await ctx.close();
});

await step('Modo libre y supervivencia terminan correctamente', async () => {
  const { page, ctx } = await newPage(browser);
  await page.clock.install();
  await startGame(page, 'libre', async () => {
    for (let i = 0; i < 4; i++) await page.click('[data-act="num"][data-key="roundsPerTeam"][data-step="-1"]');
  });
  await playRound(page, 3);
  await playRound(page, 5);
  let g = await game(page);
  assert.equal(g.finished, true);
  assert.deepEqual(g.winners, [1]);
  await page.clock.runFor(2000);
  await page.click('[data-act="menu"]');
  await startGame(page, 'supervivencia', async () => {
    for (let i = 0; i < 3; i++) await page.click('[data-act="num"][data-key="lives"][data-step="-1"]');
  });
  await playRound(page, 1, 5); // 2 vidas: se queda sin vidas en la segunda pasada
  g = await game(page);
  assert.equal(g.finished, true);
  assert.deepEqual(g.winners, [1]);
  assert.deepEqual(page.errors, []);
  await ctx.close();
});

await step('Funciona sin conexión después de la primera carga', async () => {
  const { page, ctx } = await newPage(browser);
  await page.goto(URL);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await ctx.setOffline(true);
  await page.reload();
  await page.click('.splash');
  await page.click('[data-act="new"]');
  await page.click('[data-act="next"]');
  await page.click('[data-act="next"]');
  await page.click('[data-act="start"]');
  await page.click('[data-act="go"]');
  await page.click('[data-act="roll"]');
  await page.locator('[data-act="play"]').waitFor();
  const fontsOk = await page.evaluate(() => document.fonts.check('800 20px Bricolage'));
  assert.ok(fontsOk, 'tipografías disponibles offline');
  await ctx.close();
});

await step('Sin scroll horizontal en celulares chicos, grandes y tablets', async () => {
  for (const vp of [
    { width: 320, height: 568 },
    { width: 360, height: 740 },
    { width: 430, height: 932 },
    { width: 768, height: 1024 },
  ]) {
    const { page, ctx } = await newPage(browser, vp);
    await page.clock.install();
    await startGame(page);
    const check = async (where) => {
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(over <= 0, `${vp.width}px en ${where}: desborda ${over}px`);
    };
    await check('tablero');
    await page.click('[data-act="go"]');
    await page.click('[data-act="roll"]');
    await page.clock.runFor(1700);
    await page.click('[data-act="play"]');
    await page.click('[data-act="begin"]');
    await page.clock.runFor(2600);
    await check('juego');
    const btn = await page.locator('[data-act="skip"]').boundingBox();
    assert.ok(btn.y + btn.height <= vp.height, `botón de pasar visible en ${vp.width}x${vp.height}`);
    const last = await page.locator('.card-word').last().boundingBox();
    assert.ok(last.y + last.height <= btn.y, `las 5 palabras entran en pantalla en ${vp.width}x${vp.height}`);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/e2e-play-${vp.width}.png` });
    await ctx.close();
  }
});

await browser.close();
if (failures) {
  console.error(`\n${failures} prueba(s) fallaron`);
  process.exit(1);
}
console.log('\nTodas las pruebas de punta a punta pasaron');
