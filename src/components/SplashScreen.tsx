import { useEffect, useState } from 'react';

// FIX: splash screen
export function SplashScreen({ onDone }: { onDone: () => void }) {
  const [logoVisible, setLogoVisible] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const t0 = requestAnimationFrame(() => setLogoVisible(true));
    const t1 = setTimeout(() => setFadeOut(true), 1600);
    const t2 = setTimeout(() => {
      setGone(true);
      try { sessionStorage.setItem('splashShown', 'true'); } catch { /* SSR safe */ }
      onDone();
    }, 2000);
    return () => { cancelAnimationFrame(t0); clearTimeout(t1); clearTimeout(t2); };
  }, [onDone]);

  if (gone) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: '#FBF8F5',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      transition: 'opacity 0.4s ease',
      opacity: fadeOut ? 0 : 1,
    }}>
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
        transition: 'opacity 0.6s ease, transform 0.6s ease',
        opacity: logoVisible ? 1 : 0,
        transform: logoVisible ? 'scale(1)' : 'scale(0.85)',
      }}>
        <svg viewBox="0 0 200 200" width="100" height="100" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="splashArrowGrad" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#2244CC" />
              <stop offset="100%" stopColor="#3B5FE8" />
            </linearGradient>
          </defs>
          {/* Flowing curved line — left half of infinity shape, light blue */}
          <path
            d="M 108 100 C 95 76, 58 52, 40 73 C 23 94, 36 130, 68 132 C 90 133, 106 116, 108 100"
            fill="none" stroke="#60B8FF" strokeWidth="9" strokeLinecap="round"
          />
          {/* Diagonal arrow — upper-right, dark blue gradient */}
          <line x1="52" y1="156" x2="146" y2="62" stroke="url(#splashArrowGrad)" strokeWidth="10" strokeLinecap="round" />
          {/* Arrowhead */}
          <polyline
            points="128,54 152,54 152,78"
            fill="none" stroke="url(#splashArrowGrad)" strokeWidth="10"
            strokeLinecap="round" strokeLinejoin="round"
          />
        </svg>
        <span style={{
          fontWeight: 700,
          color: '#2244CC',
          fontSize: '1.5rem',
          letterSpacing: '0.15em',
          fontFamily: "'DM Sans', sans-serif",
        }}>UPX</span>
      </div>
    </div>
  );
}
