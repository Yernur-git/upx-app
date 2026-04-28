import { useState, useRef } from 'react';
import { Plus, Star, Trash2, CheckCircle, Circle, ArrowRight, GripVertical, Pencil, FileText, SlidersHorizontal } from 'lucide-react';
import {
  DndContext, closestCenter, PointerSensor, TouchSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useStore } from '../../store';
import { detectCategory, getAllCategories } from '../../lib/categories';
import { useT } from '../../lib/i18n';
import type { Task, Priority, Recurrence } from '../../types';
import { formatDuration } from '../../lib/scheduler';

export function TaskList() {
  const t = useT();
  const { tasks, updateTask, deleteTask, toggleDone, moveTask, reorderTasks, activeChatDay, setActiveChatDay } = useStore();
  const [showAdd, setShowAdd] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [isDraggingAny, setIsDraggingAny] = useState(false);
  const activeDay = activeChatDay;
  const setActiveDay = setActiveChatDay;

  const todayTasks = tasks.filter(t2 => t2.day === 'today');
  const tomorrowTasks = tasks.filter(t2 => t2.day === 'tomorrow');
  const displayTasks = activeDay === 'today' ? todayTasks : tomorrowTasks;

  const doneTasks = displayTasks.filter(t2 => t2.is_done).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const pendingTasks = displayTasks.filter(t2 => !t2.is_done).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = pendingTasks.map(t2 => t2.id);
    const oldIndex = ids.indexOf(active.id as string);
    const newIndex = ids.indexOf(over.id as string);
    reorderTasks(arrayMove(ids, oldIndex, newIndex));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '0 16px 32px' }}>
          <div style={{ width: '100%', maxWidth: 420, background: 'var(--sf)', borderRadius: 18, border: '1px solid var(--bdr2)', padding: '20px 18px', boxShadow: 'var(--shd2)' }}>
            <p style={{ fontSize: 14, textAlign: 'center', marginBottom: 16, color: 'var(--tx)', lineHeight: 1.5 }}>{t('task.deleteConfirm')}</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center', padding: '12px' }} onClick={() => setConfirmDelete(null)}>{t('task.cancel')}</button>
              <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center', padding: '12px', background: 'var(--coral)' }} onClick={() => { deleteTask(confirmDelete); setConfirmDelete(null); }}>{t('task.delete')}</button>
            </div>
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 4, padding: '0 18px 12px', flexShrink: 0 }}>
        {(['today', 'tomorrow'] as const).map(day => (
          <button key={day} className="btn btn-ghost"
            style={{ flex: 1, justifyContent: 'center', fontSize: 12, background: activeDay === day ? 'var(--ind-l)' : 'transparent', color: activeDay === day ? 'var(--ind)' : 'var(--tx3)', borderColor: activeDay === day ? 'var(--ind-m)' : 'var(--bdr2)' }}
            onClick={() => setActiveDay(day)}>
            {day === 'today' ? t('day.today') : t('day.tomorrow')}
            <span style={{ fontSize: 10, fontWeight: 700, background: activeDay === day ? 'var(--ind)' : 'var(--sf3)', color: activeDay === day ? '#fff' : 'var(--tx3)', padding: '1px 6px', borderRadius: 10, marginLeft: 4 }}>
              {(day === 'today' ? todayTasks : tomorrowTasks).filter(t2 => !t2.is_done).length}
            </span>
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 18px', minHeight: 0 }}>
        {pendingTasks.length === 0 && doneTasks.length === 0 && (
          <div className="empty-state" style={{ marginTop: 16 }}>
            <div className="empty-icon">
              {activeDay === 'today' ? '🗓️' : '🌅'}
            </div>
            <h3>{activeDay === 'today' ? t('task.empty.today.title') : t('task.empty.tomorrow.title')}</h3>
            <p>{activeDay === 'today' ? t('task.empty.today.desc') : t('task.empty.tomorrow.desc')}</p>
          </div>
        )}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={() => setIsDraggingAny(true)} onDragEnd={(event) => { setIsDraggingAny(false); handleDragEnd(event); }} onDragCancel={() => setIsDraggingAny(false)}>
          <SortableContext items={pendingTasks.map(t2 => t2.id)} strategy={verticalListSortingStrategy}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {pendingTasks.map(task => (
                <SortableTaskCard
                  key={task.id}
                  task={task}
                  isDraggingAny={isDraggingAny}
                  onToggle={() => toggleDone(task.id)}
                  onDelete={() => setConfirmDelete(task.id)}
                  onMove={() => moveTask(task.id, task.day === 'today' ? 'tomorrow' : 'today')}
                  onStar={() => updateTask(task.id, { is_starred: !task.is_starred })} />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {doneTasks.length > 0 && (
          <>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--tx3)', margin: '16px 0 8px' }}>
              {t('task.done')} · {doneTasks.length}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, opacity: 0.55 }}>
              {doneTasks.map(task => (
                <SortableTaskCard key={task.id} task={task} isDone
                  onToggle={() => toggleDone(task.id)}
                  onDelete={() => setConfirmDelete(task.id)}
                  onMove={() => {}} onStar={() => {}} />
              ))}
            </div>
          </>
        )}
        <div style={{ height: 12 }} />
      </div>

      <div style={{ padding: '10px 18px 18px', borderTop: '1px solid var(--bdr2)', flexShrink: 0 }}>
        {showAdd
          ? <AddTaskForm day={activeDay} onDone={() => setShowAdd(false)} />
          : <QuickAddBar day={activeDay} onExpand={() => setShowAdd(true)} />
        }
      </div>
    </div>
  );
}

const SWIPE_THRESHOLD = 60;
const MAX_SWIPE = 130;
const ACTION_W = 64;

function SortableTaskCard({ task, onToggle, onDelete, onMove, onStar, isDone, isDraggingAny }: {
  task: Task; onToggle: () => void; onDelete: () => void; onMove: () => void; onStar: () => void; isDone?: boolean; isDraggingAny?: boolean;
}) {
  const t = useT();
  const lang = useStore(s => s.config.language ?? 'en');
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, disabled: !!isDone });
  const [hovered, setHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [swipeRevealed, setSwipeRevealed] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const dirLocked = useRef<'h'|'v'|null>(null);
  const isSwiping = useRef(false);

  if (isDragging && (swipeRevealed || swipeOffset !== 0)) {
    setSwipeOffset(0);
    setSwipeRevealed(false);
  }

  const onTouchStart = (e: React.TouchEvent) => {
    if (isDone) return;
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    dirLocked.current = null;
    isSwiping.current = true;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!isSwiping.current || isDone) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;
    if (!dirLocked.current) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8)
        dirLocked.current = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
      return;
    }
    if (dirLocked.current === 'v') return;
    if (dx > 0 && !swipeRevealed) return;
    const next = swipeRevealed
      ? Math.max(-MAX_SWIPE, Math.min(0, -MAX_SWIPE + dx))
      : Math.max(-MAX_SWIPE, Math.min(0, dx));
    setSwipeOffset(next);
    e.preventDefault();
  };

  const onTouchEnd = () => {
    isSwiping.current = false;
    dirLocked.current = null;
    if (Math.abs(swipeOffset) > SWIPE_THRESHOLD) {
      setSwipeRevealed(true); setSwipeOffset(-MAX_SWIPE);
    } else {
      setSwipeRevealed(false); setSwipeOffset(0);
    }
  };

  const closeSwipe = () => { setSwipeRevealed(false); setSwipeOffset(0); };

  if (editing) {
    return (
      <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}>
        <EditTaskForm task={task} onDone={() => setEditing(false)} />
      </div>
    );
  }

  const hasNotes = !!(task.notes && task.notes.trim());

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, position: 'relative', borderRadius: 10, overflow: 'hidden' }}
    >
      {!isDragging && !isDraggingAny && (
        <div style={{
          position: 'absolute', right: 0, top: 0, bottom: 0,
          display: 'flex', alignItems: 'stretch', width: MAX_SWIPE,
          borderRadius: '0 10px 10px 0', overflow: 'hidden',
        }}>
          <button onClick={() => { closeSwipe(); onMove(); }} style={{
            width: ACTION_W, border: 'none', cursor: 'pointer',
            background: 'var(--ind)', color: '#fff',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 3, fontSize: 10, fontWeight: 600, fontFamily: 'inherit',
          }}>
            <ArrowRight size={16} />
            {task.day === 'today' ? t('day.tomorrow') : t('day.today')}
          </button>
          <button onClick={() => { closeSwipe(); onDelete(); }} style={{
            flex: 1, border: 'none', cursor: 'pointer',
            background: 'var(--coral)', color: '#fff',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 3, fontSize: 10, fontWeight: 600, fontFamily: 'inherit',
          }}>
            <Trash2 size={16} />
            {t('task.delete')}
          </button>
        </div>
      )}

      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={swipeRevealed ? closeSwipe : undefined}
        style={{
          transform: `translateX(${isDragging || isDraggingAny ? 0 : swipeOffset}px)`,
          transition: isSwiping.current ? 'none' : 'transform .25s cubic-bezier(.4,0,.2,1)',
          position: 'relative', zIndex: 1,
        }}
      >
        <div
          style={{ background: 'var(--sf)', border: `1px solid ${isDragging ? 'var(--ind)' : 'var(--bdr)'}`, borderRadius: 10, padding: '9px 10px', display: 'flex', alignItems: 'flex-start', gap: 8, opacity: isDragging ? 0.5 : 1 }}
          onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
        >
          {!isDone && (
            <div {...attributes} {...listeners} style={{ cursor: isDragging ? 'grabbing' : 'grab', color: 'var(--tx3)', marginTop: 2, flexShrink: 0, touchAction: 'none' }}>
              <GripVertical size={13} />
            </div>
          )}
          <button onClick={onToggle} className="btn-icon" style={{ padding: 2, marginTop: 1, flexShrink: 0 }}>
            {task.is_done ? <CheckCircle size={15} color="var(--sage)" /> : <Circle size={15} color="var(--tx3)" />}
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, textDecoration: task.is_done ? 'line-through' : 'none', color: task.is_done ? 'var(--tx3)' : 'var(--tx)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span className={`dot ${task.priority}`} style={{ flexShrink: 0 }} />
              {task.is_starred && <Star size={10} fill="var(--must)" color="var(--must)" />}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</span>
              {task.recurrence !== 'none' && (
                <span style={{ fontSize: 9, background: 'var(--ind-l)', color: 'var(--ind)', padding: '1px 5px', borderRadius: 4, flexShrink: 0 }}>🔁</span>
              )}
              {hasNotes && (
                <button
                  className="btn-icon"
                  onClick={(e) => { e.stopPropagation(); setShowNotes(s => !s); }}
                  style={{ padding: 2, flexShrink: 0, color: showNotes ? 'var(--ind)' : 'var(--tx3)' }}
                  title={t('task.notes')}>
                  <FileText size={11} />
                </button>
              )}
            </div>
            <div style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 2, fontFamily: "'DM Mono', monospace" }}>
              {formatDuration(task.duration_minutes)}
              {task.travel_minutes > 0 && ` · +${task.travel_minutes}${lang === 'ru' ? 'м дорога' : 'm road'}`}
              {task.break_after > 0 && ` · +${task.break_after}${lang === 'ru' ? 'м перерыв' : 'm break'}`}
              {task.fixed_time && ` · @${task.fixed_time}`}
            </div>
            {hasNotes && showNotes && (
              <div style={{
                marginTop: 6, padding: '6px 8px',
                background: 'var(--sf2)', borderRadius: 6,
                fontSize: 12, color: 'var(--tx2)', lineHeight: 1.5,
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>
                {task.notes}
              </div>
            )}
          </div>
          {hovered && !isDone && (
            <div style={{ display: 'flex', gap: 1, flexShrink: 0 }}>
              <button className="btn-icon" onClick={onStar} style={{ padding: 4 }}>
                <Star size={12} fill={task.is_starred ? 'var(--must)' : 'none'} color={task.is_starred ? 'var(--must)' : 'var(--tx3)'} />
              </button>
              <button className="btn-icon" onClick={() => setEditing(true)} style={{ padding: 4 }}><Pencil size={12} /></button>
              <button className="btn-icon" onClick={onMove} style={{ padding: 4 }}><ArrowRight size={12} /></button>
              <button className="btn-icon" onClick={onDelete} style={{ padding: 4 }}><Trash2 size={12} /></button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const DAY_LABELS_KEYS = ['day.short.sun', 'day.short.mon', 'day.short.tue', 'day.short.wed', 'day.short.thu', 'day.short.fri', 'day.short.sat'] as const;

/** Shared category select with "other (custom)" support. */
function CategorySelect({
  value, onChange, allCategories, showAuto,
}: {
  value: string;
  onChange: (next: string) => void;
  allCategories: string[];
  showAuto?: boolean;
}) {
  const t = useT();
  // Custom mode is active when the value is not in the known categories list and is not empty.
  const isCustom = value !== '' && !allCategories.includes(value);
  const [mode, setMode] = useState<'preset' | 'other'>(isCustom ? 'other' : 'preset');
  const [customText, setCustomText] = useState(isCustom ? value : '');

  const handleSelectChange = (v: string) => {
    if (v === '__other__') {
      setMode('other');
      // Don't change value yet — wait for user to type
      onChange(customText.trim() || '');
    } else {
      setMode('preset');
      onChange(v);
    }
  };

  const handleCustomChange = (v: string) => {
    setCustomText(v);
    onChange(v.trim().toLowerCase());
  };

  const selectValue = mode === 'other' ? '__other__' : value;

  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--tx3)', marginBottom: 5 }}>
        {t('task.category')}{showAuto && <span style={{ marginLeft: 4, color: 'var(--ind)', fontWeight: 600 }}>{t('task.category.auto')}</span>}
      </div>
      <select value={selectValue} onChange={e => handleSelectChange(e.target.value)} style={{ fontSize: 13, padding: '9px 8px' }}>
        {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
        <option value="__other__">{t('task.category.other')}</option>
      </select>
      {mode === 'other' && (
        <input
          autoFocus
          value={customText}
          onChange={e => handleCustomChange(e.target.value)}
          placeholder={t('task.category.customPlaceholder')}
          style={{ fontSize: 13, padding: '9px 10px', marginTop: 6 }}
        />
      )}
    </div>
  );
}

function EditTaskForm({ task, onDone }: { task: Task; onDone: () => void }) {
  const t = useT();
  const { updateTask, config } = useStore();
  const [title, setTitle] = useState(task.title);
  const [duration, setDuration] = useState(String(task.duration_minutes));
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [travel, setTravel] = useState(String(task.travel_minutes));
  const [breakAfter, setBreakAfter] = useState(String(task.break_after));
  const [recurrence, setRecurrence] = useState<Recurrence>(task.recurrence);
  const [customDays, setCustomDays] = useState<number[]>(task.recurrence_days ?? [1, 2, 3, 4, 5]);
  const [category, setCategory] = useState(task.category);
  const [fixedTime, setFixedTime] = useState(task.fixed_time ?? '');
  const [notes, setNotes] = useState(task.notes ?? '');

  const toggleDay = (d: number) => {
    setCustomDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    await updateTask(task.id, {
      title: title.trim(),
      duration_minutes: parseInt(duration) || 30,
      break_after: parseInt(breakAfter) || 0,
      travel_minutes: parseInt(travel) || 0,
      priority,
      category: category.trim() || 'general',
      recurrence,
      recurrence_days: recurrence === 'custom' ? customDays : undefined,
      fixed_time: fixedTime || undefined,
      notes: notes.trim() || undefined,
    });
    onDone();
  };

  const allCategories = getAllCategories(config.category_goals);

  return (
    <div style={{ background: 'var(--sf)', border: '1px solid var(--ind-m)', borderRadius: 'var(--rs)', padding: '14px 14px 12px', display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ind)', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: -2 }}>{t('task.title')}</div>
      <input autoFocus placeholder={t('task.title.placeholder')} value={title}
        style={{ fontSize: 14, padding: '10px 12px' }}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onDone(); }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--tx3)', marginBottom: 5 }}>{t('task.duration')}</div>
          <input type="number" value={duration} onChange={e => setDuration(e.target.value)} min="1" style={{ fontSize: 14, padding: '9px 10px' }} />
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--tx3)', marginBottom: 5 }}>{t('task.road')}</div>
          <input type="number" value={travel} onChange={e => setTravel(e.target.value)} min="0" style={{ fontSize: 14, padding: '9px 10px' }} />
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--tx3)', marginBottom: 5 }}>{t('task.priority')}</div>
          <select value={priority} onChange={e => setPriority(e.target.value as Priority)} style={{ fontSize: 13, padding: '9px 8px' }}>
            <option value="high">{t('task.priority.high')}</option>
            <option value="medium">{t('task.priority.medium')}</option>
            <option value="low">{t('task.priority.low')}</option>
          </select>
        </div>
      </div>
      <div>
        <div style={{ fontSize: 11, color: 'var(--tx3)', marginBottom: 6 }}>{t('task.break')}</div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {[0, 5, 10, 15, 30].map(mins => (
            <button key={mins} type="button"
              onClick={() => setBreakAfter(String(mins))}
              style={{ padding: '6px 12px', fontSize: 12, borderRadius: 20, border: `1px solid ${breakAfter === String(mins) ? 'var(--ind)' : 'var(--bdr2)'}`, background: breakAfter === String(mins) ? 'var(--ind-l)' : 'transparent', color: breakAfter === String(mins) ? 'var(--ind)' : 'var(--tx3)', cursor: 'pointer', fontFamily: 'inherit' }}>
              {mins === 0 ? t('task.break.none') : `${mins}m`}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <CategorySelect value={category} onChange={setCategory} allCategories={allCategories} />
        <div>
          <div style={{ fontSize: 11, color: 'var(--tx3)', marginBottom: 5 }}>{t('task.repeat')}</div>
          <select value={recurrence} onChange={e => setRecurrence(e.target.value as Recurrence)} style={{ fontSize: 13, padding: '9px 8px' }}>
            <option value="none">{t('task.repeat.none')}</option>
            <option value="daily">{t('task.repeat.daily')}</option>
            <option value="weekdays">{t('task.repeat.weekdays')}</option>
            <option value="weekly">{t('task.repeat.weekly')}</option>
            <option value="custom">{t('task.repeat.custom')}</option>
          </select>
        </div>
      </div>
      <div style={{ overflow: 'hidden' }}>
        <div style={{ fontSize: 11, color: 'var(--tx3)', marginBottom: 5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <span>{t('task.fixedTime')}</span>
          {fixedTime && (
            <span style={{ color: 'var(--ind)', fontWeight: 600, fontFamily: "'DM Mono', monospace", fontSize: 11, flexShrink: 0 }}>
              {(() => {
                const [h, m] = fixedTime.split(':').map(Number);
                const endMin = h * 60 + m + (parseInt(duration) || 30);
                const eh = Math.floor(endMin / 60) % 24;
                const em = endMin % 60;
                return `→ ${String(eh).padStart(2,'0')}:${String(em).padStart(2,'0')}`;
              })()}
            </span>
          )}
        </div>
        <input type="time" value={fixedTime} onChange={e => setFixedTime(e.target.value)}
          style={{ width: '100%', minWidth: 0, boxSizing: 'border-box', fontSize: 14, padding: '9px 12px' }} />
      </div>
      <div>
        <div style={{ fontSize: 11, color: 'var(--tx3)', marginBottom: 5 }}>{t('task.notes')}</div>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder={t('task.notes.placeholder')}
          rows={3}
          style={{ fontSize: 13, padding: '9px 10px', resize: 'vertical', minHeight: 60, fontFamily: 'inherit', lineHeight: 1.5 }}
        />
      </div>
      {recurrence === 'custom' && (
        <div>
          <div style={{ fontSize: 11, color: 'var(--tx3)', marginBottom: 6 }}>{t('task.repeatOn')}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {DAY_LABELS_KEYS.map((key, i) => (
              <button key={i} type="button" onClick={() => toggleDay(i)}
                style={{ flex: 1, height: 34, borderRadius: '50%', fontSize: 11, fontWeight: 600, border: `1px solid ${customDays.includes(i) ? 'var(--ind)' : 'var(--bdr2)'}`, background: customDays.includes(i) ? 'var(--ind)' : 'transparent', color: customDays.includes(i) ? '#fff' : 'var(--tx3)', cursor: 'pointer', fontFamily: 'inherit' }}>
                {t(key)}
              </button>
            ))}
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
        <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center', padding: '11px' }} onClick={handleSave}>{t('task.save')}</button>
        <button className="btn btn-ghost" style={{ padding: '11px 16px' }} onClick={onDone}>{t('task.cancel')}</button>
      </div>
    </div>
  );
}

function QuickAddBar({ day, onExpand }: { day: 'today' | 'tomorrow'; onExpand: () => void }) {
  const t = useT();
  const { addTask, config } = useStore();
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAdd = async () => {
    const trimmed = title.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    try {
      await addTask({
        title: trimmed,
        duration_minutes: 30,
        break_after: config.buffer,
        travel_minutes: 0,
        priority: 'medium',
        category: detectCategory(trimmed, config.category_goals),
        is_starred: false,
        is_done: false,
        day,
        recurrence: 'none',
        sort_order: 0,
      });
      setTitle('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
          placeholder={t('task.title.placeholder')}
          style={{ flex: 1, fontSize: 13, padding: '10px 12px' }}
        />
        <button
          className="btn btn-primary"
          onClick={handleAdd}
          disabled={loading || !title.trim()}
          style={{ padding: '10px 16px', flexShrink: 0 }}
        >
          <Plus size={15} /> {t('task.add.btn')}
        </button>
      </div>
      <button
        className="btn btn-ghost"
        onClick={onExpand}
        style={{ fontSize: 11, color: 'var(--tx3)', padding: '5px 8px', justifyContent: 'center', border: 'none' }}
      >
        <SlidersHorizontal size={12} /> {t('task.moreOptions')}
      </button>
    </div>
  );
}

function AddTaskForm({ day, onDone }: { day: 'today' | 'tomorrow'; onDone: () => void }) {
  const t = useT();
  const { addTask, config } = useStore();
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState('30');
  const [priority, setPriority] = useState<Priority>('medium');
  const [travel, setTravel] = useState('0');
  const [breakAfter, setBreakAfter] = useState(String(config.buffer));
  const [recurrence, setRecurrence] = useState<Recurrence>('none');
  const [customDays, setCustomDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [category, setCategory] = useState('general');
  const [categoryEdited, setCategoryEdited] = useState(false);
  const [fixedTime, setFixedTime] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!categoryEdited) setCategory(detectCategory(val, config.category_goals));
  };

  const toggleDay = (d: number) => {
    setCustomDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  };

  const handleAdd = async () => {
    if (!title.trim()) return;
    setError('');
    setLoading(true);
    try {
      await addTask({
        title: title.trim(),
        duration_minutes: parseInt(duration) || 30,
        break_after: parseInt(breakAfter) || 0,
        travel_minutes: parseInt(travel) || 0,
        priority,
        category: category.trim() || 'general',
        is_starred: false,
        is_done: false,
        day,
        recurrence,
        recurrence_days: recurrence === 'custom' ? customDays : undefined,
        fixed_time: fixedTime || undefined,
        notes: notes.trim() || undefined,
        sort_order: 0,
      });
      onDone();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to add task');
      setLoading(false);
    }
  };

  const allCategories = getAllCategories(config.category_goals);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden' }}>
      <input autoFocus placeholder={t('task.title.placeholder')} value={title}
        style={{ fontSize: 14, padding: '11px 12px' }}
        onChange={e => handleTitleChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') onDone(); }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--tx3)', marginBottom: 5 }}>{t('task.duration')}</div>
          <input type="number" value={duration} onChange={e => setDuration(e.target.value)} min="1" style={{ fontSize: 14, padding: '9px 10px' }} />
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--tx3)', marginBottom: 5 }}>{t('task.road')}</div>
          <input type="number" value={travel} onChange={e => setTravel(e.target.value)} min="0" style={{ fontSize: 14, padding: '9px 10px' }} />
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--tx3)', marginBottom: 5 }}>{t('task.priority')}</div>
          <select value={priority} onChange={e => setPriority(e.target.value as Priority)} style={{ fontSize: 13, padding: '9px 8px' }}>
            <option value="high">{t('task.priority.high')}</option>
            <option value="medium">{t('task.priority.medium')}</option>
            <option value="low">{t('task.priority.low')}</option>
          </select>
        </div>
      </div>
      <div>
        <div style={{ fontSize: 11, color: 'var(--tx3)', marginBottom: 6 }}>{t('task.break')}</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[0, 5, 10, 15, 30].map(mins => (
            <button key={mins} type="button"
              onClick={() => setBreakAfter(String(mins))}
              style={{ padding: '6px 12px', fontSize: 12, borderRadius: 20, border: `1px solid ${breakAfter === String(mins) ? 'var(--ind)' : 'var(--bdr2)'}`, background: breakAfter === String(mins) ? 'var(--ind-l)' : 'transparent', color: breakAfter === String(mins) ? 'var(--ind)' : 'var(--tx3)', cursor: 'pointer', fontFamily: 'inherit' }}>
              {mins === 0 ? t('task.break.none') : `${mins}m`}
            </button>
          ))}
          <input type="number" min="0" placeholder={t('task.break.custom')}
            value={![0,5,10,15,30].includes(parseInt(breakAfter)) && breakAfter !== '0' ? breakAfter : ''}
            onChange={e => setBreakAfter(e.target.value)}
            style={{ width: 68, fontSize: 12, padding: '5px 8px' }} />
        </div>
      </div>
      <div style={{ overflow: 'hidden' }}>
        <div style={{ fontSize: 11, color: 'var(--tx3)', marginBottom: 5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <span>{t('task.startTime')}</span>
          {fixedTime && (
            <span style={{ color: 'var(--ind)', fontWeight: 600, fontFamily: "'DM Mono', monospace", fontSize: 11, flexShrink: 0 }}>
              {(() => {
                const [h, m] = fixedTime.split(':').map(Number);
                const endMin = h * 60 + m + (parseInt(duration) || 30);
                const eh = Math.floor(endMin / 60) % 24;
                const em = endMin % 60;
                return `→ ${String(eh).padStart(2,'0')}:${String(em).padStart(2,'0')}`;
              })()}
            </span>
          )}
        </div>
        <input type="time" value={fixedTime} onChange={e => setFixedTime(e.target.value)}
          style={{ width: '100%', minWidth: 0, boxSizing: 'border-box', fontSize: 14, padding: '9px 10px' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <CategorySelect
          value={category}
          onChange={(next) => { setCategory(next); setCategoryEdited(true); }}
          allCategories={allCategories}
          showAuto={!categoryEdited && category !== 'general'}
        />
        <div>
          <div style={{ fontSize: 11, color: 'var(--tx3)', marginBottom: 5 }}>{t('task.repeat')}</div>
          <select value={recurrence} onChange={e => setRecurrence(e.target.value as Recurrence)} style={{ fontSize: 13, padding: '9px 8px' }}>
            <option value="none">{t('task.repeat.none')}</option>
            <option value="daily">{t('task.repeat.daily')}</option>
            <option value="weekdays">{t('task.repeat.weekdays')}</option>
            <option value="weekly">{t('task.repeat.weekly')}</option>
            <option value="custom">{t('task.repeat.custom')}</option>
          </select>
        </div>
      </div>
      <div>
        <div style={{ fontSize: 11, color: 'var(--tx3)', marginBottom: 5 }}>{t('task.notes')}</div>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder={t('task.notes.placeholder')}
          rows={2}
          style={{ fontSize: 13, padding: '9px 10px', resize: 'vertical', minHeight: 50, fontFamily: 'inherit', lineHeight: 1.5 }}
        />
      </div>
      {recurrence === 'custom' && (
        <div>
          <div style={{ fontSize: 11, color: 'var(--tx3)', marginBottom: 6 }}>{t('task.repeatOn')}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {DAY_LABELS_KEYS.map((key, i) => (
              <button key={i} type="button" onClick={() => toggleDay(i)}
                style={{ flex: 1, height: 34, borderRadius: '50%', fontSize: 11, fontWeight: 600, border: `1px solid ${customDays.includes(i) ? 'var(--ind)' : 'var(--bdr2)'}`, background: customDays.includes(i) ? 'var(--ind)' : 'transparent', color: customDays.includes(i) ? '#fff' : 'var(--tx3)', cursor: 'pointer', fontFamily: 'inherit' }}>
                {t(key)}
              </button>
            ))}
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
        <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center', padding: '11px', fontSize: 14 }} onClick={handleAdd} disabled={loading || !title.trim()}>
          {loading ? t('task.adding') : t('task.add.btn')}
        </button>
        <button className="btn btn-ghost" style={{ padding: '11px 16px' }} onClick={onDone}>{t('task.cancel')}</button>
      </div>
      {error && (
        <div style={{ fontSize: 12, color: 'var(--coral)', padding: '8px 10px', background: 'var(--coral-l)', borderRadius: 8, lineHeight: 1.4 }}>
          ⚠️ {error}
        </div>
      )}
    </div>
  );
}
