import { useState, useEffect } from 'react';
import { Plus, Trash2, LogOut, ChevronRight, Bell, BellOff } from 'lucide-react';
import { useStore } from '../../store';
import { detectProvider, providerLabel } from '../../lib/ai';
import { useT } from '../../lib/i18n';
import { supportsPush, getPushSubscription, subscribeToPush, unsubscribeFromPush } from '../../lib/push';
import type { CategoryGoal, Lang } from '../../types';

const COLORS = ['#5C6B9C', '#5FA35F', '#F07070', '#F5C842', '#8B5CF6', '#06B6D4', '#F97316'];

function ConfirmDialog({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  const t = useT();
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '0 0 24px' }}>
      <div style={{ width: '100%', maxWidth: 420, background: 'var(--sf)', borderRadius: 20, border: '1px solid var(--bdr2)', padding: '24px 20px', margin: '0 16px', boxShadow: 'var(--shd2)' }}>
        <p style={{ fontSize: 14, color: 'var(--tx)', textAlign: 'center', lineHeight: 1.5, marginBottom: 20 }}>{message}</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center', padding: '12px' }} onClick={onCancel}>{t('common.cancel')}</button>
          <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center', padding: '12px', background: 'var(--coral)' }} onClick={onConfirm}>{t('common.confirm')}</button>
        </div>
      </div>
    </div>
  );
}

