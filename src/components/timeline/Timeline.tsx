import { useMemo, useEffect, useState, useRef } from 'react';
import { useStore } from '../../store';
import { buildSchedule, getNowMinutes, minutesToTime, formatDuration, isBreakBlock } from '../../lib/scheduler';
import type { CategoryGoal } from '../../types';

const HOUR_HEIGHT = 64; // px per hour
const PX_PER_MIN = HOUR_HEIGHT / 60;

// FIX: schedule card design — category colors and emojis
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
  // FIX: timeline hover — exact time tooltip
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

  const totalDayMinutes = sleepMin - wakeMin;
  const totalPx = (totalDayMinutes / 60) * HOUR_HEIGHT;

  function minsToPx(mins: number) {
    return ((mins - wakeMin) / 60) * HOUR_HEIGHT;
  }
  function durationToPx(dur: number) {
    return (dur / 60) * HOUR_HEIGHT;
  }

  const nowPx = minsToPx(nowMins);
  const showNow = nowMins >= wakeMin && nowMins <= sleepMin;

  const hourMarkers: number[] = [];
  const startHour = Math.ceil(wakeMin / 60);
  const endHour = Math.floor(sleepMin / 60);
  for (let h = startHour; h <= endHour; h++) hourMarkers.push(h);

  const usedPct = Math.round((totalMinutes / availableMinutes) * 100);

  // FIX: timeline hover handler
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
            ⚠️ {overflow.length} task{overflow.length !== 1 ? 's' : ''} overflow — won't fit today
          </div>
        )}
      </div>

      {/* Timeline body */}
      <div
        ref={bodyRef}
        style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 32px', position: 'relative' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <div style={{ position: 'relative', height: totalPx + 32 }}>

          {/* Hour lines */}
          {hourMarkers.map(h => {
            const py = minsToPx(h * 60);
            return (
              <div key={h} style={{ position: 'absolute', top: py, left: 0, right: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: 'var(--tx3)', width: 32, flexShrink: 0, textAlign: 'right' }}>
                  {String(h).padStart(2, '0')}:00
                </span>
                <div style={{ flex: 1, height: 1, background: 'var(--bdr)' }} />
              </div>
            );
          })}

          {/* FIX: schedule card design — redesigned blocks */}
          {blocks.map((block, i) => {
            const top = minsToPx(block.start_minutes);
            const height = Math.max(durationToPx(block.end_minutes - block.start_minutes), 32);

            if (isBreakBlock(block)) {
              return (
                <div key={i} style={{ position: 'absolute', top, left: 42, right: 0, height, display: 'flex', alignItems: 'center', paddingLeft: 10 }}>
                  <div style={{
                    height: '100%', width: '100%',
                    background: 'var(--brk-bg)',
                    borderRadius: 'var(--rs)', borderLeft: '2px solid var(--brk-tx)',
                    display: 'flex', alignItems: 'center', paddingLeft: 10,
                  }}>
                    <span style={{ fontSize: 11, color: 'var(--brk-tx)', fontWeight: 500 }}>
                      {block.label} · {formatDuration(block.end_minutes - block.start_minutes)}
                    </span>
                  </div>
                </div>
              );
            }

            const { task } = block;
            const catColor = getCategoryColor(task.category, config.category_goals);
            const catEmoji = getCategoryEmoji(task.category);
            const isPast = block.end_minutes < nowMins;
            const isCurrent = block.start_minutes <= nowMins && nowMins < block.end_minutes;
            const duration = block.end_minutes - block.start_minutes;

            return (
              <div key={i} style={{ position: 'absolute', top, left: 42, right: 0, height, paddingLeft: 8 }}>
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
              position: 'absolute', top: nowPx, left: 32, right: 0,
              display: 'flex', alignItems: 'center', gap: 6, zIndex: 10, pointerEvents: 'none',
            }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--now)', flexShrink: 0 }} />
              <div style={{ flex: 1, height: 1.5, background: 'var(--now)' }} />
            </div>
          )}

          {/* FIX: timeline hover hairline */}
          {hoveredY !== null && (
            <div style={{
              position: 'absolute', top: hoveredY, left: 0, right: 0,
              height: 1, background: 'var(--tx3)', opacity: 0.3,
              borderTop: '1px dashed var(--tx3)',
              pointerEvents: 'none', zIndex: 20,
            }} />
          )}
        </div>

        {/* FIX: timeline hover tooltip — fixed to cursor */}
        {hoveredTime !== null && hoverClientY !== null && (
          <div style={{
            position: 'fixed',
            left: (bodyRef.current?.getBoundingClientRect().left ?? 0) + 8,
            top: hoverClientY - 12,
            background: '#1A1A2E',
            color: '#fff',
            borderRadius: 6,
            padding: '2px 8px',
            fontSize: 12,
            fontFamily: "'DM Mono', monospace",
            pointerEvents: 'none',
            zIndex: 9000,
            userSelect: 'none',
          }}>
            {hoveredTime}
          </div>
        )}
      </div>
    </div>
  );
}

