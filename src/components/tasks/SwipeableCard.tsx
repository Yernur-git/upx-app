import { useRef, useState } from 'react';
import { Trash2, ArrowRight } from 'lucide-react';

interface SwipeableCardProps {
  onDelete: () => void;
  onMove: () => void;
  moveLabel?: string;
  children: React.ReactNode;
  disabled?: boolean;
}

const SWIPE_THRESHOLD = 60;
const MAX_SWIPE = 130;

export function SwipeableCard({ onDelete, onMove, moveLabel = 'Tomorrow', children, disabled }: SwipeableCardProps) {
  const [offset, setOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const directionLocked = useRef<'horizontal' | 'vertical' | null>(null);

  // Close swipe when drag starts (disabled becomes true)
  if (disabled && (revealed || offset !== 0)) {
    setRevealed(false);
    setOffset(0);
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled) return;
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    directionLocked.current = null;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (disabled || !isDragging) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;

    // Lock direction on first significant movement
    if (!directionLocked.current) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        directionLocked.current = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
      }
      return;
    }

    if (directionLocked.current === 'vertical') return;

    // Only allow left swipe (negative dx)
    if (dx > 0 && !revealed) return;

    const newOffset = revealed
      ? Math.max(-MAX_SWIPE, Math.min(0, -MAX_SWIPE + dx))
      : Math.max(-MAX_SWIPE, Math.min(0, dx));

    setOffset(newOffset);
    e.preventDefault();
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    directionLocked.current = null;

    if (Math.abs(offset) > SWIPE_THRESHOLD) {
      setRevealed(true);
      setOffset(-MAX_SWIPE);
    } else {
      setRevealed(false);
      setOffset(0);
    }
  };

  const closeSwipe = () => {
    setRevealed(false);
    setOffset(0);
  };

  const ACTION_W = 64;

  return (
    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 10 }}>
      {/* Action buttons — hidden during DnD drag */}
      <div style={{
        position: 'absolute', right: 0, top: 0, bottom: 0,
        display: 'flex', alignItems: 'stretch',
        width: MAX_SWIPE,
        visibility: disabled ? 'hidden' : 'visible',
        pointerEvents: disabled ? 'none' : 'auto',
      }}>
        {/* Move button */}
        <button
          onClick={() => { closeSwipe(); onMove(); }}
          style={{
            width: ACTION_W, border: 'none', cursor: 'pointer',
            background: 'var(--ind)', color: '#fff',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 3, fontSize: 10, fontWeight: 600, fontFamily: 'inherit',
          }}>
          <ArrowRight size={16} />
          {moveLabel}
        </button>

        {/* Delete button */}
        <button
          onClick={() => { closeSwipe(); onDelete(); }}
          style={{
            flex: 1, border: 'none', cursor: 'pointer',
            background: 'var(--coral)', color: '#fff',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 3, fontSize: 10, fontWeight: 600, fontFamily: 'inherit',
            borderRadius: '0 10px 10px 0',
          }}>
          <Trash2 size={16} />
          Delete
        </button>
      </div>

      {/* Card — slides left to reveal actions */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={revealed ? closeSwipe : undefined}
        style={{
          transform: `translateX(${offset}px)`,
          transition: isDragging ? 'none' : 'transform .25s cubic-bezier(.4,0,.2,1)',
          position: 'relative', zIndex: 1,
          willChange: 'transform',
        }}>
        {children}
      </div>
    </div>
  );
}