import { useEffect, useState, useRef } from 'react';
import { Pause, Play, StopCircle, Plus, ChevronDown } from 'lucide-react';
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

// ── Big overlay controls button ───────────────────────────────────────
function OverlayBtn({
  onClick, label, children, color = 'rgba(255,255,255,.18)',
}: {
  onClick: () => void; label: string; children: React.ReactNode; color?: string;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 8, padding: '18px 28px',
        background: color, border: '1.5px solid rgba(255,255,255,.18)',
        borderRadius: 20, cursor: 'pointer', color: '#fff',
        fontFamily: 'inherit', transition: 'background .15s',
        WebkitTapHighlightColor: 'transparent',
      }}>
      {children}
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', opacity: 0.8 }}>
        {label}
      </span>
    </button>
  );
}

export function FocusBar() {
  const { focusSession, pauseFocus, resumeFocus, stopFocus, addFocusTime, config } = useStore();
  const lang = config.language ?? 'en';
  const [, tick] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const doneNotified = useRef(false);
  // Swipe-down to close
  const touchStartY = useRef(0);

  // Re-render every 250ms while session is active
  useEffect(() => {
    if (!focusSession) {
      doneNotified.current = false;
      setFullscreen(false);
      return;
    }
    const id = setInterval(() => tick(n => n + 1), 250);
    return () => clearInterval(id);
  }, [!!focusSession]);

  // Lock body scroll when fullscreen
  useEffect(() => {
    if (fullscreen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [fullscreen]);

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

  // ── Colors ────────────────────────────────────────────────────────
  const accent = isDone ? '#EF4444' : isPaused ? '#B45309' : '#4C5EE8';
  const bgBar  = isDone ? 'var(--coral)' : isPaused ? 'rgba(160,100,0,.92)' : 'var(--ind)';

  const label = isDone
    ? (lang === 'ru' ? '✓ Готово' : '✓ Done')
    : isPaused
      ? (lang === 'ru' ? '⏸ Пауза' : '⏸ Paused')
      : (lang === 'ru' ? '🎯 Фокус' : '🎯 Focus');

  // ── Fullscreen overlay ────────────────────────────────────────────
  if (fullscreen) {
    const gradBg = isDone
      ? 'linear-gradient(160deg,#7f1d1d 0%,#1c0e0e 100%)'
      : isPaused
        ? 'linear-gradient(160deg,#422006 0%,#1c1207 100%)'
        : 'linear-gradient(160deg,#1e2a7a 0%,#0a0e2a 100%)';

    return (
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 800,
          background: gradBg,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '40px 24px',
          animation: 'focusOverlayIn .28s cubic-bezier(.4,0,.2,1)',
          cursor: 'pointer',
          userSelect: 'none',
          WebkitTapHighlightColor: 'transparent',
        }}
        onClick={() => setFullscreen(false)}
        onTouchStart={(e) => { touchStartY.current = e.touches[0].clientY; }}
        onTouchEnd={(e) => {
          const dy = e.changedTouches[0].clientY - touchStartY.current;
          if (dy > 60) setFullscreen(false); // swipe down to close
        }}
      >
        {/* Collapse hint */}
        <button
          onClick={(e) => { e.stopPropagation(); setFullscreen(false); }}
          style={{
            position: 'absolute', top: 'env(safe-area-inset-top, 16px)',
            left: '50%', transform: 'translateX(-50%)',
            marginTop: 16,
            background: 'rgba(255,255,255,.12)', border: 'none',
            borderRadius: 20, padding: '8px 20px',
            cursor: 'pointer', color: 'rgba(255,255,255,.6)',
            display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600,
            fontFamily: 'inherit',
          }}>
          <ChevronDown size={14} />
          {lang === 'ru' ? 'Свернуть' : 'Collapse'}
        </button>

        {/* State badge */}
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase',
          color: 'rgba(255,255,255,.55)', marginBottom: 20,
        }}>
          {label}
        </div>

        {/* Task title */}
        <div style={{
          fontSize: 22, fontWeight: 700, color: '#fff',
          textAlign: 'center', lineHeight: 1.35,
          maxWidth: 320, marginBottom: 36,
          textShadow: '0 2px 16px rgba(0,0,0,.4)',
        }}>
          {focusSession.taskTitle}
        </div>

        {/* Big timer */}
        <div style={{
          fontSize: 80, fontWeight: 700, color: '#fff',
          fontFamily: "'DM Mono', monospace",
          letterSpacing: '-4px', lineHeight: 1,
          textShadow: `0 0 40px ${accent}88`,
          marginBottom: 16,
        }}>
          {isDone ? `+${formatTime(-remaining)}` : formatTime(remaining)}
        </div>

        {/* Overtime label */}
        {isDone && (
          <div style={{ fontSize: 13, color: 'rgba(255,160,160,.85)', marginBottom: 32, fontWeight: 600 }}>
            {lang === 'ru' ? 'Сверхурочно' : 'Overtime'}
          </div>
        )}
        {!isDone && <div style={{ height: 32 }} />}

        {/* Controls — stop propagation so taps don't close overlay */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}
          onClick={e => e.stopPropagation()}>
          {!isDone && (
            <OverlayBtn onClick={() => addFocusTime(15 * 60 * 1000)} label={lang === 'ru' ? '+15 мин' : '+15 min'}>
              <Plus size={22} color="#fff" />
            </OverlayBtn>
          )}
          {!isDone && (
            <OverlayBtn
              onClick={() => isPaused ? resumeFocus() : pauseFocus()}
              label={isPaused ? (lang === 'ru' ? 'Продолжить' : 'Resume') : (lang === 'ru' ? 'Пауза' : 'Pause')}>
              {isPaused ? <Play size={22} color="#fff" /> : <Pause size={22} color="#fff" />}
            </OverlayBtn>
          )}
          <OverlayBtn
            onClick={() => { stopFocus(); setFullscreen(false); }}
            label={lang === 'ru' ? 'Стоп' : 'Stop'}
            color="rgba(239,68,68,.35)">
            <StopCircle size={22} color="#fff" />
          </OverlayBtn>
        </div>

        {/* Subtle ring animation behind timer */}
        <div style={{
          position: 'absolute',
          width: 260, height: 260,
          borderRadius: '50%',
          border: `2px solid ${accent}33`,
          animation: 'focusRingPulse 3s ease-in-out infinite',
          pointerEvents: 'none',
        }} />
      </div>
    );
  }

  // ── Compact bar (default) ─────────────────────────────────────────
  return (
    <div
      className="focus-bar"
      style={{ background: bgBar, cursor: 'pointer' }}
      onClick={() => setFullscreen(true)}
    >
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

      {/* Controls — stop propagation so bar tap doesn't open fullscreen */}
      <div
        style={{ display: 'flex', gap: 6, flexShrink: 0 }}
        onClick={e => e.stopPropagation()}
      >
        {/* +15 min */}
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
