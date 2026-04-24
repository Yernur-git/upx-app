import { useMemo, useEffect, useState, useRef } from 'react';
import { useStore } from '../../store';
import { buildSchedule, getNowMinutes, minutesToTime, formatDuration, isBreakBlock } from '../../lib/scheduler';
import type { CategoryGoal } from '../../types';

const HOUR_HEIGHT = 80;
const PX_PER_MIN = HOUR_HEIGHT / 60;
const LEFT_GUTTER = 48;
const CARD_GAP = 3;

function getCategoryColor(category: string, goals: CategoryGoal[]): string {
  const found = goals.find(g => g.category.toLowerCase() === category?.toLowerCase());
  if (found) return found.color;
  const defaults: Record<string, string> = {
    workout: '#5FA35F', 'deep work': '#5C6B9C', meetings: '#E07070',
    meals: '#F5A442', creative: '#B560B5', admin: '#60A0B5',
    walks: '#60B560', general: '#9EA0B8',
  };
  return defaults[category?.toLowerCase()] || '#9EA0B8';
}

function getCategoryEmoji(category: string): string {
  const emojis: Record<string, string> = {
    workout: '💪', 'deep work': '💻', meetings: '🤝',
    meals: '🍽️', creative: '🎨', admin: '📋',
    walks: '🚶', general: '📌',
  };
  return emojis[category?.toLowerCase()] || '📌';
}

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}

