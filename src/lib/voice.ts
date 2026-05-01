// ── Voice I/O utilities ────────────────────────────────────────────
// STT: Web Speech API (SpeechRecognition) — Chrome, Safari, Edge, PWA
// TTS: Web Speech Synthesis API — all modern browsers

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
  rec.continuous = false;
  rec.interimResults = true;
  rec.maxAlternatives = 1;
  rec.lang = lang === 'ru' ? 'ru-RU' : 'en-US';

  rec.onresult = (e: any) => {
    let interim = '';
    let final = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const text = e.results[i][0].transcript;
      if (e.results[i].isFinal) final += text;
      else interim += text;
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

// Eagerly load voices as soon as the module is imported.
// Chrome loads voices asynchronously; we cache them so speak() stays synchronous.
let cachedVoices: SpeechSynthesisVoice[] = [];

function loadVoices() {
  const v = window.speechSynthesis?.getVoices() ?? [];
  if (v.length) cachedVoices = v;
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  loadVoices();
  window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
}

function pickVoice(langPrefix: string): SpeechSynthesisVoice | null {
  // Re-check in case they loaded since last time
  if (!cachedVoices.length) loadVoices();
  const voices = cachedVoices;
  return (
    voices.find(v => v.lang.startsWith(langPrefix) && v.localService) ??
    voices.find(v => v.lang.startsWith(langPrefix)) ??
    null
  );
}

// Strip markdown / symbols before speaking
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
 * Speak text via the browser's Speech Synthesis API.
 * MUST stay synchronous — iOS/Safari blocks audio if there's an await
 * between the user gesture and the speak() call.
 */
export function speak(
  text: string,
  lang: 'en' | 'ru',
  onEnd?: () => void,
): void {
  if (!isSpeechOutputSupported()) { onEnd?.(); return; }

  const clean = stripMarkdown(text);
  if (!clean) { onEnd?.(); return; }

  // Cancel any ongoing speech first
  window.speechSynthesis.cancel();

  const utt = new SpeechSynthesisUtterance(clean);
  utt.lang   = lang === 'ru' ? 'ru-RU' : 'en-US';
  utt.rate   = 1.0;
  utt.pitch  = 1.0;
  utt.volume = 1.0;

  const voice = pickVoice(lang === 'ru' ? 'ru' : 'en');
  if (voice) utt.voice = voice;

  utt.onend   = () => onEnd?.();
  utt.onerror = () => onEnd?.();

  // Chrome bug: synthesis pauses when tab goes to background — resume it
  if (window.speechSynthesis.paused) window.speechSynthesis.resume();

  window.speechSynthesis.speak(utt);
}

export function stopSpeaking(): void {
  window.speechSynthesis?.cancel();
}

export function isSpeaking(): boolean {
  return window.speechSynthesis?.speaking ?? false;
}
