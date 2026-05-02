import { useMemo, useState } from 'react';
import { X, Sparkles, CheckCircle2, XCircle, Flame } from 'lucide-react';
import { useStore } from '../../store';
import { formatDuration } from '../../lib/scheduler';
import { taskMatchesGoal } from '../../lib/categories';
import { getWeeklyFeedback } from '../../lib/ai';
import { useT } from '../../lib/i18n';
import { track } from '../../lib/analytics';
import type { DayStatTask } from '../../types';

/** ISO YYYY-MM-DD. */
function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const STREAK_THRESHOLD = 0.8;

export function StatsPanel() {
  const t = useT();
  const { tasks, dayHistory, config, apiKey, customBaseURL, customModel, useDefaultKey } = useStore();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const todayTasks = tasks.filter(tt => tt.day === 'today');
  const doneTasks = todayTasks.filter(tt => tt.is_done);

  const todayTotal = todayTasks.reduce((s, tt) => s + tt.duration_minutes, 0);
  const todayDone = doneTasks.reduce((s, tt) => s + tt.duration_minutes, 0);
  const todayPct = todayTotal > 0 ? Math.round((todayDone / todayTotal) * 100) : 0;

  // Focus minutes accumulated via stopFocus() for today
  const todayIso = isoDate(new Date());
  const todayFocusMin = dayHistory.find(d => d.date === todayIso)?.focus_minutes ?? 0;

  // Build week — last 7 days. For today, snapshot live; for past, use dayHistory.
  const weekStats = useMemo(() => {
    const days: { date: string; done: number; total: number; doneCount: number; totalCount: number; tasks: DayStatTask[]; isToday: boolean }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = isoDate(d);
      const isToday = i === 0;
      if (isToday) {
        const snapshot: DayStatTask[] = todayTasks.map(tt => ({
          id: tt.id,
          title: tt.title,
          category: tt.category,
          duration_minutes: tt.duration_minutes,
          is_done: tt.is_done,
        }));
        days.push({
          date: dateStr,
          done: todayDone,
          total: todayTotal,
          doneCount: doneTasks.length,
          totalCount: todayTasks.length,
          tasks: snapshot,
          isToday: true,
        });
      } else {
        const hist = dayHistory.find(h => h.date === dateStr);
        days.push({
          date: dateStr,
          done: hist?.done_minutes ?? 0,
          total: hist?.total_minutes ?? 0,
          doneCount: hist?.done_count ?? 0,
          totalCount: hist?.total_count ?? 0,
          tasks: hist?.tasks ?? [],
          isToday: false,
        });
      }
    }
    return days;
  }, [dayHistory, todayDone, todayTotal, todayTasks, doneTasks.length]);

  const weekTotalDone = weekStats.reduce((s, d) => s + d.done, 0);
  const weekTotalPlanned = weekStats.reduce((s, d) => s + d.total, 0);

  // Weekly goals — sum DONE minutes per category across the full 7-day window.
  // Bug fix: previously only counted today's tasks toward weekly goals.
  // Bug fix: previously displayed scheduled (not done) when nothing was done — misleading.
  const categoryProgress = useMemo(() => {
    return config.category_goals.map(goal => {
      let doneMinutes = 0;
      for (const day of weekStats) {
        for (const dt of day.tasks) {
          if (dt.is_done && taskMatchesGoal(dt.title, dt.category, goal.category)) {
            doneMinutes += dt.duration_minutes;
          }
        }
      }
      const pct = Math.min(100, Math.round((doneMinutes / goal.weekly_goal_minutes) * 100));
      return { ...goal, done_minutes: doneMinutes, pct };
    });
  }, [config.category_goals, weekStats]);

  // Streak — walk backward from today, count consecutive days with >=80% completion.
  // Today counts only if it's already met the threshold.
  const streak = useMemo(() => {
    let count = 0;
    for (let i = weekStats.length - 1; i >= 0; i--) {
      const d = weekStats[i];
      if (d.totalCount === 0) {
        // No tasks that day — break streak (skipping would be wrong)
        if (d.isToday && count === 0) continue; // edge: today empty, skip
        break;
      }
      const ratio = d.doneCount / d.totalCount;
      if (ratio >= STREAK_THRESHOLD) count++;
      else break;
    }
    // Also walk further back beyond the week if needed
    if (count === weekStats.length) {
      const earliestDate = weekStats[0].date;
      const olderDays = dayHistory
        .filter(h => h.date < earliestDate)
        .sort((a, b) => b.date.localeCompare(a.date));
      for (const d of olderDays) {
        if (d.total_count === 0) break;
        const ratio = d.done_count / d.total_count;
        if (ratio >= STREAK_THRESHOLD) count++;
        else break;
      }
    }
    return count;
  }, [weekStats, dayHistory]);

  const dayLabelKeys = ['day.short.mon', 'day.short.tue', 'day.short.wed', 'day.short.thu', 'day.short.fri', 'day.short.sat', 'day.short.sun'] as const;
  const maxBar = Math.max(...weekStats.map(d => d.total), 1);

  const selectedDay = selectedDate ? weekStats.find(d => d.date === selectedDate) : null;

  const askAI = async () => {
    track('week_reviewed', { streak, has_goals: config.category_goals.length > 0 });
    setAiLoading(true);
    setAiError(null);
    setAiText(null);
    try {
      const summary = buildWeekSummary(weekStats, categoryProgress, streak, config.language ?? 'en');
      const lang = (config.language ?? 'en') as 'en' | 'ru';
      const text = await getWeeklyFeedback(summary, apiKey, lang, customBaseURL, customModel, useDefaultKey);
      setAiText(text);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : t('stats.aiError'));
    } finally {
      setAiLoading(false);
    }
  };

  const hasAnyData = weekStats.some(d => d.totalCount > 0);

  return (
    <div className="panel-scroll">

      {/* ── AI Weekly Review — hero card ─────────────────────── */}
      <div style={{
        marginTop: 16,
        background: aiText
          ? 'var(--sf2)'
          : 'linear-gradient(135deg, var(--ind) 0%, var(--ind-h) 100%)',
        border: aiText ? '1px solid var(--bdr)' : 'none',
        borderRadius: 18,
        padding: aiText ? '16px' : '20px',
        position: 'relative',
        overflow: 'hidden',
        transition: 'background .3s',
      }}>
        {/* Decorative circles (only when not showing text) */}
        {!aiText && (
          <>
            <div style={{ position: 'absolute', top: -24, right: -24, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,.08)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: -16, right: 32, width: 64, height: 64, borderRadius: '50%', background: 'rgba(255,255,255,.06)', pointerEvents: 'none' }} />
          </>
        )}

        {!aiText && !aiLoading && !aiError && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(255,255,255,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Sparkles size={22} color="#fff" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>
                {config.language === 'ru' ? 'Обзор недели' : 'Weekly Review'}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.72)', marginTop: 3, lineHeight: 1.4 }}>
                {config.language === 'ru'
                  ? 'ИИ разберёт вашу неделю и даст советы'
                  : 'AI breaks down your week & gives advice'}
              </div>
            </div>
            <button
              onClick={askAI}
              disabled={!hasAnyData}
              style={{
                flexShrink: 0,
                background: hasAnyData ? 'rgba(255,255,255,.22)' : 'rgba(255,255,255,.1)',
                border: '1.5px solid rgba(255,255,255,.3)',
                borderRadius: 12, padding: '9px 16px',
                color: '#fff', fontSize: 13, fontWeight: 700,
                cursor: hasAnyData ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit', opacity: hasAnyData ? 1 : 0.5,
              }}>
              {config.language === 'ru' ? 'Спросить' : 'Ask AI'}
            </button>
          </div>
        )}

        {aiLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(255,255,255,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Sparkles size={22} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 6 }}>
                {config.language === 'ru' ? 'Анализирую вашу неделю…' : 'Analysing your week…'}
              </div>
              <span className="typing-dots"><span /><span /><span /></span>
            </div>
          </div>
        )}

        {aiText && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Sparkles size={15} color="var(--ind)" />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ind)', letterSpacing: '.05em', textTransform: 'uppercase' }}>
                {config.language === 'ru' ? 'Обзор недели' : 'Weekly Review'}
              </span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--tx)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
              {aiText}
            </div>
            <button
              className="btn btn-ghost"
              style={{ marginTop: 12, fontSize: 12, padding: '7px 14px' }}
              onClick={() => setAiText(null)}>
              {config.language === 'ru' ? '↻ Обновить' : '↻ Refresh'}
            </button>
          </>
        )}

        {aiError && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(255,255,255,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Sparkles size={22} color="#fff" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: 'rgba(255,200,200,.9)', lineHeight: 1.4 }}>⚠️ {aiError}</div>
              <button
                style={{ marginTop: 6, fontSize: 12, color: '#fff', background: 'rgba(255,255,255,.18)', border: 'none', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}
                onClick={askAI}>
                {config.language === 'ru' ? 'Попробовать снова' : 'Retry'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Today */}
      <Section title={t('stats.today')}>
        <div style={{ display: 'grid', gridTemplateColumns: todayFocusMin > 0 ? '1fr 1fr 1fr 1fr' : '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
          <StatCard label={t('stats.done')} value={`${todayPct}%`} color="var(--ind)" />
          <StatCard label={t('stats.hoursDone')} value={formatDuration(todayDone)} color="var(--sage)" />
          <StatCard label={t('stats.remaining')} value={formatDuration(Math.max(0, todayTotal - todayDone))} color="var(--must)" />
          {todayFocusMin > 0 && (
            <StatCard label={config.language === 'ru' ? '🎯 Фокус' : '🎯 Focus'} value={formatDuration(todayFocusMin)} color="var(--ind)" />
          )}
        </div>

        <div style={{ height: 6, background: 'var(--sf3)', borderRadius: 6, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 6, transition: 'width .4s ease',
            background: todayPct >= 100 ? 'var(--sage)' : todayPct >= 50 ? 'var(--ind)' : 'var(--must)',
            width: `${todayPct}%`,
          }} />
        </div>
        <div style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 6 }}>
          {t('stats.tasksCompleted', { done: doneTasks.length, total: todayTasks.length })}
        </div>
      </Section>

      {/* Streak */}
      <Section title={t('stats.streak')}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '14px 16px', background: 'var(--sf2)',
          border: '1px solid var(--bdr)', borderRadius: 'var(--rs)',
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: streak > 0 ? 'rgba(240,180,41,.18)' : 'var(--sf3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Flame size={24} color={streak > 0 ? 'var(--must)' : 'var(--tx3)'} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            {streak > 0 ? (
              <>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--tx)', fontFamily: "'DM Mono', monospace" }}>
                  {t('stats.streakDays', { n: streak })}
                </div>
                <div style={{ fontSize: 12, color: 'var(--tx3)', marginTop: 2 }}>
                  {t('stats.streakDesc')}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--tx3)', lineHeight: 1.5 }}>
                {t('stats.noStreak')}
              </div>
            )}
          </div>
        </div>
      </Section>

      {/* Weekly bar chart — clickable */}
      <Section title={t('stats.thisWeek')}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 64, marginBottom: 8 }}>
          {weekStats.map((day) => {
            const totalH = (day.total / maxBar) * 64;
            const doneH = day.total > 0 ? (day.done / day.total) * totalH : 0;
            const isSelected = selectedDate === day.date;
            return (
              <button
                key={day.date}
                onClick={() => setSelectedDate(day.date)}
                disabled={day.totalCount === 0}
                style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                  background: 'none', border: 'none', padding: 0,
                  cursor: day.totalCount > 0 ? 'pointer' : 'default',
                  WebkitTapHighlightColor: 'transparent',
                }}>
                <div style={{ width: '100%', height: 64, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', position: 'relative' }}>
                  {day.total > 0 && (
                    <div style={{
                      width: '100%', height: totalH,
                      background: isSelected ? 'var(--ind-l)' : 'var(--sf3)',
                      borderRadius: 4, overflow: 'hidden', position: 'relative',
                      outline: isSelected ? '2px solid var(--ind)' : 'none',
                      transition: 'all .15s ease',
                    }}>
                      <div style={{
                        position: 'absolute', bottom: 0, width: '100%', height: doneH,
                        background: day.isToday ? 'var(--ind)' : 'var(--ind-m)',
                        borderRadius: 4,
                      }} />
                    </div>
                  )}
                  {day.total === 0 && (
                    <div style={{ width: '100%', height: 4, background: 'var(--bdr2)', borderRadius: 4 }} />
                  )}
                </div>
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {weekStats.map((d, i) => {
            const isToday = d.isToday;
            const dayIndex = (new Date().getDay() + i - 6 + 7) % 7;
            // Map JS Sunday=0..Saturday=6 to our key array (Mon..Sun)
            const keyIndex = dayIndex === 0 ? 6 : dayIndex - 1;
            return (
              <div key={d.date} style={{
                flex: 1, textAlign: 'center', fontSize: 9,
                color: isToday ? 'var(--ind)' : 'var(--tx3)',
                fontWeight: isToday ? 700 : 400,
              }}>
                {t(dayLabelKeys[keyIndex])}
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--tx3)' }}>
          <span style={{ color: 'var(--tx)', fontWeight: 600 }}>{formatDuration(weekTotalDone)}</span> {t('stats.doneThisWeek')}
          {weekTotalPlanned > 0 && <span> · {Math.round((weekTotalDone / weekTotalPlanned) * 100)}% {t('stats.ofPlanned')}</span>}
        </div>
      </Section>

      {/* Category goals — now over full week */}
      {config.category_goals.length > 0 && (
        <Section title={t('stats.weeklyGoals')}>
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
                    {t('stats.remainingWeek', { rem: formatDuration(Math.max(0, goal.weekly_goal_minutes - goal.done_minutes)) })}
                  </div>
                )}
                {goal.pct >= 100 && (
                  <div style={{ fontSize: 10, color: 'var(--sage)', fontWeight: 600, marginTop: 3 }}>{t('stats.goalReached')}</div>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Day detail modal */}
      {selectedDay && (
        <DayDetailModal day={selectedDay} onClose={() => setSelectedDate(null)} />
      )}
    </div>
  );
}

function DayDetailModal({
  day,
  onClose,
}: {
  day: { date: string; done: number; total: number; doneCount: number; totalCount: number; tasks: DayStatTask[]; isToday: boolean };
  onClose: () => void;
}) {
  const t = useT();
  const completed = day.tasks.filter(tt => tt.is_done);
  const missed = day.tasks.filter(tt => !tt.is_done);
  const pct = day.totalCount > 0 ? Math.round((day.doneCount / day.totalCount) * 100) : 0;
  const dateLabel = new Date(day.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 999,
        background: 'rgba(0,0,0,.5)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        padding: '0 0 16px',
      }}
      onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 460, maxHeight: '80vh',
          background: 'var(--sf)',
          borderRadius: '18px 18px 0 0',
          border: '1px solid var(--bdr2)',
          padding: '18px 18px 24px',
          margin: '0 12px',
          boxShadow: 'var(--shd2)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          animation: 'modalFadeIn .22s cubic-bezier(.4,0,.2,1)',
        }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--tx3)', letterSpacing: '.06em', textTransform: 'uppercase' }}>
              {t('stats.dayDetail')}
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, marginTop: 2, textTransform: 'capitalize' }}>
              {dateLabel}
            </div>
          </div>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        {/* Summary */}
        <div style={{
          background: 'var(--sf2)', border: '1px solid var(--bdr)',
          borderRadius: 'var(--rs)', padding: '12px 14px',
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12,
          marginBottom: 14,
        }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: pct >= 80 ? 'var(--sage)' : pct >= 50 ? 'var(--ind)' : 'var(--must)', fontFamily: "'DM Mono', monospace" }}>
              {pct}%
            </div>
            <div style={{ fontSize: 10, color: 'var(--tx3)', marginTop: 2 }}>{t('stats.done')}</div>
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--tx)', fontFamily: "'DM Mono', monospace" }}>
              {day.doneCount}/{day.totalCount}
            </div>
            <div style={{ fontSize: 10, color: 'var(--tx3)', marginTop: 2 }}>{t('stats.completedTasks')}</div>
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--tx)', fontFamily: "'DM Mono', monospace" }}>
              {formatDuration(day.done)}
            </div>
            <div style={{ fontSize: 10, color: 'var(--tx3)', marginTop: 2 }}>{t('stats.hoursDone')}</div>
          </div>
        </div>

        {/* Tasks list */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {day.tasks.length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--tx3)', textAlign: 'center', padding: '24px 0' }}>
              {t('stats.noData')}
            </div>
          )}

          {completed.length > 0 && (
            <>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--sage)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
                ✓ {t('stats.completedTasks')} · {completed.length}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14 }}>
                {completed.map(tt => (
                  <TaskRow key={tt.id} task={tt} done />
                ))}
              </div>
            </>
          )}

          {missed.length > 0 && (
            <>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--coral)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
                ✗ {t('stats.missedTasks')} · {missed.length}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {missed.map(tt => (
                  <TaskRow key={tt.id} task={tt} done={false} />
                ))}
              </div>
            </>
          )}
        </div>

        <button
          className="btn btn-ghost"
          style={{ marginTop: 14, justifyContent: 'center', padding: '10px' }}
          onClick={onClose}>
          {t('stats.close')}
        </button>
      </div>
    </div>
  );
}

