import { useMemo, useState } from 'react';
import { useLeague } from '../state/store';
import { League, Lineup, Player, SlotId } from '../lib/types';
import { SLOTS, benchOf, bestLineup, canPlay, lineupProjection } from '../lib/lineup';
import { dropPlayer, opponentOf, standings, teamById, userTeam } from '../lib/league';
import { cachedStatLine } from '../lib/scoring';
import { PlayerCard, PlayerName, PosBadge, TeamLogo, fmt } from './common';
import { lineupIssues } from './Matchup';

/** A spot is either a lineup slot or a bench player. */
type Spot = { slot: SlotId } | { bench: string };

function seasonPoints(league: League, p: Player): number {
  let n = 0;
  for (let w = 1; w < league.week; w++) n += cachedStatLine(league.seed, w, p).points;
  return n;
}

export default function MyTeam() {
  const { league, act, notify } = useLeague();
  const me = userTeam(league);
  const week = league.week;
  const done = league.phase === 'done';
  const [sel, setSel] = useState<Spot | null>(null);
  const [card, setCard] = useState<Player | null>(null);

  const bench = benchOf(me.roster, me.lineup).sort((a, b) => league.players[b].proj - league.players[a].proj);
  const record = standings(league).find((s) => s.teamId === me.id)!;
  const rank = standings(league).findIndex((s) => s.teamId === me.id) + 1;
  const opp = opponentOf(league, me.id, week);
  const issues = done ? [] : lineupIssues(me.lineup, league.players, week);
  const proj = lineupProjection(me.lineup, league.players, week);
  const best = useMemo(() => lineupProjection(bestLineup(me.roster, league.players, week), league.players, week), [me.roster, league.players, week]);

  const playerAt = (s: Spot): string | null => ('slot' in s ? me.lineup[s.slot] : s.bench);

  /** Can the player currently at `from` move to `to` (and vice versa)? */
  function legal(from: Spot, to: Spot): boolean {
    const a = playerAt(from);
    const b = playerAt(to);
    if ('bench' in from && 'bench' in to) return false;
    if ('slot' in to && a && !canPlay(league.players[a], to.slot)) return false;
    if ('slot' in from && b && !canPlay(league.players[b], from.slot)) return false;
    return a !== b;
  }

  function tap(s: Spot) {
    if (done) return;
    if (!sel) {
      if (playerAt(s) || 'slot' in s) setSel(s);
      return;
    }
    if (same(sel, s)) return setSel(null);
    if (!legal(sel, s)) {
      // Treat it as selecting a new spot instead.
      setSel(playerAt(s) || 'slot' in s ? s : null);
      return;
    }
    const a = playerAt(sel);
    const b = playerAt(s);
    act((l) => {
      const next = structuredClone(l);
      const t = userTeam(next);
      const lu: Lineup = t.lineup;
      if ('slot' in sel) lu[sel.slot] = b;
      if ('slot' in s) lu[s.slot] = a;
      return next;
    });
    setSel(null);
  }

  const isSel = (s: Spot) => !!sel && same(sel, s);
  const isTarget = (s: Spot) => !!sel && !same(sel, s) && legal(sel, s);

  return (
    <>
      <header className="page-head with-logo">
        <TeamLogo team={me} size={64} />
        <div>
        <div className="eyebrow">{me.owner} · #{rank} of {league.teams.length}</div>
        <h1>{me.name}</h1>
        <div className="team-meta">
          <span className="pill">{record.w}-{record.l}{record.t ? `-${record.t}` : ''}</span>
          <span className="pill">PF {fmt(record.pf)}</span>
          {opp && !done && <span className="pill">Wk {week} vs {teamById(league, opp).name}</span>}
        </div>
        </div>
      </header>

      {!done && (
        <div className="lineup-bar">
          <div>
            <div className="muted small">Projected</div>
            <b className="big-num">{fmt(proj)}</b>
            {best > proj + 0.05 && <span className="muted small"> / {fmt(best)} optimal</span>}
          </div>
          <button className="btn" onClick={() => { act((l) => {
            const next = structuredClone(l);
            const t = userTeam(next);
            t.lineup = bestLineup(t.roster, next.players, next.week);
            return next;
          }); notify('Lineup optimized'); setSel(null); }}>
            ⚡ Auto-set lineup
          </button>
        </div>
      )}

      {issues.length > 0 && <div className="alert static">⚠️ {issues.join(' · ')}</div>}
      {sel && <div className="hint">Tap a highlighted spot to move this player. Tap again to cancel.</div>}

      <section className="card">
        <h2 className="card-title">Starters</h2>
        <div className="list">
          {SLOTS.map((s) => {
            const id = me.lineup[s.id];
            const p = id ? league.players[id] : null;
            const spot: Spot = { slot: s.id };
            return (
              <div key={s.id} className={`list-row lineup-row ${isSel(spot) ? 'selected' : ''} ${isTarget(spot) ? 'target' : ''}`}>
                <button className="slot-btn" onClick={() => tap(spot)} aria-label={`Move ${s.label}`}>
                  <PosBadge pos={s.id === 'FLEX' ? 'FLEX' : s.allowed[0]} label={s.label} />
                </button>
                {p ? (
                  <>
                    <PlayerName p={p} week={week} onClick={() => setCard(p)} />
                    <span className="num">{fmt(p.bye === week ? 0 : p.proj)}</span>
                  </>
                ) : (
                  <button className="player-name empty-slot" onClick={() => tap(spot)}>Empty — tap to fill</button>
                )}
                <button className="btn small ghost" onClick={() => tap(spot)}>{isSel(spot) ? 'Cancel' : 'Move'}</button>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">Bench ({bench.length})</h2>
        <div className="list">
          {bench.map((id) => {
            const p = league.players[id];
            const spot: Spot = { bench: id };
            return (
              <div key={id} className={`list-row ${isSel(spot) ? 'selected' : ''} ${isTarget(spot) ? 'target' : ''}`}>
                <button className="slot-btn" onClick={() => tap(spot)}><PosBadge pos="BN" label="BN" /></button>
                <PlayerName p={p} week={week} onClick={() => setCard(p)} />
                <span className="num">{fmt(p.proj)}</span>
                <button className="btn small ghost" onClick={() => tap(spot)}>{isSel(spot) ? 'Cancel' : 'Move'}</button>
              </div>
            );
          })}
          {bench.length === 0 && <p className="empty">Nobody on the bench.</p>}
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">Season leaders</h2>
        <div className="list">
          {[...me.roster]
            .map((id) => league.players[id])
            .map((p) => ({ p, pts: seasonPoints(league, p) }))
            .sort((a, b) => b.pts - a.pts)
            .slice(0, 5)
            .map(({ p, pts }) => (
              <div key={p.id} className="list-row">
                <PosBadge pos={p.pos} />
                <PlayerName p={p} onClick={() => setCard(p)} />
                <span className="num">{fmt(pts)}</span>
              </div>
            ))}
        </div>
      </section>

      {card && (
        <PlayerCard player={card} onClose={() => setCard(null)} actions={
          me.roster.includes(card.id) && !done ? (
            <button className="btn danger" onClick={() => {
              if (!confirm(`Drop ${card.name}? He'll become a free agent.`)) return;
              act((l) => dropPlayer(l, me.id, card.id));
              setCard(null);
              notify(`Dropped ${card.name}`);
            }}>Drop player</button>
          ) : undefined
        } />
      )}
    </>
  );
}

function same(a: Spot, b: Spot): boolean {
  if ('slot' in a && 'slot' in b) return a.slot === b.slot;
  if ('bench' in a && 'bench' in b) return a.bench === b.bench;
  return false;
}
