import { useState } from 'react';
import { useStore } from '../store';
import { useT } from '../lib/i18n';
import { Sunrise, Sun, Moon, Clock, Target, Battery } from 'lucide-react';
import type { PeakFocusTime } from '../types';
import { TaskIcon } from './ui/TaskIcon';

interface OnboardingProps {
  onDone: () => void;
}

// ── Habit packs — concrete presets for step 3 ─────────────────────
const HABIT_PACKS = [
  { icon: 'Dumbbell',  en: 'Fitness',    ru: 'Фитнес',         cat: 'workout',   mins: 180, color: '#5FA35F', hintEn: '3× / week', hintRu: '3× в нед.' },
  { icon: 'Monitor',   en: 'Deep Work',  ru: 'Глубокая работа', cat: 'deep work', mins: 600, color: '#4C5EE8', hintEn: '10h / week', hintRu: '10ч / нед.' },
  { icon: 'BookOpen',  en: 'Reading',    ru: 'Чтение',          cat: 'reading',   mins: 210, color: '#F0B429', hintEn: '30min / day', hintRu: '30мин / день' },
  { icon: 'Wind',      en: 'Mindfulness',ru: 'Медитация',       cat: 'meditation',mins: 120, color: '#8B5CF6', hintEn: '20min / day', hintRu: '20мин / день' },
  { icon: 'Activity',  en: 'Running',    ru: 'Бег',             cat: 'running',   mins: 150, color: '#EF6060', hintEn: '3× / week', hintRu: '3× в нед.' },
  { icon: 'Leaf',      en: 'Learning',   ru: 'Учёба',           cat: 'learning',  mins: 300, color: '#06B6D4', hintEn: '1h / day', hintRu: '1ч / день' },
];

const PEAK_TIMES: { key: PeakFocusTime; Icon: React.FC<{ size: number; color: string; strokeWidth: number }>; en: string; ru: string; hint: string }[] = [
  { key: 'morning',   Icon: Sunrise, en: 'Morning',   ru: 'Утро',   hint: '6–12' },
  { key: 'afternoon', Icon: Sun,     en: 'Afternoon', ru: 'День',   hint: '12–18' },
  { key: 'evening',   Icon: Moon,    en: 'Evening',   ru: 'Вечер',  hint: '18–22' },
];

export function Onboarding({ onDone }: OnboardingProps) {
  const t = useT();
  const { updateConfig, addTask, config } = useStore();
  const lang = config.language ?? 'en';

  const [step, setStep] = useState(0);
  const [wake, setWake] = useState('07:00');
  const [sleep, setSleep] = useState('23:00');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDuration, setTaskDuration] = useState('30');
  // Step 3
  const [selectedPacks, setSelectedPacks] = useState<string[]>(['workout', 'deep work']);
  const [peakTime, setPeakTime] = useState<PeakFocusTime>('morning');
  const [loading, setLoading] = useState(false);

  const STEPS = [
    { Icon: Clock,  title: t('onb.wake.title'), subtitle: t('onb.wake.subtitle') },
    { Icon: Target, title: t('onb.task.title'), subtitle: t('onb.task.subtitle') },
    { Icon: Battery, title: lang === 'ru' ? 'Твои привычки и ритм' : 'Your habits & rhythm', subtitle: lang === 'ru' ? 'Выбери что хочешь развивать и когда ты продуктивнее всего' : 'Pick what you want to build and when you do your best work' },
  ];

  const togglePack = (cat: string) => {
    setSelectedPacks(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

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
        // Save selected habit packs as category_goals
        const COLORS = ['#5FA35F', '#4C5EE8', '#EF6060', '#F0B429', '#8B5CF6', '#06B6D4'];
        const newGoals = selectedPacks
          .map(cat => HABIT_PACKS.find(p => p.cat === cat)!)
          .filter(Boolean)
          .filter(p => !config.category_goals.find(g => g.category === p.cat))
          .map((p, i) => ({
            category: p.cat,
            weekly_goal_minutes: p.mins,
            color: p.color ?? COLORS[i % COLORS.length],
          }));

        await updateConfig({
          category_goals: [...config.category_goals, ...newGoals],
          peak_focus_time: peakTime,
        });
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
          <div style={{ marginBottom: 8, textAlign: 'center', display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--ind-l)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <current.Icon size={26} color="var(--ind)" strokeWidth={1.8} />
            </div>
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, textAlign: 'center', letterSpacing: '-.3px', margin: '0 0 6px' }}>
            {current.title}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--tx3)', textAlign: 'center', lineHeight: 1.6, margin: '0 0 20px' }}>
            {current.subtitle}
          </p>

          {/* ── Step 0: Wake / Sleep ── */}
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

          {/* ── Step 1: First task ── */}
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

          {/* ── Step 2: Habits & Peak time ── */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Habit packs */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--tx3)', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 10 }}>
                  {lang === 'ru' ? 'Что хочешь развивать' : 'What to build'}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {HABIT_PACKS.map(p => {
                    const sel = selectedPacks.includes(p.cat);
                    return (
                      <button
                        key={p.cat}
                        type="button"
                        onClick={() => togglePack(p.cat)}
                        style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                          padding: '12px 12px 10px',
                          borderRadius: 14,
                          border: `2px solid ${sel ? p.color : 'var(--bdr2)'}`,
                          background: sel ? `${p.color}18` : 'var(--sf2)',
                          cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                          transition: 'border-color .15s, background .15s',
                          position: 'relative',
                        }}>
                        {sel && (
                          <div style={{
                            position: 'absolute', top: 8, right: 8,
                            width: 16, height: 16, borderRadius: '50%',
                            background: p.color,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 10, color: '#fff', fontWeight: 700,
                          }}>✓</div>
                        )}
                        <div style={{ width: 32, height: 32, borderRadius: 9, background: `${p.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
                          <TaskIcon name={p.icon} size={16} color={sel ? p.color : 'var(--tx3)'} strokeWidth={1.8} />
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 600, color: sel ? p.color : 'var(--tx)' }}>
                          {lang === 'ru' ? p.ru : p.en}
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--tx3)', marginTop: 2 }}>
                          {lang === 'ru' ? p.hintRu : p.hintEn}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Peak focus time */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--tx3)', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 10 }}>
                  {lang === 'ru' ? 'Когда ты продуктивнее' : 'Peak focus time'}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {PEAK_TIMES.map(pt => {
                    const sel = peakTime === pt.key;
                    return (
                      <button
                        key={pt.key}
                        type="button"
                        onClick={() => setPeakTime(pt.key)}
                        style={{
                          flex: 1,
                          padding: '10px 6px',
                          borderRadius: 12,
                          border: `2px solid ${sel ? 'var(--ind)' : 'var(--bdr2)'}`,
                          background: sel ? 'var(--ind-l)' : 'transparent',
                          cursor: 'pointer', fontFamily: 'inherit',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                        }}>
                        <pt.Icon size={20} color={sel ? 'var(--ind)' : 'var(--tx3)'} strokeWidth={1.8} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: sel ? 'var(--ind)' : 'var(--tx)' }}>
                          {lang === 'ru' ? pt.ru : pt.en}
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--tx3)' }}>{pt.hint}</span>
                      </button>
                    );
                  })}
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
