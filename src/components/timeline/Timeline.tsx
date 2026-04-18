import { useMemo, useEffect, useState } from 'react';
import { useStore } from '../../store';
import { buildSchedule, getNowMinutes, minutesToTime, formatDuration, isBreakBlock } from '../../lib/scheduler';

const HOUR_HEIGHT = 64; // px per hour

export function Timeline() {
  const { tasks, config } = useStore();
  const [nowMins, setNowMins] = useState(getNowMinutes);

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

  // Hour markers
  const hourMarkers = [];
  const startHour = Math.ceil(wakeMin / 60);
  const endHour = Math.floor(sleepMin / 60);
  for (let h = startHour; h <= endHour; h++) {
    hourMarkers.push(h);
  }

  const usedPct = Math.round((totalMinutes / availableMinutes) * 100);

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

        {/* Progress bar */}
        <div style={{
          marginTop: 8, height: 4, background: 'var(--sf3)', borderRadius: 4, overflow: 'hidden',
        }}>
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
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px 32px' }}>
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

          {/* Blocks */}
          {blocks.map((block, i) => {
            const top = minsToPx(block.start_minutes);
            const height = Math.max(durationToPx(block.end_minutes - block.start_minutes), 28);

            if (isBreakBlock(block)) {
              return (
                <div key={i} style={{
                  position: 'absolute', top, left: 42, right: 0, height,
                  display: 'flex', alignItems: 'center', paddingLeft: 10,
                }}>
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
            const priorityColor = task.priority === 'high' ? 'var(--coral)' : task.priority === 'medium' ? 'var(--must)' : 'var(--sage)';
            const priorityBg = task.priority === 'high' ? 'var(--coral-l)' : task.priority === 'medium' ? 'var(--must-l)' : 'var(--sage-l)';
            const isPast = block.end_minutes < nowMins;
            const isCurrent = block.start_minutes <= nowMins && nowMins < block.end_minutes;

            return (
              <div key={i} style={{
                position: 'absolute', top, left: 42, right: 0, height,
                paddingLeft: 10,
              }}>
                <div style={{
                  height: '100%', borderRadius: 'var(--rs)',
                  background: task.is_done ? 'var(--sf2)' : priorityBg,
                  borderLeft: `3px solid ${task.is_done ? 'var(--tx3)' : priorityColor}`,
                  padding: '6px 10px',
                  display: 'flex', flexDirection: 'column', justifyContent: 'center',
                  opacity: isPast && !task.is_done ? 0.5 : 1,
                  outline: isCurrent ? `2px solid ${priorityColor}` : 'none',
                  outlineOffset: 1,
                  transition: 'opacity .2s',
                }}>
                  <div style={{
                    fontSize: Math.min(13, height > 24 ? 13 : 11),
                    fontWeight: 500,
                    color: task.is_done ? 'var(--tx3)' : 'var(--tx)',
                    textDecoration: task.is_done ? 'line-through' : 'none',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {task.is_starred && '★ '}{task.title}
                  </div>
                  {height > 36 && (
                    <div style={{ fontSize: 10, color: 'var(--tx3)', fontFamily: "'DM Mono', monospace", marginTop: 2 }}>
                      {minutesToTime(block.start_minutes)} – {minutesToTime(block.end_minutes)}
                      {task.travel_minutes > 0 && ` · +${task.travel_minutes}m travel`}
                    </div>
                  )}
                </div>
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
        </div>
      </div>
    </div>
  );
}
