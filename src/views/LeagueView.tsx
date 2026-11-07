import { useMemo, useState } from 'react';
import { useLeague } from '../state/store';
import { Matchup as M } from '../lib/types';
import { evaluateTrade, executeTrade, matchupsForWeek, standings, teamById, totalWeeks, userTeam } from '../lib/league';
import { SCORING } from '../lib/scoring';
import { Modal, PosBadge, TeamLogo, ThemePicker, fmt } from './common';
import { MatchupDetail, weekLabel } from './Matchup';

type View = 'standings' | 'schedule' | 'trade' | 'activity' | 'settings';

export default function LeagueView() {
  const { league } = useLeague();
  const [view, setView] = useState<View>('standings');
  return (
    <>
      <header className="page-head">
        <div className="eyebrow">{league.teams.length} teams · Full PPR</div>
        <h1>{league.name}</h1>
      </header>
      <div className="segmented scroll">
        {(['standings', 'schedule', 'trade', 'activity', 'settings'] as View[]).map((v) => (
          <button key={v} className={view === v ? 'active' : ''} onClick={() => setView(v)}>
            {v[0].toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>
      {view === 'standings' && <Standings />}
      {view === 'schedule' && <Schedule />}
      {view === 'trade' && <Trade />}
      {view === 'activity' && <Activity />}
      {view === 'settings' && <Settings />}
    </>
  );
}

function Standings() {
  const { league } = useLeague();
  const rows = standings(league);
  const n = rows.length;
  return (
    <section className="card">
      <table className="table">
        <thead>
          <tr><th>#</th><th>Team</th><th className="num">W-L</th><th className="num">PF</th><th className="num hide-sm">PA</th><th className="num hide-sm">Strk</th></tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const t = teamById(league, r.teamId);
            const zone = i < 4 ? 'zone-playoff' : i >= n - 4 ? 'zone-toilet' : '';
            return (
              <tr key={r.teamId} className={`${zone} ${t.isUser ? 'me' : ''} ${i === 3 || i === n - 5 ? 'cutline' : ''}`}>
                <td className="rank-cell">{i + 1}</td>
                <td>
                  <div className="team-cell">
                    <TeamLogo team={t} size={34} />
                    <div>
                      <div className="team-name">
                        {t.name}
                        {league.champion === t.id && ' 🏆'}
                        {league.toiletBowlLoser === t.id && ' 🚽'}
                      </div>
                      <div className="muted small">{t.owner}</div>
                    </div>
                  </div>
                </td>
                <td className="num">{r.w}-{r.l}{r.t ? `-${r.t}` : ''}</td>
                <td className="num">{fmt(r.pf)}</td>
                <td className="num hide-sm">{fmt(r.pa)}</td>
                <td className="num hide-sm">{r.streak}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="legend small">
        <span><i className="dot playoff" /> Playoffs</span>
        <span><i className="dot toilet" /> Toilet Bowl (losers advance)</span>
      </div>
    </section>
  );
}

function Schedule() {
  const { league } = useLeague();
  const maxWeek = league.schedule.length;
  const [week, setWeek] = useState(Math.min(Math.max(1, league.results.length || 1), maxWeek));
  const [open, setOpen] = useState<M | null>(null);
  const res = league.results.find((r) => r.week === week);
  const ms = matchupsForWeek(league, week);
  return (
    <>
      <div className="week-picker">
        <button className="btn small" disabled={week <= 1} onClick={() => setWeek(week - 1)}>‹</button>
        <b>{weekLabel(week, league.regularSeasonWeeks)}</b>
        <button className="btn small" disabled={week >= maxWeek} onClick={() => setWeek(week + 1)}>›</button>
      </div>
      <section className="card">
        <div className="scoreboard">
          {ms.map((m, i) => {
            const r = res?.matchups[i];
            const h = teamById(league, m.homeId);
            const a = teamById(league, m.awayId);
            return (
              <button key={i} className="sb-game clickable" onClick={() => setOpen(m)}>
                {m.label && <div className={`bracket-label small ${m.bracket}`}>{m.label}</div>}
                <div className={`sb-line ${r && r.homeScore > r.awayScore ? 'win' : ''} ${h.isUser ? 'me' : ''}`}><TeamLogo team={h} size={22} /><span className="sb-name">{h.name}</span><span className="num">{r ? fmt(r.homeScore) : '–'}</span></div>
                <div className={`sb-line ${r && r.awayScore > r.homeScore ? 'win' : ''} ${a.isUser ? 'me' : ''}`}><TeamLogo team={a} size={22} /><span className="sb-name">{a.name}</span><span className="num">{r ? fmt(r.awayScore) : '–'}</span></div>
              </button>
            );
          })}
        </div>
        {week < totalWeeks(league) && week >= league.schedule.length && <p className="muted small">Playoff matchups are set after the regular season.</p>}
      </section>
      {open && (
        <Modal title={weekLabel(week, league.regularSeasonWeeks)} onClose={() => setOpen(null)}>
          <MatchupDetail week={week} matchup={open} final={!!res} />
        </Modal>
      )}
    </>
  );
}

function Trade() {
  const { league, act, notify } = useLeague();
  const me = userTeam(league);
  const others = league.teams.filter((t) => !t.isUser);
  const [partnerId, setPartnerId] = useState(others[0].id);
  const [give, setGive] = useState<string[]>([]);
  const [get, setGet] = useState<string[]>([]);
  const partner = teamById(league, partnerId);
  const done = league.phase === 'done';
  const ev = useMemo(() => evaluateTrade(league, partnerId, give, get), [league, partnerId, give, get]);

  const toggle = (list: string[], set: (v: string[]) => void, id: string) =>
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const side = (ids: string[], picked: string[], set: (v: string[]) => void) => (
    <div className="list">
      {[...ids].sort((a, b) => league.players[b].proj - league.players[a].proj).map((id) => {
        const p = league.players[id];
        return (
          <label key={id} className={`list-row check-row ${picked.includes(id) ? 'selected' : ''}`}>
            <input type="checkbox" checked={picked.includes(id)} onChange={() => toggle(picked, set, id)} />
            <PosBadge pos={p.pos} />
            <span className="player-name"><span className="name">{p.name}</span></span>
            <span className="num">{fmt(p.proj)}</span>
          </label>
        );
      })}
    </div>
  );

  if (done) return <p className="card empty">The trade deadline has passed. See you next season.</p>;

  const pct = ev.get > 0 ? Math.min(100, (ev.give / (ev.get * 1.08)) * 100) : 0;

  return (
    <>
      <section className="card">
        <label className="field">
          Trade with
          <select value={partnerId} onChange={(e) => { setPartnerId(e.target.value); setGet([]); }}>
            {others.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.owner})</option>)}
          </select>
        </label>
        <div className="trade-meter">
          <div className={`trade-fill ${ev.accept ? 'ok' : ''}`} style={{ width: `${pct}%` }} />
        </div>
        <p className={`small ${ev.accept ? 'good' : 'muted'}`}>{ev.reason}</p>
        <button className="btn primary" disabled={!ev.accept} onClick={() => {
          act((l) => executeTrade(l, partnerId, give, get));
          notify('Trade complete!');
          setGive([]); setGet([]);
        }}>Propose trade</button>
      </section>
      <div className="two-col">
        <section className="card"><h2 className="card-title">You send</h2>{side(me.roster, give, setGive)}</section>
        <section className="card"><h2 className="card-title">{partner.name} sends</h2>{side(partner.roster, get, setGet)}</section>
      </div>
    </>
  );
}

function Activity() {
  const { league } = useLeague();
  if (!league.transactions.length) return <p className="card empty">No transactions yet.</p>;
  return (
    <section className="card">
      <div className="list">
        {league.transactions.slice(0, 80).map((t, i) => (
          <div key={i} className="list-row activity">
            <span className={`tx tx-${t.kind}`}>{t.kind.toUpperCase()}</span>
            <div>
              <div className="small"><b>{teamById(league, t.teamId).name}</b> — {t.text}</div>
              <div className="muted small">Week {t.week}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Settings() {
  const { setLeague } = useLeague();
  const rules: [string, string][] = [
    ['Passing yard', `${SCORING.passYd} (1 per 25)`], ['Passing TD', `${SCORING.passTd}`], ['Interception', `${SCORING.int}`],
    ['Rushing / receiving yard', `${SCORING.rushYd} (1 per 10)`], ['Reception', `${SCORING.rec}`], ['Rush / rec TD', `${SCORING.rushTd}`],
    ['Fumble lost', `${SCORING.fum}`], ['Field goal', `${SCORING.fg}`], ['Extra point', `${SCORING.xp}`],
    ['DEF sack / takeaway / TD', `${SCORING.sack} / ${SCORING.takeaway} / ${SCORING.defTd}`],
  ];
  return (
    <>
      <section className="card">
        <h2 className="card-title">App style</h2>
        <ThemePicker />
      </section>
      <section className="card">
        <h2 className="card-title">Scoring</h2>
        <table className="table compact"><tbody>
          {rules.map(([k, v]) => <tr key={k}><td>{k}</td><td className="num">{v}</td></tr>)}
        </tbody></table>
        <p className="muted small">Players and stats are simulated. A live NFL data feed can be plugged in later.</p>
      </section>
      <section className="card">
        <h2 className="card-title">Danger zone</h2>
        <button className="btn danger" onClick={() => confirm('Delete this league and start over?') && setLeague(null)}>
          Reset league
        </button>
      </section>
    </>
  );
}
