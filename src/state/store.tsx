import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { League } from '../lib/types';
import { ThemeId, applyTheme, loadTheme } from '../theme';

const KEY = 'toilet-bowl:league:v1';

interface Store {
  league: League | null;
  setLeague: (l: League | null) => void;
  /** Apply a pure transform; errors are surfaced as a toast. */
  act: (fn: (l: League) => League) => boolean;
  toast: string | null;
  notify: (msg: string) => void;
  theme: ThemeId;
  setTheme: (t: ThemeId) => void;
}

const Ctx = createContext<Store | null>(null);

function load(): League | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as League) : null;
  } catch {
    return null;
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [league, setLeagueState] = useState<League | null>(load);
  const [toast, setToast] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeId>(loadTheme);

  useEffect(() => applyTheme(theme), [theme]);

  useEffect(() => {
    try {
      if (league) localStorage.setItem(KEY, JSON.stringify(league));
      else localStorage.removeItem(KEY);
    } catch {
      /* storage unavailable — app still works for this session */
    }
  }, [league]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const act = useCallback(
    (fn: (l: League) => League) => {
      if (!league) return false;
      try {
        setLeagueState(fn(league));
        return true;
      } catch (e) {
        setToast(e instanceof Error ? e.message : String(e));
        return false;
      }
    },
    [league],
  );

  return (
    <Ctx.Provider value={{ league, setLeague: setLeagueState, act, toast, notify: setToast, theme, setTheme }}>{children}</Ctx.Provider>
  );
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside provider');
  return s;
}

/** Use inside screens that only render once a league exists. */
export function useLeague(): Store & { league: League } {
  const s = useStore();
  if (!s.league) throw new Error('No league');
  return s as Store & { league: League };
}