// FIX: schedule card design — extracted card component
function ScheduleCard({
  task, catColor, catEmoji, startTime, durationMin, height, isPast, isCurrent,
}: {
  task: { title: string; category: string; travel_minutes: number; is_done: boolean; is_starred: boolean };
  catColor: string;
  catEmoji: string;
  startTime: string;
  durationMin: number;
  height: number;
  isPast: boolean;
  isCurrent: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const rgb = (() => { try { return hexToRgb(catColor); } catch { return '92, 107, 156'; } })();

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        height: '100%',
        borderRadius: 12,
        background: 'var(--sf)',
        boxShadow: hovered
          ? `0 4px 16px rgba(${rgb}, 0.22)`
          : `0 2px 8px rgba(0,0,0,0.06)`,
        display: 'flex',
        overflow: 'hidden',
        opacity: isPast && !task.is_done ? 0.5 : 1,
        outline: isCurrent ? `2px solid ${catColor}` : 'none',
        outlineOffset: 1,
        transition: 'box-shadow 0.18s ease, transform 0.18s ease, opacity 0.2s',
        transform: hovered ? 'translateY(-1px)' : 'none',
        cursor: 'default',
      }}
    >
      {/* Left colored bar */}
      <div style={{ width: 4, flexShrink: 0, background: catColor, borderRadius: '12px 0 0 12px' }} />

      {/* Content */}
      <div style={{ flex: 1, padding: height > 48 ? '7px 10px' : '5px 8px', minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2 }}>
        {/* Top row: emoji + time + title + duration badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <span style={{ fontSize: 14, flexShrink: 0, lineHeight: 1 }}>{catEmoji}</span>
          <span style={{ fontSize: 10, color: 'var(--tx3)', fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>
            {startTime}
          </span>
          <span style={{
            flex: 1, fontSize: 14, fontWeight: 700,
            color: task.is_done ? 'var(--tx3)' : 'var(--tx)',
            textDecoration: task.is_done ? 'line-through' : 'none',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {task.is_starred && '★ '}{task.title}
          </span>
          {/* Duration badge */}
          <span style={{
            flexShrink: 0,
            fontSize: 10, fontWeight: 600,
            color: catColor,
            background: `rgba(${rgb}, 0.15)`,
            borderRadius: 20, padding: '2px 7px',
            fontFamily: "'DM Mono', monospace",
          }}>
            {formatDuration(durationMin)}
          </span>
        </div>

        {/* Bottom row: category + travel */}
        {height > 44 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--tx3)', paddingLeft: 20 }}>
            <span style={{ textTransform: 'capitalize' }}>{task.category || 'general'}</span>
            {task.travel_minutes > 0 && (
              <>
                <span>•</span>
                <span>🚗 +{task.travel_minutes} min travel</span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
