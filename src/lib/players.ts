import { Player, Pos } from './types';
import { Rng, mulberry32, normal, shuffle } from './rng';

export const NFL_TEAMS = [
  'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE', 'DAL', 'DEN', 'DET', 'GB', 'HOU', 'IND', 'JAX', 'KC',
  'LAC', 'LAR', 'LV', 'MIA', 'MIN', 'NE', 'NO', 'NYG', 'NYJ', 'PHI', 'PIT', 'SEA', 'SF', 'TB', 'TEN', 'WAS',
];

const FIRST = [
  'Marcus', 'Jalen', 'Tyler', 'DeShawn', 'Cole', 'Bryce', 'Trey', 'Darius', 'Austin', 'Malik', 'Jordan', 'Caleb',
  'Isaiah', 'Brandon', 'Xavier', 'Devin', 'Logan', 'Terrell', 'Garrett', 'Hunter', 'Andre', 'Kendall', 'Rashad',
  'Mason', 'Elijah', 'Damon', 'Quentin', 'Zach', 'Jamal', 'Noah', 'Cedric', 'Tavon', 'Preston', 'Roman', 'Jaylen',
  'Colby', 'Dante', 'Keenan', 'Micah', 'Wyatt', 'Reggie', 'Omar', 'Luke', 'Nico', 'Tre', 'Javon', 'Brock', 'Ty',
];
const LAST = [
  'Johnson', 'Williams', 'Carter', 'Brooks', 'Hayes', 'Mitchell', 'Coleman', 'Sanders', 'Reed', 'Bryant', 'Foster',
  'Jenkins', 'Price', 'Henderson', 'Patterson', 'Wallace', 'Barnes', 'Graham', 'Knight', 'Stone', 'Fields',
  'Hollins', 'Dawson', 'Mack', 'Tate', 'Booker', 'Ellis', 'Ford', 'Holt', 'Lockett', 'Maddox', 'Nash', 'Pryor',
  'Quinn', 'Rhodes', 'Shaw', 'Tillman', 'Vance', 'Ward', 'Young', 'Banks', 'Crowder', 'Dunbar', 'Easley', 'Fuller',
  'Gaines', 'Harlan', 'Irving', 'Jeffers', 'Kirby', 'Lowe', 'Moss', 'Okafor', 'Pruitt', 'Rollins', 'Slade',
];

/** Bye week for each NFL team (weeks 5-14). */
export function byeFor(teamIndex: number): number {
  return 5 + (teamIndex % 10);
}

/** How many of each position to create, and the projection curve (top -> bottom). */
const POOL: Record<Pos, { count: number; top: number; bottom: number }> = {
  QB: { count: 34, top: 24, bottom: 9 },
  RB: { count: 70, top: 21, bottom: 2.5 },
  WR: { count: 90, top: 20, bottom: 2.5 },
  TE: { count: 34, top: 15, bottom: 2 },
  K: { count: 32, top: 9.5, bottom: 5.5 },
  DEF: { count: 32, top: 9.5, bottom: 4 },
};

/** Points-per-game of a freely available starter — used for draft value. */
export const REPLACEMENT: Record<Pos, number> = { QB: 15, RB: 8, WR: 8.5, TE: 6, K: 7.5, DEF: 6.5 };

export function valueOf(p: Player): number {
  return p.proj - REPLACEMENT[p.pos];
}

function uniqueName(rng: Rng, used: Set<string>): string {
  for (;;) {
    const name = `${FIRST[Math.floor(rng() * FIRST.length)]} ${LAST[Math.floor(rng() * LAST.length)]}`;
    if (!used.has(name)) {
      used.add(name);
      return name;
    }
  }
}

/**
 * Generates a fictional player pool. Swap this out for a real data feed later;
 * everything else only depends on the Player shape.
 */
export function generatePlayers(seed: number): Record<string, Player> {
  const rng = mulberry32(seed);
  const used = new Set<string>();
  const list: Player[] = [];

  for (const pos of Object.keys(POOL) as Pos[]) {
    const { count, top, bottom } = POOL[pos];
    const teams = pos === 'DEF' ? NFL_TEAMS : null;
    for (let i = 0; i < count; i++) {
      // Convex curve: elite tier drops off quickly, depth flattens out.
      const t = i / (count - 1);
      const base = bottom + (top - bottom) * Math.pow(1 - t, 1.7);
      const proj = Math.max(1, Math.round((base + normal(rng, 0, 0.6)) * 10) / 10);
      const teamIndex = teams ? i : Math.floor(rng() * NFL_TEAMS.length);
      const nflTeam = NFL_TEAMS[teamIndex];
      list.push({
        id: `${pos}${i + 1}`,
        name: teams ? `${nflTeam} D/ST` : uniqueName(rng, used),
        pos,
        nflTeam,
        bye: byeFor(NFL_TEAMS.indexOf(nflTeam)),
        proj,
        adp: 0,
      });
    }
  }

  // DEF are generated in team order; shuffle their projections so strength isn't alphabetical.
  const defs = list.filter((p) => p.pos === 'DEF');
  const projs = shuffle(rng, defs.map((d) => d.proj));
  defs.forEach((d, i) => (d.proj = projs[i]));

  // ADP: value over replacement plus a little market noise; K/DEF go late.
  const scored = list.map((p) => {
    let v = valueOf(p) + normal(rng, 0, 0.8);
    if (p.pos === 'K' || p.pos === 'DEF') v -= 6;
    if (p.pos === 'QB') v -= 1.5;
    return { p, v };
  });
  scored.sort((a, b) => b.v - a.v);
  scored.forEach((s, i) => (s.p.adp = i + 1));

  return Object.fromEntries(list.map((p) => [p.id, p]));
}
