import { useState } from 'react';
import { Moon, Zap, Smile, Wind, Crosshair, Activity, Sun, X } from 'lucide-react';
import { useStore } from '../store';
import type { DayCheckin, CheckinMood } from '../types';

interface Props {
  onDone: () => void;
}

const ENERGY_LEVELS = [
  { val: 1 as const, labelEn: 'Empty',   labelRu: 'Никак',  color: '#ff4444', bg: '#fff4f4', bgDk: '#3a1010' },
  { val: 2 as const, labelEn: 'Low',     labelRu: 'Слабо',  color: '#ff9500', bg: '#fff8f0', bgDk: '#3a2010' },
  { val: 3 as const, labelEn: 'Ok',      labelRu: 'Норм',   color: '#ffcc00', bg: '#fffce0', bgDk: '#383010' },
  { val: 4 as const, labelEn: 'Good',    labelRu: 'Бодро',  color: '#34c759', bg: '#f0faf0', bgDk: '#0e2a10' },
  { val: 5 as const, labelEn: 'Peak',    labelRu: 'Пик',    color: '#30d158', bg: '#e8f8e8', bgDk: '#0a2010' },
];

const MOODS: Array<{ key: CheckinMood; labelEn: string; labelRu: string; subEn: string; subRu: string; color: string; bg: string; bgDk: string; Icon: React.FC<{ size: number; color: string; strokeWidth: number }> }> = [
  { key: 'calm',     labelEn: 'Calm',    labelRu: 'Спокойно', subEn: 'Relaxed',     subRu: 'Расслаблен',   color: '#5C6B9C', bg: '#eef0ff', bgDk: '#1a2040', Icon: Wind },
  { key: 'focused',  labelEn: 'Focused', labelRu: 'Фокус',    subEn: 'Ready to go', subRu: 'Готов к работе',color: '#cc8800', bg: '#fff8e8', bgDk: '#2a1e08', Icon: Crosshair },
  { key: 'stressed', labelEn: 'Stressed',labelRu: 'Стресс',   subEn: 'Tense',       subRu: 'Напряжённо',   color: '#ef4444', bg: '#fff0f0', bgDk: '#2a1010', Icon: Activity },
  { key: 'sick',     labelEn: 'Sick',    labelRu: 'Болею',    subEn: 'Need rest',   subRu: 'Нужен отдых',  color: '#22c55e', bg: '#f0faf0', bgDk: '#0e2010', Icon: Sun },
];

const SLEEP_OPTIONS = [4, 5, 6, 7, 8, 9];

