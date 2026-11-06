import { League, Player, Pos } from './types';
import { Rng } from './rng';

export function snakeOrder(teamIds: string[], rounds: number): string[] {
  const order: string[] = [];
  for (let r = 0; r < rounds; r++) order.push(...(r % 2 === 0 ? teamIds : [...teamIds].reverse()));
  return order;
}

export function draftedIds(league: League): Set<string> {
  return new Set(league.picks.map((p) => p.playerId));
}

export function availablePlayers(league: League): Player[] {
  const taken = draftedIds(league);
  return Object.values(league.players)
    .filter((p) => !taken.has(p.id))
    .sort((a, b) => a.adp - b.adp);
}

export function currentPick(league: League): { overall: number; round: number; teamId: string } | null {
  const overall = league.picks.length;
  if (overall >= league.draftOrder.length) return null;
  return { overall: overall + 1, round: Math.floor(overall / league.teams.length) + 1, teamId: league.draftOrder[overall] };
}

const REQUIRED: Record<Pos, number> = { QB: 1, RB: 2, WR: 2, TE: 1, K: 1, DEF: 1 };
const MAX: Record<Pos, number> = { QB: 2, RB: 6, WR: 6, TE: 2, K: 1, DEF: 1 };

/**
 * CPU draft logic: best available by ADP, respecting position caps,
 * waiting on K/DEF, and making sure every starting slot gets filled.
 */
export function chooseDraftPick(league: League, teamId: string, rng: Rng): Player {
  const team = league.teams.find((t) => t.id === teamId)!;
  const counts: Record<Pos, number> = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DEF: 0 };
  for (const id of team.roster) counts[league.players[id].pos]++;

  const picksLeft = league.rounds - team.roster.length; // including this one
  const missing = (Object.keys(REQUIRED) as Pos[]).filter((p) => counts[p] < REQUIRED[p]);
  const missingSlots = missing.reduce((n, p) => n + (REQUIRED[p] - counts[p]), 0);
  const round = Math.floor(league.picks.length / league.teams.length) + 1;

  let pool = availablePlayers(league).filter((p) => counts[p.pos] < MAX[p.pos]);
  if (missingSlots >= picksLeft) pool = pool.filter((p) => missing.includes(p.pos));
  else if (round < league.rounds - 3) pool = pool.filter((p) => p.pos !== 'K' && p.pos !== 'DEF');
  if (pool.length === 0) pool = availablePlayers(league);

  // A little unpredictability: usually the top guy, sometimes the 2nd or 3rd.
  const r = rng();
  const idx = r < 0.65 ? 0 : r < 0.9 ? 1 : 2;
  return pool[Math.min(idx, pool.length - 1)];
}
