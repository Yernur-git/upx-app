import { useEffect, useState } from 'react';
import { BarChart2, CalendarDays, User } from 'lucide-react';
import { useStore } from './store';
import { AuthScreen } from './components/auth/AuthScreen';
import { SplashScreen } from './components/SplashScreen';
import { TaskList } from './components/tasks/TaskList';
import { Timeline } from './components/timeline/Timeline';
import { ChatPanel } from './components/chat/ChatPanel';
import { StatsPanel } from './components/panels/StatsPanel';
import { ProfilePanel } from './components/panels/ProfilePanel';
import { supabase } from './lib/supabase';
import './styles/globals.css';

const NAV = [
  { id: 'profile', label: 'Profile', Icon: User },
  { id: 'plan',    label: 'Plan',    Icon: CalendarDays },
  { id: 'stats',   label: 'Stats',   Icon: BarChart2 },
] as const;

function greeting() {
  const h = new Date().getHours();
  if (h < 5)  return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Good night';
}

export default function App() {
  const {
    config, userId, userEmail,
    setUserId, setUserEmail, loadFromSupabase,
    activePanel, setActivePanel,
    checkAndRollover, saveDayStats,
  } = useStore();

  const [authChecked, setAuthChecked] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
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
    else checkAndRollover(); // offline mode still needs rollover
  }, [userId]);

  // saveDayStats every 5 minutes so it's not lost on tab close
  useEffect(() => {
    saveDayStats();
    const interval = setInterval(saveDayStats, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

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
      {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}

      {/* Content */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* ── PLAN PANEL ── */}
        {activePanel === 'plan' && (
          <div className={`shell${showTimeline ? ' show-timeline' : ''}`} style={{ flex: 1 }}>

            {/* Sidebar — task list */}
            <aside className="sidebar">
              <div style={{
                padding: '16px 18px 12px', flexShrink: 0,
                borderBottom: '1px solid var(--bdr)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div>
                  {/* Logo — replace with your PNG once uploaded */}
                  <img src="/logo.png" alt="UpX"
                    style={{ height: 28, marginBottom: 4 }}
                    onError={e => {
                      // fallback to text if logo not found
                      (e.target as HTMLImageElement).style.display = 'none';
                      const el = document.getElementById('upx-text-logo');
                      if (el) el.style.display = 'block';
                    }}
                  />
                  <div id="upx-text-logo" style={{ display: 'none', fontSize: 13, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ind)', marginBottom: 2 }}>UpX</div>
                  <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-.2px' }}>{greeting()} 👋</div>
                  <div style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 1 }}>
                    {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </div>
                </div>

                {/* Mobile: schedule toggle */}
                <button
                  id="timeline-toggle"
                  className="btn btn-ghost"
                  style={{ fontSize: 11, padding: '7px 12px', display: 'none', gap: 5 }}
                  onClick={() => setShowTimeline(true)}>
                  <CalendarDays size={13} /> Schedule
                </button>
              </div>

              <TaskList />
            </aside>

            {/* Main — timeline */}
            <main className="main">
              <div id="back-to-tasks" style={{ padding: '12px 18px 0', display: 'none' }}>
                <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setShowTimeline(false)}>
                  ← Tasks
                </button>
              </div>
              <Timeline />
            </main>
          </div>
        )}

        {/* ── STATS PANEL ── */}
        {activePanel === 'stats' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <PanelHeader title="Stats" />
            <StatsPanel />
          </div>
        )}

        {/* ── PROFILE PANEL ── */}
        {activePanel === 'profile' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <PanelHeader title="Profile" />
            <ProfilePanel />
          </div>
        )}
      </div>

      {/* ── BOTTOM NAV ── */}
      <nav className="bottom-nav">
        {NAV.map(({ id, label, Icon }) => {
          const active = activePanel === id;
          return (
            <button
              key={id}
              className={`nav-item${active ? ' active' : ''}`}
              onClick={() => { setActivePanel(id); setShowTimeline(false); }}>
              <div className="nav-pill" />
              <Icon size={22} strokeWidth={active ? 2.2 : 1.8} />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>

      <ChatPanel />

      <style>{`
        @media (max-width: 767px) {
          #timeline-toggle { display: flex !important; }
          #back-to-tasks   { display: block !important; }
        }
      `}</style>
    </div>
  );
}

function PanelHeader({ title }: { title: string }) {
  return (
    <div style={{ padding: '16px 18px 10px', flexShrink: 0, borderBottom: '1px solid var(--bdr)' }}>
      <img src="/logo.png" alt="UpX" style={{ height: 22, marginBottom: 4 }}
        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.3px' }}>{title}</div>
    </div>
  );
}