function TaskRow({ task, done }: { task: DayStatTask; done: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 10px', background: 'var(--sf2)',
      borderRadius: 8,
    }}>
      {done
        ? <CheckCircle2 size={14} color="var(--sage)" style={{ flexShrink: 0 }} />
        : <XCircle size={14} color="var(--coral)" style={{ flexShrink: 0 }} />
      }
      <span style={{
        flex: 1, fontSize: 13,
        color: 'var(--tx)',
        textDecoration: done ? 'line-through' : 'none',
        opacity: done ? 0.7 : 1,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {task.title}
      </span>
      <span style={{
        fontSize: 11, color: 'var(--tx3)',
        textTransform: 'capitalize', flexShrink: 0,
      }}>
        {task.category}
      </span>
      <span style={{
        fontSize: 11, color: 'var(--tx3)',
        fontFamily: "'DM Mono', monospace", flexShrink: 0,
      }}>
        {formatDuration(task.duration_minutes)}
      </span>
    </div>
  );
}

function buildWeekSummary(
  week: { date: string; done: number; total: number; doneCount: number; totalCount: number; tasks: DayStatTask[] }[],
  goals: { category: string; done_minutes: number; weekly_goal_minutes: number; pct: number }[],
  streak: number,
  language: string,
): string {
  const lines: string[] = [];
  lines.push(`Week summary (last 7 days, language=${language}):`);
  lines.push(`Streak: ${streak} consecutive days at 80%+ completion.`);
  lines.push('');
  lines.push('Daily breakdown:');
  for (const d of week) {
    const pct = d.totalCount > 0 ? Math.round((d.doneCount / d.totalCount) * 100) : 0;
    if (d.totalCount === 0) {
      lines.push(`  ${d.date}: no tasks logged`);
      continue;
    }
    const tasksStr = d.tasks
      .map(tt => `${tt.is_done ? '✓' : '✗'} ${tt.title} [${tt.category}, ${tt.duration_minutes}m]`)
      .join('; ');
    lines.push(`  ${d.date}: ${d.doneCount}/${d.totalCount} done (${pct}%), ${d.done}min/${d.total}min — ${tasksStr}`);
  }
  if (goals.length > 0) {
    lines.push('');
    lines.push('Category goals (week):');
    for (const g of goals) {
      lines.push(`  ${g.category}: ${g.done_minutes}min / ${g.weekly_goal_minutes}min target (${g.pct}%)`);
    }
  }
  return lines.join('\n');
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
