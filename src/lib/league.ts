import { League, Lineup, Matchup, MatchupResult, Team, Transaction, WeekResult } from './types';
import { generatePlayers, valueOf } from './players';
import { hashSeed, mulberry32, rngFor, shuffle } from './rng';
import { availablePlayers, chooseDraftPick, currentPick, snakeOrder } from './draft';
import { ROSTER_SIZE, bestLineup, cleanLineup, emptyLineup } from './lineup';
import { cachedStatLine } from './scoring';

export const CPU_TEAMS = [
  ['Flush Hour', 'Gus'], ['The Plungers', 'Rita'], ['Porcelain Gods', 'Dev'], ['Two-Ply Titans', 'Mo'],
  ['Septic Tanks', 'Lena'], ['Golden Showers of Glory', 'Hank'], ['Bidet Blitz', 'Priya'], ['Clogged Arteries', 'Sal'],
  ['Royal Flush', 'Kim'], ['Swirlies', 'Otis'], ['Brown Bombers', 'Tess'], ['Sit & Spin', 'Vic'],
] as const;

export interface NewLeagueOptions {
  name: string;
  teamName: string;
  ownerName: string;
  numTeams: number;
  /** 1-based draft slot, or 0 for random */
  draftSlot: number;
  seed?: number;
}

export function createLeague(opts: NewLeagueOptions): League {
  const seed = opts.seed ?? hashSeed(Date.now(), Math.random());
  const rng = mulberry32(seed);
  const cpu = shuffle(rng, CPU_TEAMS).slice(0, opts.numTeams - 1);
  let teams: Team[] = [
    { id: 't0', name: opts.teamName, owner: opts.ownerName, isUser: true, roster: [], lineup: emptyLineup() },
    ...cpu.map(([name, owner], i) => ({
      id: `t${i + 1}`, name, owner, isUser: false, roster: [], lineup: emptyLineup(),
    })),
  ];
  teams = shuffle(rng, teams);
  if (opts.draftSlot > 0) {
    const user = teams.find((t) => t.isUser)!;
    teams = teams.filter((t) => !t.isUser);
    teams.splice(Math.min(opts.draftSlot - 1, teams.length), 0, user);
  }
  const regularSeasonWeeks = 14;
  return {
    version: 1,
    name: opts.name,
    seed,
    createdAt: Date.now(),
    phase: 'draft',
    teams,
    players: generatePlayers(seed),
    draftOrder: snakeOrder(teams.map((t) => t.id), ROSTER_SIZE),
    picks: [],
    rounds: ROSTER_SIZE,
    schedule: roundRobin(teams.map((t) => t.id), regularSeasonWeeks, seed),
    regularSeasonWeeks,
    playoffWeeks: 2,
    week: 1,
    results: [],
    transactions: [],
  };
}

/** Circle-method round robin, repeated until we have enough weeks. */
export function roundRobin(ids: string[], weeks: number, seed: number): Matchup[][] {
  const list = shuffle(mulberry32(seed ^ 0x5eed), ids);
  if (list.length % 2) list.push('BYE');
  const n = list.length;
  const rounds: Matchup[][] = [];
  for (let r = 0; r < n - 1; r++) {
    const week: Matchup[] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = list[i];
      const b = list[n - 1 - i];
      if (a !== 'BYE' && b !== 'BYE')
        week.push(r % 2 ? { homeId: a, awayId: b, bracket: 'regular' } : { homeId: b, awayId: a, bracket: 'regular' });
    }
    rounds.push(week);
    list.splice(1, 0, list.pop()!);
  }
  return Array.from({ length: weeks }, (_, w) => rounds[w % rounds.length]);
}

export function teamById(league: League, id: string): Team {
  return league.teams.find((t) => t.id === id)!;
}

export function userTeam(league: League): Team {
  return league.teams.find((t) => t.isUser)!;
}

// ---------- Draft ----------

