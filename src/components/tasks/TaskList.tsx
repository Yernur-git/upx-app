import { useState } from 'react';
import { Plus, Star, Trash2, CheckCircle, Circle, ArrowRight, GripVertical } from 'lucide-react';
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
import type { Task, Priority, Recurrence } from '../../types';
import { formatDuration } from '../../lib/scheduler';

export function TaskList() {
  const { tasks, updateTask, deleteTask, toggleDone, moveTask, reorderTasks } = useStore();
  const [showAdd, setShowAdd] = useState(false);
  const [activeDay, setActiveDay] = useState<'today' | 'tomorrow'>('today');

  const todayTasks = tasks.filter(t => t.day === 'today');
  const tomorrowTasks = tasks.filter(t => t.day === 'tomorrow');
  const displayTasks = activeDay === 'today' ? todayTasks : tomorrowTasks;

  const doneTasks = displayTasks.filter(t => t.is_done).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const pendingTasks = displayTasks.filter(t => !t.is_done).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = pendingTasks.map(t => t.id);
    const oldIndex = ids.indexOf(active.id as string);
    const newIndex = ids.indexOf(over.id as string);
    reorderTasks(arrayMove(ids, oldIndex, newIndex));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', gap: 4, padding: '0 18px 12px', flexShrink: 0 }}>
        {(['today', 'tomorrow'] as const).map(day => (
          <button key={day} className="btn btn-ghost"
            style={{ flex: 1, justifyContent: 'center', fontSize: 12, background: activeDay === day ? 'var(--ind-l)' : 'transparent', color: activeDay === day ? 'var(--ind)' : 'var(--tx3)', borderColor: activeDay === day ? 'var(--ind-m)' : 'var(--bdr2)' }}
            onClick={() => setActiveDay(day)}>
            {day === 'today' ? 'Today' : 'Tomorrow'}
            <span style={{ fontSize: 10, fontWeight: 700, background: activeDay === day ? 'var(--ind)' : 'var(--sf3)', color: activeDay === day ? '#fff' : 'var(--tx3)', padding: '1px 6px', borderRadius: 10, marginLeft: 4 }}>
              {(day === 'today' ? todayTasks : tomorrowTasks).filter(t => !t.is_done).length}
            </span>
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 18px' }}>
        {pendingTasks.length === 0 && doneTasks.length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--tx3)', fontSize: 13, lineHeight: 1.7, border: '1.5px dashed var(--bdr2)', borderRadius: 'var(--rs)', marginTop: 8 }}>
            No tasks yet.<br /><span style={{ fontSize: 12 }}>Add one below or ask the AI ✨</span>
          </div>
        )}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={pendingTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {pendingTasks.map(task => (
                <SortableTaskCard key={task.id} task={task}
                  onToggle={() => toggleDone(task.id)}
                  onDelete={() => deleteTask(task.id)}
                  onMove={() => moveTask(task.id, task.day === 'today' ? 'tomorrow' : 'today')}
                  onStar={() => updateTask(task.id, { is_starred: !task.is_starred })} />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {doneTasks.length > 0 && (
          <>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--tx3)', margin: '16px 0 8px' }}>
              Done · {doneTasks.length}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, opacity: 0.55 }}>
              {doneTasks.map(task => (
                <SortableTaskCard key={task.id} task={task} isDone
                  onToggle={() => toggleDone(task.id)}
                  onDelete={() => deleteTask(task.id)}
                  onMove={() => {}} onStar={() => {}} />
              ))}
            </div>
          </>
        )}
      </div>

      <div style={{ padding: '10px 18px 18px', borderTop: '1px solid var(--bdr2)', flexShrink: 0 }}>
        {showAdd
          ? <AddTaskForm day={activeDay} onDone={() => setShowAdd(false)} />
          : <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center', color: 'var(--ind)' }} onClick={() => setShowAdd(true)}>
              <Plus size={15} /> Add task
            </button>
        }
      </div>
    </div>
  );
}

function SortableTaskCard({ task, onToggle, onDelete, onMove, onStar, isDone }: {
  task: Task; onToggle: () => void; onDelete: () => void; onMove: () => void; onStar: () => void; isDone?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, disabled: !!isDone });
  const [hovered, setHovered] = useState(false);

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <div style={{ background: 'var(--sf)', border: `1px solid ${isDragging ? 'var(--ind)' : 'var(--bdr)'}`, borderRadius: 'var(--rs)', padding: '9px 10px', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
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
          </div>
          <div style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 2, fontFamily: "'DM Mono', monospace" }}>
            {formatDuration(task.duration_minutes)}
            {task.travel_minutes > 0 && ` · +${task.travel_minutes}m road`}
            {task.break_after > 0 && ` · +${task.break_after}m break`}
            {task.fixed_time && ` · @${task.fixed_time}`}
          </div>
        </div>
        {hovered && !isDone && (
          <div style={{ display: 'flex', gap: 1, flexShrink: 0 }}>
            <button className="btn-icon" onClick={onStar} style={{ padding: 4 }}>
              <Star size={12} fill={task.is_starred ? 'var(--must)' : 'none'} color={task.is_starred ? 'var(--must)' : 'var(--tx3)'} />
            </button>
            <button className="btn-icon" onClick={onMove} style={{ padding: 4 }}><ArrowRight size={12} /></button>
            <button className="btn-icon" onClick={onDelete} style={{ padding: 4 }}><Trash2 size={12} /></button>
          </div>
        )}
      </div>
    </div>
  );
}

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function AddTaskForm({ day, onDone }: { day: 'today' | 'tomorrow'; onDone: () => void }) {
  const { addTask, config } = useStore();
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState('30');
  const [priority, setPriority] = useState<Priority>('medium');
  const [travel, setTravel] = useState('0');
  const [breakAfter, setBreakAfter] = useState(String(config.buffer));
  const [recurrence, setRecurrence] = useState<Recurrence>('none');
  const [customDays, setCustomDays] = useState<number[]>([1, 2, 3, 4, 5]); // Mon-Fri default
  const [category, setCategory] = useState('general');
  const [categoryEdited, setCategoryEdited] = useState(false);

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!categoryEdited) setCategory(detectCategory(val, config.category_goals));
  };

  const toggleDay = (d: number) => {
    setCustomDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  };

  const handleAdd = async () => {
    if (!title.trim()) return;
    await addTask({
      title: title.trim(),
      duration_minutes: parseInt(duration) || 30,
      break_after: parseInt(breakAfter) || 0,
      travel_minutes: parseInt(travel) || 0,
      priority,
      category,
      is_starred: false,
      is_done: false,
      day,
      recurrence,
      recurrence_days: recurrence === 'custom' ? customDays : undefined,
      sort_order: 0,
    });
    onDone();
  };

  const allCategories = getAllCategories(config.category_goals);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <input autoFocus placeholder="Task title…" value={title}
        onChange={e => handleTitleChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') onDone(); }} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--tx3)', marginBottom: 4 }}>Duration (min)</div>
          <input type="number" value={duration} onChange={e => setDuration(e.target.value)} min="1" />
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--tx3)', marginBottom: 4 }}>Road (min)</div>
          <input type="number" value={travel} onChange={e => setTravel(e.target.value)} min="0" />
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--tx3)', marginBottom: 4 }}>Priority</div>
          <select value={priority} onChange={e => setPriority(e.target.value as Priority)}>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* Break after */}
      <div>
        <div style={{ fontSize: 10, color: 'var(--tx3)', marginBottom: 6 }}>Break after task</div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {[0, 5, 10, 15, 30].map(mins => (
            <button key={mins} type="button"
              onClick={() => setBreakAfter(String(mins))}
              style={{
                padding: '4px 10px', fontSize: 11, borderRadius: 20,
                border: `1px solid ${breakAfter === String(mins) ? 'var(--ind)' : 'var(--bdr2)'}`,
                background: breakAfter === String(mins) ? 'var(--ind-l)' : 'transparent',
                color: breakAfter === String(mins) ? 'var(--ind)' : 'var(--tx3)',
                cursor: 'pointer', fontFamily: 'inherit',
              }}>
              {mins === 0 ? 'None' : `${mins}m`}
            </button>
          ))}
          <input type="number" min="0" placeholder="custom"
            value={![0,5,10,15,30].includes(parseInt(breakAfter)) && breakAfter !== '0' ? breakAfter : ''}
            onChange={e => setBreakAfter(e.target.value)}
            style={{ width: 64, fontSize: 11, padding: '4px 8px' }} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--tx3)', marginBottom: 4 }}>
            Category
            {!categoryEdited && category !== 'general' && (
              <span style={{ marginLeft: 4, color: 'var(--ind)', fontWeight: 600 }}>auto</span>
            )}
          </div>
          <select value={category} onChange={e => { setCategory(e.target.value); setCategoryEdited(true); }}>
            {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--tx3)', marginBottom: 4 }}>Repeat</div>
          <select value={recurrence} onChange={e => setRecurrence(e.target.value as Recurrence)}>
            <option value="none">No repeat</option>
            <option value="daily">Every day</option>
            <option value="weekdays">Weekdays</option>
            <option value="weekly">Weekly</option>
            <option value="custom">Custom days…</option>
          </select>
        </div>
      </div>

      {/* Custom day picker */}
      {recurrence === 'custom' && (
        <div>
          <div style={{ fontSize: 10, color: 'var(--tx3)', marginBottom: 6 }}>Repeat on</div>
          <div style={{ display: 'flex', gap: 5 }}>
            {DAY_LABELS.map((label, i) => (
              <button key={i} type="button" onClick={() => toggleDay(i)}
                style={{
                  width: 32, height: 32, borderRadius: '50%', fontSize: 11, fontWeight: 600,
                  border: `1px solid ${customDays.includes(i) ? 'var(--ind)' : 'var(--bdr2)'}`,
                  background: customDays.includes(i) ? 'var(--ind)' : 'transparent',
                  color: customDays.includes(i) ? '#fff' : 'var(--tx3)',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 6 }}>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleAdd}>Add</button>
        <button className="btn btn-ghost" onClick={onDone}>Cancel</button>
      </div>
    </div>
  );
}