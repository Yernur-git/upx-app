import { useEffect, useState } from 'react';

export function SplashScreen({ onDone }: { onDone: () => void }) {
  const [visible, setVisible] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const [gone, setGone] = useState(false);
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    const t0 = requestAnimationFrame(() => setVisible(true));
    const t1 = setTimeout(() => setFadeOut(true), 1600);
    const t2 = setTimeout(() => {
      setGone(true);
      try { sessionStorage.setItem('splashShown', 'true'); } catch { /* ok */ }
      onDone();
    }, 2000);
    return () => { cancelAnimationFrame(t0); clearTimeout(t1); clearTimeout(t2); };
  }, [onDone]);

  if (gone) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'var(--bg)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      opacity: fadeOut ? 0 : 1,
      transition: 'opacity .4s ease',
    }}>
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
        opacity: visible ? 1 : 0,
        transform: visible ? 'scale(1) translateY(0)' : 'scale(0.88) translateY(12px)',
        transition: 'opacity .5s ease, transform .5s cubic-bezier(.34,1.56,.64,1)',
      }}>
        {/* Try PNG logo first, fallback to SVG icon */}
        {!logoError ? (
          <img
            src="/logo.png"
            alt="UpX"
            style={{ height: 80, width: 'auto', objectFit: 'contain' }}
            onError={() => setLogoError(true)}
          />
        ) : (
          /* Fallback SVG icon */
          <div style={{
            width: 80, height: 80, borderRadius: 24,
            background: 'var(--ind)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 32px rgba(76,94,232,.35)',
          }}>
            <svg viewBox="0 0 48 48" width="44" height="44" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M14 32 L24 12 L34 32" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M18 26 L30 26" stroke="white" strokeWidth="4" strokeLinecap="round"/>
              <path d="M32 20 L40 12 M40 12 L40 20 M40 12 L32 12" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        )}

        <div style={{
          fontSize: 15, fontWeight: 700, letterSpacing: '.12em',
          textTransform: 'uppercase', color: 'var(--ind)',
          opacity: logoError ? 1 : 0, // only show text if logo failed
        }}>
          {logoError && 'UpX'}
        </div>
      </div>
    </div>
  );
}
