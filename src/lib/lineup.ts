import { Lineup, Player, Pos, SlotId } from './types';

export interface Slot {
  id: SlotId;
  label: string;
  allowed: Pos[];
}

export const SLOTS: Slot[] = [
  { id: 'QB', label: 'QB', allowed: ['QB'] },
  { id: 'RB1', label: 'RB', allowed: ['RB'] },
  { id: 'RB2', label: 'RB', allowed: ['RB'] },
  { id: 'WR1', label: 'WR', allowed: ['WR'] },
  { id: 'WR2', label: 'WR', allowed: ['WR'] },
  { id: 'TE', label: 'TE', allowed: ['TE'] },
  { id: 'FLEX', label: 'FLEX', allowed: ['RB', 'WR', 'TE'] },
  { id: 'K', label: 'K', allowed: ['K'] },
  { id: 'DEF', label: 'DEF', allowed: ['DEF'] },
];

export const ROSTER_SIZE = 15;

export function emptyLineup(): Lineup {
  return Object.fromEntries(SLOTS.map((s) => [s.id, null])) as Lineup;
}

export function slotById(id: SlotId): Slot {
  return SLOTS.find((s) => s.id === id)!;
}

export function canPlay(p: Player, slot: SlotId): boolean {
  return slotById(slot).allowed.includes(p.pos);
}

/** Best projected lineup for a week, skipping players on bye. */
export function bestLineup(roster: string[], players: Record<string, Player>, week: number): Lineup {
  const lineup = emptyLineup();
  const pool = roster
    .map((id) => players[id])
    .filter(Boolean)
    .sort((a, b) => effectiveProj(b, week) - effectiveProj(a, week));
  const used = new Set<string>();
  for (const slot of SLOTS) {
    const p = pool.find((x) => !used.has(x.id) && slot.allowed.includes(x.pos));
    if (p) {
      lineup[slot.id] = p.id;
      used.add(p.id);
    }
  }
  return lineup;
}

export function effectiveProj(p: Player, week: number): number {
  return p.bye === week ? 0 : p.proj;
}

export function lineupProjection(lineup: Lineup, players: Record<string, Player>, week: number): number {
  let total = 0;
  for (const id of Object.values(lineup)) if (id && players[id]) total += effectiveProj(players[id], week);
  return Math.round(total * 10) / 10;
}

export function benchOf(roster: string[], lineup: Lineup): string[] {
  const starters = new Set(Object.values(lineup).filter(Boolean));
  return roster.filter((id) => !starters.has(id));
}

/** Drop any lineup entries for players no longer on the roster. */
export function cleanLineup(lineup: Lineup, roster: string[]): Lineup {
  const set = new Set(roster);
  const out = { ...lineup };
  for (const k of Object.keys(out) as SlotId[]) if (out[k] && !set.has(out[k]!)) out[k] = null;
  return out;
}