export function Timeline() {
  const { tasks, config } = useStore();
  const [nowMins, setNowMins] = useState(getNowMinutes);
  const [hoveredY, setHoveredY] = useState<number | null>(null);
  const [hoveredTime, setHoveredTime] = useState<string | null>(null);
  const [hoverClientY, setHoverClientY] = useState<number | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setInterval(() => setNowMins(getNowMinutes()), 60_000);
    return () => clearInterval(id);
  }, []);

  const { blocks, overflow, totalMinutes, availableMinutes } = useMemo(
    () => buildSchedule(tasks, config),
    [tasks, config]
  );

  const wakeMin = useMemo(() => {
    const [h, m] = config.wake.split(':').map(Number);
    return h * 60 + m;
  }, [config.wake]);

  const sleepMin = useMemo(() => {
    const [h, m] = config.sleep.split(':').map(Number);
    return h * 60 + m;
  }, [config.sleep]);

  const totalPx = ((sleepMin - wakeMin) / 60) * HOUR_HEIGHT;

  function minsToPx(mins: number) {
    return ((mins - wakeMin) / 60) * HOUR_HEIGHT;
  }

  const nowPx = minsToPx(nowMins);
  const showNow = nowMins >= wakeMin && nowMins <= sleepMin;

  const hourMarkers: number[] = [];
  const startHour = Math.ceil(wakeMin / 60);
  const endHour = Math.floor(sleepMin / 60);
  for (let h = startHour; h <= endHour; h++) hourMarkers.push(h);

  const usedPct = Math.round((totalMinutes / availableMinutes) * 100);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = bodyRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const relY = e.clientY - rect.top + el.scrollTop;
    const mins = wakeMin + relY / PX_PER_MIN;
    const clamped = Math.max(wakeMin, Math.min(sleepMin, mins));
    setHoveredY(relY);
    setHoverClientY(e.clientY);
    setHoveredTime(minutesToTime(Math.round(clamped)));
  };

  const handleMouseLeave = () => {
    setHoveredY(null);
    setHoveredTime(null);
    setHoverClientY(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '16px 24px 12px', flexShrink: 0, borderBottom: '1px solid var(--bdr)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Today's Schedule</div>
          <div style={{ fontSize: 12, color: 'var(--tx3)', fontFamily: "'DM Mono', monospace" }}>
            {formatDuration(totalMinutes)} / {formatDuration(availableMinutes)}
          </div>
        </div>

        <div style={{ marginTop: 8, height: 4, background: 'var(--sf3)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 4,
            background: usedPct > 90 ? 'var(--coral)' : usedPct > 70 ? 'var(--must)' : 'var(--ind)',
            width: `${Math.min(usedPct, 100)}%`,
            transition: 'width .3s ease',
          }} />
        </div>

        {overflow.length > 0 && (
          <div style={{
            marginTop: 8, padding: '6px 10px', borderRadius: 'var(--rs)',
            background: 'var(--coral-l)', color: 'var(--coral)',
            fontSize: 12, fontWeight: 500,
          }}>
            ⚠️ {overflow.length} task{overflow.length !== 1 ? 's' : ''} won't fit today
          </div>
        )}
      </div>

      {/* Timeline body */}
      <div
        ref={bodyRef}
        style={{ flex: 1, overflowY: 'auto', padding: '16px 12px 32px', position: 'relative' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <div style={{ position: 'relative', height: totalPx + 32 }}>

          {/* Hour lines */}
          {hourMarkers.map(h => {
            const py = minsToPx(h * 60);
            return (
              <div key={h} style={{ position: 'absolute', top: py, left: 0, right: 0, display: 'flex', alignItems: 'center', gap: 8, pointerEvents: 'none' }}>
                <span style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: 'var(--tx3)', width: LEFT_GUTTER - 8, flexShrink: 0, textAlign: 'right' }}>
                  {String(h).padStart(2, '0')}:00
                </span>
                <div style={{ flex: 1, height: 1, background: 'var(--bdr)' }} />
              </div>
            );
          })}

          {/* Blocks */}
          {blocks.map((block, i) => {
            const top = minsToPx(block.start_minutes);
            const rawHeight = ((block.end_minutes - block.start_minutes) / 60) * HOUR_HEIGHT;

            if (isBreakBlock(block)) {
              // Break blocks use EXACT height — no minimum — to prevent overlap with next card
              const breakHeight = Math.max(rawHeight - CARD_GAP, 2);
              const breakDur = block.end_minutes - block.start_minutes;
              if (rawHeight < 6) return null;
              return (
                <div key={i} style={{
                  position: 'absolute',
                  top: top + CARD_GAP / 2,
                  left: LEFT_GUTTER,
                  right: 4,
                  height: breakHeight,
                  display: 'flex',
                  alignItems: 'center',
                  paddingLeft: 8,
                  background: 'var(--brk-bg)',
                  borderRadius: 5,
                  borderLeft: '2px dashed var(--brk-tx)',
                  opacity: 0.6,
                  overflow: 'hidden',
                }}>
                  {rawHeight >= 20 && (
                    <span style={{ fontSize: 10, color: 'var(--brk-tx)', fontWeight: 500, userSelect: 'none', whiteSpace: 'nowrap' }}>
                      ☕ {formatDuration(breakDur)}
                    </span>
                  )}
                </div>
              );
            }

            // Task cards: minimum 24px so title stays readable
            const height = Math.max(rawHeight - CARD_GAP, 24);
            const { task } = block;
            const catColor = getCategoryColor(task.category, config.category_goals);
            const catEmoji = getCategoryEmoji(task.category);
            const isPast = block.end_minutes < nowMins;
            const isCurrent = block.start_minutes <= nowMins && nowMins < block.end_minutes;
            const duration = block.end_minutes - block.start_minutes;

            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  top: top + CARD_GAP / 2,
                  left: LEFT_GUTTER,
                  right: 4,
                  height,
                }}
              >
                <ScheduleCard
                  task={task}
                  catColor={catColor}
                  catEmoji={catEmoji}
                  startTime={minutesToTime(block.start_minutes)}
                  durationMin={duration}
                  height={height}
                  isPast={isPast}
                  isCurrent={isCurrent}
                />
              </div>
            );
          })}

          {/* Now line */}
          {showNow && (
            <div style={{
              position: 'absolute', top: nowPx, left: LEFT_GUTTER - 12, right: 0,
              display: 'flex', alignItems: 'center', gap: 4, zIndex: 10, pointerEvents: 'none',
            }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--now)', flexShrink: 0 }} />
              <div style={{ flex: 1, height: 1.5, background: 'var(--now)' }} />
            </div>
          )}

          {/* Hover hairline */}
          {hoveredY !== null && (
            <div style={{
              position: 'absolute', top: hoveredY, left: 0, right: 0,
              height: 1, borderTop: '1px dashed var(--tx3)', opacity: 0.25,
              pointerEvents: 'none', zIndex: 20,
            }} />
          )}
        </div>

        {/* Hover tooltip */}
        {hoveredTime !== null && hoverClientY !== null && (
          <div style={{
            position: 'fixed',
            left: (bodyRef.current?.getBoundingClientRect().left ?? 0) + 4,
            top: hoverClientY - 12,
            background: '#1A1A2E', color: '#fff',
            borderRadius: 6, padding: '2px 8px',
            fontSize: 12, fontFamily: "'DM Mono', monospace",
            pointerEvents: 'none', zIndex: 9000, userSelect: 'none',
          }}>
            {hoveredTime}
          </div>
        )}
      </div>
    </div>
  );
}

