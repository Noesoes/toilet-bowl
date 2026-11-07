import { useState } from 'react';
import { useLeague } from '../state/store';
import { Lineup, Matchup as M, Player } from '../lib/types';
import { SLOTS, bestLineup, effectiveProj, lineupProjection } from '../lib/lineup';
import { matchupsForWeek, simulateWeek, teamById, teamScore, totalWeeks, userTeam } from '../lib/league';
import { cachedStatLine } from '../lib/scoring';
import { Modal, PlayerCard, PosBadge, TeamLogo, ThemePicker, fmt } from './common';

export function weekLabel(week: number, regular: number): string {
  if (week <= regular) return `Week ${week}`;
  return week === regular + 1 ? `Week ${week} · Playoff Semis` : `Week ${week} · Finals`;
}

export default function Matchup({ goTo }: { goTo: (t: 'team') => void }) {
  const { league, act } = useLeague();
  const me = userTeam(league);
  const done = league.phase === 'done';
  const lastPlayed = league.results.length;
  const [mode, setMode] = useState<'next' | 'last'>(done ? 'last' : 'next');
  const [styling, setStyling] = useState(false);
  const showMode = done ? 'last' : mode;
  const week = showMode === 'next' ? league.week : lastPlayed;

  const matchup = findMatchup(matchupsForWeek(league, week), me.id);
  const issues = done ? [] : lineupIssues(me.lineup, league.players, league.week);

  function play() {
    act(simulateWeek);
    setMode('last');
  }

  return (
    <>
      <header className="page-head head-row">
        <div>
          <div className="eyebrow">{league.name}</div>
          <h1>{done ? 'Season complete' : weekLabel(league.week, league.regularSeasonWeeks)}</h1>
        </div>
        <button className="btn small style-btn" onClick={() => setStyling(true)} aria-label="Change app style">🎨 Style</button>
      </header>
      {styling && (
        <Modal title="App style" onClose={() => setStyling(false)}>
          <ThemePicker />
        </Modal>
      )}

      {done && <SeasonSummary />}

      {!done && (
        <div className="play-bar">
          <button className="btn primary big" onClick={play}>
            ▶ Play {weekLabel(league.week, league.regularSeasonWeeks).split(' · ')[0]}
          </button>
          <span className="muted small">
            {league.week} of {totalWeeks(league)}
          </span>
        </div>
      )}

      {issues.length > 0 && (
        <button className="alert" onClick={() => goTo('team')}>
          ⚠️ {issues[0]}{issues.length > 1 ? ` (+${issues.length - 1} more)` : ''} — tap to fix your lineup
        </button>
      )}

      {lastPlayed > 0 && !done && (
        <div className="segmented">
          <button className={showMode === 'next' ? 'active' : ''} onClick={() => setMode('next')}>
            Week {league.week} preview
          </button>
          <button className={showMode === 'last' ? 'active' : ''} onClick={() => setMode('last')}>
            Week {lastPlayed} result
          </button>
        </div>
      )}

      {week > 0 &&
        (matchup ? (
          <MatchupDetail week={week} matchup={matchup} final={showMode === 'last'} />
        ) : (
          <div className="card empty">
            {week > league.regularSeasonWeeks ? "You're not playing this week — your season is over (in the middle, at least)." : 'No matchup this week.'}
          </div>
        ))}

      {week > 0 && <Scoreboard week={week} final={showMode === 'last'} />}
    </>
  );
}

function findMatchup(ms: M[], teamId: string): M | undefined {
  return ms.find((m) => m.homeId === teamId || m.awayId === teamId);
}

export function lineupIssues(lineup: Lineup, players: Record<string, Player>, week: number): string[] {
  const out: string[] = [];
  for (const s of SLOTS) {
    const id = lineup[s.id];
    if (!id) out.push(`Empty ${s.label} slot`);
    else if (players[id].bye === week) out.push(`${players[id].name} is on bye`);
  }
  return out;
}

