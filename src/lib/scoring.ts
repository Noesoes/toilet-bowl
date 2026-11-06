import { Player, Pos } from './types';
import { Rng, normal, poisson, rngFor } from './rng';

export interface StatLine {
  bye?: boolean;
  dnp?: boolean;
  passYds?: number;
  passTd?: number;
  int?: number;
  rushYds?: number;
  rushTd?: number;
  rec?: number;
  recYds?: number;
  recTd?: number;
  fum?: number;
  fg?: number;
  xp?: number;
  /** DEF only: points allowed, sacks, takeaways, defensive TDs */
  ptsAllowed?: number;
  sacks?: number;
  takeaways?: number;
  defTd?: number;
  points: number;
}

/** Full-PPR scoring rules. */
export const SCORING = {
  passYd: 0.04,
  passTd: 4,
  int: -2,
  rushYd: 0.1,
  rushTd: 6,
  rec: 1,
  recYd: 0.1,
  recTd: 6,
  fum: -2,
  fg: 3,
  xp: 1,
  sack: 1,
  takeaway: 2,
  defTd: 6,
};

function pointsAllowedScore(pa: number): number {
  if (pa === 0) return 10;
  if (pa <= 6) return 7;
  if (pa <= 13) return 4;
  if (pa <= 20) return 1;
  if (pa <= 27) return 0;
  if (pa <= 34) return -1;
  return -4;
}

export function fantasyPoints(s: Omit<StatLine, 'points'>): number {
  const S = SCORING;
  let pts =
    (s.passYds ?? 0) * S.passYd +
    (s.passTd ?? 0) * S.passTd +
    (s.int ?? 0) * S.int +
    (s.rushYds ?? 0) * S.rushYd +
    (s.rushTd ?? 0) * S.rushTd +
    (s.rec ?? 0) * S.rec +
    (s.recYds ?? 0) * S.recYd +
    (s.recTd ?? 0) * S.recTd +
    (s.fum ?? 0) * S.fum +
    (s.fg ?? 0) * S.fg +
    (s.xp ?? 0) * S.xp +
    (s.sacks ?? 0) * S.sack +
    (s.takeaways ?? 0) * S.takeaway +
    (s.defTd ?? 0) * S.defTd;
  if (s.ptsAllowed !== undefined) pts += pointsAllowedScore(s.ptsAllowed);
  return Math.round(pts * 10) / 10;
}

/** Baseline per-game stats for a player whose projection equals `ref`. Scaled linearly from there. */
const TEMPLATES: Record<Exclude<Pos, 'K' | 'DEF'>, { ref: number; stats: Record<string, number> }> = {
  QB: { ref: 20, stats: { passYds: 265, passTd: 1.9, int: 0.7, rushYds: 22, rushTd: 0.2, fum: 0.15 } },
  RB: { ref: 15, stats: { rushYds: 68, rushTd: 0.55, rec: 3.2, recYds: 24, recTd: 0.15, fum: 0.08 } },
  WR: { ref: 15, stats: { rec: 5.4, recYds: 70, recTd: 0.45, rushYds: 3, fum: 0.04 } },
  TE: { ref: 11, stats: { rec: 4.4, recYds: 46, recTd: 0.38, fum: 0.03 } },
};

const COUNTING = new Set(['passTd', 'int', 'rushTd', 'rec', 'recTd', 'fum']);

function simSkill(p: Player, rng: Rng): Omit<StatLine, 'points'> {
  const t = TEMPLATES[p.pos as keyof typeof TEMPLATES];
  const scale = p.proj / t.ref;
  // One "game script" factor drives correlated volume; individual stats get their own noise.
  const game = Math.max(0.15, normal(rng, 1, 0.3));
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(t.stats)) {
    const mean = v * scale * (k === 'int' || k === 'fum' ? 1 / Math.max(scale, 0.6) : game);
    out[k] = COUNTING.has(k) ? poisson(rng, mean) : Math.max(-5, Math.round(normal(rng, mean, mean * 0.25)));
  }
  return out;
}

function simKicker(p: Player, rng: Rng): Omit<StatLine, 'points'> {
  const scale = p.proj / 8;
  return { fg: poisson(rng, 1.7 * scale), xp: poisson(rng, 2.4 * scale) };
}

function simDefense(p: Player, rng: Rng): Omit<StatLine, 'points'> {
  const quality = (p.proj - 4) / 5.5; // 0..1
  const ptsAllowed = Math.max(0, Math.round(normal(rng, 25 - quality * 8, 8)));
  return {
    ptsAllowed,
    sacks: poisson(rng, 2 + quality * 1.5),
    takeaways: poisson(rng, 1 + quality * 0.8),
    defTd: rng() < 0.06 + quality * 0.06 ? 1 : 0,
  };
}

/**
 * A player's stat line for a given week. Deterministic for (league seed, week, player),
 * so results never need to be stored and can be recomputed anywhere.
 */
export function statLine(seed: number, week: number, p: Player): StatLine {
  if (p.bye === week) return { bye: true, points: 0 };
  const rng = rngFor(seed, 'stats', week, p.id);
  if (rng() < 0.035) return { dnp: true, points: 0 };
  const s = p.pos === 'K' ? simKicker(p, rng) : p.pos === 'DEF' ? simDefense(p, rng) : simSkill(p, rng);
  return { ...s, points: fantasyPoints(s) };
}

const cache = new Map<string, StatLine>();
export function cachedStatLine(seed: number, week: number, p: Player): StatLine {
  const key = `${seed}:${week}:${p.id}`;
  let s = cache.get(key);
  if (!s) {
    s = statLine(seed, week, p);
    if (cache.size > 20000) cache.clear();
    cache.set(key, s);
  }
  return s;
}

export function formatStatLine(s: StatLine): string {
  if (s.bye) return 'BYE';
  if (s.dnp) return 'Did not play';
  const parts: string[] = [];
  if (s.passYds) parts.push(`${s.passYds} pass yds`);
  if (s.passTd) parts.push(`${s.passTd} pass TD`);
  if (s.int) parts.push(`${s.int} INT`);
  if (s.rushYds) parts.push(`${s.rushYds} rush yds`);
  if (s.rushTd) parts.push(`${s.rushTd} rush TD`);
  if (s.rec) parts.push(`${s.rec} rec`);
  if (s.recYds) parts.push(`${s.recYds} rec yds`);
  if (s.recTd) parts.push(`${s.recTd} rec TD`);
  if (s.fum) parts.push(`${s.fum} FUM`);
  if (s.fg !== undefined) parts.push(`${s.fg} FG`, `${s.xp ?? 0} XP`);
  if (s.ptsAllowed !== undefined)
    parts.push(`${s.ptsAllowed} PA`, `${s.sacks ?? 0} sacks`, `${s.takeaways ?? 0} TO`);
  if (s.defTd) parts.push(`${s.defTd} TD`);
  return parts.join(', ') || 'No stats';
}
