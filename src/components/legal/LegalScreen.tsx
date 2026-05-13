import { useState } from 'react';
import { X } from 'lucide-react';
import { useStore } from '../../store';

type Tab = 'privacy' | 'terms';

export function LegalScreen({ initial = 'privacy', onClose }: { initial?: Tab; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>(initial);
  const lang = useStore(s => s.config.language ?? 'en');
  const isRu = lang === 'ru';

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,.55)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
      onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 540, maxHeight: '90vh',
          background: 'var(--sf)',
          borderRadius: '20px 20px 0 0',
          border: '1px solid var(--bdr2)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: 'var(--shd2)',
        }}>

        {/* Header with tabs */}
        <div style={{
          display: 'flex', alignItems: 'center',
          padding: '14px 16px 0',
          borderBottom: '1px solid var(--bdr)',
          gap: 8,
        }}>
          <div style={{ display: 'flex', gap: 4, flex: 1 }}>
            {(['privacy', 'terms'] as Tab[]).map(k => (
              <button
                key={k}
                onClick={() => setTab(k)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
                  padding: '8px 12px 14px',
                  color: tab === k ? 'var(--tx)' : 'var(--tx3)',
                  borderBottom: tab === k ? '2px solid var(--ind)' : '2px solid transparent',
                  marginBottom: -1,
                }}>
                {isRu
                  ? (k === 'privacy' ? 'Конфиденциальность' : 'Условия')
                  : (k === 'privacy' ? 'Privacy' : 'Terms')}
              </button>
            ))}
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, color: 'var(--tx3)', marginBottom: 6 }}
            aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{
          flex: 1, overflowY: 'auto',
          padding: '18px 20px 28px',
          fontSize: 13, lineHeight: 1.65, color: 'var(--tx2)',
        }}>
          {tab === 'privacy' ? (isRu ? <PrivacyRu /> : <PrivacyEn />) : (isRu ? <TermsRu /> : <TermsEn />)}
        </div>
      </div>
    </div>
  );
}

// ── Style helpers ───────────────────────────────────────────────────────
const h2Style: React.CSSProperties = { fontSize: 16, fontWeight: 700, color: 'var(--tx)', marginTop: 18, marginBottom: 8 };
const pStyle: React.CSSProperties = { marginBottom: 10 };
const liStyle: React.CSSProperties = { marginBottom: 4 };

