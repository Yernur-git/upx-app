import { useEffect, useRef, useState } from 'react';

export function SplashScreen({ onDone }: { onDone: () => void }) {
  const [fadeOut, setFadeOut] = useState(false);
  const [gone, setGone] = useState(false);
  const doneRef = useRef(false);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    setFadeOut(true);
    setTimeout(() => {
      setGone(true);
      try { sessionStorage.setItem('splashShown', 'true'); } catch { /**/ }
      onDone();
    }, 400);
  };

  // Hard fallback — always fires after 4s no matter what
  useEffect(() => {
    const t = setTimeout(finish, 4000);
    return () => clearTimeout(t);
  }, []);

  if (gone) return null;

  return (
    <div
      onClick={finish}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#000',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: fadeOut ? 0 : 1,
        transition: 'opacity .4s ease',
        cursor: 'pointer',
      }}
    >
      <video
        src="/splash.mp4"
        autoPlay
        muted
        playsInline
        onEnded={finish}
        onError={finish}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    </div>
  );
}
