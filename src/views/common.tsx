import { ReactNode, useEffect } from 'react';
import { Player, Pos } from '../lib/types';
import { useLeague } from '../state/store';
import { cachedStatLine, formatStatLine } from '../lib/scoring';
import { ownerOf, totalWeeks } from '../lib/league';

export function PosBadge({ pos, label }: { pos: Pos | 'FLEX' | 'BN'; label?: string }) {
  return <span className={`pos pos-${pos}`}>{label ?? pos}</span>;
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function PlayerName({ p, week, onClick }: { p: Player; week?: number; onClick?: () => void }) {
  const onBye = week !== undefined && p.bye === week;
  return (
    <button className="player-name" onClick={onClick}>
      <span className="name">{p.name}</span>
      <span className="meta">
        {p.pos === 'DEF' ? 'Defense' : p.nflTeam} · Bye {p.bye}
        {onBye && <span className="tag warn">BYE</span>}
      </span>
    </button>
  );
}

export function PlayerCard({ player, onClose, actions }: { player: Player; onClose: () => void; actions?: ReactNode }) {
  const { league } = useLeague();
  const owner = ownerOf(league, player.id);
  const played = Math.min(league.week - 1, totalWeeks(league));
  const log = Array.from({ length: played }, (_, i) => ({ week: i + 1, s: cachedStatLine(league.seed, i + 1, player) }));
  const games = log.filter((g) => !g.s.bye);
  const total = games.reduce((n, g) => n + g.s.points, 0);
  return (
    <Modal title={player.name} onClose={onClose}>
      <div className="card-head">
        <PosBadge pos={player.pos} />
        <span>{player.nflTeam} · Bye week {player.bye}</span>
      </div>
      <div className="stat-tiles">
        <div><b>{player.proj.toFixed(1)}</b><span>Proj / gm</span></div>
        <div><b>{games.length ? (total / games.length).toFixed(1) : '–'}</b><span>Avg</span></div>
        <div><b>{total.toFixed(1)}</b><span>Total</span></div>
        <div><b>#{player.adp}</b><span>ADP</span></div>
      </div>
      <p className="muted">{owner ? `Rostered by ${owner.name}` : 'Free agent'}</p>
      {actions && <div className="row-actions">{actions}</div>}
      {log.length > 0 && (
        <table className="table compact">
          <thead><tr><th>Wk</th><th>Stats</th><th className="num">Pts</th></tr></thead>
          <tbody>
            {[...log].reverse().map((g) => (
              <tr key={g.week}>
                <td>{g.week}</td>
                <td className="muted small">{formatStatLine(g.s)}</td>
                <td className="num"><b>{g.s.bye ? '–' : g.s.points.toFixed(1)}</b></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  );
}

export function PosFilter({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div className="chips">
      {options.map((o) => (
        <button key={o} className={`chip ${value === o ? 'active' : ''}`} onClick={() => onChange(o)}>{o}</button>
      ))}
    </div>
  );
}

export const fmt = (n: number) => n.toFixed(1);
