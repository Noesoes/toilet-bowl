# Toilet Bowl Fantasy

A mobile-first fantasy football app (web first; iPhone later).

## Run it

```bash
npm install
npm run dev      # http://localhost:5173 (also on your LAN, so you can open it on your phone)
npm test         # game-logic tests
npm run build    # production build in dist/
```

## What's in it

- **League setup** — name, team, 8/10/12 teams, pick your draft slot
- **Live snake draft** — 15 rounds vs. CPU managers, draft board, auto-pick
- **Lineups** — QB, 2 RB, 2 WR, TE, FLEX, K, DEF + 6 bench; tap-to-swap, bye warnings, auto-set
- **Weekly matchups** — projections, win probability, simulated stat lines, league scoreboard
- **Players** — free agents, search/filter/sort, add/drop, per-player game logs
- **League** — standings, schedule, trades with CPU teams, transaction log, scoring rules
- **Playoffs** — top 4 play for the title; bottom 4 play the **Toilet Bowl**, where losers advance

Players and stats are simulated (deterministic per league seed). Data is saved in the browser's localStorage.

## Structure

- `src/lib/` — pure game logic (no React): players, scoring, draft, lineup, season sim. Reusable for the iOS app.
- `src/views/` — screens
- `src/state/store.tsx` — app state + persistence
