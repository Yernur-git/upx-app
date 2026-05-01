// ── Voice I/O utilities ────────────────────────────────────────────
// STT : Web Speech API — Chrome, Safari, Edge, PWA
// TTS : /api/tts proxy → ElevenLabs (key stays server-side)
//       Fallback: Web Speech API if proxy unavailable

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

// ── STT ──────────────────────────────────────────────────────────
export function isSpeechInputSupported(): boolean {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export interface SpeechRecognizer {
  start: () => void;
  stop:  () => void;
  abort: () => void;
}

export function createSpeechRecognizer(
  lang: 'en' | 'ru',
  onInterim: (text: string) => void,
  onFinal:   (text: string) => void,
  onEnd:     () => void,
  onError:   (err: string) => void,
): SpeechRecognizer | null {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;

  const rec = new SR();
  rec.continuous      = false;
  rec.interimResults  = true;
  rec.maxAlternatives = 1;
  rec.lang = lang === 'ru' ? 'ru-RU' : 'en-US';

  rec.onresult = (e: any) => {
    let interim = '', final = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const txt = e.results[i][0].transcript;
      if (e.results[i].isFinal) final += txt;
      else interim += txt;
    }
    if (interim) onInterim(interim);
    if (final)   onFinal(final.trim());
  };
  rec.onerror = (e: any) => {
    if (e.error !== 'aborted' && e.error !== 'no-speech') onError(e.error);
    onEnd();
  };
  rec.onend = onEnd;

  return {
    start:  () => { try { rec.start(); } catch { /* already started */ } },
    stop:   () => { try { rec.stop();  } catch { /* already stopped */ } },
    abort:  () => { try { rec.abort(); } catch { /* already stopped */ } },
  };
}

// ── TTS ── ElevenLabs via /api/tts proxy ─────────────────────────
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^#{1,3} /gm, '')
    .replace(/^[-•] /gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`[^`]+`/g, '')
    .replace(/[⚠️✓★↩️]/gu, '')
    .trim();
}

let _elAudio: HTMLAudioElement | null = null;

/**
 * Speak via ElevenLabs through the /api/tts proxy.
 * The ElevenLabs API key never leaves the server.
 * Falls back to browser TTS if the proxy returns an error.
 *
 * @param authToken  Supabase JWT from the current session (for auth gate)
 */
export async function speakElevenLabs(
  text: string,
  lang: 'en' | 'ru',
  authToken: string | null,
  onEnd?: () => void,
): Promise<void> {
  stopSpeaking();

  const clean = stripMarkdown(text);
  if (!clean) { onEnd?.(); return; }

  try {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: JSON.stringify({ text: clean }),
    });

    if (!res.ok) {
      console.warn('[TTS proxy] error', res.status);
      // Fallback to browser voice
      speak(clean, lang, onEnd);
      return;
    }

    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const audio = new Audio(url);
    _elAudio = audio;

    audio.onended = () => { URL.revokeObjectURL(url); _elAudio = null; onEnd?.(); };
    audio.onerror = () => { URL.revokeObjectURL(url); _elAudio = null; speak(clean, lang, onEnd); };
    audio.play().catch(() => { speak(clean, lang, onEnd); });
  } catch (err) {
    console.warn('[TTS proxy] fetch failed', err);
    speak(clean, lang, onEnd);
  }
}

// ── TTS — Web Speech fallback ─────────────────────────────────────
export function isSpeechOutputSupported(): boolean {
  return 'speechSynthesis' in window;
}

let _voices: SpeechSynthesisVoice[] = [];
function refreshVoices() {
  const v = window.speechSynthesis?.getVoices() ?? [];
  if (v.length) _voices = v;
}
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  refreshVoices();
  window.speechSynthesis.addEventListener('voiceschanged', refreshVoices);
}

function pickVoice(prefix: string): SpeechSynthesisVoice | null {
  refreshVoices();
  return (
    _voices.find(v => v.lang.startsWith(prefix) && v.localService) ??
    _voices.find(v => v.lang.startsWith(prefix)) ??
    null
  );
}

/** Unlock iOS audio context — call synchronously in a button click handler */
export function unlockSpeechSynthesis(): void {
  if (!isSpeechOutputSupported()) return;
  const utt = new SpeechSynthesisUtterance('');
  utt.volume = 0;
  window.speechSynthesis.speak(utt);
  setTimeout(() => window.speechSynthesis.cancel(), 0);
}

export function speak(
  text: string,
  lang: 'en' | 'ru',
  onEnd?: () => void,
): void {
  if (!isSpeechOutputSupported()) { onEnd?.(); return; }

  const clean = stripMarkdown(text);
  if (!clean) { onEnd?.(); return; }

  window.speechSynthesis.cancel();

  const utt   = new SpeechSynthesisUtterance(clean);
  utt.lang    = lang === 'ru' ? 'ru-RU' : 'en-US';
  utt.rate    = 1.0;
  utt.pitch   = 1.0;
  utt.volume  = 1.0;
  utt.onend   = () => onEnd?.();
  utt.onerror = () => onEnd?.();

  const voice = pickVoice(lang === 'ru' ? 'ru' : 'en');
  if (voice) utt.voice = voice;

  setTimeout(() => {
    if (window.speechSynthesis.paused) window.speechSynthesis.resume();
    window.speechSynthesis.speak(utt);
  }, 50);
}

export function stopSpeaking(): void {
  if (_elAudio) {
    _elAudio.pause();
    _elAudio.src = '';
    _elAudio = null;
  }
  window.speechSynthesis?.cancel();
}
