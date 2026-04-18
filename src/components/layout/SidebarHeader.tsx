import { useState } from 'react';
import { Settings, Moon, Sun } from 'lucide-react';
import { useStore } from '../../store';

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Good night';
}

export function SidebarHeader() {
  const { config, updateConfig, apiKey, setApiKey } = useStore();
  const [showSettings, setShowSettings] = useState(false);
  const [localKey, setLocalKey] = useState(apiKey);

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const toggleTheme = () => {
    const next = config.theme === 'light' ? 'dark' : 'light';
    updateConfig({ theme: next });
    document.documentElement.setAttribute('data-theme', next);
  };

  return (
    <div style={{ padding: '20px 18px 14px', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ind)', marginBottom: 3 }}>
            UpX
          </div>
          <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-.3px' }}>
            {getGreeting()} 👋
          </div>
          <div style={{ fontSize: 12, color: 'var(--tx3)', marginTop: 2 }}>{today}</div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="btn-icon" onClick={toggleTheme} title="Toggle theme">
            {config.theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button className="btn-icon" onClick={() => setShowSettings(!showSettings)} title="Settings">
            <Settings size={16} />
          </button>
        </div>
      </div>

      {showSettings && (
        <div style={{
          marginTop: 14, padding: 14, background: 'var(--sf2)',
          borderRadius: 'var(--rs)', border: '1px solid var(--bdr2)',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--tx3)', marginBottom: 10 }}>
            Settings
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Row label="Wake up">
              <input type="time" value={config.wake}
                onChange={e => updateConfig({ wake: e.target.value })}
                style={{ fontSize: 12, padding: '5px 8px' }} />
            </Row>
            <Row label="Sleep">
              <input type="time" value={config.sleep}
                onChange={e => updateConfig({ sleep: e.target.value })}
                style={{ fontSize: 12, padding: '5px 8px' }} />
            </Row>
            <Row label="Default break">
              <input type="number" value={config.buffer} min="0" max="60"
                onChange={e => updateConfig({ buffer: parseInt(e.target.value) || 0 })}
                style={{ fontSize: 12, padding: '5px 8px', width: 70 }} />
            </Row>
            <Row label="Gym travel (min)">
              <input type="number" value={config.gym_travel_minutes} min="0"
                onChange={e => updateConfig({ gym_travel_minutes: parseInt(e.target.value) || 0 })}
                style={{ fontSize: 12, padding: '5px 8px', width: 70 }} />
            </Row>
            <Row label="API Key">
              <input
                type="password"
                value={localKey}
                onChange={e => setLocalKey(e.target.value)}
                onBlur={() => setApiKey(localKey)}
                placeholder="sk-ant-..."
                style={{ fontSize: 12, padding: '5px 8px' }}
              />
            </Row>
          </div>
        </div>
      )}
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
