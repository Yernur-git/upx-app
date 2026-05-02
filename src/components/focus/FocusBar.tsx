import { useEffect, useState, useRef } from 'react';
import { Pause, Play, StopCircle, Plus } from 'lucide-react';
import { useStore } from '../../store';
import { canNotify } from '../../lib/notifications';

// ── Soft beep via Web Audio API — no audio file needed ───────────────
function playBeep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.35, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.7);
    setTimeout(() => ctx.close().catch(() => {}), 1500);
  } catch { /* audio context not supported */ }
}

function formatTime(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const ctrlBtn: React.CSSProperties = {
  width: 34, height: 34, borderRadius: 10, border: 'none',
  background: 'rgba(255,255,255,.22)', color: '#fff',
  display: 'flex', flexDirection: 'column', alignItems: 'center',
  justifyContent: 'center', gap: 1, cursor: 'pointer', flexShrink: 0,
};

export function FocusBar() {
  const { focusSession, pauseFocus, resumeFocus, stopFocus, addFocusTime, config } = useStore();
  const lang = config.language ?? 'en';
  const [, tick] = useState(0);
  const doneNotified = useRef(false);

  // Re-render every 250ms while session is active
  useEffect(() => {
    if (!focusSession) { doneNotified.current = false; return; }
    const id = setInterval(() => tick(n => n + 1), 250);
    return () => clearInterval(id);
  }, [!!focusSession]);

  if (!focusSession) return null;

  // ── Calculate remaining time ───────────────────────────────────────
  const snapNow = focusSession.pausedAt ?? Date.now();
  const elapsed = snapNow - focusSession.startedAt - focusSession.pausedMs;
  const remaining = focusSession.durationMs - elapsed;
  const isDone = remaining <= 0;
  const isPaused = !!focusSession.pausedAt;

  // ── Fire notification + beep exactly once on completion ───────────
  if (isDone && !doneNotified.current) {
    doneNotified.current = true;
    playBeep();
    if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
    if (canNotify()) {
      try {
        new Notification(lang === 'ru' ? '⏱ Время вышло!' : '⏱ Time\'s up!', {
          body: focusSession.taskTitle,
          icon: '/icon-192.png',
          tag: 'upx-focus-done',
          silent: false,
        });
      } catch { /* notification blocked */ }
    }
  }

  const bg = isDone
    ? 'var(--coral)'
    : isPaused
      ? 'rgba(160,100,0,.92)'
      : 'var(--ind)';

  const label = isDone
    ? (lang === 'ru' ? '✓ Готово' : '✓ Done')
    : isPaused
      ? (lang === 'ru' ? '⏸ Пауза' : '⏸ Paused')
      : (lang === 'ru' ? '🎯 Фокус' : '🎯 Focus');

  return (
    <div className="focus-bar" style={{ background: bg }}>
      {/* Task info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 9, color: 'rgba(255,255,255,.65)',
          fontWeight: 700, letterSpacing: '.08em',
          textTransform: 'uppercase', lineHeight: 1,
        }}>
          {label}
        </div>
        <div style={{
          fontSize: 13, fontWeight: 600, color: '#fff', marginTop: 3,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {focusSession.taskTitle}
        </div>
      </div>

      {/* Countdown / overtime */}
      <div style={{
        fontSize: 20, fontWeight: 700, color: '#fff',
        fontFamily: "'DM Mono', monospace",
        flexShrink: 0, minWidth: 56, textAlign: 'center',
        letterSpacing: '-1px',
      }}>
        {isDone ? `+${formatTime(-remaining)}` : formatTime(remaining)}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        {/* +15 min — only while running/paused, not in overtime */}
        {!isDone && (
          <button
            onClick={() => addFocusTime(15 * 60 * 1000)}
            title={lang === 'ru' ? '+15 минут' : '+15 min'}
            style={ctrlBtn}>
            <Plus size={13} />
            <span style={{ fontSize: 8, fontWeight: 800, lineHeight: 1 }}>15</span>
          </button>
        )}

        {/* Pause / Resume */}
        {!isDone && (
          <button
            onClick={() => isPaused ? resumeFocus() : pauseFocus()}
            title={isPaused
              ? (lang === 'ru' ? 'Продолжить' : 'Resume')
              : (lang === 'ru' ? 'Пауза' : 'Pause')}
            style={ctrlBtn}>
            {isPaused ? <Play size={15} /> : <Pause size={15} />}
          </button>
        )}

        {/* Stop */}
        <button
          onClick={stopFocus}
          title={lang === 'ru' ? 'Остановить' : 'Stop'}
          style={ctrlBtn}>
          <StopCircle size={15} />
        </button>
      </div>
    </div>
  );
}
