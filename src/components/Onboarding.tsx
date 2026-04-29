import { useState } from 'react';
import { useStore } from '../store';
import { useT } from '../lib/i18n';

interface OnboardingProps {
  onDone: () => void;
}

export function Onboarding({ onDone }: OnboardingProps) {
  const t = useT();
  const { updateConfig, addTask, config } = useStore();
  const [step, setStep] = useState(0);
  const [wake, setWake] = useState('07:00');
  const [sleep, setSleep] = useState('23:00');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDuration, setTaskDuration] = useState('30');
  const [goalCat, setGoalCat] = useState('workout');
  const [goalHours, setGoalHours] = useState('6');
  const [loading, setLoading] = useState(false);

  const STEPS = [
    { emoji: '⏰', title: t('onb.wake.title'), subtitle: t('onb.wake.subtitle') },
    { emoji: '🎯', title: t('onb.task.title'), subtitle: t('onb.task.subtitle') },
    { emoji: '📊', title: t('onb.goal.title'), subtitle: t('onb.goal.subtitle') },
  ];

  const canNext = () => {
    if (step === 1 && !taskTitle.trim()) return false;
    return true;
  };

  const handleNext = async () => {
    setLoading(true);
    try {
      if (step === 0) {
        await updateConfig({ wake, sleep });
      } else if (step === 1) {
        if (taskTitle.trim()) {
          await addTask({
            title: taskTitle.trim(),
            duration_minutes: parseInt(taskDuration) || 30,
            break_after: config.buffer,
            travel_minutes: 0,
            priority: 'medium',
            category: 'general',
            is_starred: false,
            is_done: false,
            day: 'today',
            recurrence: 'none',
            sort_order: 0,
          });
        }
      } else if (step === 2) {
        if (goalCat.trim()) {
          const existing = config.category_goals.find((g: { category: string }) => g.category === goalCat.trim().toLowerCase());
          if (!existing) {
            const COLORS = ['#5FA35F', '#4C5EE8', '#EF6060', '#F0B429', '#8B5CF6'];
            await updateConfig({
              category_goals: [...config.category_goals, {
                category: goalCat.trim().toLowerCase(),
                weekly_goal_minutes: Math.round(parseFloat(goalHours) * 60),
                color: COLORS[config.category_goals.length % COLORS.length],
              }],
            });
          }
        }
        onDone();
        return;
      }
      if (step < STEPS.length - 1) setStep(s => s + 1);
    } finally {
      setLoading(false);
    }
  };

  const current = STEPS[step];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 8000,
      background: 'var(--bg)',
      display: 'flex', flexDirection: 'column',
      overflowY: 'auto',
      WebkitOverflowScrolling: 'touch' as any,
    }}>
      {/* Scrollable inner — top-aligned with safe-area padding */}
      <div style={{
        flex: 1,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'flex-start',
        padding: '0 20px 40px',
        paddingTop: 'max(env(safe-area-inset-top, 0px) + 32px, 48px)',
        minHeight: 'min-content',
        gap: 16,
      }}>
        {/* Step dots */}
        <div style={{ display: 'flex', gap: 8 }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              width: i === step ? 24 : 8,
              height: 8, borderRadius: 4,
              background: i <= step ? 'var(--ind)' : 'var(--sf3)',
              transition: 'width .3s ease, background .3s ease',
            }} />
          ))}
        </div>

        {/* Card */}
        <div style={{
          width: '100%', maxWidth: 400,
          background: 'var(--sf)', borderRadius: 24,
          border: '1px solid var(--bdr2)', padding: '32px 24px 24px',
          boxShadow: 'var(--shd2)',
          boxSizing: 'border-box',
        }}>
          <div style={{ fontSize: 48, marginBottom: 4, textAlign: 'center' }}>{current.emoji}</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, textAlign: 'center', letterSpacing: '-.3px', margin: '0 0 6px' }}>
            {current.title}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--tx3)', textAlign: 'center', lineHeight: 1.6, margin: '0 0 20px' }}>
            {current.subtitle}
          </p>

          {step === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx2)', display: 'block', marginBottom: 6 }}>
                  {t('onb.wakeUp')}
                </label>
                <input type="time" value={wake} onChange={e => setWake(e.target.value)}
                  style={{ display: 'block', width: '100%', boxSizing: 'border-box', fontSize: 18, padding: '14px 16px', WebkitAppearance: 'none', appearance: 'none' } as React.CSSProperties} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx2)', display: 'block', marginBottom: 6 }}>
                  {t('onb.bedtime')}
                </label>
                <input type="time" value={sleep} onChange={e => setSleep(e.target.value)}
                  style={{ display: 'block', width: '100%', boxSizing: 'border-box', fontSize: 18, padding: '14px 16px', WebkitAppearance: 'none', appearance: 'none' } as React.CSSProperties} />
              </div>
            </div>
          )}

          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input
                autoFocus
                placeholder={t('onb.taskPlaceholder')}
                value={taskTitle}
                onChange={e => setTaskTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && canNext() && handleNext()}
                style={{ display: 'block', width: '100%', boxSizing: 'border-box', fontSize: 15, padding: '12px 14px' }}
              />
              <div>
                <label style={{ fontSize: 11, color: 'var(--tx3)', display: 'block', marginBottom: 5 }}>{t('onb.taskDuration')}</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {[15, 30, 45, 60, 90].map(m => (
                    <button key={m} type="button" onClick={() => setTaskDuration(String(m))}
                      style={{
                        flex: 1, minWidth: 44, padding: '9px 6px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                        border: `1.5px solid ${taskDuration === String(m) ? 'var(--ind)' : 'var(--bdr2)'}`,
                        background: taskDuration === String(m) ? 'var(--ind-l)' : 'transparent',
                        color: taskDuration === String(m) ? 'var(--ind)' : 'var(--tx3)',
                        cursor: 'pointer', fontFamily: 'inherit',
                      }}>
                      {m}m
                    </button>
                  ))}
                </div>
              </div>
              <button
                className="btn btn-ghost"
                style={{ fontSize: 12, justifyContent: 'center', marginTop: 2 }}
                onClick={() => { setTaskTitle('​'); setTimeout(() => { setTaskTitle(''); handleNext(); }, 0); }}>
                {t('onb.skip')}
              </button>
            </div>
          )}

          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {['workout', 'deep work', 'reading', 'meditation', 'running'].map(preset => (
                  <button key={preset} onClick={() => setGoalCat(preset)}
                    style={{
                      padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                      border: `1.5px solid ${goalCat === preset ? 'var(--ind)' : 'var(--bdr2)'}`,
                      background: goalCat === preset ? 'var(--ind-l)' : 'transparent',
                      color: goalCat === preset ? 'var(--ind)' : 'var(--tx3)',
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}>
                    {preset}
                  </button>
                ))}
              </div>
              <input placeholder={t('onb.goalPlaceholder')} value={goalCat}
                onChange={e => setGoalCat(e.target.value)}
                style={{ display: 'block', width: '100%', boxSizing: 'border-box', fontSize: 14, padding: '11px 14px' }} />
              <div>
                <label style={{ fontSize: 11, color: 'var(--tx3)', display: 'block', marginBottom: 6 }}>
                  {t('onb.goalHours')}
                </label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[2, 3, 5, 6, 8, 10].map(h => (
                    <button key={h} onClick={() => setGoalHours(String(h))}
                      style={{
                        flex: 1, padding: '9px 4px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                        border: `1.5px solid ${goalHours === String(h) ? 'var(--ind)' : 'var(--bdr2)'}`,
                        background: goalHours === String(h) ? 'var(--ind-l)' : 'transparent',
                        color: goalHours === String(h) ? 'var(--ind)' : 'var(--tx3)',
                        cursor: 'pointer', fontFamily: 'inherit',
                      }}>
                      {h}h
                    </button>
                  ))}
                </div>
              </div>
              <button className="btn btn-ghost" style={{ fontSize: 12, justifyContent: 'center' }}
                onClick={onDone}>
                {t('onb.skip')}
              </button>
            </div>
          )}
        </div>

        {/* CTA button */}
        <button
          className="btn btn-primary"
          style={{
            width: '100%', maxWidth: 400,
            padding: '15px', fontSize: 15, fontWeight: 600,
            justifyContent: 'center',
            opacity: canNext() && !loading ? 1 : 0.5,
          }}
          onClick={handleNext}
          disabled={!canNext() || loading}>
          {loading
            ? '…'
            : step === STEPS.length - 1
              ? t('onb.lets')
              : t('onb.continue')}
        </button>
      </div>
    </div>
  );
}