export function MatchupDetail({ week, matchup, final }: { week: number; matchup: M; final: boolean }) {
  const { league } = useLeague();
  const [card, setCard] = useState<Player | null>(null);
  const me = userTeam(league);
  // Always show the user's team on the left.
  const [leftId, rightId] = matchup.awayId === me.id ? [matchup.awayId, matchup.homeId] : [matchup.homeId, matchup.awayId];
  const left = teamById(league, leftId);
  const right = teamById(league, rightId);
  const result = league.results.find((r) => r.week === week);

  const lineupFor = (id: string): Lineup => {
    if (final && result) return result.starters[id];
    const t = teamById(league, id);
    return t.isUser ? t.lineup : bestLineup(t.roster, league.players, week);
  };
  const lL = lineupFor(leftId);
  const rL = lineupFor(rightId);
  const score = (l: Lineup) => (final ? teamScore(league, l, week) : lineupProjection(l, league.players, week));
  const ls = score(lL);
  const rs = score(rL);

  const cell = (id: string | null, align: 'l' | 'r') => {
    if (!id) return <div className={`mu-player ${align}`}><span className="muted">Empty</span><span className="num">0.0</span></div>;
    const p = league.players[id];
    const pts = final ? cachedStatLine(league.seed, week, p).points : effectiveProj(p, week);
    const bye = p.bye === week;
    return (
      <button className={`mu-player ${align}`} onClick={() => setCard(p)}>
        <span className="mu-name">
          {p.name}
          {bye && <span className="tag warn">BYE</span>}
        </span>
        <span className={`num ${final ? 'final' : 'proj'}`}>{fmt(pts)}</span>
      </button>
    );
  };

  return (
    <section className="card matchup">
      {matchup.label && <div className={`bracket-label ${matchup.bracket}`}>{matchup.label}</div>}
      <div className="mu-head">
        <div className={`mu-team ${final && ls > rs ? 'win' : ''}`}>
          <TeamLogo team={left} size={44} />
          <div className="mu-team-name">{left.name}</div>
          <div className="mu-owner muted small">{left.owner}</div>
          <div className="mu-score">{fmt(ls)}</div>
        </div>
        <div className="mu-vs muted">{final ? 'FINAL' : 'PROJ'}</div>
        <div className={`mu-team r ${final && rs > ls ? 'win' : ''}`}>
          <TeamLogo team={right} size={44} />
          <div className="mu-team-name">{right.name}</div>
          <div className="mu-owner muted small">{right.owner}</div>
          <div className="mu-score">{fmt(rs)}</div>
        </div>
      </div>
      {!final && <WinBar a={ls} b={rs} />}
      <div className="mu-rows">
        {SLOTS.map((s) => (
          <div key={s.id} className="mu-row">
            {cell(lL[s.id], 'l')}
            <PosBadge pos={s.id === 'FLEX' ? 'FLEX' : s.allowed[0]} label={s.label} />
            {cell(rL[s.id], 'r')}
          </div>
        ))}
      </div>
      {card && <PlayerCard player={card} onClose={() => setCard(null)} />}
    </section>
  );
}

function WinBar({ a, b }: { a: number; b: number }) {
  // Rough win probability from projected margin (team-score SD ≈ 25).
  const z = (a - b) / 25;
  const p = 1 / (1 + Math.exp(-1.7 * z));
  return (
    <div className="winbar" title="Win probability">
      <div style={{ width: `${p * 100}%` }} />
      <span>{Math.round(p * 100)}% win chance</span>
    </div>
  );
}

function Scoreboard({ week, final }: { week: number; final: boolean }) {
  const { league } = useLeague();
  const res = league.results.find((r) => r.week === week);
  const ms = matchupsForWeek(league, week);
  return (
    <section className="card">
      <h2 className="card-title">Scoreboard · Week {week}</h2>
      <div className="scoreboard">
        {ms.map((m, i) => {
          const r = final ? res?.matchups[i] : undefined;
          const h = teamById(league, m.homeId);
          const a = teamById(league, m.awayId);
          const hs = r ? r.homeScore : lineupProjection(h.isUser ? h.lineup : bestLineup(h.roster, league.players, week), league.players, week);
          const as = r ? r.awayScore : lineupProjection(a.isUser ? a.lineup : bestLineup(a.roster, league.players, week), league.players, week);
          return (
            <div key={i} className="sb-game">
              {m.label && <div className={`bracket-label small ${m.bracket}`}>{m.label}</div>}
              <div className={`sb-line ${r && hs > as ? 'win' : ''} ${h.isUser ? 'me' : ''}`}><TeamLogo team={h} size={22} /><span className="sb-name">{h.name}</span><span className="num">{fmt(hs)}</span></div>
              <div className={`sb-line ${r && as > hs ? 'win' : ''} ${a.isUser ? 'me' : ''}`}><TeamLogo team={a} size={22} /><span className="sb-name">{a.name}</span><span className="num">{fmt(as)}</span></div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SeasonSummary() {
  const { league, setLeague } = useLeague();
  const champ = teamById(league, league.champion!);
  const loser = teamById(league, league.toiletBowlLoser!);
  return (
    <section className="card summary">
      <div className="trophy">🏆</div>
      <TeamLogo team={champ} size={56} />
      <h2>{champ.name} win the title!</h2>
      <p className="muted">{champ.isUser ? 'That’s you. Unbelievable.' : `Congrats to ${champ.owner}.`}</p>
      <div className="trophy">🚽</div>
      <TeamLogo team={loser} size={56} />
      <h2>{loser.name} lost the Toilet Bowl</h2>
      <p className="muted">{loser.isUser ? 'That’s you. Enjoy your punishment.' : `${loser.owner} has some explaining to do.`}</p>
      <button className="btn primary" onClick={() => confirm('Start a new league? This season will be erased.') && setLeague(null)}>
        Start a new season
      </button>
    </section>
  );
}
