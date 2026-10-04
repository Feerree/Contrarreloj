// Cómo se juega.

import { html, esc, onAction } from '../ui/dom.js';
import { MODES, MODE_ORDER, CHALLENGES } from '../core/modes.js';

export function rulesScreen(app) {
  const modes = MODE_ORDER.map((id) => {
    const m = MODES[id];
    return `<details class="card"><summary><b>${m.icon} ${esc(m.name)}</b> <span class="muted small">— ${esc(m.short)}</span></summary><p style="margin-top:10px">${esc(m.description)}</p></details>`;
  }).join('');
  const challenges = CHALLENGES.map((c) => `<li><b>${c.icon} ${esc(c.name)}:</b> ${esc(c.text)}</li>`).join('');
  const el = html(`<section class="screen" aria-label="Cómo se juega">
    <header class="topbar"><button class="icon-btn" data-act="back" aria-label="Volver">←</button><h2>Cómo se juega</h2></header>
    <div class="card stack">
      <h3 style="margin:0">El turno</h3>
      <ol class="rules-list">
        <li>La app indica qué equipo juega y sugiere quién describe (rota en cada turno).</li>
        <li>Se tira el dado: puede salir <b>0, 1 o 2</b>.</li>
        <li>Arranca el reloj (60 segundos por defecto). Quien describe ve las palabras y las explica <b>sin decirlas</b>, ni partes de ellas, ni traducciones.</li>
        <li>Su equipo adivina. <b>✓ Acierto</b> suma; <b>✗ Pasar</b> salta a la siguiente.</li>
        <li>Al terminar el tiempo se calcula el avance: <b>aciertos − dado</b>. Si da negativo, el equipo no avanza (nunca retrocede).</li>
        <li>Gana el primer equipo que llega a la meta.</li>
      </ol>
      <div class="banner">Ejemplos: 5 aciertos con dado 1 → avanza 4. 3 aciertos con dado 2 → avanza 1. 1 acierto con dado 2 → no avanza.</div>
    </div>
    <div class="card stack">
      <h3 style="margin:0">Correcciones</h3>
      <p>En la pantalla de resultado se puede cambiar cualquier palabra (acertada, pasada o sin responder) y hacer un ajuste manual. Las rondas ya confirmadas se corrigen desde ☰ → <i>Rondas jugadas</i>: el tablero se recalcula solo.</p>
    </div>
    <h3>Modalidades</h3>
    ${modes}
    <details class="card"><summary><b>⚡ Desafíos del modo Desafío</b></summary><ul class="rules-list" style="margin-top:10px">${challenges}</ul></details>
    <div class="card stack">
      <h3 style="margin:0">Consejos</h3>
      <ul class="rules-list">
        <li>Usá el mismo nombre de equipo en cada partida para acumular estadísticas.</li>
        <li>Si una palabra quedó en pantalla justo cuando terminó el tiempo y la adivinaron, marcala como acertada en el resultado (si el grupo lo acepta).</li>
        <li>Agregá palabras propias del grupo en <i>Palabras → Mis palabras</i>.</li>
      </ul>
    </div>
  </section>`);
  onAction(el, { back: () => app.go('menu') });
  return { el };
}
