import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, X, Bot, Undo2, Settings2, Sparkles, Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { useStore } from '../../store';
import { sendChatMessage } from '../../lib/ai';
import { useT } from '../../lib/i18n';
import { track } from '../../lib/analytics';
import {
  isSpeechInputSupported, isSpeechOutputSupported,
  createSpeechRecognizer, speakElevenLabs, stopSpeaking, unlockSpeechSynthesis,
  type SpeechRecognizer,
} from '../../lib/voice';
import { supabase } from '../../lib/supabase';

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
  const {
    chatOpen, setChatOpen, chatMessages, addChatMessage, applyActions,
    undoLastAI, aiUndoSnapshot, tasks, config, apiKey, customBaseURL,
    customModel, useDefaultKey, activeChatDay, setActivePanel,
    pendingChatInput, setPendingChatInput, dayHistory, todayCheckin,
    todayMidEnergy, todayEveningMood,
  } = useStore();

  const lang = config.language ?? 'en';

  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Voice state ───────────────────────────────────────────────
  const [isListening, setIsListening]     = useState(false);
  const [ttsEnabled, setTtsEnabled]       = useState(false);
  const [isSpeakingNow, setIsSpeakingNow] = useState(false);
  const [interimText, setInterimText]     = useState('');
  const recognizerRef = useRef<SpeechRecognizer | null>(null);
  const hasStt = isSpeechInputSupported();
  const hasTts = isSpeechOutputSupported();

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

  // Stop TTS when chat closes
  useEffect(() => {
    if (!chatOpen) { stopSpeaking(); setIsSpeakingNow(false); }
  }, [chatOpen]);

  const [retryText, setRetryText] = useState<string | null>(null);

  const claimsAction = (msg: string) =>
    /\b(переношу|добавляю|удаляю|изменяю|перемещаю|поставлю|обновлю|создаю|перенёс|добавил|удалил|изменил|обновил)\b|I'(ll|ve) (moved|added|deleted|updated|created)|I will (move|add|delete|update|create)/i.test(msg);

  const sendText = useCallback(async (text: string) => {
    if (!text || isTyping) return;
    setInput('');
    setInterimText('');
    setRetryText(null);

    stopSpeaking();
    setIsSpeakingNow(false);

    addChatMessage({ role: 'user', content: text });
    track('ai_chat_sent', { day: activeChatDay, message_length: text.length });
    setIsTyping(true);

    try {
      const result = await sendChatMessage(
        text, chatMessages, tasks, config, apiKey, activeChatDay,
        customBaseURL, customModel, useDefaultKey, dayHistory,
        todayCheckin ?? undefined,
        todayMidEnergy ?? undefined,
        todayEveningMood ?? undefined,
      );

      let applied = 0;
      if (result.actions.length > 0) {
        applied = await applyActions(result.actions);
      }

      const actionsFailed  = result.actions.length > 0 && applied === 0;
      const claimedNothing = result.actions.length === 0 && claimsAction(result.message);
      if (actionsFailed || claimedNothing) setRetryText(text);

      addChatMessage({
        role: 'assistant',
        content: result.message,
        actions: applied > 0 ? result.actions.slice(0, applied) : [],
      });

      // Auto-speak AI response if TTS is enabled
      if (ttsEnabled && result.message) {
        setIsSpeakingNow(true);
        // Get current auth token for the /api/tts proxy auth gate
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token ?? null;
        // speakElevenLabs calls /api/tts proxy; falls back to browser TTS on error
        speakElevenLabs(result.message, lang, token, () => setIsSpeakingNow(false));
      }
    } catch (err) {
      addChatMessage({
        role: 'assistant',
        content: t('chat.error', { err: err instanceof Error ? err.message : 'Unknown error' }),
        actions: [],
      });
    } finally {
      setIsTyping(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTyping, chatMessages, tasks, config, apiKey, activeChatDay, customBaseURL, customModel, useDefaultKey, dayHistory, todayCheckin, todayMidEnergy, todayEveningMood, ttsEnabled, lang]);

  const send = () => sendText(input.trim());

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  // ── Voice input ───────────────────────────────────────────────
  // Tap to START recording → transcript fills input field
  // Tap again to STOP → user can edit → press Send manually
  const startListening = useCallback(() => {
    if (isTyping) return;
    stopSpeaking();
    setIsSpeakingNow(false);
    setInterimText('');

    const rec = createSpeechRecognizer(
      lang,
      // Interim: show live preview above input
      (interim) => setInterimText(interim),
      // Final: append to input field — user edits and sends manually
      (final) => {
        setInput(prev => {
          const joined = (prev.trim() ? prev.trim() + ' ' : '') + final;
          return joined;
        });
        setInterimText('');
      },
      // End: stop listening indicator
      () => { setIsListening(false); setInterimText(''); },
      // Error
      () => { setIsListening(false); setInterimText(''); },
    );

    if (!rec) return;
    recognizerRef.current = rec;
    rec.start();
    setIsListening(true);
    track('voice_input_start', {});
  }, [isTyping]);

  const stopListening = useCallback(() => {
    recognizerRef.current?.stop();
    recognizerRef.current = null;
    setIsListening(false);
    setInterimText('');
    // Focus input so user can edit / send
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) stopListening();
    else startListening();
  }, [isListening, startListening, stopListening]);

  const toggleTts = () => {
    const next = !ttsEnabled;
    setTtsEnabled(next);
    if (next) {
      // Unlock speech synthesis SYNCHRONOUSLY in this gesture handler.
      // iOS/Safari requires speechSynthesis.speak() to be called directly
      // inside a user interaction — once unlocked, later async calls work too.
      unlockSpeechSynthesis();
    } else {
      stopSpeaking();
      setIsSpeakingNow(false);
    }
  };

  const HINTS = lang === 'ru'
    ? ['обзор недели', 'построй мой день', 'я перегружен, помоги', 'тренировка 60мин']
    : ['week review', 'build my day', "I'm overloaded, help", 'workout 60min'];

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
            background: isListening ? 'rgba(239,96,96,.15)' : 'var(--ind-l)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background .2s',
          }}>
            {isListening
              ? <Mic size={16} color="var(--coral)" />
              : <Bot size={16} color="var(--ind)" />}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{t('chat.title')}</div>
            <div style={{ fontSize: 11, color: isListening ? 'var(--coral)' : isSpeakingNow ? 'var(--ind)' : 'var(--tx3)' }}>
              {isListening
                ? (lang === 'ru' ? 'Слушаю… (нажмите ещё раз чтобы остановить)' : 'Listening… (tap mic to stop)')
                : isSpeakingNow
                  ? (lang === 'ru' ? 'Говорю…' : 'Speaking…')
                  : t('chat.subtitle')}
            </div>
          </div>
          <button className="btn-icon" title={lang === 'ru' ? 'Настройки AI' : 'AI settings'} onClick={() => { setChatOpen(false); setActivePanel('profile'); }}>
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
              <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center' }}>
                <Sparkles size={28} color="var(--ind)" strokeWidth={1.5} />
              </div>
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

          {chatMessages.map((msg, idx) => (
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
                {/* Inline retry — shown only on last AI message when action failed */}
                {msg.role === 'assistant' && idx === chatMessages.length - 1 && retryText && !isTyping && (
                  <div style={{
                    marginTop: 8, paddingTop: 8,
                    borderTop: '1px solid rgba(255,255,255,.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                  }}>
                    <span style={{ fontSize: 11, opacity: 0.75 }}>
                      ⚠️ {lang === 'ru' ? 'Не применилось' : "Didn't apply"}
                    </span>
                    <button
                      onClick={() => sendText(retryText!)}
                      style={{
                        fontSize: 11, padding: '4px 12px', borderRadius: 20,
                        background: 'rgba(255,255,255,.2)', color: 'inherit',
                        border: '1px solid rgba(255,255,255,.25)',
                        cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
                        flexShrink: 0,
                      }}>
                      {lang === 'ru' ? 'Применить' : 'Apply'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Live interim voice transcript */}
          {interimText && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{
                maxWidth: '82%', padding: '9px 13px',
                borderRadius: 'var(--r) var(--r) 4px var(--r)',
                background: 'var(--coral)', color: '#fff', fontSize: 13,
                opacity: 0.55, fontStyle: 'italic',
              }}>
                {interimText}
              </div>
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

        {/* Input bar */}
        <div style={{
          padding: '10px 12px', borderTop: '1px solid var(--bdr)',
          display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center',
        }}>

          {/* TTS toggle */}
          {hasTts && (
            <button
              className="btn-icon"
              title={ttsEnabled
                ? (lang === 'ru' ? 'Выключить голос ИИ' : 'Mute AI voice')
                : (lang === 'ru' ? 'Включить голос ИИ' : 'Enable AI voice')}
              onClick={toggleTts}
              style={{
                color: ttsEnabled ? 'var(--ind)' : 'var(--tx3)',
                background: ttsEnabled ? 'var(--ind-l)' : 'transparent',
                borderRadius: 10, padding: 7, flexShrink: 0,
                position: 'relative',
              }}>
              {ttsEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              {/* Pulse dot while speaking */}
              {isSpeakingNow && (
                <span style={{
                  position: 'absolute', top: 3, right: 3,
                  width: 6, height: 6, borderRadius: '50%',
                  background: 'var(--ind)',
                  animation: 'voice-pulse 1s ease-in-out infinite',
                }} />
              )}
            </button>
          )}

          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={
              isListening
                ? (lang === 'ru' ? 'Говорите… нажмите микрофон ещё раз чтобы остановить' : 'Speak… tap mic again to stop')
                : t('chat.placeholder')
            }
            style={{ flex: 1, fontSize: 13, padding: '9px 12px' }}
            disabled={isTyping}
          />

          {/* Mic toggle button */}
          {hasStt && (
            <button
              className="btn-icon"
              title={isListening
                ? (lang === 'ru' ? 'Остановить запись' : 'Stop recording')
                : (lang === 'ru' ? 'Голосовой ввод' : 'Voice input')}
              onClick={toggleListening}
              disabled={isTyping}
              style={{
                color: isListening ? '#fff' : 'var(--tx3)',
                background: isListening ? 'var(--coral)' : 'transparent',
                borderRadius: 10, padding: 7, flexShrink: 0,
                animation: isListening ? 'mic-pulse 1.4s ease-in-out infinite' : 'none',
                transition: 'background .15s, color .15s',
              }}>
              {isListening ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
          )}

          <button className="btn btn-primary" style={{ padding: '9px 12px', flexShrink: 0 }}
            onClick={send} disabled={isTyping || !input.trim()}>
            <Send size={14} />
          </button>
        </div>
      </div>
    </>
  );
}
