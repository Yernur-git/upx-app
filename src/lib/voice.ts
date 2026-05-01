// ── Voice I/O utilities ────────────────────────────────────────────
// STT: Web Speech API (SpeechRecognition) — Chrome, Safari, Edge, PWA
// TTS: Web Speech Synthesis API — all modern browsers

// ── Type shims ────────────────────────────────────────────────────
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

  rec.onresult = (e: SpeechRecognitionEvent) => {
    let interim = '';
    let final = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) final += t;
      else interim += t;
    }
    if (interim) onInterim(interim);
    if (final)   onFinal(final.trim());
  };

  rec.onerror = (e: SpeechRecognitionErrorEvent) => {
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

// Strip markdown before speaking
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')   // bold
    .replace(/\*([^*]+)\*/g, '$1')        // italic
    .replace(/^#{1,3} /gm, '')            // headers
    .replace(/^- /gm, '')                 // bullets
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links
    .replace(/`[^`]+`/g, '')              // inline code
    .trim();
}

export function speak(
  text: string,
  lang: 'en' | 'ru',
  onEnd?: () => void,
): void {
  if (!isSpeechOutputSupported()) return;
  window.speechSynthesis.cancel();

  const clean = stripMarkdown(text);
  if (!clean) return;

  const utt = new SpeechSynthesisUtterance(clean);
  utt.lang  = lang === 'ru' ? 'ru-RU' : 'en-US';
  utt.rate  = 1.05;
  utt.pitch = 1.0;
  utt.volume = 1.0;

  // Pick best available voice for the language
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(v =>
    v.lang.startsWith(lang === 'ru' ? 'ru' : 'en') && v.localService
  ) || voices.find(v => v.lang.startsWith(lang === 'ru' ? 'ru' : 'en'));
  if (preferred) utt.voice = preferred;

  if (onEnd) utt.onend = onEnd;
  window.speechSynthesis.speak(utt);
}

export function stopSpeaking(): void {
  window.speechSynthesis?.cancel();
}

export function isSpeaking(): boolean {
  return window.speechSynthesis?.speaking ?? false;
}
