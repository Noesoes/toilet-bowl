import { useEffect, useMemo, useState } from 'react';
import { useLeague } from '../state/store';
import { availablePlayers, currentPick } from '../lib/draft';
import { autoDraftRest, cpuPick, makePick, teamById, userTeam } from '../lib/league';
import { Player, Pos } from '../lib/types';
import { PlayerCard, PlayerName, PosBadge, PosFilter, fmt } from './common';

type View = 'players' | 'board' | 'roster';

export default function Draft() {
  const { league, act } = useLeague();
  const [view, setView] = useState<View>('players');
  const [pos, setPos] = useState('ALL');
  const [q, setQ] = useState('');
  const [card, setCard] = useState<Player | null>(null);
  const cur = currentPick(league);
  const me = userTeam(league);
  const myTurn = cur?.teamId === me.id;

  // CPU teams pick on a short timer so the draft feels live.
  const overall = cur?.overall;
  useEffect(() => {
    if (overall === undefined || myTurn) return;
    const t = setTimeout(() => act(cpuPick), 350);
    return () => clearTimeout(t);
  }, [overall, myTurn, act]);

  const available = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return availablePlayers(league)
      .filter((p) => pos === 'ALL' || p.pos === pos)
      .filter((p) => !needle || p.name.toLowerCase().includes(needle))
      .slice(0, 150);
  }, [league, pos, q]);

  const picksUntilMine = useMemo(() => {
    if (!cur) return 0;
    const idx = league.draftOrder.indexOf(me.id, cur.overall - 1);
    return idx < 0 ? 0 : idx - (cur.overall - 1);
  }, [league, cur, me.id]);

  function draft(p: Player) {
    if (!myTurn) return;
    act((l) => makePick(l, p.id));
    setCard(null);
  }

  const n = league.teams.length;
  const recent = [...league.picks].slice(-6).reverse();

  return (
    <main className="screen draft">
      <header className="draft-head">
        <div>
          <div className="eyebrow">{league.name} · Draft</div>
          <h1>{cur ? `Round ${cur.round} · Pick ${((cur.overall - 1) % n) + 1}` : 'Draft complete'}</h1>
        </div>
        <button className="btn ghost small" onClick={() => act(autoDraftRest)}>Auto-draft rest</button>
      </header>

      <div className={`clock ${myTurn ? 'mine' : ''}`}>
        {myTurn ? (
          <>
            <b>You're on the clock!</b>
            <button className="btn small" onClick={() => draft(availablePlayers(league)[0])}>Auto-pick</button>
          </>
        ) : (
          <span>
            <b>{cur && teamById(league, cur.teamId).name}</b> is picking… you're up in {picksUntilMine}
          </span>
        )}
      </div>

      {recent.length > 0 && (
        <div className="ticker">
          {recent.map((pk) => {
            const p = league.players[pk.playerId];
            return (
              <div key={pk.overall} className="ticker-item">
                <span className="muted small">{pk.round}.{((pk.overall - 1) % n) + 1}</span>
                <PosBadge pos={p.pos} />
                <span className="small">{p.name}</span>
                <span className="muted small">{teamById(league, pk.teamId).name}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="segmented">
        {(['players', 'board', 'roster'] as View[]).map((v) => (
          <button key={v} className={view === v ? 'active' : ''} onClick={() => setView(v)}>
            {v === 'players' ? 'Available' : v === 'board' ? 'Board' : `My Roster (${me.roster.length})`}
          </button>
        ))}
      </div>

      {view === 'players' && (
        <>
          <input className="search" placeholder="Search players" value={q} onChange={(e) => setQ(e.target.value)} />
          <PosFilter value={pos} onChange={setPos} options={['ALL', 'QB', 'RB', 'WR', 'TE', 'K', 'DEF']} />
          <div className="list">
            {available.map((p) => (
              <div key={p.id} className="list-row">
                <span className="rank muted">{p.adp}</span>
                <PosBadge pos={p.pos} />
                <PlayerName p={p} onClick={() => setCard(p)} />
                <span className="num">{fmt(p.proj)}</span>
                <button className="btn small primary" disabled={!myTurn} onClick={() => draft(p)}>Draft</button>
              </div>
            ))}
          </div>
        </>
      )}

      {view === 'board' && (
        <div className="board-wrap">
          <div className="board" style={{ gridTemplateColumns: `repeat(${n}, minmax(88px, 1fr))` }}>
            {league.teams.map((t) => (
              <div key={t.id} className={`board-head ${t.isUser ? 'me' : ''}`}>{t.name}</div>
            ))}
            {Array.from({ length: league.rounds }, (_, r) =>
              league.teams.map((t, col) => {
                const order = r % 2 === 0 ? col : n - 1 - col;
                const pk = league.picks[r * n + order];
                const p = pk && league.players[pk.playerId];
                return (
                  <div key={`${r}-${t.id}`} className={`board-cell ${p ? `bg-${p.pos}` : ''}`}>
                    {p ? (<><b>{p.name.split(' ').slice(-1)[0]}</b><span>{p.pos}</span></>) : <span className="muted">{r + 1}.{order + 1}</span>}
                  </div>
                );
              }),
            )}
          </div>
        </div>
      )}

      {view === 'roster' && <RosterByPos ids={me.roster} players={league.players} />}

      {card && (
        <PlayerCard player={card} onClose={() => setCard(null)} actions={
          <button className="btn primary" disabled={!myTurn} onClick={() => draft(card)}>
            {myTurn ? `Draft ${card.name}` : 'Not your pick'}
          </button>
        } />
      )}
    </main>
  );
}

function RosterByPos({ ids, players }: { ids: string[]; players: Record<string, Player> }) {
  const groups: Pos[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
  if (!ids.length) return <p className="empty">No picks yet.</p>;
  return (
    <div className="list">
      {groups.flatMap((g) =>
        ids.filter((id) => players[id].pos === g).map((id) => {
          const p = players[id];
          return (
            <div key={id} className="list-row">
              <PosBadge pos={p.pos} />
              <PlayerName p={p} />
              <span className="num">{fmt(p.proj)}</span>
            </div>
          );
        }),
      )}
    </div>
  );
}
