import { useState } from 'react';
import { useStore } from './state/store';
import Setup from './views/Setup';
import Draft from './views/Draft';
import Matchup from './views/Matchup';
import MyTeam from './views/MyTeam';
import Players from './views/Players';
import LeagueView from './views/LeagueView';

type Tab = 'matchup' | 'team' | 'players' | 'league';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'matchup', label: 'Matchup', icon: '🏈' },
  { id: 'team', label: 'My Team', icon: '📋' },
  { id: 'players', label: 'Players', icon: '🔍' },
  { id: 'league', label: 'League', icon: '🏆' },
];

export default function App() {
  const { league, toast } = useStore();
  const [tab, setTab] = useState<Tab>('matchup');

  let body;
  if (!league) body = <Setup />;
  else if (league.phase === 'draft') body = <Draft />;
  else
    body = (
      <>
        <main className="screen">
          {tab === 'matchup' && <Matchup goTo={setTab} />}
          {tab === 'team' && <MyTeam />}
          {tab === 'players' && <Players />}
          {tab === 'league' && <LeagueView />}
        </main>
        <nav className="tabbar">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
              <span className="tab-icon">{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
      </>
    );

  return (
    <div className="app">
      {body}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
