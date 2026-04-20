import { useEffect, useState } from 'react';
import { CalendarDays, BarChart2, User } from 'lucide-react';
import { useStore } from './store';
import { AuthScreen } from './components/auth/AuthScreen';
import { TaskList } from './components/tasks/TaskList';
import { Timeline } from './components/timeline/Timeline';
import { ChatPanel } from './components/chat/ChatPanel';
import { StatsPanel } from './components/panels/StatsPanel';
import { ProfilePanel } from './components/panels/ProfilePanel';
import { SplashScreen } from './components/SplashScreen';
import { supabase } from './lib/supabase';
import './styles/globals.css';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Good night';
}

export default function App() {
  const { config, userId, userEmail, setUserId, setUserEmail, loadFromSupabase, activePanel, setActivePanel } = useStore();
  const [authChecked, setAuthChecked] = useState(false);

  // FIX: splash screen — once per session
  const [showSplash, setShowSplash] = useState(() => {
    try { return !sessionStorage.getItem('splashShown'); } catch { return true; }
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', config.theme);
  }, [config.theme]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        setUserId(data.session.user.id);
        setUserEmail(data.session.user.email ?? 'local');
      }
      setAuthChecked(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) { setUserId(session.user.id); setUserEmail(session.user.email ?? 'local'); }
      else { setUserId(null); setUserEmail(null); }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (userId && userId !== 'local-user') loadFromSupabase();
  }, [userId]);

  if (!authChecked) return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ fontSize: 13, color: 'var(--tx3)' }}>Loading…</div>
    </div>
  );

  if (!userId && !userEmail) return (
    <AuthScreen onAuth={(id, email) => { setUserId(id); setUserEmail(email); }} />
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>
      {/* FIX: splash screen */}
      {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}

      {/* Content area */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {activePanel === 'plan' && (
          <div className="shell" style={{ flex: 1 }}>
            <aside className="sidebar">
              <div style={{ padding: '14px 18px 10px', flexShrink: 0, borderBottom: '1px solid var(--bdr)' }}>
                <div>
                  <img src="/logo.png" style={{ height: 20 }} alt="UpX" />
                  <div style={{ fontSize: 17, fontWeight: 700, marginTop: 1 }}>{greeting()} 👋</div>
                  <div style={{ fontSize: 11, color: 'var(--tx3)' }}>
                    {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </div>
                </div>
              </div>
              {/* FIX: sidebar padding-bottom ensures Add Task button is above nav */}
              <TaskList />
            </aside>

            {/* FIX: Today's Schedule always visible; on mobile appears below task list */}
            <main className="main">
              <Timeline />
            </main>
          </div>
        )}

        {activePanel === 'stats' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <PanelHeader title="Stats" />
            <StatsPanel />
          </div>
        )}

        {activePanel === 'profile' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <PanelHeader title="Profile" />
            <ProfilePanel />
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <nav className="bottom-nav">
        {([
          { id: 'plan', label: 'Plan', Icon: CalendarDays },
          { id: 'stats', label: 'Stats', Icon: BarChart2 },
          { id: 'profile', label: 'Profile', Icon: User },
        ] as const).map(({ id, label, Icon }) => {
          const active = activePanel === id;
          return (
            <button key={id} onClick={() => setActivePanel(id)}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '10px 8px 6px', background: 'none', border: 'none', cursor: 'pointer', color: active ? 'var(--ind)' : 'var(--tx3)', transition: 'color .15s' }}>
              <Icon size={20} strokeWidth={active ? 2.2 : 1.7} />
              <span style={{ fontSize: 10, fontWeight: active ? 600 : 400 }}>{label}</span>
            </button>
          );
        })}
      </nav>

      <ChatPanel />
    </div>
  );
}

function PanelHeader({ title }: { title: string }) {
  return (
    <div style={{ padding: '14px 18px 8px', flexShrink: 0, borderBottom: '1px solid var(--bdr)' }}>
      <img src="/logo.png" style={{ height: 20 }} alt="UpX" />
      <div style={{ fontSize: 20, fontWeight: 700 }}>{title}</div>
    </div>
  );
}
