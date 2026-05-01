import React, { useEffect, useState, useCallback } from 'react';
import { BarChart2, CalendarDays, User, Sparkles, X, Plus, Sunrise, Moon } from 'lucide-react';
import { useStore } from './store';
import { AuthScreen } from './components/auth/AuthScreen';
import { PasswordResetScreen } from './components/auth/PasswordResetScreen';
import { SplashScreen } from './components/SplashScreen';
import { Onboarding } from './components/Onboarding';
import { MorningCheckin } from './components/MorningCheckin';
import { TaskList, QuickActionSheet } from './components/tasks/TaskList';
import { Timeline } from './components/timeline/Timeline';
import { ChatPanel } from './components/chat/ChatPanel';
import { StatsPanel } from './components/panels/StatsPanel';
import { ProfilePanel } from './components/panels/ProfilePanel';
import { supabase } from './lib/supabase';
import { buildSchedule } from './lib/scheduler';
import { scheduleTaskNotifications, canNotify } from './lib/notifications';
import { sendChatMessage } from './lib/ai';
import { initAnalytics, identifyUser, track } from './lib/analytics';
import './styles/globals.css';
import { t as tr } from './lib/i18n';

// Run once at module load — safe even if VITE_POSTHOG_KEY is not set
initAnalytics();