export function MorningCheckin({ onDone }: Props) {
  const { config, setCheckin } = useStore();
  const lang = config.language ?? 'en';
  const isDark = config.theme === 'dark';

  const now = new Date();
  const dateStr = now.toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  const hour = now.getHours();
  const greetingText = lang === 'ru'
    ? (hour < 12 ? 'Доброе утро' : hour < 17 ? 'Добрый день' : 'Добрый вечер')
    : (hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening');

  const [sleep, setSleep] = useState(7);
  const [energy, setEnergy] = useState<1|2|3|4|5>(3);
  const [mood, setMood] = useState<CheckinMood>('calm');
  const [note, setNote] = useState('');

  const handleDone = () => {
    const checkin: DayCheckin = { sleep_hours: sleep, energy, mood, note: note.trim() || undefined };
    setCheckin(checkin);
    onDone();
  };

  const sf = isDark ? '#2c2c2e' : '#fff';
  const sf2 = isDark ? '#3a3a3c' : '#f2f2f7';
  const tx = isDark ? '#e5e5ea' : '#1c1c1e';
  const tx3 = isDark ? '#636366' : '#8e8e93';
  const hdrBg = isDark
    ? 'linear-gradient(170deg,#000 0%,#0d1030 60%,#141c48 100%)'
    : 'linear-gradient(170deg,#0d0d1a 0%,#1a2050 60%,#243070 100%)';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      background: isDark ? '#1c1c1e' : '#f2f2f7',
      display: 'flex', flexDirection: 'column',
      overflowY: 'auto', WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'],
    }}>
      {/* Header */}
      <div style={{
        background: hdrBg,
        padding: 'max(env(safe-area-inset-top,0px) + 48px, 56px) 28px 36px',
        color: '#fff', flexShrink: 0, position: 'relative',
      }}>
        <button
          onClick={onDone}
          style={{ position: 'absolute', top: 'max(env(safe-area-inset-top,0px) + 12px, 20px)', right: 18, background: 'rgba(255,255,255,.15)', border: 'none', borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}>
          <X size={15} strokeWidth={2.5} />
        </button>
        <div style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,.45)', letterSpacing: '.04em', marginBottom: 10 }}>
          {dateStr}
        </div>
        <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-.7px', lineHeight: 1.12, marginBottom: 8 }}>
          {greetingText}
        </div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,.5)', lineHeight: 1.55 }}>
          {lang === 'ru'
            ? 'Расскажи как ты — AI подберёт нагрузку под твоё состояние'
            : 'Tell me how you feel — AI will adjust your plan accordingly'}
        </div>
      </div>

      {/* Cards */}
      <div style={{ padding: '18px 16px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* Sleep */}
        <Card sf={sf} isDark={isDark}>
          <CardHead Icon={Moon} iconBg={isDark ? '#1a2040' : '#eef2ff'} iconColor="#5C6B9C"
            title={lang === 'ru' ? 'Сон' : 'Sleep'} />
          <div style={{ display: 'flex', background: sf2, borderRadius: 12, padding: 3, gap: 2 }}>
            {SLEEP_OPTIONS.map(h => (
              <button key={h} onClick={() => setSleep(h)} style={{
                flex: 1, padding: '9px 0', borderRadius: 9, border: 'none',
                fontSize: 13, fontWeight: 600,
                background: sleep === h ? sf : 'transparent',
                color: sleep === h ? tx : tx3,
                cursor: 'pointer', fontFamily: 'inherit',
                boxShadow: sleep === h ? '0 1px 4px rgba(0,0,0,.12)' : 'none',
                transition: 'all .15s ease',
              }}>
                {h}{lang === 'ru' ? 'ч' : 'h'}
              </button>
            ))}
          </div>
        </Card>

        {/* Energy */}
        <Card sf={sf} isDark={isDark}>
          <CardHead Icon={Zap} iconBg={isDark ? '#302810' : '#fff8e0'} iconColor="#cc9900"
            title={lang === 'ru' ? 'Энергия' : 'Energy'} />
          <div style={{ display: 'flex', gap: 6 }}>
            {ENERGY_LEVELS.map(e => {
              const active = energy === e.val;
              return (
                <button key={e.val} onClick={() => setEnergy(e.val)} style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                  gap: 7, padding: '12px 4px 10px', borderRadius: 14, border: 'none',
                  background: active ? (isDark ? e.bgDk : e.bg) : sf2,
                  cursor: 'pointer', fontFamily: 'inherit',
                  boxShadow: active ? '0 4px 14px rgba(0,0,0,.1)' : 'none',
                  transition: 'all .15s ease',
                }}>
                  <div style={{
                    width: active ? 14 : 10, height: active ? 14 : 10, borderRadius: '50%',
                    background: e.color, transition: 'all .15s ease',
                  }} />
                  <span style={{
                    fontSize: 10, fontWeight: 700,
                    color: active ? e.color : tx3, lineHeight: 1,
                    transition: 'color .15s ease',
                  }}>
                    {lang === 'ru' ? e.labelRu : e.labelEn}
                  </span>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Mood */}
        <Card sf={sf} isDark={isDark}>
          <CardHead Icon={Smile} iconBg={isDark ? '#20183a' : '#f0eeff'} iconColor="#6644cc"
            title={lang === 'ru' ? 'Настроение' : 'Mood'} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {MOODS.map(m => {
              const active = mood === m.key;
              return (
                <button key={m.key} onClick={() => setMood(m.key)} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                  gap: 10, padding: '14px 14px 13px', borderRadius: 16, border: 'none',
                  background: active ? (isDark ? m.bgDk : m.bg) : sf2,
                  cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                  boxShadow: active ? '0 4px 16px rgba(0,0,0,.1)' : 'none',
                  transition: 'all .15s ease', position: 'relative',
                }}>
                  {active && (
                    <div style={{
                      position: 'absolute', top: 9, right: 10,
                      fontSize: 11, fontWeight: 800, color: m.color, opacity: .7,
                    }}>✓</div>
                  )}
                  <div style={{
                    width: 32, height: 32, borderRadius: 9,
                    background: isDark ? (active ? m.bgDk : '#2c2c2e') : (active ? m.bg : '#e8e8ef'),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: active ? `1.5px solid ${m.color}33` : 'none',
                  }}>
                    <m.Icon size={17} color={active ? m.color : tx3} strokeWidth={1.8} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: active ? m.color : tx, lineHeight: 1 }}>
                      {lang === 'ru' ? m.labelRu : m.labelEn}
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 500, color: tx3, marginTop: 3, lineHeight: 1 }}>
                      {lang === 'ru' ? m.subRu : m.subEn}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Note */}
        <div style={{ background: sf, borderRadius: 20, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder={lang === 'ru' ? 'Что важно сегодня? (необязательно)' : 'Anything important today? (optional)'}
            rows={2}
            style={{
              width: '100%', border: 'none', outline: 'none',
              background: 'transparent', padding: '14px 18px',
              fontSize: 14, fontFamily: 'inherit', color: tx,
              resize: 'none', lineHeight: 1.6, display: 'block',
            }}
          />
        </div>
      </div>

      {/* CTA */}
      <div style={{ padding: '16px 16px max(env(safe-area-inset-bottom,0px) + 16px, 24px)', marginTop: 'auto' }}>
        <button
          onClick={onDone}
          style={{
            display: 'block', width: '100%', textAlign: 'center',
            padding: '14px', border: 'none',
            fontSize: 14, fontWeight: 500, color: tx3,
            background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
            marginBottom: 8,
          }}>
          {lang === 'ru' ? 'Пропустить' : 'Skip'}
        </button>
        <button
          onClick={handleDone}
          style={{
            width: '100%', padding: '17px', borderRadius: 17, border: 'none',
            background: isDark ? '#fff' : '#1c1c1e',
            color: isDark ? '#1c1c1e' : '#fff',
            fontSize: 16, fontWeight: 700, fontFamily: 'inherit',
            cursor: 'pointer', letterSpacing: '-.2px',
            boxShadow: isDark ? '0 4px 20px rgba(0,0,0,.5)' : '0 4px 20px rgba(0,0,0,.2)',
          }}>
          {lang === 'ru' ? 'Начать день' : 'Start my day'}
        </button>
      </div>
    </div>
  );
}

function Card({ children, sf, isDark }: { children: React.ReactNode; sf: string; isDark: boolean }) {
  return (
    <div style={{
      background: sf, borderRadius: 20, padding: '18px 18px 16px',
      boxShadow: isDark
        ? '0 1px 3px rgba(0,0,0,.3),0 0 0 .5px rgba(255,255,255,.04)'
        : '0 1px 3px rgba(0,0,0,.06),0 4px 16px rgba(0,0,0,.04)',
    }}>
      {children}
    </div>
  );
}

function CardHead({ Icon, iconBg, iconColor, title }: {
  Icon: React.FC<{ size: number; color: string; strokeWidth: number }>;
  iconBg: string; iconColor: string; title: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
      <div style={{ width: 28, height: 28, borderRadius: 8, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={15} color={iconColor} strokeWidth={2} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx)', letterSpacing: '-.1px' }}>{title}</span>
    </div>
  );
}
