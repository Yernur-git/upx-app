import { useState } from 'react';
import { Plus, Trash2, LogOut, Bell } from 'lucide-react';
import { useStore } from '../../store';
import { detectProvider, providerLabel } from '../../lib/ai';
import { requestNotificationPermission, canNotify } from '../../lib/notifications';
import type { CategoryGoal } from '../../types';

const COLORS = ['#5C6B9C', '#5FA35F', '#F07070', '#F5C842', '#8B5CF6', '#06B6D4', '#F97316'];

export function ProfilePanel() {
  const { config, updateConfig, userEmail, signOut, apiKey, setApiKey, customBaseURL, setCustomBaseURL, customModel, setCustomModel } = useStore();
  const [localKey, setLocalKey] = useState(apiKey);
  const [localURL, setLocalURL] = useState(customBaseURL);
  const [localModel, setLocalModel] = useState(customModel);
  const [newGoalCat, setNewGoalCat] = useState('');
  const [newGoalHours, setNewGoalHours] = useState('5');
  const [showAI, setShowAI] = useState(false);

  const provider = detectProvider(localKey, localURL);

  const addGoal = () => {
    if (!newGoalCat.trim()) return;
    const goal: CategoryGoal = {
      category: newGoalCat.trim().toLowerCase(),
      weekly_goal_minutes: Math.round(parseFloat(newGoalHours) * 60),
      color: COLORS[config.category_goals.length % COLORS.length],
    };
    updateConfig({ category_goals: [...config.category_goals, goal] });
    setNewGoalCat('');
    setNewGoalHours('5');
  };

  const removeGoal = (cat: string) => {
    updateConfig({ category_goals: config.category_goals.filter(g => g.category !== cat) });
  };

  const [notifGranted, setNotifGranted] = useState(() => canNotify());

  const handleRequestNotif = async () => {
    const granted = await requestNotificationPermission();
    setNotifGranted(granted);
    if (granted) {
      new Notification('✅ UpX notifications enabled', {
        body: 'You\'ll get reminders before each task starts.',
        icon: '/icon-192.png',
      });
    }
  };

  const handleTestNotif = () => {
    if (!canNotify()) return;
    new Notification('⏰ Starting in 10 min', {
      body: 'Deep Work Session',
      icon: '/icon-192.png',
      tag: 'upx-test',
    });
  }; const PRESETS = [
    { label: 'OpenRouter', url: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o-mini' },
    { label: 'Groq (free)', url: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' },
    { label: 'OpenAI', url: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
    { label: 'Ollama', url: 'http://localhost:11434/v1', model: 'llama3' },
  ];

  return (
    <div className="panel-scroll">

      {/* Account */}
      <Section title="Account">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--sf2)', borderRadius: 'var(--rs)', border: '1px solid var(--bdr)' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--ind-l)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: 'var(--ind)' }}>
            {userEmail && userEmail !== 'local' ? userEmail[0].toUpperCase() : '?'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {userEmail === 'local' ? 'Local account' : userEmail}
            </div>
            <div style={{ fontSize: 11, color: 'var(--tx3)' }}>
              {userEmail === 'local' ? 'No sync — data on this device only' : 'Synced across devices'}
            </div>
          </div>
          <button className="btn-icon" onClick={signOut} title="Sign out"><LogOut size={15} /></button>
        </div>
      </Section>

      {/* Schedule */}
      <Section title="Schedule">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Row label="Wake up">
            <input type="time" value={config.wake} onChange={e => updateConfig({ wake: e.target.value })} style={{ fontSize: 12, padding: '5px 8px', width: 100 }} />
          </Row>
          <Row label="Sleep">
            <input type="time" value={config.sleep} onChange={e => updateConfig({ sleep: e.target.value })} style={{ fontSize: 12, padding: '5px 8px', width: 100 }} />
          </Row>
          <Row label="Morning buffer (min)">
            <input type="number" min="0" max="120" value={config.morning_buffer}
              onChange={e => updateConfig({ morning_buffer: parseInt(e.target.value) || 0 })}
              style={{ fontSize: 12, padding: '5px 8px', width: 70 }} />
          </Row>
          <Row label="Break between tasks (min)">
            <input type="number" min="0" max="60" value={config.buffer}
              onChange={e => updateConfig({ buffer: parseInt(e.target.value) || 0 })}
              style={{ fontSize: 12, padding: '5px 8px', width: 70 }} />
          </Row>
          <Row label="Time on road (min)">
            <input type="number" min="0" value={config.road_time_minutes}
              onChange={e => updateConfig({ road_time_minutes: parseInt(e.target.value) || 0 })}
              style={{ fontSize: 12, padding: '5px 8px', width: 70 }} />
          </Row>
          <div style={{ fontSize: 10, color: 'var(--tx3)', marginTop: -4, lineHeight: 1.5 }}>
            "Time on road" is added automatically to workout/gym tasks (each way).
          </div>
        </div>
      </Section>

      {/* Weekly goals */}
      <Section title="Weekly goals">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
          {config.category_goals.map(goal => (
            <div key={goal.category} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'var(--sf2)', borderRadius: 'var(--rs)', border: '1px solid var(--bdr)' }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: goal.color, flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 13, textTransform: 'capitalize' }}>{goal.category}</span>
              <span style={{ fontSize: 11, color: 'var(--tx3)', fontFamily: "'DM Mono', monospace" }}>
                {Math.round(goal.weekly_goal_minutes / 60)}h/week
              </span>
              <button className="btn-icon" style={{ padding: 3 }} onClick={() => removeGoal(goal.category)}>
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          <input placeholder="Category (e.g. workout)" value={newGoalCat}
            onChange={e => setNewGoalCat(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addGoal()}
            style={{ flex: 2, fontSize: 12, padding: '7px 10px' }} />
          <input type="number" placeholder="hrs" value={newGoalHours}
            onChange={e => setNewGoalHours(e.target.value)}
            style={{ width: 56, fontSize: 12, padding: '7px 8px' }} />
          <button className="btn btn-primary" style={{ padding: '7px 10px' }} onClick={addGoal}>
            <Plus size={14} />
          </button>
        </div>
        <div style={{ fontSize: 10, color: 'var(--tx3)', marginTop: 6 }}>
          Match category names with your tasks (case-insensitive).
        </div>
      </Section>

      {/* AI Provider */}
      <Section title="AI Provider">
        <button onClick={() => setShowAI(!showAI)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: showAI ? 10 : 0 }}>
          <span style={{ fontSize: 12, color: localKey ? 'var(--sage)' : 'var(--tx3)' }}>
            {localKey ? providerLabel(provider) : 'Not configured — click to set up'}
          </span>
          <span style={{ fontSize: 11, color: 'var(--tx3)' }}>{showAI ? '▲' : '▼'}</span>
        </button>

        {showAI && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {PRESETS.map(p => (
                <button key={p.label} className="btn btn-ghost" style={{ fontSize: 10, padding: '3px 8px' }}
                  onClick={() => { setLocalURL(p.url); setLocalModel(p.model); setCustomBaseURL(p.url); setCustomModel(p.model); }}>
                  {p.label}
                </button>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--tx3)', marginBottom: 4 }}>API Key</div>
              <input type="password" value={localKey} placeholder="sk-ant-...  /  sk-...  /  sk-or-...  /  gsk_..."
                onChange={e => setLocalKey(e.target.value)}
                onBlur={() => setApiKey(localKey)}
                style={{ fontSize: 12, padding: '6px 8px' }} />
              {localKey && <div style={{ fontSize: 10, color: 'var(--sage)', fontWeight: 600, marginTop: 4 }}>{providerLabel(provider)}</div>}
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--tx3)', marginBottom: 4 }}>Base URL <span style={{ opacity: .6 }}>(leave empty for auto)</span></div>
              <input value={localURL} placeholder="https://openrouter.ai/api/v1"
                onChange={e => setLocalURL(e.target.value)} onBlur={() => setCustomBaseURL(localURL)}
                style={{ fontSize: 12, padding: '6px 8px' }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--tx3)', marginBottom: 4 }}>Model <span style={{ opacity: .6 }}>(leave empty for default)</span></div>
              <input value={localModel} placeholder="openai/gpt-4o-mini"
                onChange={e => setLocalModel(e.target.value)} onBlur={() => setCustomModel(localModel)}
                style={{ fontSize: 12, padding: '6px 8px' }} />
            </div>
            <div style={{ fontSize: 10, color: 'var(--tx3)', lineHeight: 1.8 }}>
              🆓 <a href="https://console.groq.com" target="_blank" rel="noreferrer" style={{ color: 'var(--ind)' }}>Groq</a> — free •{' '}
              🔀 <a href="https://openrouter.ai" target="_blank" rel="noreferrer" style={{ color: 'var(--ind)' }}>OpenRouter</a> — any model •{' '}
              🤖 <a href="https://console.anthropic.com" target="_blank" rel="noreferrer" style={{ color: 'var(--ind)' }}>Anthropic</a>
            </div>
          </div>
        )}
      </Section>

      {/* Notifications */}
      <Section title="Notifications">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Row label="Task reminders">
            {notifGranted ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--sage)', fontWeight: 600 }}>✓ Enabled</span>
                <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }} onClick={handleTestNotif}>
                  Test
                </button>
              </div>
            ) : (
              <button className="btn btn-ghost" style={{ fontSize: 11, padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 5 }}
                onClick={handleRequestNotif}>
                <Bell size={12} /> Enable
              </button>
            )}
          </Row>
          {notifGranted && (
            <div style={{ fontSize: 11, color: 'var(--tx3)', lineHeight: 1.6 }}>
              You'll get a reminder 10 min before each task and at start time. Notifications only work while the app is open.
            </div>
          )}
          {!notifGranted && (
            <div style={{ fontSize: 11, color: 'var(--tx3)', lineHeight: 1.6 }}>
              Enable to get reminders before your tasks start.
            </div>
          )}
        </div>
      </Section>

      {/* Appearance */}
      <Section title="Appearance">
        <Row label="Theme">
          <div style={{ display: 'flex', gap: 6 }}>
            {(['light', 'dark'] as const).map(t => (
              <button key={t} className="btn btn-ghost"
                style={{ fontSize: 12, padding: '5px 12px', background: config.theme === t ? 'var(--ind-l)' : 'transparent', color: config.theme === t ? 'var(--ind)' : 'var(--tx3)' }}
                onClick={() => { updateConfig({ theme: t }); document.documentElement.setAttribute('data-theme', t); }}>
                {t === 'light' ? '☀️ Light' : '🌙 Dark'}
              </button>
            ))}
          </div>
        </Row>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--tx3)', marginBottom: 10 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <span style={{ fontSize: 12, color: 'var(--tx2)', flexShrink: 0 }}>{label}</span>
      {children}
    </div>
  );
}
