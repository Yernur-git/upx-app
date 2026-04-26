import { useEffect, useState } from 'react';
import { BarChart2, CalendarDays, User, Sparkles } from 'lucide-react';
import { useStore } from './store';
import { AuthScreen } from './components/auth/AuthScreen';
import { PasswordResetScreen } from './components/auth/PasswordResetScreen';
import { SplashScreen } from './components/SplashScreen';
import { Onboarding } from './components/Onboarding';
import { TaskList } from './components/tasks/TaskList';
import { Timeline } from './components/timeline/Timeline';
import { ChatPanel } from './components/chat/ChatPanel';
import { StatsPanel } from './components/panels/StatsPanel';
import { ProfilePanel } from './components/panels/ProfilePanel';
import { supabase } from './lib/supabase';
import { buildSchedule } from './lib/scheduler';
import { scheduleTaskNotifications, canNotify } from './lib/notifications';
import './styles/globals.css';
import { t as tr } from './lib/i18n';


function greeting() {
  const h = new Date().getHours();
  if (h < 5)  return tr('greeting.night');
  if (h < 12) return tr('greeting.morning');
  if (h < 17) return tr('greeting.afternoon');
  if (h < 21) return tr('greeting.evening');
  return tr('greeting.night');
}

export default function App() {
  const {
    config, userId, userEmail, tasks,
    setUserId, setUserEmail, loadFromSupabase,
    activePanel, setActivePanel,
    checkAndRollover, saveDayStats,
  } = useStore();

  const [authChecked, setAuthChecked] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        // User clicked reset link — show new password form
        setShowPasswordReset(true);
        setAuthChecked(true);
        return;
      }
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

  // Schedule task notifications whenever tasks/config change
  useEffect(() => {
    if (!canNotify()) return;
    const todayTasks = tasks.filter(t => t.day === 'today');
    const { blocks } = buildSchedule(todayTasks, config);
    const taskBlocks = blocks
      .filter(b => 'task' in b)
      .map(b => ({ task: (b as any).task, start_minutes: b.start_minutes }));
    scheduleTaskNotifications(taskBlocks, 10);
  }, [tasks, config]);

  if (!authChecked) return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ fontSize: 13, color: 'var(--tx3)' }}>Loading…</div>
    </div>
  );

  if (!userId && !userEmail && !showPasswordReset) return (
    <AuthScreen onAuth={(id, email) => { setUserId(id); setUserEmail(email); }} />
  );

  if (showPasswordReset) return (
    <PasswordResetScreen onDone={(id, email) => { setShowPasswordReset(false); setUserId(id); setUserEmail(email); }} />
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>
      {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}
      {showOnboarding && !showSplash && (
        <Onboarding onDone={() => {
          if (userId) localStorage.setItem(`upx_onboarded_${userId}`, 'true');
          setShowOnboarding(false);
        }} />
      )}

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
            <PanelHeader title={tr('nav.stats')} />
            <StatsPanel />
          </div>
        )}

        {/* ── PROFILE PANEL ── */}
        {activePanel === 'profile' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <PanelHeader title={tr('nav.profile')} />
            <ProfilePanel />
          </div>
        )}
      </div>

      {/* ── BOTTOM NAV ── */}
      <nav className="bottom-nav">
        {([
          { id: 'profile', label: tr('nav.profile'), Icon: User },
          { id: 'plan',    label: tr('nav.plan'),    Icon: CalendarDays },
        ] as const).map(({ id, label, Icon }) => {
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

        {/* AI center button */}
        <AIChatButton />

        {([
          { id: 'stats', label: tr('nav.stats'), Icon: BarChart2 },
        ] as const).map(({ id, label, Icon }) => {
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

function AIChatButton() {
  const { chatOpen, setChatOpen } = useStore();
  return (
    <button
      onClick={() => setChatOpen(!chatOpen)}
      style={{
        flex: 1,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 4, border: 'none', cursor: 'pointer',
        background: 'none', padding: '8px 4px',
        WebkitTapHighlightColor: 'transparent',
        position: 'relative',
      }}>
      <div style={{
        width: 44, height: 44, borderRadius: 14,
        background: chatOpen ? 'var(--ind)' : 'var(--ind-l)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all .18s ease',
        boxShadow: chatOpen ? '0 4px 16px rgba(76,94,232,.4)' : 'none',
        transform: chatOpen ? 'scale(1.05)' : 'scale(1)',
      }}>
        <Sparkles size={20} color={chatOpen ? '#fff' : 'var(--ind)'} />
      </div>
      <span style={{ fontSize: 10, fontWeight: chatOpen ? 700 : 500, color: chatOpen ? 'var(--ind)' : 'var(--tx3)' }}>AI</span>
    </button>
  );
}
