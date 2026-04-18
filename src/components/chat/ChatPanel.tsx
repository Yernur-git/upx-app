import { useState, useRef, useEffect } from 'react';
import { Send, X, Bot, Sparkles } from 'lucide-react';
import { useStore } from '../../store';
import { sendChatMessage } from '../../lib/ai';

export function ChatPanel() {
  const { chatOpen, setChatOpen, chatMessages, addChatMessage, applyActions, tasks, config, apiKey } = useStore();
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
      if (!apiKey) {
        addChatMessage({
          role: 'assistant',
          content: '⚙️ Please add your Anthropic API key in Settings to use the AI assistant.',
          actions: [],
        });
        return;
      }

      const result = await sendChatMessage(text, chatMessages, tasks, config, apiKey);
      addChatMessage({ role: 'assistant', content: result.message, actions: result.actions });

      if (result.actions.length > 0) {
        await applyActions(result.actions);
      }
    } catch (err) {
      addChatMessage({
        role: 'assistant',
        content: `Something went wrong: ${err instanceof Error ? err.message : 'Unknown error'}`,
        actions: [],
      });
    } finally {
      setIsTyping(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const HINTS = [
    'edit video 60min',
    'workout 60min',
    'build my day',
    'I\'m overloaded, help',
  ];

  return (
    <>
      {/* FAB */}
      <button className="chat-fab" onClick={() => setChatOpen(!chatOpen)} title="AI Assistant">
        {chatOpen ? <X size={20} /> : <Sparkles size={20} />}
      </button>

      {/* Panel */}
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
            <div style={{ fontSize: 14, fontWeight: 600 }}>UpX AI</div>
            <div style={{ fontSize: 11, color: 'var(--tx3)' }}>Plan smarter, not harder</div>
          </div>
          <button className="btn-icon" onClick={() => setChatOpen(false)}>
            <X size={15} />
          </button>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 4px', display: 'flex', flexDirection: 'column', gap: 10 }}>

          {chatMessages.length === 0 && (
            <div style={{ textAlign: 'center', padding: '24px 16px' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>✨</div>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Hi! I'm your day planner.</div>
              <div style={{ fontSize: 12, color: 'var(--tx3)', lineHeight: 1.6 }}>
                Tell me what you need to do today and I'll build your schedule.
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
                    ✓ {msg.actions.length} action{msg.actions.length !== 1 ? 's' : ''} applied
                  </div>
                )}
              </div>
            </div>
          ))}

          {isTyping && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{
                padding: '10px 14px', borderRadius: 'var(--r) var(--r) var(--r) 4px',
                background: 'var(--sf2)', fontSize: 18, letterSpacing: 2,
              }}>
                <span style={{ animation: 'pulse 1.2s ease-in-out infinite' }}>•••</span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{
          padding: '10px 12px', borderTop: '1px solid var(--bdr)',
          display: 'flex', gap: 8, flexShrink: 0,
        }}>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="edit video 60min or ask anything…"
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
