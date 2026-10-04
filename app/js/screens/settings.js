// Configuración general, respaldo de datos e información de la app.

import { html, onAction, confirmDialog, toast } from '../ui/dom.js';
import { KEYS } from '../core/storage.js';
import { sound } from '../ui/feedback.js';
import { DEFAULT_SETTINGS } from '../app.js';

export function settingsScreen(app) {
  const s = app.settings;
  const el = html(`<section class="screen" aria-label="Configuración">
    <header class="topbar"><button class="icon-btn" data-act="back" aria-label="Volver">←</button><h2>Configuración</h2></header>
    <div class="card stack">
      <h3 style="margin:0">Partidas nuevas</h3>
      <div class="row between"><div><b>Duración de la ronda</b><p class="small muted">Predeterminado: 60 s</p></div>
        <div class="stepper"><button data-act="num" data-key="roundSeconds" data-step="-5" aria-label="Menos tiempo">−</button><output data-key="roundSeconds">${s.roundSeconds} s</output><button data-act="num" data-key="roundSeconds" data-step="5" aria-label="Más tiempo">+</button></div></div>
      <div class="row between"><div><b>Palabras por tarjeta</b><p class="small muted">Predeterminado: 5</p></div>
        <div class="stepper"><button data-act="num" data-key="cardSize" data-step="-1" aria-label="Menos palabras">−</button><output data-key="cardSize">${s.cardSize}</output><button data-act="num" data-key="cardSize" data-step="1" aria-label="Más palabras">+</button></div></div>
      <div class="row between"><div><b>Casilleros del tablero</b><p class="small muted">Predeterminado: 34</p></div>
        <div class="stepper"><button data-act="num" data-key="boardSize" data-step="-2" aria-label="Menos casilleros">−</button><output data-key="boardSize">${s.boardSize}</output><button data-act="num" data-key="boardSize" data-step="2" aria-label="Más casilleros">+</button></div></div>
    </div>
    <div class="card">
      <h3>Experiencia</h3>
      ${toggle('sound', 'Sonidos', 'Inicio, aviso de 10 segundos, final y aciertos', s.sound)}
      ${toggle('vibration', 'Vibración', 'Solo en dispositivos compatibles (Android)', s.vibration)}
      ${toggle('countdown', 'Cuenta regresiva 3-2-1', 'Antes de que arranque el reloj', s.countdown)}
      ${toggle('keepAwake', 'Mantener la pantalla encendida', 'Durante la ronda, si el navegador lo permite', s.keepAwake)}
    </div>
    <div class="card stack">
      <h3 style="margin:0">Datos</h3>
      <p class="small muted">Todo se guarda solo en este dispositivo. Con el respaldo podés pasar estadísticas, palabras propias e historial a otro celular.</p>
      <button class="btn block" data-act="export">⬇️ Exportar respaldo</button>
      <label class="btn block" for="import-file">⬆️ Importar respaldo</label>
      <input type="file" id="import-file" accept="application/json,.json" class="visually-hidden">
      <button class="btn ghost block" data-act="reset-settings">Restablecer configuración</button>
      <button class="btn ghost block" data-act="wipe" style="color:var(--bad)">Borrar todos los datos</button>
    </div>
    <div class="card stack">
      <h3 style="margin:0">Acerca de</h3>
      <p class="small muted">Contrarreloj · banco ${app.bankVersion} · ${app.bank.all.length.toLocaleString('es-UY')} palabras.<br>
      Inspirado en el juego de mesa Trivia Contrarreloj. Contenido original; no reproduce las cartas del juego.<br>
      ${app.store.persistent ? 'Almacenamiento local activo.' : '⚠️ El navegador no permite guardar datos (modo privado): se pierden al cerrar.'}</p>
      <p class="small muted" id="sw-status"></p>
    </div>
  </section>`);

  onAction(el, {
    back: () => app.go('menu'),
    num: (b) => {
      const key = b.dataset.key;
      const [min, max] = key === 'roundSeconds' ? [15, 300] : key === 'cardSize' ? [1, 6] : [10, 80];
      const v = Math.max(min, Math.min(max, s[key] + Number(b.dataset.step)));
      app.saveSettings({ [key]: v, lastConfig: s.lastConfig ? { ...s.lastConfig, [key]: v } : null });
      el.querySelector(`output[data-key="${key}"]`).textContent = key === 'roundSeconds' ? `${v} s` : v;
    },
    export: () => {
      const blob = new Blob([JSON.stringify(app.store.exportAll(), null, 1)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `contrarreloj-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      toast('Respaldo descargado');
    },
    'reset-settings': () => {
      app.saveSettings({ ...DEFAULT_SETTINGS });
      toast('Configuración restablecida');
      app.go('settings');
    },
    wipe: async () => {
      const ok = await confirmDialog({
        title: '¿Borrar todos los datos?',
        text: 'Se eliminan la partida en curso, estadísticas, historial de palabras, palabras propias y configuración.',
        ok: 'Borrar todo',
        danger: true,
      });
      if (!ok) return;
      Object.values(KEYS).forEach((k) => app.store.remove(k));
      location.reload();
    },
  });

  el.addEventListener('change', async (e) => {
    const t = e.target;
    if (t.dataset.setting) {
      app.saveSettings({ [t.dataset.setting]: t.checked });
      if (t.dataset.setting === 'sound' && t.checked) sound.hit();
    }
    if (t.id === 'import-file' && t.files[0]) {
      try {
        const data = JSON.parse(await t.files[0].text());
        const ok = await confirmDialog({ title: '¿Importar el respaldo?', text: 'Reemplaza los datos actuales de este dispositivo.', ok: 'Importar' });
        if (!ok) return;
        app.store.importAll(data);
        location.reload();
      } catch (err) {
        toast(err.message || 'No se pudo leer el archivo');
      }
    }
  });

  const mounted = async () => {
    const box = el.querySelector('#sw-status');
    if (!('serviceWorker' in navigator)) return (box.textContent = 'Este navegador no permite el modo sin conexión.');
    const reg = await navigator.serviceWorker.getRegistration();
    box.textContent = reg?.active ? '✅ Lista para usar sin conexión.' : 'Preparando el modo sin conexión…';
  };
  return { el, mounted };
}

function toggle(key, label, hint, on) {
  return `<label class="switch"><span><b>${label}</b><p class="small muted">${hint}</p></span>
    <span class="toggle"><input type="checkbox" data-setting="${key}" ${on ? 'checked' : ''}><span></span></span></label>`;
}
