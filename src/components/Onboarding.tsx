import { useState } from 'react';
import { useStore } from '../store';

interface OnboardingProps {
  onDone: () => void;
}

const STEPS = [
  {
    emoji: '⏰',
    title: "When do you wake up?",
    subtitle: "We'll build your schedule around your day.",
  },
  {
    emoji: '🎯',
    title: "What's your first task?",
    subtitle: "Add one thing you want to get done today.",
  },
  {
    emoji: '📊',
    title: "Set a weekly goal",
    subtitle: "Track progress on things that matter to you.",
  },
];

export function Onboarding({ onDone }: OnboardingProps) {
  const { updateConfig, addTask, config } = useStore();
  const [step, setStep] = useState(0);
  const [wake, setWake] = useState('07:00');
  const [sleep, setSleep] = useState('23:00');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDuration, setTaskDuration] = useState('30');
  const [goalCat, setGoalCat] = useState('workout');
  const [goalHours, setGoalHours] = useState('6');

  const canNext = () => {
    if (step === 1 && !taskTitle.trim()) return false;
    return true;
  };

  const handleNext = async () => {
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
  };

  const current = STEPS[step];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 8000,
      background: 'var(--bg)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '24px 20px',
    }}>
      {/* Progress dots */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 40 }}>
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
        width: '100%', maxWidth: 380,
        background: 'var(--sf)', borderRadius: 24,
        border: '1px solid var(--bdr2)', padding: '36px 28px',
        boxShadow: 'var(--shd2)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      }}>
        <div style={{ fontSize: 52, marginBottom: 8 }}>{current.emoji}</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, textAlign: 'center', letterSpacing: '-.3px' }}>
          {current.title}
        </h1>
        <p style={{ fontSize: 14, color: 'var(--tx3)', textAlign: 'center', lineHeight: 1.6, marginBottom: 16 }}>
          {current.subtitle}
        </p>

        {/* Step 0 — Wake/Sleep time */}
        {step === 0 && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx2)', display: 'block', marginBottom: 6 }}>
                Wake up
              </label>
              <input type="time" value={wake} onChange={e => setWake(e.target.value)}
                style={{ fontSize: 16, padding: '12px 14px', textAlign: 'center' }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx2)', display: 'block', marginBottom: 6 }}>
                Bedtime
              </label>
              <input type="time" value={sleep} onChange={e => setSleep(e.target.value)}
                style={{ fontSize: 16, padding: '12px 14px', textAlign: 'center' }} />
            </div>
          </div>
        )}

        {/* Step 1 — First task */}
        {step === 1 && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input
              autoFocus
              placeholder="e.g. Morning workout, Deep work session…"
              value={taskTitle}
              onChange={e => setTaskTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && canNext() && handleNext()}
              style={{ fontSize: 15, padding: '12px 14px' }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: 'var(--tx3)', display: 'block', marginBottom: 5 }}>Duration (min)</label>
                <input type="number" value={taskDuration} min="5"
                  onChange={e => setTaskDuration(e.target.value)}
                  style={{ fontSize: 14, padding: '10px 12px' }} />
              </div>
            </div>
            <button
              className="btn btn-ghost"
              style={{ fontSize: 13, justifyContent: 'center' }}
              onClick={() => { setTaskTitle(''); handleNext(); }}>
              Skip for now
            </button>
          </div>
        )}

        {/* Step 2 — Weekly goal */}
        {step === 2 && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Quick presets */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
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
            <input placeholder="Or type your own category…" value={goalCat}
              onChange={e => setGoalCat(e.target.value)}
              style={{ fontSize: 14, padding: '11px 14px' }} />
            <div>
              <label style={{ fontSize: 11, color: 'var(--tx3)', display: 'block', marginBottom: 5 }}>
                Weekly goal (hours)
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
            <button className="btn btn-ghost" style={{ fontSize: 13, justifyContent: 'center' }}
              onClick={onDone}>
              Skip for now
            </button>
          </div>
        )}
      </div>

      {/* Next button */}
      <button
        className="btn btn-primary"
        style={{
          marginTop: 24, width: '100%', maxWidth: 380,
          padding: '15px', fontSize: 15, fontWeight: 600,
          justifyContent: 'center',
          opacity: canNext() ? 1 : 0.5,
        }}
        onClick={handleNext}
        disabled={!canNext()}>
        {step === STEPS.length - 1 ? "Let's go 🚀" : 'Continue'}
      </button>
    </div>
  );
}
