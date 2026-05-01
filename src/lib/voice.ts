// ── Voice I/O utilities ────────────────────────────────────────────
// STT: Web Speech API — Chrome, Safari, Edge, PWA
// TTS: Web Speech Synthesis — all modern browsers

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

// ── STT ───────────────────────────────────────────────────────────
export function isSpeechInputSupported(): boolean {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export interface SpeechRecognizer {
  start: () => void;
  stop: () => void;
  abort: () => void;
}

export function createSpeechRecognizer(
  lang: 'en' | 'ru',
  onInterim: (text: string) => void,
  onFinal: (text: string) => void,
  onEnd: () => void,
  onError: (err: string) => void,
): SpeechRecognizer | null {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;

  const rec = new SR();
  rec.continuous      = false;
  rec.interimResults  = true;
  rec.maxAlternatives = 1;
  rec.lang = lang === 'ru' ? 'ru-RU' : 'en-US';

  rec.onresult = (e: any) => {
    let interim = '';
    let final   = '';
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

// ── TTS ───────────────────────────────────────────────────────────
export function isSpeechOutputSupported(): boolean {
  return 'speechSynthesis' in window;
}

// Eagerly cache voices — Chrome loads them async via voiceschanged.
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

/**
 * Unlock speech synthesis on iOS/Safari.
 * Must be called SYNCHRONOUSLY inside a user-gesture handler (e.g. button click).
 * After this, subsequent speak() calls work even after async operations.
 */
export function unlockSpeechSynthesis(): void {
  if (!isSpeechOutputSupported()) return;
  // Speak + immediately cancel an empty utterance to "unlock" the audio context.
  const utt = new SpeechSynthesisUtterance('');
  utt.volume = 0;
  window.speechSynthesis.speak(utt);
  // Cancel after a tick — the unlock effect persists for the session.
  setTimeout(() => window.speechSynthesis.cancel(), 0);
}

/**
 * Speak text. Can be called after async operations IF unlockSpeechSynthesis()
 * was called first in a synchronous gesture handler.
 *
 * Chrome bug: calling speak() immediately after cancel() is sometimes silently
 * swallowed. We use a short setTimeout to work around it.
 */
export function speak(
  text: string,
  lang: 'en' | 'ru',
  onEnd?: () => void,
): void {
  if (!isSpeechOutputSupported()) { onEnd?.(); return; }

  const clean = stripMarkdown(text);
  if (!clean) { onEnd?.(); return; }

  window.speechSynthesis.cancel();

  const utt      = new SpeechSynthesisUtterance(clean);
  utt.lang       = lang === 'ru' ? 'ru-RU' : 'en-US';
  utt.rate       = 1.0;
  utt.pitch      = 1.0;
  utt.volume     = 1.0;
  utt.onend      = () => onEnd?.();
  utt.onerror    = () => onEnd?.();

  const voice = pickVoice(lang === 'ru' ? 'ru' : 'en');
  if (voice) utt.voice = voice;

  // setTimeout fixes Chrome's cancel() → immediate speak() silent-drop bug.
  // 50 ms is imperceptible to the user.
  setTimeout(() => {
    if (window.speechSynthesis.paused) window.speechSynthesis.resume();
    window.speechSynthesis.speak(utt);
  }, 50);
}

export function stopSpeaking(): void {
  window.speechSynthesis?.cancel();
}
