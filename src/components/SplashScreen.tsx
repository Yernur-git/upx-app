import { useEffect, useRef, useState } from 'react';

export function SplashScreen({ onDone }: { onDone: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [fadeOut, setFadeOut] = useState(false);
  const [gone, setGone] = useState(false);

  const finish = () => {
    setFadeOut(true);
    setTimeout(() => {
      setGone(true);
      try { sessionStorage.setItem('splashShown', 'true'); } catch { /* ok */ }
      onDone();
    }, 400);
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // When video ends → fade out
    video.addEventListener('ended', finish);

    // Fallback: if video fails to load or takes too long → skip after 3s
    const fallback = setTimeout(finish, 3000);

    return () => {
      video.removeEventListener('ended', finish);
      clearTimeout(fallback);
    };
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
        ref={videoRef}
        src="/splash.mp4"
        autoPlay
        muted
        playsInline
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />
    </div>
  );
}