// ── Privacy (EN) ────────────────────────────────────────────────────────
function PrivacyEn() {
  return (
    <div>
      <p style={{ ...pStyle, color: 'var(--tx3)' }}>Last updated: 2026</p>

      <p style={pStyle}>
        UpX is a personal daily planner. We try to collect as little data as possible — only what we need to make the app work for you.
      </p>

      <h2 style={h2Style}>What we collect</h2>
      <ul>
        <li style={liStyle}><b>Account:</b> your email address. Optionally a name and phone if you fill them in.</li>
        <li style={liStyle}><b>Your data:</b> tasks, schedule, daily check-ins, AI chat history, focus sessions, weekly stats. This is yours — we only store it so you can see it across devices.</li>
        <li style={liStyle}><b>Push subscriptions:</b> if you enable notifications, your browser's push endpoint and timezone offset.</li>
        <li style={liStyle}><b>Anonymous analytics (PostHog):</b> which screens you open, button clicks, errors. Used to fix bugs and improve the app. No personal content from your tasks or AI chats is sent.</li>
      </ul>

      <h2 style={h2Style}>What we don't collect</h2>
      <ul>
        <li style={liStyle}>No location.</li>
        <li style={liStyle}>No contact list, microphone, or camera (unless you tap the mic button, which uses your browser's speech API locally).</li>
        <li style={liStyle}>No payment info — there's nothing to pay for yet.</li>
        <li style={liStyle}>No ads, no ad tracking, no third-party trackers.</li>
      </ul>

      <h2 style={h2Style}>Where it's stored</h2>
      <p style={pStyle}>
        Supabase (Postgres database, hosted in EU). Row-Level Security policies make sure only you can read your rows.
      </p>

      <h2 style={h2Style}>Third parties</h2>
      <ul>
        <li style={liStyle}><b>AI provider</b> (Anthropic, OpenAI, OpenRouter, or Groq — depending on which key is configured): receives your AI chat messages and a system prompt summarising your tasks. They process this to generate replies. We don't store conversations beyond your chat history shown in the app.</li>
        <li style={liStyle}><b>ElevenLabs:</b> receives the text of AI replies for voice synthesis, only if you turn on voice output.</li>
        <li style={liStyle}><b>Web Push (Apple/Google):</b> when you enable notifications, the browser's push service delivers them.</li>
        <li style={liStyle}><b>PostHog:</b> anonymous product analytics.</li>
      </ul>

      <h2 style={h2Style}>Your rights</h2>
      <ul>
        <li style={liStyle}><b>Export:</b> contact us and we'll send you a JSON of everything we have.</li>
        <li style={liStyle}><b>Delete:</b> deleting your account removes all your tasks, history, and chat. Email/auth records are removed within 30 days.</li>
        <li style={liStyle}><b>Withdraw consent:</b> sign out, disable push, or stop using the app at any time.</li>
      </ul>

      <h2 style={h2Style}>Children</h2>
      <p style={pStyle}>UpX is not directed to children under 13. We don't knowingly collect their data.</p>

      <h2 style={h2Style}>Contact</h2>
      <p style={pStyle}>Questions? Bug reports? Email <a href="mailto:hello@upx.app" style={{ color: 'var(--ind)' }}>hello@upx.app</a>.</p>
    </div>
  );
}

// ── Privacy (RU) ────────────────────────────────────────────────────────
function PrivacyRu() {
  return (
    <div>
      <p style={{ ...pStyle, color: 'var(--tx3)' }}>Обновлено: 2026</p>

      <p style={pStyle}>
        UpX — это личный планировщик дня. Мы собираем минимум данных — только то, что нужно для работы приложения.
      </p>

      <h2 style={h2Style}>Что мы собираем</h2>
      <ul>
        <li style={liStyle}><b>Аккаунт:</b> ваш email. По желанию — имя и телефон.</li>
        <li style={liStyle}><b>Ваши данные:</b> задачи, расписание, чекины, история чата с ИИ, фокус-сессии, недельная статистика. Это всё ваше — мы храним только чтобы вы видели это на всех устройствах.</li>
        <li style={liStyle}><b>Push-подписки:</b> если включаете уведомления — endpoint браузера и смещение часового пояса.</li>
        <li style={liStyle}><b>Анонимная аналитика (PostHog):</b> какие экраны открываете, клики, ошибки. Помогает чинить баги. Содержимое задач и чатов туда не уходит.</li>
      </ul>

      <h2 style={h2Style}>Что мы НЕ собираем</h2>
      <ul>
        <li style={liStyle}>Геолокация.</li>
        <li style={liStyle}>Контакты, микрофон, камера (микрофон работает локально через браузер только когда вы сами нажимаете кнопку).</li>
        <li style={liStyle}>Платёжные данные — платить пока не за что.</li>
        <li style={liStyle}>Никакой рекламы и сторонних трекеров.</li>
      </ul>

      <h2 style={h2Style}>Где хранится</h2>
      <p style={pStyle}>
        Supabase (Postgres в ЕС). Row-Level Security гарантирует, что ваши строки можете читать только вы.
      </p>

      <h2 style={h2Style}>Третьи стороны</h2>
      <ul>
        <li style={liStyle}><b>Провайдер ИИ</b> (Anthropic / OpenAI / OpenRouter / Groq — какой настроен): получает ваши сообщения и системный промпт со сводкой задач. Обрабатывает и возвращает ответ. Мы не храним диалоги нигде, кроме истории чата в самом приложении.</li>
        <li style={liStyle}><b>ElevenLabs:</b> получает текст ответов ИИ для озвучки — только если вы включили голосовой режим.</li>
        <li style={liStyle}><b>Web Push (Apple / Google):</b> доставляют уведомления когда вы их включаете.</li>
        <li style={liStyle}><b>PostHog:</b> анонимная аналитика.</li>
      </ul>

      <h2 style={h2Style}>Ваши права</h2>
      <ul>
        <li style={liStyle}><b>Экспорт:</b> напишите нам и мы пришлём JSON со всеми вашими данными.</li>
        <li style={liStyle}><b>Удаление:</b> удаление аккаунта стирает все задачи, историю и чат. Auth-записи удаляются в течение 30 дней.</li>
        <li style={liStyle}><b>Отзыв согласия:</b> выйти из аккаунта, отключить push или перестать пользоваться — в любой момент.</li>
      </ul>

      <h2 style={h2Style}>Дети</h2>
      <p style={pStyle}>UpX не предназначен для детей младше 13 лет. Мы не собираем их данные сознательно.</p>

      <h2 style={h2Style}>Контакты</h2>
      <p style={pStyle}>Вопросы или баги? Пишите <a href="mailto:hello@upx.app" style={{ color: 'var(--ind)' }}>hello@upx.app</a>.</p>
    </div>
  );
}

// ── Terms (EN) ──────────────────────────────────────────────────────────
function TermsEn() {
  return (
    <div>
      <p style={{ ...pStyle, color: 'var(--tx3)' }}>Last updated: 2026</p>

      <p style={pStyle}>
        Using UpX means you agree to these terms. They're short on purpose.
      </p>

      <h2 style={h2Style}>The deal</h2>
      <p style={pStyle}>
        UpX is provided as-is for personal use. We try to keep it running and bug-free but don't guarantee uptime, accuracy, or data preservation. Back up anything important.
      </p>

      <h2 style={h2Style}>AI is not advice</h2>
      <p style={pStyle}>
        The AI assistant gives suggestions about planning your day. It's not medical, legal, financial, or psychological advice. Don't act on AI suggestions for serious decisions without thinking for yourself.
      </p>

      <h2 style={h2Style}>Your responsibility</h2>
      <ul>
        <li style={liStyle}>Don't try to break the app — no scraping, automated abuse, or trying to bypass rate limits.</li>
        <li style={liStyle}>Don't share illegal content via AI chat.</li>
        <li style={liStyle}>Keep your password safe. We can't recover it if you lose access to your email.</li>
      </ul>

      <h2 style={h2Style}>Changes</h2>
      <p style={pStyle}>
        We may update these terms or discontinue the service. If we make a major change, we'll notify you in the app.
      </p>

      <h2 style={h2Style}>Liability</h2>
      <p style={pStyle}>
        To the extent allowed by law, our liability is limited to what you paid us — which is zero. We're not responsible for missed tasks, bad days, or anything the AI got wrong.
      </p>

      <h2 style={h2Style}>Contact</h2>
      <p style={pStyle}><a href="mailto:hello@upx.app" style={{ color: 'var(--ind)' }}>hello@upx.app</a></p>
    </div>
  );
}

// ── Terms (RU) ──────────────────────────────────────────────────────────
function TermsRu() {
  return (
    <div>
      <p style={{ ...pStyle, color: 'var(--tx3)' }}>Обновлено: 2026</p>

      <p style={pStyle}>
        Пользуясь UpX, вы соглашаетесь с этими условиями. Они короткие специально.
      </p>

      <h2 style={h2Style}>Суть</h2>
      <p style={pStyle}>
        UpX предоставляется «как есть» для личного использования. Мы стараемся чтобы он работал без ошибок, но не гарантируем 100% uptime, точность или сохранность данных. Делайте бэкапы важного.
      </p>

      <h2 style={h2Style}>ИИ — не совет</h2>
      <p style={pStyle}>
        ИИ-ассистент предлагает идеи для планирования дня. Это не медицинский, юридический, финансовый или психологический совет. Не принимайте серьёзные решения, опираясь только на ответ ИИ — думайте сами.
      </p>

      <h2 style={h2Style}>Ваша ответственность</h2>
      <ul>
        <li style={liStyle}>Не пытайтесь сломать приложение — никакого скрейпинга, автоматического злоупотребления, обхода лимитов.</li>
        <li style={liStyle}>Не отправляйте незаконный контент через ИИ-чат.</li>
        <li style={liStyle}>Берегите пароль. Если потеряете доступ к email — восстановить не сможем.</li>
      </ul>

      <h2 style={h2Style}>Изменения</h2>
      <p style={pStyle}>
        Мы можем обновлять эти условия или закрыть сервис. При серьёзных изменениях — уведомим внутри приложения.
      </p>

      <h2 style={h2Style}>Ответственность</h2>
      <p style={pStyle}>
        В рамках разрешённого законом, наша ответственность ограничена тем, что вы нам заплатили — то есть нулём. Мы не отвечаем за пропущенные задачи, плохие дни или ошибки ИИ.
      </p>

      <h2 style={h2Style}>Контакты</h2>
      <p style={pStyle}><a href="mailto:hello@upx.app" style={{ color: 'var(--ind)' }}>hello@upx.app</a></p>
    </div>
  );
}
