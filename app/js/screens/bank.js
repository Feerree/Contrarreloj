// Gestión del banco de palabras: categorías activas, historial, búsqueda y palabras propias.

import { html, esc, onAction, confirmDialog, toast } from '../ui/dom.js';
import { CUSTOM_CATEGORY, LEVELS, levelName } from '../core/words.js';
import { normalizeKey } from '../core/text.js';

export function bankScreen(app, { tab = 'cats' } = {}) {
  const el = html(`<section class="screen" aria-label="Banco de palabras">
    <header class="topbar"><button class="icon-btn" data-act="back" aria-label="Volver">←</button><h2>Palabras</h2></header>
    <div class="tabs" role="tablist">
      <button role="tab" data-act="tab" data-tab="cats" aria-selected="${tab === 'cats'}">Categorías</button>
      <button role="tab" data-act="tab" data-tab="search" aria-selected="${tab === 'search'}">Buscar</button>
      <button role="tab" data-act="tab" data-tab="custom" aria-selected="${tab === 'custom'}">Mis palabras</button>
    </div>
    <div id="body" class="stack"></div>
  </section>`);
  const body = el.querySelector('#body');

  const renderCats = () => {
    const off = new Set(app.settings.disabledCategories);
    const total = app.bank.all.length;
    const seen = app.bank.all.filter((w) => app.history.has(w.id)).length;
    const rows = app.bank.categories
      .map((c) => {
        const words = app.bank.filter({ categories: [c.id] });
        if (!words.length) return '';
        const counts = [1, 2, 3].map((l) => words.filter((w) => w.level === l).length);
        const seenCat = words.filter((w) => app.history.has(w.id)).length;
        return `<div class="cat-row"><span class="ico">${c.icon}</span><div class="info"><b>${esc(c.name)}</b>
          <span>${words.length} · F ${counts[0]} · I ${counts[1]} · D ${counts[2]} · vistas ${seenCat}</span></div>
          <span class="toggle"><input type="checkbox" data-cat="${c.id}" aria-label="Activar ${esc(c.name)}" ${off.has(c.id) ? '' : 'checked'}><span></span></span></div>`;
      })
      .join('');
    body.innerHTML = `
      <div class="card stack">
        <div class="row between"><div><b style="font-size:24px;font-family:var(--font-display)">${total.toLocaleString('es-UY')}</b> <span class="muted">conceptos</span></div><span class="small muted">${seen.toLocaleString('es-UY')} ya vistos</span></div>
        <div class="progress" aria-label="Palabras vistas"><i style="width:${(seen / total) * 100}%"></i></div>
        <p class="small muted">La app elige primero palabras que nunca salieron. Cuando se agotan, avisa y repite las más viejas.</p>
        <button class="btn block" data-act="reset-history" ${seen ? '' : 'disabled'}>Reiniciar historial de palabras vistas</button>
      </div>
      <div class="card"><div class="row between"><h3 style="margin:0">Categorías activas</h3><span class="small muted">Desactivadas no aparecen al configurar</span></div>${rows}</div>`;
  };

  const renderSearch = (q = '', cat = '', level = '') => {
    const catOptions = app.bank.categories.map((c) => `<option value="${c.id}" ${cat === c.id ? 'selected' : ''}>${c.icon} ${esc(c.name)}</option>`).join('');
    const levelOptions = LEVELS.map((l) => `<option value="${l.id}" ${String(l.id) === level ? 'selected' : ''}>${l.name}</option>`).join('');
    body.innerHTML = `<div class="card stack">
        <input class="input" id="q" type="search" placeholder="Buscar palabra…" value="${esc(q)}" autocomplete="off">
        <div class="row"><select class="input" id="fcat"><option value="">Todas las categorías</option>${catOptions}</select>
        <select class="input" id="flevel" style="max-width:150px"><option value="">Todo nivel</option>${levelOptions}</select></div>
        <p class="small muted" id="count"></p>
        <div class="search-results" id="results"></div>
      </div>`;
    runSearch();
  };

  const runSearch = () => {
    const q = normalizeKey(body.querySelector('#q')?.value || '');
    const cat = body.querySelector('#fcat')?.value || '';
    const level = body.querySelector('#flevel')?.value || '';
    let list = app.bank.filter({ categories: cat ? [cat] : [], levels: level ? [Number(level)] : [] });
    if (q) list = list.filter((w) => normalizeKey(w.text).includes(q));
    body.querySelector('#count').textContent = `${list.length.toLocaleString('es-UY')} resultados${list.length > 150 ? ' (se muestran 150)' : ''}`;
    body.querySelector('#results').innerHTML = list
      .slice(0, 150)
      .map((w) => `<div><span>${esc(w.text)}</span><span class="small muted">${app.bank.category(w.cat).icon} <span class="level-badge level-${w.level}">${levelName(w.level)}</span>${app.history.has(w.id) ? ' 👁' : ''}</span></div>`)
      .join('');
  };

  const renderCustom = () => {
    const list = app.customWords();
    const catOptions = [CUSTOM_CATEGORY, ...app.bank.categories.filter((c) => c.id !== CUSTOM_CATEGORY.id)]
      .map((c) => `<option value="${c.id}">${c.icon} ${esc(c.name)}</option>`)
      .join('');
    const rows = list
      .map(
        (w, i) => `<div class="word-row"><span class="txt">${esc(w.text)}<small>${app.bank.category(w.cat).icon} ${esc(app.bank.category(w.cat).name)} · ${levelName(w.level)}</small></span>
        <button class="chip" data-act="del" data-i="${i}" aria-label="Eliminar ${esc(w.text)}">🗑</button></div>`,
      )
      .join('');
    body.innerHTML = `<form class="card stack" id="add-form">
        <h3 style="margin:0">Agregar palabra</h3>
        <input class="input" id="new-word" maxlength="56" placeholder="Ej.: El profe de mate" required autocomplete="off">
        <div class="row"><select class="input" id="new-cat">${catOptions}</select>
        <select class="input" id="new-level" style="max-width:150px">${LEVELS.map((l) => `<option value="${l.id}" ${l.id === 2 ? 'selected' : ''}>${l.name}</option>`).join('')}</select></div>
        <button class="btn primary block" type="submit">Agregar</button>
        <p class="small muted">Ideal para chistes internos del grupo. Se controla que no estén repetidas.</p>
      </form>
      <div class="card stack"><div class="row between"><h3 style="margin:0">Mis palabras</h3><span class="small muted">${list.length}</span></div>
        ${rows || '<p class="muted">Todavía no agregaste palabras.</p>'}</div>`;
    body.querySelector('#add-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const text = body.querySelector('#new-word').value.trim().replace(/\s+/g, ' ');
      if (!normalizeKey(text)) return toast('Escribí una palabra');
      const dup = app.bank.findDuplicate(text);
      if (dup) return toast(`Ya existe: "${dup.text}" (${app.bank.category(dup.cat).name})`);
      const next = [...list, { text, cat: body.querySelector('#new-cat').value, level: Number(body.querySelector('#new-level').value) }];
      app.saveCustomWords(next);
      // Si la categoría elegida estaba desactivada, se activa para que la palabra pueda salir.
      const cat = body.querySelector('#new-cat').value;
      app.saveSettings({ disabledCategories: app.settings.disabledCategories.filter((c) => c !== cat) });
      toast('Palabra agregada');
      renderCustom();
      body.querySelector('#new-word').focus();
    });
  };

  const render = () => {
    if (tab === 'cats') renderCats();
    if (tab === 'search') renderSearch();
    if (tab === 'custom') renderCustom();
  };

  onAction(el, {
    back: () => app.go('menu'),
    tab: (b) => {
      tab = b.dataset.tab;
      el.querySelectorAll('[data-act="tab"]').forEach((x) => x.setAttribute('aria-selected', x === b));
      render();
    },
    'reset-history': async () => {
      const ok = await confirmDialog({
        title: '¿Reiniciar el historial?',
        text: 'Todas las palabras vuelven a contar como nunca vistas.',
        ok: 'Reiniciar',
      });
      if (!ok) return;
      app.resetHistory();
      app.flags.historyExhausted = false;
      toast('Historial reiniciado');
      renderCats();
    },
    del: async (b) => {
      const list = app.customWords();
      const w = list[Number(b.dataset.i)];
      const ok = await confirmDialog({ title: `¿Eliminar "${w.text}"?`, ok: 'Eliminar', danger: true });
      if (!ok) return;
      list.splice(Number(b.dataset.i), 1);
      app.saveCustomWords(list);
      renderCustom();
    },
  });

  el.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.cat) {
      const off = new Set(app.settings.disabledCategories);
      t.checked ? off.delete(t.dataset.cat) : off.add(t.dataset.cat);
      if (app.bank.categories.every((c) => off.has(c.id) || !app.bank.count({ categories: [c.id] }))) {
        t.checked = true;
        return toast('Tiene que quedar al menos una categoría activa');
      }
      app.saveSettings({ disabledCategories: [...off] });
    }
    if (t.id === 'fcat' || t.id === 'flevel') runSearch();
  });
  el.addEventListener('input', (e) => e.target.id === 'q' && runSearch());

  render();
  return { el };
}
