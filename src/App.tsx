import { useEffect, useState } from 'react';
import { CalendarDays, BarChart2, User, Bell } from 'lucide-react';
import { useStore } from './store';
import { AuthScreen } from './components/auth/AuthScreen';
import { TaskList } from './components/tasks/TaskList';
import { Timeline } from './components/timeline/Timeline';
import { ChatPanel } from './components/chat/ChatPanel';
import { StatsPanel } from './components/panels/StatsPanel';
import { ProfilePanel } from './components/panels/ProfilePanel';
import { supabase } from './lib/supabase';
import { requestNotificationPermission, canNotify, scheduleMorningBriefing } from './lib/notifications';
import './styles/globals.css';

const NAV = [
  { id: 'plan',    label: 'Plan',    Icon: CalendarDays },
  { id: 'stats',   label: 'Stats',   Icon: BarChart2 },
  { id: 'profile', label: 'Profile', Icon: User },
] as const;

export default function App() {
  const { config, tasks, userId, userEmail, setUserId, setUserEmail, loadFromSupabase, activePanel, setActivePanel } = useStore();
  const [authChecked, setAuthChecked] = useState(false);

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', config.theme);
  }, [config.theme]);

  // Check existing session
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        setUserId(data.session.user.id);
        setUserEmail(data.session.user.email ?? 'local');
      }
      setAuthChecked(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUserId(session.user.id);
        setUserEmail(session.user.email ?? 'local');
      } else {
        setUserId(null);
        setUserEmail(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load data when user is set
  useEffect(() => {
    if (userId && userId !== 'local-user') {
      loadFromSupabase();
    }
  }, [userId]);
  // Schedule morning briefing when tasks or wake time changes
  useEffect(() => {
    if (canNotify()) {
      const todayCount = tasks.filter((t: { day: string; is_done: boolean }) => t.day === 'today' && !t.is_done).length;
      scheduleMorningBriefing(config.wake, todayCount);
    }
  }, [tasks.length, config.wake]);

  if (!authChecked) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ fontSize: 13, color: 'var(--tx3)' }}>Loading…</div>
      </div>
    );
  }

  if (!userId && !userEmail) {
    return <AuthScreen onAuth={(id, email) => { setUserId(id); setUserEmail(email); }} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>
      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* Plan panel — sidebar + timeline */}
        {activePanel === 'plan' && (
          <div className="shell" style={{ flex: 1 }}>
            <aside className="sidebar">
              <div style={{ padding: '16px 18px 10px', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ind)' }}>UpX</div>
                    <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>
                      {greeting()} 👋
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 1 }}>
                      {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </div>
                  </div>
                  {!canNotify() && 'Notification' in window && (
                    <button className="btn-icon" title="Enable notifications"
                      onClick={() => requestNotificationPermission()}
                      style={{ marginTop: 4, opacity: 0.6 }}>
                      <Bell size={15} />
                    </button>
                  )}
                </div>
              </div>
              <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <TaskList />
              </div>
            </aside>
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
      <nav style={{
        display: 'flex', borderTop: '1px solid var(--bdr2)',
        background: 'var(--sf)', flexShrink: 0,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        {NAV.map(({ id, label, Icon }) => {
          const active = activePanel === id;
          return (
            <button key={id}
              onClick={() => setActivePanel(id)}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 3, padding: '10px 8px 8px', background: 'none', border: 'none',
                cursor: 'pointer', color: active ? 'var(--ind)' : 'var(--tx3)',
                transition: 'color .15s',
              }}>
              <Icon size={20} strokeWidth={active ? 2.2 : 1.7} />
              <span style={{ fontSize: 10, fontWeight: active ? 600 : 400 }}>{label}</span>
            </button>
          );
        })}
      </nav>

      {/* AI chat */}
      <ChatPanel />
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Good night';
}

function PanelHeader({ title }: { title: string }) {
  return (
    <div style={{ padding: '16px 18px 4px', flexShrink: 0, borderBottom: '1px solid var(--bdr)' }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ind)', marginBottom: 2 }}>UpX</div>
      <div style={{ fontSize: 20, fontWeight: 700 }}>{title}</div>
    </div>
  );
}
