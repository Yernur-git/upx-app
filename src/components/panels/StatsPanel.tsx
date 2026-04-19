import { useMemo } from 'react';
import { useStore } from '../../store';
import { formatDuration } from '../../lib/scheduler';
import { detectCategory } from '../../lib/categories';

export function StatsPanel() {
  const { tasks, dayHistory, config } = useStore();

  const todayTasks = tasks.filter(t => t.day === 'today');
  const doneTasks = todayTasks.filter(t => t.is_done);

  const todayTotal = todayTasks.reduce((s, t) => s + t.duration_minutes, 0);
  const todayDone = doneTasks.reduce((s, t) => s + t.duration_minutes, 0);
  const todayPct = todayTotal > 0 ? Math.round((todayDone / todayTotal) * 100) : 0;

  // Week stats from history + today
  const weekStats = useMemo(() => {
    const days: { date: string; done: number; total: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toDateString();
      const isToday = i === 0;
      if (isToday) {
        days.push({ date: dateStr, done: todayDone, total: todayTotal });
      } else {
        const hist = dayHistory.find(h => h.date === dateStr);
        days.push({ date: dateStr, done: hist?.done_minutes ?? 0, total: hist?.total_minutes ?? 0 });
      }
    }
    return days;
  }, [dayHistory, todayDone, todayTotal]);

  const weekTotalDone = weekStats.reduce((s, d) => s + d.done, 0);
  const weekTotalPlanned = weekStats.reduce((s, d) => s + d.total, 0);

  // Category goals progress this week
  const categoryProgress = useMemo(() => {
    return config.category_goals.map(goal => {
      // Match by category field OR auto-detect from title
      const todayMinutes = tasks
        .filter(t => t.day === 'today' && t.is_done && (
          t.category.toLowerCase() === goal.category.toLowerCase() ||
          detectCategory(t.title) === goal.category.toLowerCase()
        ))
        .reduce((s, t) => s + t.duration_minutes, 0);

      // Count from last 7 days history (approximate — history stores totals not per-category)
      // For now use today only; full per-category history is a future enhancement
      const pct = Math.min(100, Math.round((todayMinutes / goal.weekly_goal_minutes) * 100));
      return { ...goal, done_minutes: todayMinutes, pct };
    });
  }, [config.category_goals, tasks]);

  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const maxBar = Math.max(...weekStats.map(d => d.total), 1);

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '0 18px 24px' }}>

      {/* Today */}
      <Section title="Today">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
          <StatCard label="Done" value={`${todayPct}%`} color="var(--ind)" />
          <StatCard label="Hours done" value={formatDuration(todayDone)} color="var(--sage)" />
          <StatCard label="Remaining" value={formatDuration(Math.max(0, todayTotal - todayDone))} color="var(--must)" />
        </div>

        {/* Progress bar */}
        <div style={{ height: 6, background: 'var(--sf3)', borderRadius: 6, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 6, transition: 'width .4s ease',
            background: todayPct >= 100 ? 'var(--sage)' : todayPct >= 50 ? 'var(--ind)' : 'var(--must)',
            width: `${todayPct}%`,
          }} />
        </div>
        <div style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 6 }}>
          {doneTasks.length} of {todayTasks.length} tasks completed
        </div>
      </Section>

      {/* Weekly bar chart */}
      <Section title="This week">
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 64, marginBottom: 8 }}>
          {weekStats.map((day, i) => {
            const isToday = i === weekStats.length - 1;
            const totalH = (day.total / maxBar) * 64;
            const doneH = day.total > 0 ? (day.done / day.total) * totalH : 0;
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <div style={{ width: '100%', height: 64, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', position: 'relative' }}>
                  {day.total > 0 && (
                    <div style={{ width: '100%', height: totalH, background: 'var(--sf3)', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                      <div style={{
                        position: 'absolute', bottom: 0, width: '100%', height: doneH,
                        background: isToday ? 'var(--ind)' : 'var(--ind-m)',
                        borderRadius: 4,
                      }} />
                    </div>
                  )}
                  {day.total === 0 && (
                    <div style={{ width: '100%', height: 4, background: 'var(--bdr2)', borderRadius: 4 }} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {weekStats.map((_, i) => {
            const isToday = i === weekStats.length - 1;
            const dayIndex = (new Date().getDay() + i - 6 + 7) % 7;
            return (
              <div key={i} style={{
                flex: 1, textAlign: 'center', fontSize: 9,
                color: isToday ? 'var(--ind)' : 'var(--tx3)',
                fontWeight: isToday ? 700 : 400,
              }}>
                {dayLabels[dayIndex === 0 ? 6 : dayIndex - 1]}
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--tx3)' }}>
          <span style={{ color: 'var(--tx)', fontWeight: 600 }}>{formatDuration(weekTotalDone)}</span> done this week
          {weekTotalPlanned > 0 && <span> · {Math.round((weekTotalDone / weekTotalPlanned) * 100)}% of planned</span>}
        </div>
      </Section>

      {/* Category goals */}
      {config.category_goals.length > 0 && (
        <Section title="Weekly goals">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {categoryProgress.map(goal => (
              <div key={goal.category}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, textTransform: 'capitalize' }}>{goal.category}</span>
                  <span style={{ fontSize: 12, color: 'var(--tx3)', fontFamily: "'DM Mono', monospace" }}>
                    {formatDuration(goal.done_minutes)} / {formatDuration(goal.weekly_goal_minutes)}
                  </span>
                </div>
                <div style={{ height: 6, background: 'var(--sf3)', borderRadius: 6, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 6, transition: 'width .4s ease',
                    background: goal.color || 'var(--ind)',
                    width: `${goal.pct}%`,
                  }} />
                </div>
                {goal.pct < 100 && (
                  <div style={{ fontSize: 10, color: 'var(--tx3)', marginTop: 3 }}>
                    {formatDuration(goal.weekly_goal_minutes - goal.done_minutes)} remaining this week
                  </div>
                )}
                {goal.pct >= 100 && (
                  <div style={{ fontSize: 10, color: 'var(--sage)', fontWeight: 600, marginTop: 3 }}>✓ Goal reached!</div>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}
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

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: 'var(--sf2)', borderRadius: 'var(--rs)', padding: '10px 12px', border: '1px solid var(--bdr)' }}>
      <div style={{ fontSize: 17, fontWeight: 700, color, fontFamily: "'DM Mono', monospace" }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--tx3)', marginTop: 2 }}>{label}</div>
    </div>
  );
}