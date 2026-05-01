import {
  Dumbbell, Monitor, Calendar, BookOpen, Wind, Footprints,
  Activity, Leaf, Zap, Sunrise, Sun, Moon, Target, Battery,
  Flame, Brain, Heart, Coffee, Bike, PersonStanding, Sparkles,
  Clock, Pencil, Music, ShoppingCart, Home, Briefcase,
} from 'lucide-react';
import type { LucideProps } from 'lucide-react';

const ICON_MAP: Record<string, React.FC<LucideProps>> = {
  Dumbbell, Monitor, Calendar, BookOpen, Wind, Footprints,
  Activity, Leaf, Zap, Sunrise, Sun, Moon, Target, Battery,
  Flame, Brain, Heart, Coffee, Bike, PersonStanding, Sparkles,
  Clock, Pencil, Music, ShoppingCart, Home, Briefcase,
};

interface TaskIconProps {
  name: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

/**
 * Renders a Lucide icon if `name` matches a known icon name,
 * otherwise falls back to rendering `name` as text (supports legacy emoji values).
 */
export function TaskIcon({ name, size = 18, color = 'currentColor', strokeWidth = 1.8 }: TaskIconProps) {
  const Icon = ICON_MAP[name];
  if (Icon) {
    return <Icon size={size} color={color} strokeWidth={strokeWidth} />;
  }
  // Fallback: render as emoji / text
  return <span style={{ fontSize: size * 0.9, lineHeight: 1 }}>{name}</span>;
}

export const LUCIDE_ICON_NAMES = Object.keys(ICON_MAP);
