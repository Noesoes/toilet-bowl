import { FormEvent, useState } from 'react';
import { useStore } from '../state/store';
import { advanceToUser, createLeague } from '../lib/league';

export default function Setup() {
  const { setLeague } = useStore();
  const [name, setName] = useState('The Toilet Bowl');
  const [teamName, setTeamName] = useState('');
  const [owner, setOwner] = useState('');
  const [numTeams, setNumTeams] = useState(10);
  const [slot, setSlot] = useState(0);

  function submit(e: FormEvent) {
    e.preventDefault();
    const league = createLeague({
      name: name.trim() || 'The Toilet Bowl',
      teamName: teamName.trim() || 'My Team',
      ownerName: owner.trim() || 'You',
      numTeams,
      draftSlot: slot,
    });
    setLeague(advanceToUser(league));
  }

  return (
    <main className="screen setup">
      <div className="hero">
        <div className="hero-logo">🚽🏈</div>
        <h1>Toilet Bowl Fantasy</h1>
        <p className="muted">Draft a team, set your lineup, and stay out of last place.</p>
      </div>
      <form className="card form" onSubmit={submit}>
        <label>
          League name
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
        </label>
        <label>
          Your team name
          <input value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="My Team" maxLength={30} />
        </label>
        <label>
          Your name
          <input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="You" maxLength={20} />
        </label>
        <div className="form-row">
          <label>
            Teams
            <select value={numTeams} onChange={(e) => { setNumTeams(+e.target.value); setSlot(0); }}>
              {[8, 10, 12].map((n) => <option key={n} value={n}>{n} teams</option>)}
            </select>
          </label>
          <label>
            Draft slot
            <select value={slot} onChange={(e) => setSlot(+e.target.value)}>
              <option value={0}>Random</option>
              {Array.from({ length: numTeams }, (_, i) => <option key={i} value={i + 1}>Pick {i + 1}</option>)}
            </select>
          </label>
        </div>
        <ul className="rules muted small">
          <li>Full PPR scoring · 15-round snake draft</li>
          <li>Lineup: QB, 2 RB, 2 WR, TE, FLEX, K, DEF + 6 bench</li>
          <li>14-week season · top 4 make the playoffs</li>
          <li>Bottom 4 play in the Toilet Bowl — losers advance</li>
        </ul>
        <button className="btn primary big" type="submit">Create league & start draft</button>
      </form>
    </main>
  );
}
