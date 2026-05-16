import { useState } from 'react';
import { CalendarDays, Sparkles, Target, Clock, Shield, Zap, ArrowRight, ChevronDown } from 'lucide-react';
import { AuthScreen } from './auth/AuthScreen';
import { LegalScreen } from './legal/LegalScreen';

interface Props {
  onAuth: (id: string, email: string) => void;
}

export function LandingPage({ onAuth }: Props) {
  const [showAuth, setShowAuth] = useState(false);
  const [legalTab, setLegalTab] = useState<'privacy' | 'terms' | null>(null);
  const isRu = /^ru\b/i.test(typeof navigator !== 'undefined' ? (navigator.language ?? '') : '');

  if (showAuth) return <AuthScreen onAuth={onAuth} />;

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', overflowX: 'hidden' }}>

      {/* ── NAV ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px',
        background: 'var(--bg)',
        borderBottom: '1px solid var(--bdr)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src="/logo.png" alt="UpX" style={{ height: 28 }}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: '.1em', color: 'var(--ind)' }}>UPX</span>
        </div>
        <button
          className="btn btn-ghost"
          style={{ fontSize: 13, padding: '8px 16px' }}
          onClick={() => setShowAuth(true)}>
          {isRu ? 'Войти' : 'Sign In'}
        </button>
      </nav>

      {/* ── HERO ── */}
      <section style={{
        padding: '56px 24px 48px',
        textAlign: 'center',
        maxWidth: 560,
        margin: '0 auto',
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '6px 14px', borderRadius: 99,
          background: 'var(--ind-l)', color: 'var(--ind)',
          fontSize: 12, fontWeight: 600, marginBottom: 20,
        }}>
          <Sparkles size={13} />
          {isRu ? 'AI-планировщик' : 'AI-powered planner'}
        </div>

        <h1 style={{
          fontSize: 'clamp(28px, 7vw, 42px)',
          fontWeight: 800,
          lineHeight: 1.15,
          letterSpacing: '-.02em',
          color: 'var(--tx)',
          marginBottom: 16,
        }}>
          {isRu
            ? <>Планируй день{' '}<span style={{ color: 'var(--ind)' }}>с AI</span></>
            : <>Plan your day{' '}<span style={{ color: 'var(--ind)' }}>with AI</span></>}
        </h1>

        <p style={{
          fontSize: 16, lineHeight: 1.65,
          color: 'var(--tx2)', maxWidth: 420,
          margin: '0 auto 28px',
        }}>
          {isRu
            ? 'Задачи, расписание, фокус-таймер и AI-ассистент — всё в одном приложении. Бесплатно.'
            : 'Tasks, schedule, focus timer, and AI assistant — all in one app. Free.'}
        </p>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            className="btn btn-primary"
            style={{ fontSize: 15, padding: '14px 28px', fontWeight: 700, gap: 8 }}
            onClick={() => setShowAuth(true)}>
            {isRu ? 'Начать бесплатно' : 'Get started free'}
            <ArrowRight size={16} />
          </button>
        </div>

        <button
          onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--tx3)', marginTop: 32,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            margin: '32px auto 0', fontSize: 12,
          }}>
          {isRu ? 'Подробнее' : 'Learn more'}
          <ChevronDown size={16} style={{ animation: 'bounce 2s infinite' }} />
        </button>
      </section>

      {/* ── SCREENSHOTS ── */}
      <section style={{
        padding: '0 20px 48px',
        display: 'flex', justifyContent: 'center', gap: 12,
        maxWidth: 600, margin: '0 auto',
      }}>
        <div style={{
          flex: 1, maxWidth: 260,
          borderRadius: 16, overflow: 'hidden',
          border: '1px solid var(--bdr2)',
          boxShadow: 'var(--shd2)',
        }}>
          <img src="/screenshot-plan.png" alt="UpX Plan view"
            style={{ width: '100%', display: 'block' }}
            onError={e => { (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }} />
        </div>
        <div style={{
          flex: 1, maxWidth: 260,
          borderRadius: 16, overflow: 'hidden',
          border: '1px solid var(--bdr2)',
          boxShadow: 'var(--shd2)',
        }}>
          <img src="/screenshot-stats.png" alt="UpX Stats view"
            style={{ width: '100%', display: 'block' }}
            onError={e => { (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }} />
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" style={{
        padding: '48px 20px',
        maxWidth: 600,
        margin: '0 auto',
      }}>
        <h2 style={{
          fontSize: 22, fontWeight: 700, textAlign: 'center',
          letterSpacing: '-.02em', marginBottom: 32,
        }}>
          {isRu ? 'Всё для продуктивного дня' : 'Everything for a productive day'}
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          <FeatureCard
            Icon={CalendarDays}
            title={isRu ? 'Задачи и расписание' : 'Tasks & Schedule'}
            desc={isRu
              ? 'Добавляй задачи текстом или голосом. AI построит таймлайн на день.'
              : 'Add tasks by text or voice. AI builds your daily timeline.'}
          />
          <FeatureCard
            Icon={Sparkles}
            title={isRu ? 'AI-ассистент' : 'AI Assistant'}
            desc={isRu
              ? 'Подскажет что делать, поможет спланировать и подведёт итоги дня.'
              : 'Suggests what to do, helps plan, and reviews your day.'}
          />
          <FeatureCard
            Icon={Target}
            title={isRu ? 'Фокус-таймер' : 'Focus Timer'}
            desc={isRu
              ? 'Pomodoro-таймер с трекингом прогресса по каждой задаче.'
              : 'Pomodoro timer with per-task progress tracking.'}
          />
          <FeatureCard
            Icon={Clock}
            title={isRu ? 'Утренние и вечерние ритуалы' : 'Morning & Evening Rituals'}
            desc={isRu
              ? 'Чекины настроения, утренний брифинг и вечерний разбор дня.'
              : 'Mood check-ins, morning briefing, and evening day review.'}
          />
        </div>
      </section>

      {/* ── TRUST ── */}
      <section style={{
        padding: '40px 20px 48px',
        maxWidth: 600,
        margin: '0 auto',
      }}>
        <div style={{
          background: 'var(--sf)',
          border: '1px solid var(--bdr2)',
          borderRadius: 18,
          padding: '28px 24px',
          boxShadow: 'var(--shd)',
        }}>
          <h3 style={{
            fontSize: 17, fontWeight: 700, textAlign: 'center',
            marginBottom: 20,
          }}>
            {isRu ? 'Почему UpX?' : 'Why UpX?'}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <TrustRow Icon={Zap}
              text={isRu ? 'Бесплатно. Без рекламы. Без подвоха.' : 'Free. No ads. No catch.'} />
            <TrustRow Icon={Shield}
              text={isRu ? 'Твои данные только твои — шифрование и Row-Level Security.' : 'Your data stays yours — encryption and Row-Level Security.'} />
            <TrustRow Icon={Sparkles}
              text={isRu ? 'AI не хранит твои разговоры. Приватность по умолчанию.' : 'AI doesn\'t store your conversations. Privacy by default.'} />
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section style={{
        padding: '32px 24px 56px',
        textAlign: 'center',
        maxWidth: 480,
        margin: '0 auto',
      }}>
        <h2 style={{
          fontSize: 24, fontWeight: 800,
          letterSpacing: '-.02em', marginBottom: 12,
        }}>
          {isRu ? 'Начни прямо сейчас' : 'Start planning today'}
        </h2>
        <p style={{ fontSize: 14, color: 'var(--tx2)', marginBottom: 24, lineHeight: 1.6 }}>
          {isRu
            ? 'Регистрация за 30 секунд. Никаких карт.'
            : 'Sign up in 30 seconds. No credit card.'}
        </p>
        <button
          className="btn btn-primary"
          style={{ fontSize: 15, padding: '14px 32px', fontWeight: 700, gap: 8 }}
          onClick={() => setShowAuth(true)}>
          {isRu ? 'Создать аккаунт' : 'Create account'}
          <ArrowRight size={16} />
        </button>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{
        borderTop: '1px solid var(--bdr)',
        padding: '20px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12,
        maxWidth: 600, margin: '0 auto',
      }}>
        <div style={{ fontSize: 12, color: 'var(--tx3)' }}>
          © {new Date().getFullYear()} UpX
        </div>
        <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
          <button
            onClick={() => setLegalTab('privacy')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx3)', fontSize: 12, fontFamily: 'inherit' }}>
            {isRu ? 'Конфиденциальность' : 'Privacy'}
          </button>
          <button
            onClick={() => setLegalTab('terms')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx3)', fontSize: 12, fontFamily: 'inherit' }}>
            {isRu ? 'Условия' : 'Terms'}
          </button>
          <a href="mailto:hurah492@gmail.com"
            style={{ color: 'var(--tx3)', textDecoration: 'none' }}>
            {isRu ? 'Контакты' : 'Contact'}
          </a>
        </div>
      </footer>

      {legalTab && <LegalScreen initial={legalTab} onClose={() => setLegalTab(null)} />}

      {/* Bounce animation for scroll indicator */}
      <style>{`
        @keyframes bounce {
          0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-6px); }
          60% { transform: translateY(-3px); }
        }
      `}</style>
    </div>
  );
}

/* ── Feature card ── */
function FeatureCard({ Icon, title, desc }: { Icon: React.ElementType; title: string; desc: string }) {
  return (
    <div style={{
      background: 'var(--sf)',
      border: '1px solid var(--bdr2)',
      borderRadius: 14,
      padding: '20px 18px',
      display: 'flex', flexDirection: 'column', gap: 10,
      transition: 'all .18s ease',
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 12,
        background: 'var(--ind-l)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={20} color="var(--ind)" strokeWidth={1.8} />
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)' }}>{title}</div>
      <div style={{ fontSize: 13, color: 'var(--tx2)', lineHeight: 1.55 }}>{desc}</div>
    </div>
  );
}

/* ── Trust row ── */
function TrustRow({ Icon, text }: { Icon: React.ElementType; text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{
        width: 32, height: 32, borderRadius: 10,
        background: 'var(--sage-l)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon size={16} color="var(--sage)" strokeWidth={2} />
      </div>
      <span style={{ fontSize: 13, color: 'var(--tx2)', lineHeight: 1.5 }}>{text}</span>
    </div>
  );
}
