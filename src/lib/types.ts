export type Pos = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF';
export const POSITIONS: Pos[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];

export type SlotId = 'QB' | 'RB1' | 'RB2' | 'WR1' | 'WR2' | 'TE' | 'FLEX' | 'K' | 'DEF';

export interface Player {
  id: string;
  name: string;
  pos: Pos;
  nflTeam: string;
  bye: number;
  /** Projected fantasy points per game (PPR). */
  proj: number;
  /** Average draft position rank (1 = first overall). */
  adp: number;
}

export type Lineup = Record<SlotId, string | null>;

export interface Team {
  id: string;
  name: string;
  owner: string;
  isUser: boolean;
  roster: string[];
  lineup: Lineup;
}

export interface DraftPick {
  overall: number;
  round: number;
  teamId: string;
  playerId: string;
}

export type Bracket = 'regular' | 'champ' | 'toilet';

export interface Matchup {
  homeId: string;
  awayId: string;
  bracket: Bracket;
  label?: string;
}

export interface MatchupResult extends Matchup {
  homeScore: number;
  awayScore: number;
}

export interface WeekResult {
  week: number;
  matchups: MatchupResult[];
  /** Snapshot of who each team started that week. */
  starters: Record<string, Lineup>;
}

export interface Transaction {
  week: number;
  teamId: string;
  kind: 'add' | 'drop' | 'trade';
  text: string;
}

export type Phase = 'draft' | 'season' | 'done';

export interface League {
  version: 1;
  name: string;
  seed: number;
  createdAt: number;
  phase: Phase;
  teams: Team[];
  players: Record<string, Player>;
  draftOrder: string[]; // team ids for every overall pick (snake)
  picks: DraftPick[];
  rounds: number;
  /** schedule[week-1] = matchups that week. Playoff weeks are appended when reached. */
  schedule: Matchup[][];
  regularSeasonWeeks: number;
  playoffWeeks: number;
  /** Next week to be played (1-based). */
  week: number;
  results: WeekResult[];
  transactions: Transaction[];
  /** Final placements once the season is done. */
  champion?: string;
  toiletBowlLoser?: string;
}
