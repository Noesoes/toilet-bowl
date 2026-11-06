import { useMemo, useState } from 'react';
import { useLeague } from '../state/store';
import { Player } from '../lib/types';
import { ROSTER_SIZE } from '../lib/lineup';
import { addDropPlayer, ownerOf, rosteredIds, userTeam } from '../lib/league';
import { cachedStatLine } from '../lib/scoring';
import { Modal, PlayerCard, PlayerName, PosBadge, PosFilter, fmt } from './common';

type Sort = 'proj' | 'season' | 'last';

export default function Players() {
  const { league, act, notify } = useLeague();
  const me = userTeam(league);
  const done = league.phase === 'done';
  const [pos, setPos] = useState('ALL');
  const [status, setStatus] = useState<'fa' | 'all'>('fa');
  const [sort, setSort] = useState<Sort>('proj');
  const [q, setQ] = useState('');
  const [card, setCard] = useState<Player | null>(null);
  const [adding, setAdding] = useState<Player | null>(null);
  const lastWeek = league.week - 1;

  const rows = useMemo(() => {
    const taken = rosteredIds(league);
    const needle = q.trim().toLowerCase();
    return Object.values(league.players)
      .filter((p) => status === 'all' || !taken.has(p.id))
      .filter((p) => pos === 'ALL' || p.pos === pos)
      .filter((p) => !needle || p.name.toLowerCase().includes(needle) || p.nflTeam.toLowerCase() === needle)
      .map((p) => {
        let season = 0;
        for (let w = 1; w <= lastWeek; w++) season += cachedStatLine(league.seed, w, p).points;
        const last = lastWeek > 0 ? cachedStatLine(league.seed, lastWeek, p).points : 0;
        return { p, season, last };
      })
      .sort((a, b) => (sort === 'proj' ? b.p.proj - a.p.proj : sort === 'season' ? b.season - a.season : b.last - a.last))
      .slice(0, 120);
  }, [league, pos, status, sort, q, lastWeek]);

  function add(p: Player) {
    if (me.roster.length >= ROSTER_SIZE) return setAdding(p);
    act((l) => addDropPlayer(l, me.id, p.id)) && notify(`Added ${p.name}`);
    setCard(null);
  }

  return (
    <>
      <header className="page-head">
        <div className="eyebrow">Roster {me.roster.length}/{ROSTER_SIZE}</div>
        <h1>Players</h1>
      </header>
      <input className="search" placeholder="Search name or NFL team" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="segmented">
        <button className={status === 'fa' ? 'active' : ''} onClick={() => setStatus('fa')}>Free agents</button>
        <button className={status === 'all' ? 'active' : ''} onClick={() => setStatus('all')}>All players</button>
      </div>
      <PosFilter value={pos} onChange={setPos} options={['ALL', 'QB', 'RB', 'WR', 'TE', 'K', 'DEF']} />
      <div className="sort-row muted small">
        Sort:
        {(['proj', 'season', 'last'] as Sort[]).map((s) => (
          <button key={s} className={`link ${sort === s ? 'active' : ''}`} onClick={() => setSort(s)}>
            {s === 'proj' ? 'Projection' : s === 'season' ? 'Season pts' : 'Last week'}
          </button>
        ))}
      </div>
      <div className="list card">
        <div className="list-row list-header muted small">
          <span>Pos</span><span>Player</span><span className="num">{sort === 'proj' ? 'Proj' : sort === 'season' ? 'Pts' : `Wk ${lastWeek}`}</span><span />
        </div>
        {rows.map(({ p, season, last }) => {
          const owner = ownerOf(league, p.id);
          return (
            <div key={p.id} className="list-row">
              <PosBadge pos={p.pos} />
              <PlayerName p={p} week={league.week} onClick={() => setCard(p)} />
              <span className="num">{fmt(sort === 'proj' ? p.proj : sort === 'season' ? season : last)}</span>
              {owner ? (
                <span className={`owner-tag small ${owner.isUser ? 'me' : ''}`}>{owner.isUser ? 'Mine' : owner.name.split(' ')[0]}</span>
              ) : (
                <button className="btn small primary" disabled={done} onClick={() => add(p)}>+ Add</button>
              )}
            </div>
          );
        })}
        {rows.length === 0 && <p className="empty">No players match.</p>}
      </div>

      {card && (
        <PlayerCard player={card} onClose={() => setCard(null)} actions={
          !ownerOf(league, card.id) && !done ? <button className="btn primary" onClick={() => add(card)}>+ Add {card.name}</button> : undefined
        } />
      )}

      {adding && (
        <Modal title={`Drop someone to add ${adding.name}`} onClose={() => setAdding(null)}>
          <p className="muted small">Your roster is full ({ROSTER_SIZE}). Choose a player to release.</p>
          <div className="list">
            {[...me.roster]
              .map((id) => league.players[id])
              .sort((a, b) => a.proj - b.proj)
              .map((p) => (
                <div key={p.id} className="list-row">
                  <PosBadge pos={p.pos} />
                  <PlayerName p={p} />
                  <span className="num">{fmt(p.proj)}</span>
                  <button className="btn small danger" onClick={() => {
                    if (act((l) => addDropPlayer(l, me.id, adding.id, p.id))) notify(`Added ${adding.name}, dropped ${p.name}`);
                    setAdding(null);
                    setCard(null);
                  }}>Drop</button>
                </div>
              ))}
          </div>
        </Modal>
      )}
    </>
  );
}