function ScheduleCard({
  task, catColor, catEmoji, startTime, durationMin, height, isPast, isCurrent,
}: {
  task: { title: string; category: string; travel_minutes: number; is_done: boolean; is_starred: boolean };
  catColor: string; catEmoji: string; startTime: string;
  durationMin: number; height: number; isPast: boolean; isCurrent: boolean;
}) {
  const rgb = (() => { try { return hexToRgb(catColor); } catch { return '92, 107, 156'; } })();
  // Size tiers
  const micro   = height < 26;   // only title, no padding
  const tiny    = height < 40;   // title + no meta
  const compact = height < 70;   // title + time only

  const done = task.is_done;
  const accent = done ? 'var(--tx3)' : catColor;
  const accentRgb = done ? '120,120,120' : rgb;

  return (
    <div style={{
      height: '100%',
      borderRadius: micro ? 5 : 10,
      background: done
        ? 'var(--sf2)'
        : isCurrent
          ? `rgba(${accentRgb}, 0.15)`
          : `rgba(${accentRgb}, 0.08)`,
      borderLeft: `3px solid ${accent}`,
      border: `1px solid rgba(${accentRgb}, ${isCurrent ? '0.35' : '0.14'})`,
      borderLeftWidth: 3,
      borderLeftColor: accent,
      boxShadow: isCurrent ? `0 1px 12px rgba(${accentRgb}, 0.18), inset 0 0 0 1px rgba(${accentRgb},0.08)` : 'none',
      display: 'flex',
      overflow: 'hidden',
      opacity: isPast && !done ? 0.4 : 1,
      transition: 'opacity 0.2s, box-shadow 0.2s',
      boxSizing: 'border-box',
      cursor: 'pointer',
    }}>
      {/* Color stripe — left side */}
      <div style={{
        width: micro ? 3 : 4,
        background: accent,
        flexShrink: 0,
        borderRadius: '0',
        opacity: done ? 0.4 : isCurrent ? 1 : 0.7,
      }} />

      {/* Content */}
      <div style={{
        flex: 1, minWidth: 0,
        display: 'flex',
        flexDirection: micro ? 'row' : 'column',
        justifyContent: 'center',
        alignItems: micro ? 'center' : 'stretch',
        padding: micro ? '0 6px' : tiny ? '3px 8px' : compact ? '5px 9px' : '7px 10px',
        gap: micro ? 4 : 2,
        overflow: 'hidden',
      }}>
        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
          {!micro && (
            <span style={{
              fontSize: compact ? 12 : 13,
              flexShrink: 0,
              lineHeight: 1,
              opacity: done ? 0.5 : 1,
            }}>
              {done ? '✓' : catEmoji}
            </span>
          )}
          <span style={{
            flex: 1,
            fontSize: micro ? 10 : tiny ? 12 : compact ? 13 : 14,
            fontWeight: 600,
            color: done ? 'var(--tx3)' : 'var(--tx)',
            textDecoration: done ? 'line-through' : 'none',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            lineHeight: 1.25,
            letterSpacing: '-0.1px',
          }}>
            {task.is_starred && !done && <span style={{ color: accent, marginRight: 2 }}>★</span>}
            {task.title}
          </span>
          {/* Duration badge — always visible on non-micro */}
          {!micro && (
            <span style={{
              fontSize: 10,
              fontWeight: 600,
              color: done ? 'var(--tx3)' : accent,
              background: `rgba(${accentRgb}, 0.12)`,
              borderRadius: 20,
              padding: '1px 6px',
              flexShrink: 0,
              fontFamily: "'DM Mono', monospace",
              letterSpacing: '0',
            }}>
              {formatDuration(durationMin)}
            </span>
          )}
        </div>

        {/* Meta row — time + category */}
        {!tiny && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            paddingLeft: compact ? 0 : 17,
            overflow: 'hidden', whiteSpace: 'nowrap',
          }}>
            <span style={{
              fontSize: 11,
              fontFamily: "'DM Mono', monospace",
              color: isCurrent ? accent : 'var(--tx3)',
              fontWeight: isCurrent ? 600 : 400,
              flexShrink: 0,
            }}>
              {startTime}
            </span>
            {!compact && (
              <>
                <span style={{ color: 'var(--bdr2)', fontSize: 8, flexShrink: 0 }}>•</span>
                <span style={{
                  fontSize: 11, color: 'var(--tx3)',
                  textTransform: 'capitalize',
                  overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {task.category || 'general'}
                </span>
                {task.travel_minutes > 0 && (
                  <span style={{ fontSize: 10, color: 'var(--tx3)', flexShrink: 0 }}>
                    · 🚗 {task.travel_minutes}m
                  </span>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Active pulse bar on right edge */}
      {isCurrent && (
        <div style={{
          width: 2.5,
          background: accent,
          flexShrink: 0,
          opacity: 0.6,
        }} />
      )}
    </div>
  );
}