export function makePick(league: League, playerId: string): League {
  const cur = currentPick(league);
  if (!cur) return league;
  if (league.picks.some((p) => p.playerId === playerId)) throw new Error('Player already drafted');
  const next = structuredClone(league);
  next.picks.push({ overall: cur.overall, round: cur.round, teamId: cur.teamId, playerId });
  teamById(next, cur.teamId).roster.push(playerId);
  if (next.picks.length === next.draftOrder.length) return finishDraft(next);
  return next;
}

export function cpuPick(league: League): League {
  const cur = currentPick(league);
  if (!cur) return league;
  const rng = rngFor(league.seed, 'draft', cur.overall);
  return makePick(league, chooseDraftPick(league, cur.teamId, rng).id);
}

/** Run CPU picks until it's the user's turn (or the draft ends). */
export function advanceToUser(league: League): League {
  let l = league;
  for (;;) {
    const cur = currentPick(l);
    if (!cur || teamById(l, cur.teamId).isUser) return l;
    l = cpuPick(l);
  }
}

export function autoDraftRest(league: League): League {
  let l = league;
  while (currentPick(l)) l = cpuPick(l);
  return l;
}

function finishDraft(league: League): League {
  league.phase = 'season';
  for (const t of league.teams) t.lineup = bestLineup(t.roster, league.players, 1);
  return league;
}

// ---------- Season ----------

export interface Standing {
  teamId: string;
  w: number;
  l: number;
  t: number;
  pf: number;
  pa: number;
  streak: string;
}

export function standings(league: League): Standing[] {
  const map = new Map<string, Standing & { log: string[] }>();
  for (const t of league.teams) map.set(t.id, { teamId: t.id, w: 0, l: 0, t: 0, pf: 0, pa: 0, streak: '-', log: [] });
  for (const r of league.results) {
    for (const m of r.matchups) {
      if (m.bracket !== 'regular') continue;
      const h = map.get(m.homeId)!;
      const a = map.get(m.awayId)!;
      h.pf += m.homeScore; h.pa += m.awayScore;
      a.pf += m.awayScore; a.pa += m.homeScore;
      if (m.homeScore > m.awayScore) { h.w++; a.l++; h.log.push('W'); a.log.push('L'); }
      else if (m.homeScore < m.awayScore) { a.w++; h.l++; a.log.push('W'); h.log.push('L'); }
      else { h.t++; a.t++; h.log.push('T'); a.log.push('T'); }
    }
  }
  const rows = [...map.values()].map(({ log, ...s }) => {
    if (log.length) {
      const last = log[log.length - 1];
      let n = 0;
      for (let i = log.length - 1; i >= 0 && log[i] === last; i--) n++;
      s.streak = `${last}${n}`;
    }
    s.pf = Math.round(s.pf * 10) / 10;
    s.pa = Math.round(s.pa * 10) / 10;
    return s;
  });
  return rows.sort((a, b) => b.w + b.t / 2 - (a.w + a.t / 2) || b.pf - a.pf);
}

export function matchupsForWeek(league: League, week: number): Matchup[] {
  return league.schedule[week - 1] ?? [];
}

export function opponentOf(league: League, teamId: string, week: number): string | null {
  const m = matchupsForWeek(league, week).find((x) => x.homeId === teamId || x.awayId === teamId);
  if (!m) return null;
  return m.homeId === teamId ? m.awayId : m.homeId;
}

export function teamScore(league: League, lineup: Lineup, week: number): number {
  let total = 0;
  for (const id of Object.values(lineup)) {
    if (id) total += cachedStatLine(league.seed, week, league.players[id]).points;
  }
  return Math.round(total * 10) / 10;
}

export function totalWeeks(league: League): number {
  return league.regularSeasonWeeks + league.playoffWeeks;
}

