import { useEffect, useState } from 'react';
import { CalendarDays, BarChart2, User, Clock } from 'lucide-react';
import { useStore } from './store';
import { AuthScreen } from './components/auth/AuthScreen';
import { TaskList } from './components/tasks/TaskList';
import { Timeline } from './components/timeline/Timeline';
import { ChatPanel } from './components/chat/ChatPanel';
import { StatsPanel } from './components/panels/StatsPanel';
import { ProfilePanel } from './components/panels/ProfilePanel';
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
  const [showTimeline, setShowTimeline] = useState(false); // mobile toggle

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

      {/* Content area */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {activePanel === 'plan' && (
          <div className={`shell${showTimeline ? ' show-timeline' : ''}`} style={{ flex: 1 }}>
            <aside className="sidebar">
              {/* Header */}
              <div style={{ padding: '14px 18px 10px', flexShrink: 0, borderBottom: '1px solid var(--bdr)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ind)' }}>UpX</div>
                    <div style={{ fontSize: 17, fontWeight: 700, marginTop: 1 }}>{greeting()} 👋</div>
                    <div style={{ fontSize: 11, color: 'var(--tx3)' }}>
                      {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </div>
                  </div>
                  {/* Mobile: toggle timeline button */}
                  <button
                    className="btn btn-ghost"
                    style={{ fontSize: 11, padding: '6px 10px', display: 'none' }}
                    id="timeline-toggle"
                    onClick={() => setShowTimeline(true)}>
                    <Clock size={13} /> Schedule
                  </button>
                </div>
              </div>
              <TaskList />
            </aside>

            <main className="main">
              {/* Mobile back button */}
              <div style={{ padding: '10px 16px 0', display: 'none' }} id="back-to-tasks">
                <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setShowTimeline(false)}>
                  ← Tasks
                </button>
              </div>
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
            <button key={id} onClick={() => { setActivePanel(id); setShowTimeline(false); }}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '10px 8px 6px', background: 'none', border: 'none', cursor: 'pointer', color: active ? 'var(--ind)' : 'var(--tx3)', transition: 'color .15s' }}>
              <Icon size={20} strokeWidth={active ? 2.2 : 1.7} />
              <span style={{ fontSize: 10, fontWeight: active ? 600 : 400 }}>{label}</span>
            </button>
          );
        })}
      </nav>

      <ChatPanel />

      {/* Mobile CSS injection for show/hide */}
      <style>{`
        @media (max-width: 767px) {
          #timeline-toggle { display: flex !important; }
          #back-to-tasks { display: block !important; }
        }
      `}</style>
    </div>
  );
}

function PanelHeader({ title }: { title: string }) {
  return (
    <div style={{ padding: '14px 18px 8px', flexShrink: 0, borderBottom: '1px solid var(--bdr)' }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ind)', marginBottom: 2 }}>UpX</div>
      <div style={{ fontSize: 20, fontWeight: 700 }}>{title}</div>
    </div>
  );
}