function greeting() {
  const h = new Date().getHours();
  if (h < 5)  return tr('greeting.night');
  if (h < 12) return tr('greeting.morning');
  if (h < 17) return tr('greeting.afternoon');
  if (h < 21) return tr('greeting.evening');
  return tr('greeting.night');
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export default function App() {
  const {
    config, userId, userEmail, tasks,
    setUserId, setUserEmail, loadFromSupabase,
    activePanel, setActivePanel,
    activeChatDay,
    checkAndRollover, saveDayStats,
    chatMessages, addChatMessage, applyActions,
    apiKey, customBaseURL, customModel, useDefaultKey,
    setChatOpen,
    lastMorningBriefDate, setLastMorningBriefDate,
    lastEveningPromptDate, setLastEveningPromptDate,
    isLoading, lastCheckinDate, todayCheckin,
  } = useStore();

  const [authChecked, setAuthChecked] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [showMorningBanner, setShowMorningBanner] = useState(false);
  const [showEveningBanner, setShowEveningBanner] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showCheckin, setShowCheckin] = useState(false);
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

  // Show morning check-in once per day after data loads
  useEffect(() => {
    if (authChecked && userId && !isLoading && lastCheckinDate !== todayStr()) {
      setShowCheckin(true);
    }
  }, [authChecked, userId, isLoading]);

  // saveDayStats every 5 minutes so it's not lost on tab close
  useEffect(() => {
    saveDayStats();
    const interval = setInterval(saveDayStats, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Periodic rollover check — catches the date change for users who keep the tab open across midnight
  useEffect(() => {
    const interval = setInterval(checkAndRollover, 5 * 60 * 1000);
    const onVisible = () => { if (document.visibilityState === 'visible') checkAndRollover(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', checkAndRollover);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', checkAndRollover);
    };
  }, []);

  // Analytics: identify user on sign-in
  useEffect(() => {
    if (userId && userId !== 'local-user') {
      identifyUser(userId, userEmail ?? undefined);
      track('app_opened');
    }
  }, [userId]);

  // Show onboarding for first-time users (after splash + auth confirmed)
  useEffect(() => {
    if (!userId || !authChecked || showSplash) return;
    const key = `upx_onboarded_${userId}`;
    if (!localStorage.getItem(key)) {
      setShowOnboarding(true);
    }
  }, [userId, authChecked, showSplash]);

  // Helper: fire an AI message without the user typing
  const sendAutoMessage = useCallback(async (text: string) => {
    addChatMessage({ role: 'user', content: text });
    try {
      const result = await sendChatMessage(
        text, chatMessages, tasks, config,
        apiKey, 'today', customBaseURL, customModel, useDefaultKey, [],
        todayCheckin ?? undefined,
      );
      const applied = result.actions.length > 0 ? await applyActions(result.actions) : 0;
      addChatMessage({ role: 'assistant', content: result.message, actions: applied > 0 ? result.actions.slice(0, applied) : [] });
    } catch (err) {
      addChatMessage({ role: 'assistant', content: tr('chat.error', { err: err instanceof Error ? err.message : 'Error' }), actions: [] });
    }
  }, [tasks, config, apiKey, customBaseURL, customModel, useDefaultKey, chatMessages, addChatMessage, applyActions, todayCheckin]);

  // Morning briefing banner: show once per day between 06:00–11:00 if there are tasks
  useEffect(() => {
    const h = new Date().getHours();
    const today = todayStr();
    const hasTasks = tasks.filter(t => t.day === 'today').length > 0;
    if (h >= 6 && h < 11 && hasTasks && lastMorningBriefDate !== today && authChecked && !showSplash) {
      setShowMorningBanner(true);
    }
  }, [authChecked, showSplash, tasks, lastMorningBriefDate]);

  // Evening summary banner: show once per day after 19:00 if there are tasks
  useEffect(() => {
    const h = new Date().getHours();
    const today = todayStr();
    const hasTasks = tasks.filter(t => t.day === 'today').length > 0;
    if (h >= 19 && hasTasks && lastEveningPromptDate !== today && authChecked && !showSplash) {
      setShowEveningBanner(true);
    }
  }, [authChecked, showSplash, tasks, lastEveningPromptDate]);

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
    <div style={{ display: 'flex', height: '100dvh', overflow: 'hidden' }}>
      {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}
      {showOnboarding && !showSplash && (
        <Onboarding onDone={() => {
          if (userId) localStorage.setItem(`upx_onboarded_${userId}`, 'true');
          setShowOnboarding(false);
        }} />
      )}

      {showCheckin && !showOnboarding && !showSplash && (
        <MorningCheckin onDone={() => setShowCheckin(false)} />
      )}

      {/* ── DESKTOP SIDEBAR NAV (≥900px) ── */}
      <DesktopNav
        activePanel={activePanel}
        onNav={(id) => { setActivePanel(id); setShowTimeline(false); }}
      />

      {/* ── MAIN COLUMN ── */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

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
                  <img src="/logo.png" alt="UpX"
                    className="sidebar-logo"
                    style={{ height: 28, marginBottom: 4 }}
                    onError={e => {
                      (e.target as HTMLImageElement).style.display = 'none';
                      const el = document.getElementById('upx-text-logo');
                      if (el) el.style.display = 'block';
                    }}
                  />
                  <div id="upx-text-logo" style={{ display: 'none', fontSize: 13, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ind)', marginBottom: 2 }}>UpX</div>
                  <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-.2px' }}>{greeting()}</div>
                  <div style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 1 }}>
                    {new Date().toLocaleDateString(config.language === 'ru' ? 'ru-RU' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </div>
                </div>

                {/* Mobile: schedule toggle */}
                <button
                  id="timeline-toggle"
                  className="btn btn-ghost"
                  style={{ fontSize: 11, padding: '7px 12px', display: 'none', gap: 5 }}
                  onClick={() => setShowTimeline(true)}>
                  <CalendarDays size={13} /> {tr('nav.schedule')}
                </button>
              </div>

              {/* Morning & evening banners */}
              {showMorningBanner && (
                <div style={{
                  margin: '0 18px 10px', padding: '10px 14px',
                  background: 'linear-gradient(135deg, var(--ind-l) 0%, var(--sf2) 100%)',
                  border: '1px solid var(--ind-m)', borderRadius: 12,
                  display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
                }}>
                  <Sunrise size={18} color="var(--ind)" strokeWidth={1.8} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ind)' }}>
                      {config.language === 'ru' ? 'Утренний брифинг готов' : 'Morning briefing ready'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 1 }}>
                      {config.language === 'ru' ? 'AI расскажет как лучше провести день' : 'AI will walk you through your day'}
                    </div>
                  </div>
                  <button className="btn btn-primary" style={{ fontSize: 11, padding: '6px 12px', flexShrink: 0 }}
                    onClick={() => {
                      setShowMorningBanner(false);
                      setLastMorningBriefDate(todayStr());
                      setChatOpen(true);
                      track('morning_brief_opened');
                      const msg = config.language === 'ru'
                        ? 'Дай мне краткий утренний план на сегодня. Посмотри на задачи и скажи с чего начать и как распределить день.'
                        : "Give me a quick morning plan for today. Look at my tasks and tell me where to start and how to structure my day.";
                      setTimeout(() => sendAutoMessage(msg), 400);
                    }}>
                    {config.language === 'ru' ? 'Открыть' : 'Open'}
                  </button>
                  <button className="btn-icon" style={{ padding: 4, flexShrink: 0 }}
                    onClick={() => { setShowMorningBanner(false); setLastMorningBriefDate(todayStr()); }}>
                    <X size={14} />
                  </button>
                </div>
              )}
              {showEveningBanner && (
                <div style={{
                  margin: '0 18px 10px', padding: '10px 14px',
                  background: 'linear-gradient(135deg, rgba(240,180,41,.12) 0%, var(--sf2) 100%)',
                  border: '1px solid var(--must)', borderRadius: 12,
                  display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
                }}>
                  <Moon size={18} color="var(--must)" strokeWidth={1.8} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx)' }}>
                      {config.language === 'ru' ? 'День заканчивается' : 'Day wrapping up'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 1 }}>
                      {config.language === 'ru' ? 'AI оценит твой день и подскажет на завтра' : 'Get AI feedback on your day'}
                    </div>
                  </div>
                  <button className="btn btn-ghost" style={{ fontSize: 11, padding: '6px 12px', flexShrink: 0 }}
                    onClick={() => {
                      setShowEveningBanner(false);
                      setLastEveningPromptDate(todayStr());
                      setChatOpen(true);
                      track('evening_summary_opened');
                      const msg = config.language === 'ru'
                        ? 'Подведи итог моего дня. Что сделал, что нет, что стоит перенести на завтра и какой совет дашь?'
                        : "Summarize my day. What did I accomplish, what did I miss, what should move to tomorrow, and what's your advice?";
                      setTimeout(() => sendAutoMessage(msg), 400);
                    }}>
                    {config.language === 'ru' ? 'Подвести итог' : 'Review day'}
                  </button>
                  <button className="btn-icon" style={{ padding: 4, flexShrink: 0 }}
                    onClick={() => { setShowEveningBanner(false); setLastEveningPromptDate(todayStr()); }}>
                    <X size={14} />
                  </button>
                </div>
              )}

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

        {/* ── BOTTOM NAV (mobile only, hidden on desktop via CSS) ── */}
        <nav className="bottom-nav">
          {([
            { id: 'plan',  label: tr('nav.plan'),  Icon: CalendarDays },
            { id: 'stats', label: tr('nav.stats'), Icon: BarChart2 },
          ] as const).map(({ id, label, Icon }) => {
            const active = activePanel === id;
            return (
              <button key={id} className={`nav-item${active ? ' active' : ''}`}
                onClick={() => { setActivePanel(id); setShowTimeline(false); }}>
                <div className="nav-pill" />
                <Icon size={22} strokeWidth={active ? 2.2 : 1.8} />
                <span>{label}</span>
              </button>
            );
          })}

          {/* ── CENTER + BUTTON ── */}
          <button
            onClick={() => setShowQuickAdd(true)}
            style={{
              flex: 1,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 4, border: 'none', cursor: 'pointer',
              background: 'none', padding: '8px 4px',
              WebkitTapHighlightColor: 'transparent',
            }}>
            <div style={{
              width: 46, height: 46, borderRadius: 16,
              background: 'var(--ind)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(76,94,232,.35)',
              transition: 'transform .15s ease',
            }}>
              <Plus size={22} color="#fff" strokeWidth={2.5} />
            </div>
          </button>

          <AIChatButton />

          <button className={`nav-item${activePanel === 'profile' ? ' active' : ''}`}
            onClick={() => { setActivePanel('profile'); setShowTimeline(false); }}>
            <div className="nav-pill" />
            <User size={22} strokeWidth={activePanel === 'profile' ? 2.2 : 1.8} />
            <span>{tr('nav.profile')}</span>
          </button>
        </nav>
      </div>

      {/* Quick add sheet — global so it works from any panel */}
      <QuickActionSheet
        open={showQuickAdd}
        onClose={() => setShowQuickAdd(false)}
        day={activeChatDay}
      />

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

function DesktopNav({ activePanel, onNav }: {
  activePanel: string;
  onNav: (id: 'plan' | 'stats' | 'profile') => void;
}) {
  const { chatOpen, setChatOpen } = useStore();

  const navBtn = (id: 'plan' | 'stats' | 'profile', Icon: React.ElementType, label: string) => {
    const active = activePanel === id;
    return (
      <button key={id} onClick={() => onNav(id)} title={label}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 3, padding: '10px 6px', borderRadius: 12, border: 'none', cursor: 'pointer',
          fontFamily: 'inherit', fontSize: 9, fontWeight: active ? 700 : 500,
          background: active ? 'var(--ind-l)' : 'transparent',
          color: active ? 'var(--ind)' : 'var(--tx3)',
          transition: 'all var(--tr)', width: '100%',
        }}>
        <Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
        <span>{label}</span>
      </button>
    );
  };

  return (
    <nav className="desktop-nav">
      {/* Logo */}
      <div style={{ padding: '14px 0 10px', display: 'flex', justifyContent: 'center' }}>
        <img src="/logo.png" alt="UpX" style={{ width: 28, height: 28, objectFit: 'contain' }}
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      </div>

      {/* Primary nav — top */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 8px' }}>
        {navBtn('plan',  CalendarDays, tr('nav.plan'))}
        {navBtn('stats', BarChart2,    tr('nav.stats'))}
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* AI button — center */}
      <div style={{ padding: '0 8px 4px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
        <button onClick={() => setChatOpen(!chatOpen)} title="AI"
          style={{
            width: 40, height: 40, borderRadius: 12, border: 'none', cursor: 'pointer',
            background: chatOpen ? 'var(--ind)' : 'var(--ind-l)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all var(--tr)',
            boxShadow: chatOpen ? '0 4px 14px rgba(76,94,232,.4)' : 'none',
          }}>
          <Sparkles size={18} color={chatOpen ? '#fff' : 'var(--ind)'} />
        </button>
        <span style={{ fontSize: 9, fontWeight: 600, color: chatOpen ? 'var(--ind)' : 'var(--tx3)' }}>AI</span>
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Profile — bottom */}
      <div style={{ padding: '0 8px 20px' }}>
        {navBtn('profile', User, tr('nav.profile'))}
      </div>
    </nav>
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
