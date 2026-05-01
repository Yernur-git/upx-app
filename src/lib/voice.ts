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
  // No lang set → browser auto-detects from the user's OS / browser language
  // This lets bilingual users speak in any language regardless of app language.

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

// Strip markdown before speaking
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^#{1,3} /gm, '')
    .replace(/^[-•] /gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`[^`]+`/g, '')
    .replace(/⚠️|✓|★|↩️/g, '')
    .trim();
}

// Get voices, waiting for voiceschanged if list is empty (Chrome async loading)
function getVoices(lang: string): Promise<SpeechSynthesisVoice | null> {
  return new Promise(resolve => {
    const pick = () => {
      const voices = window.speechSynthesis.getVoices();
      if (!voices.length) return null;
      // Prefer local (native) voice matching the language
      const local = voices.find(v => v.lang.startsWith(lang) && v.localService);
      const remote = voices.find(v => v.lang.startsWith(lang));
      return local ?? remote ?? null;
    };

    const immediate = pick();
    if (immediate !== null) { resolve(immediate); return; }

    // Voices not loaded yet — wait for event (Chrome)
    const onLoaded = () => {
      window.speechSynthesis.removeEventListener('voiceschanged', onLoaded);
      resolve(pick());
    };
    window.speechSynthesis.addEventListener('voiceschanged', onLoaded);
    // Fallback: if event never fires, resolve after 1s
    setTimeout(() => resolve(pick()), 1000);
  });
}

export async function speak(
  text: string,
  lang: 'en' | 'ru',
  onEnd?: () => void,
): Promise<void> {
  if (!isSpeechOutputSupported()) { onEnd?.(); return; }

  const clean = stripMarkdown(text);
  if (!clean) { onEnd?.(); return; }

  window.speechSynthesis.cancel();

  const utt = new SpeechSynthesisUtterance(clean);
  utt.lang   = lang === 'ru' ? 'ru-RU' : 'en-US';
  utt.rate   = 1.0;
  utt.pitch  = 1.0;
  utt.volume = 1.0;

  const voice = await getVoices(lang === 'ru' ? 'ru' : 'en');
  if (voice) utt.voice = voice;

  if (onEnd) utt.onend = onEnd;
  utt.onerror = () => onEnd?.();

  // Workaround: Chrome sometimes pauses speech synthesis in background tabs.
  // Resume before speaking.
  if (window.speechSynthesis.paused) window.speechSynthesis.resume();
  window.speechSynthesis.speak(utt);
}

export function stopSpeaking(): void {
  window.speechSynthesis?.cancel();
}

export function isSpeaking(): boolean {
  return window.speechSynthesis?.speaking ?? false;
}
