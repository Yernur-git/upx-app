import { useState, useRef, useEffect } from 'react';
import { Send, X, Bot, Undo2 } from 'lucide-react';
import { useStore } from '../../store';
import { sendChatMessage } from '../../lib/ai';
import { useT } from '../../lib/i18n';

export function ChatPanel() {
  const t = useT();
  const { chatOpen, setChatOpen, chatMessages, addChatMessage, applyActions, undoLastAI, aiUndoSnapshot, tasks, config, apiKey, customBaseURL, customModel, activeChatDay } = useStore();
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

  const send = async () => {
    const text = input.trim();
    if (!text || isTyping) return;
    setInput('');

    addChatMessage({ role: 'user', content: text });
    setIsTyping(true);

    try {
      const result = await sendChatMessage(text, chatMessages, tasks, config, apiKey, activeChatDay, customBaseURL, customModel);

      let applied = 0;
      if (result.actions.length > 0) {
        applied = await applyActions(result.actions);
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
                lineHeight: 1.55,
                whiteSpace: 'pre-wrap',
              }}>
                {msg.content}
                {msg.actions && msg.actions.length > 0 && (
                  <div style={{ marginTop: 6, fontSize: 11, opacity: 0.7 }}>
                    {t('chat.actionsApplied', { n: msg.actions.length })}
                  </div>
                )}
              </div>
            </div>
          ))}

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