/** Play the current week: CPU teams set optimal lineups, everyone scores, standings advance. */
export function simulateWeek(league: League): League {
  if (league.phase !== 'season') return league;
  const next = structuredClone(league);
  const week = next.week;
  const matchups = matchupsForWeek(next, week);
  const starters: Record<string, Lineup> = {};

  for (const t of next.teams) {
    if (!t.isUser) {
      cpuWaivers(next, t);
      t.lineup = bestLineup(t.roster, next.players, week);
    }
    t.lineup = cleanLineup(t.lineup, t.roster);
    starters[t.id] = { ...t.lineup };
  }

  const results: MatchupResult[] = matchups.map((m) => ({
    ...m,
    homeScore: teamScore(next, starters[m.homeId], week),
    awayScore: teamScore(next, starters[m.awayId], week),
  }));
  const result: WeekResult = { week, matchups: results, starters };
  next.results.push(result);
  next.week = week + 1;

  if (week === next.regularSeasonWeeks) next.schedule.push(playoffRoundOne(next));
  else if (week === next.regularSeasonWeeks + 1) next.schedule.push(playoffFinals(next, results));
  else if (week === totalWeeks(next)) finishSeason(next, results);

  // Pre-set the user's lineup for the coming week if empty slots appeared (e.g. a trade).
  return next;
}

function winnerLoser(m: MatchupResult): [string, string] {
  // Ties go to the home team (the higher seed in playoffs).
  return m.homeScore >= m.awayScore ? [m.homeId, m.awayId] : [m.awayId, m.homeId];
}

export function playoffTeams(league: League) {
  const seeds = standings(league).map((s) => s.teamId);
  const n = seeds.length;
  return { champ: seeds.slice(0, 4), toilet: seeds.slice(n - 4) };
}

function playoffRoundOne(league: League): Matchup[] {
  const { champ, toilet } = playoffTeams(league);
  return [
    { homeId: champ[0], awayId: champ[3], bracket: 'champ', label: 'Semifinal' },
    { homeId: champ[1], awayId: champ[2], bracket: 'champ', label: 'Semifinal' },
    // Toilet bowl: the LOSERS advance. Lose the final and you're the league's last-place legend.
    { homeId: toilet[0], awayId: toilet[3], bracket: 'toilet', label: 'Toilet Bowl Semi' },
    { homeId: toilet[1], awayId: toilet[2], bracket: 'toilet', label: 'Toilet Bowl Semi' },
  ];
}

function playoffFinals(_league: League, round1: MatchupResult[]): Matchup[] {
  const champ = round1.filter((m) => m.bracket === 'champ').map(winnerLoser);
  const toilet = round1.filter((m) => m.bracket === 'toilet').map(winnerLoser);
  return [
    { homeId: champ[0][0], awayId: champ[1][0], bracket: 'champ', label: 'Championship' },
    { homeId: champ[0][1], awayId: champ[1][1], bracket: 'champ', label: '3rd Place' },
    { homeId: toilet[0][1], awayId: toilet[1][1], bracket: 'toilet', label: 'The Toilet Bowl' },
  ];
}

function finishSeason(league: League, finals: MatchupResult[]) {
  const title = finals.find((m) => m.label === 'Championship')!;
  const bowl = finals.find((m) => m.label === 'The Toilet Bowl')!;
  league.champion = winnerLoser(title)[0];
  league.toiletBowlLoser = winnerLoser(bowl)[1];
  league.phase = 'done';
}

// ---------- Roster moves ----------

export function rosteredIds(league: League): Set<string> {
  return new Set(league.teams.flatMap((t) => t.roster));
}

export function freeAgents(league: League) {
  const taken = rosteredIds(league);
  return Object.values(league.players).filter((p) => !taken.has(p.id));
}

export function ownerOf(league: League, playerId: string): Team | undefined {
  return league.teams.find((t) => t.roster.includes(playerId));
}

function log(league: League, teamId: string, kind: Transaction['kind'], text: string) {
  league.transactions.unshift({ week: league.week, teamId, kind, text });
}

