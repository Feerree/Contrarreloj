// Estadísticas a partir del historial de partidas terminadas (resúmenes de summarize()).

import { normalizeKey } from './text.js';

export function computeStats(games) {
  const finished = games.filter((g) => g && g.teams);
  const teams = new Map(); // clave normalizada → { name, played, won }
  const catCounts = {};
  let rounds = 0;
  let hits = 0;
  let skips = 0;
  let bestRound = null;

  for (const g of finished) {
    g.teams.forEach((t, i) => {
      const key = normalizeKey(t.name);
      if (!teams.has(key)) teams.set(key, { name: t.name, played: 0, won: 0, color: t.color });
      const rec = teams.get(key);
      rec.played++;
      if (g.winners.includes(i)) rec.won++;
    });
    for (const r of g.rounds) {
      rounds++;
      hits += r.hits;
      skips += r.skips;
      if (!bestRound || r.hits > bestRound.hits) {
        bestRound = { hits: r.hits, team: g.teams[r.team]?.name, describer: r.describer, date: g.finishedAt };
      }
    }
    for (const [cat, n] of Object.entries(g.catCounts || {})) catCounts[cat] = (catCounts[cat] || 0) + n;
  }

  const teamList = [...teams.values()]
    .map((t) => ({ ...t, pct: t.played ? Math.round((t.won / t.played) * 100) : 0 }))
    .sort((a, b) => b.won - a.won || b.pct - a.pct || a.name.localeCompare(b.name));

  const topCategories = Object.entries(catCounts)
    .map(([cat, count]) => ({ cat, count }))
    .sort((a, b) => b.count - a.count);

  return {
    played: finished.length,
    decided: finished.filter((g) => g.winners.length).length,
    rounds,
    hits,
    skips,
    avgHits: rounds ? hits / rounds : 0,
    accuracy: hits + skips ? hits / (hits + skips) : 0,
    teams: teamList,
    topCategories,
    bestRound,
  };
}
