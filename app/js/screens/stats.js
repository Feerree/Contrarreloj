// Estadísticas e historial de partidas.

import { html, esc, onAction, confirmDialog, formatDate, toast } from '../ui/dom.js';
import { computeStats } from '../core/stats.js';
import { MODES } from '../core/modes.js';

export function statsScreen(app, { tab = 'summary' } = {}) {
  const games = app.finishedGames();
  const st = computeStats(games);
  const el = html(`<section class="screen" aria-label="Estadísticas">
    <header class="topbar"><button class="icon-btn" data-act="back" aria-label="Volver">←</button><h2>Estadísticas</h2></header>
    <div class="tabs" role="tablist">
      <button role="tab" data-act="tab" data-tab="summary" aria-selected="${tab === 'summary'}">Resumen</button>
      <button role="tab" data-act="tab" data-tab="history" aria-selected="${tab === 'history'}">Historial</button>
    </div>
    <div id="body" class="stack"></div>
  </section>`);

  const body = el.querySelector('#body');
  const renderSummary = () => {
    if (!st.played) {
      body.innerHTML = `<div class="empty-state"><div class="ico">📊</div><p>Todavía no hay partidas terminadas.<br>Las estadísticas aparecen al terminar la primera.</p></div>`;
      return;
    }
    const pct = Math.round(st.accuracy * 100);
    const teams = st.teams
      .map((t) => `<tr><td><span class="row"><span class="team-dot" style="--team:var(--team-${t.color})"></span>${esc(t.name)}</span></td><td class="num">${t.played}</td><td class="num">${t.won}</td><td class="num">${t.pct}%</td></tr>`)
      .join('');
    const maxCat = st.topCategories[0]?.count || 1;
    const cats = st.topCategories
      .slice(0, 8)
      .map((c) => {
        const cat = app.bank.category(c.cat);
        return `<div class="hbar"><span class="lbl">${cat.icon} ${esc(cat.name)}</span><span class="track"><i style="width:${Math.round((c.count / maxCat) * 100)}%"></i></span><span class="num">${c.count}</span></div>`;
      })
      .join('');
    body.innerHTML = `
      <div class="highlights">
        <div class="stat"><b>${st.played}</b><span>partidas jugadas</span></div>
        <div class="stat"><b>${st.rounds}</b><span>rondas</span></div>
        <div class="stat"><b>${st.hits.toLocaleString('es-UY')}</b><span>palabras acertadas</span></div>
        <div class="stat"><b>${st.avgHits.toFixed(1)}</b><span>aciertos por ronda</span></div>
        <div class="stat"><b>${pct}%</b><span>efectividad (aciertos / mostradas)</span></div>
        <div class="stat"><b>${st.bestRound ? st.bestRound.hits : 0}</b><span>récord en una ronda${st.bestRound ? ` · ${esc(st.bestRound.describer)}` : ''}</span></div>
      </div>
      <div class="card"><h3>Equipos</h3>
        <table class="table"><thead><tr><th>Equipo</th><th class="num">PJ</th><th class="num">PG</th><th class="num">% vic.</th></tr></thead><tbody>${teams}</tbody></table>
        <p class="tiny muted" style="margin-top:8px">Los equipos se agrupan por nombre: usen siempre el mismo para acumular.</p>
      </div>
      <div class="card stack"><h3 style="margin:0">Categorías más usadas</h3>${cats || '<p class="muted">Sin datos</p>'}</div>`;
  };

  const renderHistory = () => {
    if (!games.length) {
      body.innerHTML = `<div class="empty-state"><div class="ico">🗂️</div><p>No hay partidas registradas.</p></div>`;
      return;
    }
    body.innerHTML =
      games
        .map((g) => {
          const mode = MODES[g.mode];
          const teams = g.teams
            .map((t, i) => `<span class="row" style="gap:6px"><span class="team-dot" style="--team:var(--team-${t.color})"></span>${g.winners.includes(i) ? '🏆 ' : ''}<b>${esc(t.name)}</b> <span class="muted">${t.score}</span></span>`)
            .join('');
          const rounds = g.rounds
            .map((r, i) => `<div class="small">${i + 1}. ${esc(g.teams[r.team]?.name || '')} · ${esc(r.describer)}: ${r.hits} ✓ ${r.skips} ✗${r.die !== null && r.die !== undefined ? ` · dado ${r.die}` : ''}</div>`)
            .join('');
          return `<article class="game-item">
            <div class="head"><span>${mode?.icon || ''} ${esc(mode?.name || g.mode)}${g.endedEarly ? ' · anticipada' : ''}</span><span>${formatDate(g.finishedAt)}</span></div>
            <div class="teams">${teams}</div>
            <details><summary>${g.rounds.length} rondas · ${g.hits} aciertos</summary><div class="stack" style="gap:4px;margin-top:8px">${rounds}</div></details>
          </article>`;
        })
        .join('') + `<button class="btn ghost block" data-act="clear">Borrar historial y estadísticas</button>`;
  };

  const render = () => (tab === 'summary' ? renderSummary() : renderHistory());

  onAction(el, {
    back: () => app.go('menu'),
    tab: (b) => {
      tab = b.dataset.tab;
      el.querySelectorAll('[data-act="tab"]').forEach((x) => x.setAttribute('aria-selected', x === b));
      render();
    },
    clear: async () => {
      const ok = await confirmDialog({ title: '¿Borrar todo el historial?', text: 'Se pierden las estadísticas de todas las partidas. No se puede deshacer.', ok: 'Borrar', danger: true });
      if (!ok) return;
      app.clearFinishedGames();
      toast('Historial borrado');
      app.go('stats', { tab: 'history' });
    },
  });
  render();
  return { el };
}