export function addDropPlayer(league: League, teamId: string, addId: string, dropId?: string): League {
  const next = structuredClone(league);
  const team = teamById(next, teamId);
  if (ownerOf(next, addId)) throw new Error('Player is already on a roster');
  if (dropId && !team.roster.includes(dropId)) throw new Error('You do not own that player');
  if (!dropId && team.roster.length >= ROSTER_SIZE) throw new Error('Roster is full — choose someone to drop');
  if (dropId) {
    team.roster = team.roster.filter((id) => id !== dropId);
    team.lineup = cleanLineup(team.lineup, team.roster);
  }
  team.roster.push(addId);
  const add = next.players[addId].name;
  log(next, teamId, 'add', dropId ? `Added ${add}, dropped ${next.players[dropId].name}` : `Added ${add}`);
  return next;
}

export function dropPlayer(league: League, teamId: string, dropId: string): League {
  const next = structuredClone(league);
  const team = teamById(next, teamId);
  team.roster = team.roster.filter((id) => id !== dropId);
  team.lineup = cleanLineup(team.lineup, team.roster);
  log(next, teamId, 'drop', `Dropped ${next.players[dropId].name}`);
  return next;
}

/** CPU managers occasionally grab a hot free agent over their worst bench player. */
function cpuWaivers(league: League, team: Team) {
  const rng = rngFor(league.seed, 'waiver', league.week, team.id);
  if (rng() > 0.3) return;
  const fa = freeAgents(league).filter((p) => p.pos !== 'K' && p.pos !== 'DEF').sort((a, b) => b.proj - a.proj)[0];
  if (!fa) return;
  const starters = new Set(Object.values(bestLineup(team.roster, league.players, league.week)));
  const bench = team.roster
    .filter((id) => !starters.has(id))
    .map((id) => league.players[id])
    .filter((p) => p.pos !== 'K' && p.pos !== 'DEF' && p.pos !== 'QB')
    .sort((a, b) => a.proj - b.proj);
  const worst = bench[0];
  if (!worst || fa.proj <= worst.proj + 0.5) return;
  team.roster = team.roster.filter((id) => id !== worst.id).concat(fa.id);
  log(league, team.id, 'add', `Added ${fa.name}, dropped ${worst.name}`);
}

// ---------- Trades ----------

export interface TradeEvaluation {
  accept: boolean;
  give: number;
  get: number;
  reason: string;
}

function tradeValue(league: League, ids: string[]): number {
  return ids.reduce((s, id) => s + Math.max(0.5, valueOf(league.players[id]) + 2), 0);
}

/** Would the CPU team accept? `give` = user's players, `get` = CPU's players. */
export function evaluateTrade(league: League, partnerId: string, give: string[], get: string[]): TradeEvaluation {
  const user = userTeam(league);
  const partner = teamById(league, partnerId);
  const g = tradeValue(league, give);
  const r = tradeValue(league, get);
  if (!give.length || !get.length) return { accept: false, give: g, get: r, reason: 'Pick players on both sides.' };
  if (user.roster.length - give.length + get.length > ROSTER_SIZE)
    return { accept: false, give: g, get: r, reason: 'That would put you over the roster limit.' };
  if (partner.roster.length - get.length + give.length > ROSTER_SIZE)
    return { accept: false, give: g, get: r, reason: `${partner.name} would be over the roster limit.` };
  if (g >= r * 1.08) return { accept: true, give: g, get: r, reason: `${partner.owner} accepts!` };
  return { accept: false, give: g, get: r, reason: `${partner.owner} wants more value back.` };
}

export function executeTrade(league: League, partnerId: string, give: string[], get: string[]): League {
  const next = structuredClone(league);
  const user = userTeam(next);
  const partner = teamById(next, partnerId);
  user.roster = user.roster.filter((id) => !give.includes(id)).concat(get);
  partner.roster = partner.roster.filter((id) => !get.includes(id)).concat(give);
  user.lineup = cleanLineup(user.lineup, user.roster);
  partner.lineup = bestLineup(partner.roster, next.players, next.week);
  const names = (ids: string[]) => ids.map((id) => next.players[id].name).join(', ');
  log(next, user.id, 'trade', `Traded ${names(give)} to ${partner.name} for ${names(get)}`);
  return next;
}

export { availablePlayers };