export function ProfilePanel() {
  const t = useT();
  const { config, updateConfig, userEmail, signOut, apiKey, setApiKey, customBaseURL, setCustomBaseURL, customModel, setCustomModel, useDefaultKey, setKeyMode, deleteTask } = useStore();
  const [localKey, setLocalKey] = useState(apiKey);
  const [localURL, setLocalURL] = useState(customBaseURL);
  const [localModel, setLocalModel] = useState(customModel);
  const [newGoalCat, setNewGoalCat] = useState('');
  const [newGoalHours, setNewGoalHours] = useState('5');
  const [showAI, setShowAI] = useState(false);
  const [pushStatus, setPushStatus] = useState<'loading' | 'subscribed' | 'unsubscribed' | 'unsupported'>('loading');
  const [pushWorking, setPushWorking] = useState(false);
  const [confirm, setConfirm] = useState<null | { message: string; onConfirm: () => void }>(null);

  // Detect current push subscription state on mount
  useEffect(() => {
    if (!supportsPush()) { setPushStatus('unsupported'); return; }
    getPushSubscription().then(sub => setPushStatus(sub ? 'subscribed' : 'unsubscribed'));
  }, []);

  const provider = detectProvider(localKey, localURL);

  const ask = (message: string, onConfirm: () => void) => setConfirm({ message, onConfirm });

  const addGoal = () => {
    if (!newGoalCat.trim()) return;
    const goal: CategoryGoal = {
      category: newGoalCat.trim().toLowerCase(),
      weekly_goal_minutes: Math.round(parseFloat(newGoalHours) * 60),
      color: COLORS[config.category_goals.length % COLORS.length],
    };
    updateConfig({ category_goals: [...config.category_goals, goal] });
    setNewGoalCat(''); setNewGoalHours('5');
  };

  const handleSubscribe = async () => {
    setPushWorking(true);
    const { userId } = useStore.getState();
    const result = await subscribeToPush(userId || 'local-user');
    if (result === 'subscribed') {
      setPushStatus('subscribed');
      // Send a test push so user sees it immediately
      new Notification('✅ UpX', { body: t('profile.pushEnabled'), icon: '/icon-192.png' });
    } else if (result === 'denied') {
      alert(t('profile.pushDenied'));
    }
    setPushWorking(false);
  };

  const handleUnsubscribe = async () => {
    setPushWorking(true);
    const { userId } = useStore.getState();
    await unsubscribeFromPush(userId || 'local-user');
    setPushStatus('unsubscribed');
    setPushWorking(false);
  };

  const PRESETS = [
    { label: 'OpenRouter', url: 'https://openrouter.ai/api/v1', model: 'google/gemini-2.0-flash-exp:free' },
    { label: 'Groq (free)', url: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' },
    { label: 'OpenAI', url: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
    { label: 'Anthropic', url: '', model: 'claude-sonnet-4-20250514' },
  ];

  const currentLang = (config.language ?? 'en') as Lang;

  return (
    <div className="panel-scroll">
      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          onConfirm={() => { confirm.onConfirm(); setConfirm(null); }}
          onCancel={() => setConfirm(null)}
        />
      )}

      {/* ── ACCOUNT ── */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'var(--ind-l)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: 'var(--ind)', flexShrink: 0 }}>
            {userEmail && userEmail !== 'local' ? userEmail[0].toUpperCase() : '👤'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {userEmail === 'local' ? t('profile.localAccount') : userEmail}
            </div>
            <div style={{ fontSize: 12, color: 'var(--tx3)', marginTop: 2 }}>
              {userEmail === 'local' ? t('profile.localWarn') : t('profile.synced')}
            </div>
          </div>
          <button
            className="btn btn-ghost"
            style={{ padding: '8px 14px', fontSize: 13, color: 'var(--coral)', borderColor: 'var(--coral)', flexShrink: 0, gap: 6 }}
            onClick={() => ask(t('profile.signOutConfirm'), signOut)}>
            <LogOut size={14} /> {t('profile.signOut')}
          </button>
        </div>
      </Card>

      {/* ── SCHEDULE ── */}
      <SectionTitle>{t('profile.schedule')}</SectionTitle>
      <Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Row label={t('profile.wake')}>
            <input type="time" value={config.wake} onChange={e => updateConfig({ wake: e.target.value })} style={timeInput} />
          </Row>
          <Divider />
          <Row label={t('profile.sleep')}>
            <input type="time" value={config.sleep} onChange={e => updateConfig({ sleep: e.target.value })} style={timeInput} />
          </Row>
          <Divider />
          <Row label={t('profile.morningBuffer')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="number" min="0" max="120" value={config.morning_buffer}
                onChange={e => updateConfig({ morning_buffer: parseInt(e.target.value) || 0 })}
                style={numInput} />
              <span style={{ fontSize: 12, color: 'var(--tx3)' }}>{t('profile.min')}</span>
            </div>
          </Row>
          <Divider />
          <Row label={t('profile.taskBreak')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="number" min="0" max="60" value={config.buffer}
                onChange={e => updateConfig({ buffer: parseInt(e.target.value) || 0 })}
                style={numInput} />
              <span style={{ fontSize: 12, color: 'var(--tx3)' }}>{t('profile.min')}</span>
            </div>
          </Row>
          <Divider />
          <Row label={t('profile.roadTime')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="number" min="0" value={config.road_time_minutes}
                onChange={e => updateConfig({ road_time_minutes: parseInt(e.target.value) || 0 })}
                style={numInput} />
              <span style={{ fontSize: 12, color: 'var(--tx3)' }}>{t('profile.min')}</span>
            </div>
          </Row>
        </div>
      </Card>

      {/* ── WEEKLY GOALS ── */}
      <SectionTitle>{t('profile.weeklyGoals')}</SectionTitle>
      <Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {config.category_goals.length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--tx3)', textAlign: 'center', padding: '12px 0' }}>{t('profile.noGoals')}</div>
          )}
          {config.category_goals.map((goal, idx) => (
            <div key={goal.category}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0' }}>
                <div style={{ width: 12, height: 12, borderRadius: 4, background: goal.color, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 14, textTransform: 'capitalize', fontWeight: 500 }}>{goal.category}</span>
                <span style={{ fontSize: 12, color: 'var(--tx3)', fontFamily: "'DM Mono', monospace" }}>
                  {Math.round(goal.weekly_goal_minutes / 60)}{t('profile.hPerWeek')}
                </span>
                <button className="btn-icon" style={{ padding: 6 }}
                  onClick={() => ask(t('profile.removeGoal', { cat: goal.category }), () =>
                    updateConfig({ category_goals: config.category_goals.filter(g => g.category !== goal.category) })
                  )}>
                  <Trash2 size={13} color="var(--coral)" />
                </button>
              </div>
              {idx < config.category_goals.length - 1 && <Divider />}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--bdr)' }}>
          <input placeholder={t('profile.goalCategory')}
            value={newGoalCat} onChange={e => setNewGoalCat(e.target.value)}
            style={{ flex: 2, fontSize: 13, padding: '9px 12px' }} />
          <input type="number" placeholder={t('profile.hoursShort')} value={newGoalHours}
            onChange={e => setNewGoalHours(e.target.value)}
            style={{ width: 60, fontSize: 13, padding: '9px 10px' }} />
          <button className="btn btn-primary" style={{ padding: '9px 14px' }} onClick={addGoal}>
            <Plus size={15} />
          </button>
        </div>
        <p style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 8, lineHeight: 1.5 }}>
          {t('profile.goalHelp')}
        </p>
      </Card>

      {/* ── NOTIFICATIONS ── */}
      <SectionTitle>{t('profile.notifications')}</SectionTitle>
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
              {pushStatus === 'subscribed'
                ? <Bell size={15} color="var(--sage)" />
                : <BellOff size={15} color="var(--tx3)" />}
              {t('profile.pushTitle')}
            </div>
            <div style={{ fontSize: 12, color: 'var(--tx3)', marginTop: 3, lineHeight: 1.5 }}>
              {pushStatus === 'loading'   && '…'}
              {pushStatus === 'unsupported' && t('profile.pushUnsupported')}
              {pushStatus === 'unsubscribed' && t('profile.pushOff')}
              {pushStatus === 'subscribed'   && t('profile.pushOn')}
            </div>
          </div>

          {pushStatus === 'unsupported' && (
            <span style={{ fontSize: 12, color: 'var(--tx3)' }}>—</span>
          )}
          {pushStatus === 'unsubscribed' && (
            <button className="btn btn-primary"
              style={{ padding: '10px 18px', fontSize: 13, flexShrink: 0 }}
              disabled={pushWorking}
              onClick={handleSubscribe}>
              {pushWorking ? '…' : t('profile.pushEnable')}
            </button>
          )}
          {pushStatus === 'subscribed' && (
            <button className="btn btn-ghost"
              style={{ padding: '9px 14px', fontSize: 13, flexShrink: 0, color: 'var(--coral)', borderColor: 'var(--coral)' }}
              disabled={pushWorking}
              onClick={handleUnsubscribe}>
              {pushWorking ? '…' : t('profile.pushDisable')}
            </button>
          )}
        </div>

        {pushStatus === 'subscribed' && (
          <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--sf2)', borderRadius: 10, fontSize: 12, color: 'var(--tx2)', lineHeight: 1.6 }}>
            ☀️ {t('profile.pushMorningHint')}
          </div>
        )}
      </Card>

      {/* ── AI PROVIDER ── */}
      <SectionTitle>{t('profile.aiProvider')}</SectionTitle>
      <Card>
        <button onClick={() => setShowAI(!showAI)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <span style={{ fontSize: 13, color: useDefaultKey ? 'var(--ind)' : (localKey ? 'var(--sage)' : 'var(--tx3)'), fontWeight: 500 }}>
            {useDefaultKey
              ? (config.language === 'ru' ? 'По умолчанию' : 'Default')
              : (localKey ? providerLabel(provider) : t('profile.aiNotConfigured'))}
          </span>
          <ChevronRight size={16} color="var(--tx3)" style={{ transform: showAI ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }} />
        </button>

        {showAI && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
            {/* Mode toggle — switching CLEARS custom inputs */}
            <div style={{ display: 'flex', gap: 8 }}>
              {([
                { mode: 'default' as const, label: config.language === 'ru' ? 'По умолчанию' : 'Default' },
                { mode: 'custom'  as const, label: config.language === 'ru' ? 'Свой ключ'    : 'Custom'  },
              ]).map(opt => {
                const active = (opt.mode === 'default') === useDefaultKey;
                return (
                  <button key={opt.mode} className="btn btn-ghost" style={{
                    flex: 1, justifyContent: 'center', padding: '10px',
                    fontSize: 13, fontWeight: 600,
                    background: active ? 'var(--ind-l)' : 'transparent',
                    color:      active ? 'var(--ind)'   : 'var(--tx3)',
                    borderColor:active ? 'var(--ind-m)' : 'var(--bdr2)',
                  }}
                    onClick={() => {
                      // Always reset local mirror state on mode switch.
                      // The store action also wipes apiKey/customBaseURL/customModel.
                      setLocalKey('');
                      setLocalURL('');
                      setLocalModel('');
                      setKeyMode(opt.mode);
                    }}>
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {useDefaultKey ? (
              <div style={{
                fontSize: 12, color: 'var(--tx3)', lineHeight: 1.6,
                padding: '10px 12px', background: 'var(--sf2)',
                border: '1px solid var(--bdr)', borderRadius: 'var(--rs)',
              }}>
                {config.language === 'ru'
                  ? 'Используется встроенный ключ. Запросы идут через защищённый прокси-сервер.'
                  : 'Built-in key in use. Requests are routed through a secure proxy.'}
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {PRESETS.map(p => (
                    <button key={p.label} className="btn btn-ghost" style={{ fontSize: 12, padding: '6px 12px' }}
                      onClick={() => { setLocalURL(p.url); setLocalModel(p.model); setCustomBaseURL(p.url); setCustomModel(p.model); }}>
                      {p.label}
                    </button>
                  ))}
                </div>
                <div>
                  <label style={label}>{t('profile.apiKey')}</label>
                  <input type="password" value={localKey} placeholder="sk-ant-…  /  sk-…  /  sk-or-…  /  gsk_…"
                    onChange={e => setLocalKey(e.target.value)} onBlur={() => setApiKey(localKey)}
                    style={{ fontSize: 13, padding: '10px 12px' }} />
                  {localKey && <div style={{ fontSize: 11, color: 'var(--sage)', fontWeight: 600, marginTop: 5 }}>{providerLabel(provider)}</div>}
                </div>
                <div>
                  <label style={label}>{t('profile.baseURL')} <span style={{ opacity: .6, fontWeight: 400 }}>{t('profile.baseURLHint')}</span></label>
                  <input value={localURL} placeholder="https://openrouter.ai/api/v1"
                    onChange={e => setLocalURL(e.target.value)} onBlur={() => setCustomBaseURL(localURL)}
                    style={{ fontSize: 13, padding: '10px 12px' }} />
                </div>
                <div>
                  <label style={label}>{t('profile.model')}</label>
                  <input value={localModel} placeholder="google/gemini-2.0-flash-exp:free"
                    onChange={e => setLocalModel(e.target.value)} onBlur={() => setCustomModel(localModel)}
                    style={{ fontSize: 13, padding: '10px 12px' }} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--tx3)', lineHeight: 1.8 }}>
                  🆓 <a href="https://console.groq.com" target="_blank" rel="noreferrer" style={{ color: 'var(--ind)' }}>Groq</a> — free &nbsp;·&nbsp;
                  🔀 <a href="https://openrouter.ai" target="_blank" rel="noreferrer" style={{ color: 'var(--ind)' }}>OpenRouter</a> &nbsp;·&nbsp;
                  🤖 <a href="https://console.anthropic.com" target="_blank" rel="noreferrer" style={{ color: 'var(--ind)' }}>Anthropic</a>
                </div>
              </>
            )}
          </div>
        )}
      </Card>

      {/* ── APPEARANCE ── */}
      <SectionTitle>{t('profile.appearance')}</SectionTitle>
      <Card>
        <div style={{ display: 'flex', gap: 10 }}>
          {(['light', 'dark'] as const).map(themeOpt => (
            <button key={themeOpt} className="btn btn-ghost" style={{
              flex: 1, justifyContent: 'center', padding: '12px',
              fontSize: 14, fontWeight: 600,
              background: config.theme === themeOpt ? 'var(--ind-l)' : 'transparent',
              color: config.theme === themeOpt ? 'var(--ind)' : 'var(--tx3)',
              borderColor: config.theme === themeOpt ? 'var(--ind-m)' : 'var(--bdr2)',
            }}
              onClick={() => { updateConfig({ theme: themeOpt }); document.documentElement.setAttribute('data-theme', themeOpt); }}>
              {themeOpt === 'light' ? t('profile.themeLight') : t('profile.themeDark')}
            </button>
          ))}
        </div>
      </Card>

      {/* ── LANGUAGE ── (under appearance, as requested) */}
      <SectionTitle>{t('profile.language')}</SectionTitle>
      <Card>
        <div style={{ display: 'flex', gap: 10 }}>
          {([
            { code: 'en' as const, label: 'English' },
            { code: 'ru' as const, label: 'Русский' },
          ]).map(opt => (
            <button key={opt.code} className="btn btn-ghost" style={{
              flex: 1, justifyContent: 'center', padding: '12px',
              fontSize: 14, fontWeight: 600,
              background: currentLang === opt.code ? 'var(--ind-l)' : 'transparent',
              color: currentLang === opt.code ? 'var(--ind)' : 'var(--tx3)',
              borderColor: currentLang === opt.code ? 'var(--ind-m)' : 'var(--bdr2)',
            }}
              onClick={() => updateConfig({ language: opt.code })}>
              {opt.label}
            </button>
          ))}
        </div>
      </Card>

      {/* ── DANGER ── */}
      <SectionTitle>{t('profile.danger')}</SectionTitle>
      <Card>
        <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center', padding: '12px', color: 'var(--coral)', borderColor: 'var(--coral)', fontSize: 13 }}
          onClick={() => ask(t('profile.deleteAllConfirm'), async () => {
            const all = useStore.getState().tasks;
            for (const tt of all) await deleteTask(tt.id);
          })}>
          {t('profile.deleteAll')}
        </button>
      </Card>

      <div style={{ height: 32 }} />
    </div>
  );
}

const timeInput: React.CSSProperties = { fontSize: 14, padding: '8px 12px', width: 110 };
const numInput: React.CSSProperties = { fontSize: 14, padding: '8px 10px', width: 70 };
const label: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--tx2)', display: 'block', marginBottom: 6 };

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--sf)', border: '1px solid var(--bdr2)', borderRadius: 14, padding: '14px 16px', marginBottom: 2 }}>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--tx3)', padding: '18px 4px 8px' }}>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <span style={{ fontSize: 14, color: 'var(--tx)' }}>{label}</span>
      {children}
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: 'var(--bdr)', margin: '0 -2px' }} />;
}
