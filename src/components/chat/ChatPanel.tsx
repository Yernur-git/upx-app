import { useState, useRef, useEffect } from 'react';
import { Send, X, Bot, Undo2, Settings2 } from 'lucide-react';
import { useStore } from '../../store';
import { sendChatMessage } from '../../lib/ai';
import { useT } from '../../lib/i18n';
import { track } from '../../lib/analytics';

// ── Simple markdown renderer for assistant messages ───────────────
function parseBold(text: string): React.ReactNode {
  const parts = text.split(/\*\*([^*]+)\*\*/g);
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i} style={{ fontWeight: 700 }}>{part}</strong> : part
  );
}

function MsgContent({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <>
      {lines.map((line, i) => {
        if (/^###? /.test(line)) {
          const content = line.replace(/^###? /, '');
          return (
            <div key={i} style={{ fontWeight: 700, fontSize: 13, marginTop: i > 0 ? 10 : 0, marginBottom: 2 }}>
              {parseBold(content)}
            </div>
          );
        }
        if (line.startsWith('- ') || line.startsWith('• ')) {
          return (
            <div key={i} style={{ display: 'flex', gap: 6, marginTop: 3, alignItems: 'flex-start' }}>
              <span style={{ flexShrink: 0, opacity: 0.6, marginTop: 1 }}>•</span>
              <span>{parseBold(line.slice(2))}</span>
            </div>
          );
        }
        if (line.trim() === '') return <div key={i} style={{ height: 6 }} />;
        return <div key={i} style={{ marginTop: i > 0 && lines[i-1]?.trim() !== '' ? 2 : 0 }}>{parseBold(line)}</div>;
      })}
    </>
  );
}

export function ChatPanel() {
  const t = useT();
  const { chatOpen, setChatOpen, chatMessages, addChatMessage, applyActions, undoLastAI, aiUndoSnapshot, tasks, config, apiKey, customBaseURL, customModel, useDefaultKey, activeChatDay, setActivePanel, pendingChatInput, setPendingChatInput, dayHistory } = useStore();
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isTyping]);

  useEffect(() => {
    if (chatOpen) inputRef.current?.focus();
  }, [chatOpen]);

  // Auto-send pending message (e.g. weekly review) when chat opens
  useEffect(() => {
    if (chatOpen && pendingChatInput) {
      const msg = pendingChatInput;
      setPendingChatInput('');
      sendText(msg);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatOpen, pendingChatInput]);

  const [retryText, setRetryText] = useState<string | null>(null);

  // Words that indicate AI claims to have taken action
  const claimsAction = (msg: string) =>
    /переношу|добавляю|удаляю|изменяю|перемещаю|поставлю|обновлю|создаю|готово|сделал|сделано|выполнено|перенёс|добавил|удалил|изменил|обновил|I['']ll|I will|I('ve| have) (moved|added|deleted|updated|created|scheduled)|adding|moving|creating|deleting|updating|done\b|scheduled|completed/i.test(msg);

  const sendText = async (text: string) => {
    if (!text || isTyping) return;
    setInput('');
    setRetryText(null);

    addChatMessage({ role: 'user', content: text });
    track('ai_chat_sent', { day: activeChatDay, message_length: text.length });
    setIsTyping(true);

    try {
      const result = await sendChatMessage(text, chatMessages, tasks, config, apiKey, activeChatDay, customBaseURL, customModel, useDefaultKey, dayHistory);

      let applied = 0;
      if (result.actions.length > 0) {
        applied = await applyActions(result.actions);
      }

      // Show retry if:
      // 1. Actions were returned but none could be applied (ID mismatch etc.)
      // 2. AI claimed to do something but sent no actions at all
      const actionsFailed   = result.actions.length > 0 && applied === 0;
      const claimedNothing  = result.actions.length === 0 && claimsAction(result.message);
      if (actionsFailed || claimedNothing) {
        setRetryText(text);
      }

      addChatMessage({
        role: 'assistant',
        content: result.message,
        actions: applied > 0 ? result.actions.slice(0, applied) : [],
      });
    } catch (err) {
      addChatMessage({
        role: 'assistant',
        content: t('chat.error', { err: err instanceof Error ? err.message : 'Unknown error' }),
        actions: [],
      });
    } finally {
      setIsTyping(false);
    }
  };

  const send = () => sendText(input.trim());

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const HINTS = config.language === 'ru'
    ? ['монтаж 60мин', 'тренировка 60мин', 'построй мой день', 'я перегружен, помоги']
    : ['edit video 60min', 'workout 60min', 'build my day', "I'm overloaded, help"];

  return (
    <>
      <div className={`chat-panel ${chatOpen ? '' : 'hidden'}`}>
        {/* Header */}
        <div style={{
          padding: '14px 16px', borderBottom: '1px solid var(--bdr)',
          display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'var(--ind-l)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Bot size={16} color="var(--ind)" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{t('chat.title')}</div>
            <div style={{ fontSize: 11, color: 'var(--tx3)' }}>{t('chat.subtitle')}</div>
          </div>
          <button className="btn-icon" title={config.language === 'ru' ? 'Настройки AI' : 'AI settings'} onClick={() => { setChatOpen(false); setActivePanel('profile'); }}>
            <Settings2 size={15} />
          </button>
          <button className="btn-icon" onClick={() => setChatOpen(false)}>
            <X size={15} />
          </button>
        </div>

        {aiUndoSnapshot && (
          <div style={{
            padding: '8px 14px', background: 'var(--ind-l)',
            borderBottom: '1px solid var(--ind-m)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            fontSize: 12, color: 'var(--ind)', flexShrink: 0,
          }}>
            <span>{t('chat.aiChanged')}</span>
            <button
              className="btn btn-ghost"
              style={{ fontSize: 11, padding: '3px 10px', color: 'var(--ind)', borderColor: 'var(--ind-m)', gap: 4 }}
              onClick={async () => {
                await undoLastAI();
                addChatMessage({ role: 'assistant', content: t('chat.undone'), actions: [] });
              }}>
              <Undo2 size={11} /> {t('chat.undo')}
            </button>
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 4px', display: 'flex', flexDirection: 'column', gap: 10 }}>

          {chatMessages.length === 0 && (
            <div style={{ textAlign: 'center', padding: '24px 16px' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>✨</div>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>{t('chat.hi')}</div>
              <div style={{ fontSize: 12, color: 'var(--tx3)', lineHeight: 1.6 }}>
                {t('chat.hiDesc')}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 14 }}>
                {HINTS.map(h => (
                  <button key={h} className="btn btn-ghost" style={{ fontSize: 11, padding: '5px 10px' }}
                    onClick={() => setInput(h)}>
                    {h}
                  </button>
                ))}
              </div>
            </div>
          )}

          {chatMessages.map(msg => (
            <div key={msg.id} style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}>
              <div style={{
                maxWidth: '82%',
                padding: '9px 13px',
                borderRadius: msg.role === 'user'
                  ? 'var(--r) var(--r) 4px var(--r)'
                  : 'var(--r) var(--r) var(--r) 4px',
                background: msg.role === 'user' ? 'var(--ind)' : 'var(--sf2)',
                color: msg.role === 'user' ? '#fff' : 'var(--tx)',
                fontSize: 13,
                lineHeight: 1.6,
              }}>
                {msg.role === 'assistant'
                  ? <MsgContent text={msg.content} />
                  : msg.content}
                {msg.actions && msg.actions.length > 0 && (
                  <div style={{ marginTop: 6, fontSize: 11, opacity: 0.7 }}>
                    {t('chat.actionsApplied', { n: msg.actions.length })}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Retry banner — shown when actions failed to apply */}
          {retryText && !isTyping && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
              padding: '10px 14px', borderRadius: 12,
              background: 'var(--must-l, #fff8e1)',
              border: '1px solid var(--must, #e0a800)',
            }}>
              <div style={{ fontSize: 12, color: 'var(--must, #b7890a)', fontWeight: 500, lineHeight: 1.4 }}>
                ⚠️ {config.language === 'ru'
                  ? 'Действие не применилось'
                  : 'Action didn\'t apply'}
              </div>
              <button
                onClick={() => sendText(retryText!)}
                style={{
                  fontSize: 12, padding: '6px 14px', borderRadius: 20, flexShrink: 0,
                  background: 'var(--must, #b7890a)', color: '#fff',
                  border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
                }}>
                {config.language === 'ru' ? 'Повторить' : 'Retry'}
              </button>
            </div>
          )}

          {isTyping && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{
                padding: '6px 14px',
                borderRadius: 'var(--r) var(--r) var(--r) 4px',
                background: 'var(--sf2)',
                minHeight: 32,
                display: 'flex',
                alignItems: 'center',
              }}>
                <span className="typing-dots">
                  <span /><span /><span />
                </span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <div style={{
          padding: '10px 12px', borderTop: '1px solid var(--bdr)',
          display: 'flex', gap: 8, flexShrink: 0,
        }}>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={t('chat.placeholder')}
            style={{ flex: 1, fontSize: 13, padding: '9px 12px' }}
            disabled={isTyping}
          />
          <button className="btn btn-primary" style={{ padding: '9px 12px' }}
            onClick={send} disabled={isTyping || !input.trim()}>
            <Send size={14} />
          </button>
        </div>
      </div>
    </>
  );
}
