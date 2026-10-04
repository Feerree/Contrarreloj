// Utilidades mínimas de DOM: plantillas seguras, avisos, hojas modales y confirmaciones.

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

/** Crea un elemento a partir de HTML (el contenido variable debe pasar por esc()). */
export function html(markup) {
  const t = document.createElement('template');
  t.innerHTML = markup.trim();
  return t.content.firstElementChild;
}

export const $ = (root, sel) => root.querySelector(sel);
export const $$ = (root, sel) => [...root.querySelectorAll(sel)];

/** Delegación de eventos por atributo data-act. */
export function onAction(root, handlers) {
  const listener = (ev) => {
    const el = ev.target.closest('[data-act]');
    if (!el || !root.contains(el) || el.disabled) return;
    const fn = handlers[el.dataset.act];
    if (fn) fn(el, ev);
  };
  root.addEventListener('click', listener);
  return () => root.removeEventListener('click', listener);
}

let toastTimer;
export function toast(message, ms = 2600) {
  document.querySelector('.toast')?.remove();
  const el = html(`<div class="toast" role="status">${esc(message)}</div>`);
  document.body.append(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), ms);
}

/** Hoja inferior. content: HTMLElement. Devuelve función para cerrarla. */
export function sheet(content, { onClose } = {}) {
  const back = html('<div class="sheet-backdrop" role="dialog" aria-modal="true"><div class="sheet"></div></div>');
  back.firstElementChild.append(content);
  const close = () => {
    back.remove();
    document.removeEventListener('keydown', onKey);
    onClose?.();
  };
  const onKey = (e) => e.key === 'Escape' && close();
  back.addEventListener('click', (e) => e.target === back && close());
  document.addEventListener('keydown', onKey);
  document.body.append(back);
  back.querySelector('button, input, select')?.focus({ preventScroll: true });
  sheet.closeTop = close;
  return close;
}

/** Confirmación con dos botones. Devuelve una promesa booleana. */
export function confirmDialog({ title, text = '', ok = 'Aceptar', cancel = 'Cancelar', danger = false }) {
  return new Promise((resolve) => {
    let done = false;
    const el = html(`<div class="stack">
      <h3>${esc(title)}</h3>
      ${text ? `<p class="muted">${esc(text)}</p>` : ''}
      <div class="btn-col">
        <button class="btn block ${danger ? 'bad' : 'primary'}" data-v="1">${esc(ok)}</button>
        <button class="btn block ghost" data-v="0">${esc(cancel)}</button>
      </div></div>`);
    const close = sheet(el, { onClose: () => !done && resolve(false) });
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-v]');
      if (!b) return;
      done = true;
      close();
      resolve(b.dataset.v === '1');
    });
  });
}

export function teamClass(team) {
  return `team-${team.color}`;
}

/** Tamaño de letra para que la palabra entre en la tarjeta según su largo. */
export function wordSize(text) {
  const longest = Math.max(...String(text).split(/\s+/).map((w) => w.length));
  const len = String(text).length;
  let size = 58;
  if (len > 12 || longest > 9) size = 46;
  if (len > 20 || longest > 12) size = 38;
  if (len > 30 || longest > 15) size = 31;
  if (len > 42) size = 26;
  return size;
}

/** Separa "Texto (aclaración)" para mostrar la aclaración más chica. */
export function splitHint(text) {
  const m = String(text).match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  return m ? { main: m[1], hint: m[2] } : { main: String(text), hint: '' };
}

export function formatDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString('es-UY', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDuration(ms) {
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}
