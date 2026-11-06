import { describe, expect, it } from 'vitest';
import {
  addDropPlayer, advanceToUser, autoDraftRest, createLeague, evaluateTrade, executeTrade, freeAgents,
  makePick, simulateWeek, standings, totalWeeks, userTeam,
} from './league';
import { availablePlayers, currentPick } from './draft';
import { fantasyPoints, statLine } from './scoring';
import { SLOTS } from './lineup';

const opts = { name: 'Test', teamName: 'Mine', ownerName: 'Me', numTeams: 10, draftSlot: 3, seed: 42 };

function drafted() {
  return autoDraftRest(createLeague(opts));
}

describe('league creation & draft', () => {
  it('puts the user in the requested draft slot', () => {
    const l = createLeague(opts);
    expect(l.teams[2].isUser).toBe(true);
    expect(l.teams).toHaveLength(10);
  });

  it('runs CPU picks until it is the user\'s turn', () => {
    const l = advanceToUser(createLeague(opts));
    expect(l.picks).toHaveLength(2);
    expect(currentPick(l)!.teamId).toBe(userTeam(l).id);
    const next = makePick(l, availablePlayers(l)[0].id);
    expect(userTeam(next).roster).toHaveLength(1);
  });

  it('fills every roster with a valid starting lineup', () => {
    const l = drafted();
    expect(l.phase).toBe('season');
    for (const t of l.teams) {
      expect(t.roster).toHaveLength(15);
      for (const s of SLOTS) expect(t.lineup[s.id]).not.toBeNull();
    }
    expect(new Set(l.picks.map((p) => p.playerId)).size).toBe(150);
  });

  it('is deterministic for a given seed', () => {
    expect(drafted().picks).toEqual(drafted().picks);
  });
});

describe('scoring', () => {
  it('scores PPR correctly', () => {
    expect(fantasyPoints({ rec: 5, recYds: 80, recTd: 1 })).toBe(19);
    expect(fantasyPoints({ passYds: 300, passTd: 2, int: 1 })).toBe(18);
  });

  it('gives zero on bye and produces sane averages', () => {
    const l = drafted();
    const p = Object.values(l.players).find((x) => x.pos === 'WR' && x.adp < 20)!;
    expect(statLine(l.seed, p.bye, p).bye).toBe(true);
    let sum = 0;
    for (let w = 0; w < 400; w++) sum += statLine(w, 1, { ...p, bye: 99 }).points;
    const avg = sum / 400;
    expect(avg).toBeGreaterThan(p.proj * 0.75);
    expect(avg).toBeLessThan(p.proj * 1.25);
  });
});

describe('season', () => {
  it('plays a full season with both playoff brackets', () => {
    let l = drafted();
    for (let i = 0; i < totalWeeks(l); i++) l = simulateWeek(l);
    expect(l.phase).toBe('done');
    expect(l.results).toHaveLength(16);
    const s = standings(l);
    expect(s.reduce((n, r) => n + r.w + r.l + r.t, 0)).toBe(14 * 10);
    expect(l.champion).toBeTruthy();
    expect(l.toiletBowlLoser).toBeTruthy();
    expect(s.slice(0, 4).map((r) => r.teamId)).toContain(l.champion);
    expect(s.slice(-4).map((r) => r.teamId)).toContain(l.toiletBowlLoser);
  });

  it('handles add/drop and trades', () => {
    let l = drafted();
    const me = userTeam(l);
    const fa = freeAgents(l)[0];
    l = addDropPlayer(l, me.id, fa.id, me.roster[14]);
    expect(userTeam(l).roster).toContain(fa.id);
    expect(() => addDropPlayer(l, me.id, freeAgents(l)[0].id)).toThrow(/full/);

    const partner = l.teams.find((t) => !t.isUser)!;
    const mine = [...userTeam(l).roster].sort((a, b) => l.players[b].proj - l.players[a].proj);
    const theirs = [...partner.roster].sort((a, b) => l.players[a].proj - l.players[b].proj);
    const ev = evaluateTrade(l, partner.id, [mine[0]], [theirs[0]]);
    expect(ev.accept).toBe(true);
    l = executeTrade(l, partner.id, [mine[0]], [theirs[0]]);
    expect(userTeam(l).roster).toContain(theirs[0]);
    expect(evaluateTrade(l, partner.id, [theirs[0]], [mine[0]]).accept).toBe(false);
  });
});
