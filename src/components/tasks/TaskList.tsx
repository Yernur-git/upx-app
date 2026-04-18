import { useState } from 'react';
import { Plus, Star, Trash2, CheckCircle, Circle, ArrowRight } from 'lucide-react';
import { useStore } from '../../store';
import type { Task, Priority } from '../../types';
import { formatDuration } from '../../lib/scheduler';

export function TaskList() {
  const { tasks, updateTask, deleteTask, toggleDone, moveTask } = useStore();
  const [showAdd, setShowAdd] = useState(false);
  const [activeDay, setActiveDay] = useState<'today' | 'tomorrow'>('today');

  const todayTasks = tasks.filter(t => t.day === 'today');
  const tomorrowTasks = tasks.filter(t => t.day === 'tomorrow');
  const displayTasks = activeDay === 'today' ? todayTasks : tomorrowTasks;

  const doneTasks = displayTasks.filter(t => t.is_done);
  const pendingTasks = displayTasks.filter(t => !t.is_done);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Day tabs */}
      <div style={{ display: 'flex', gap: 4, padding: '0 18px 12px', flexShrink: 0 }}>
        {(['today', 'tomorrow'] as const).map(day => (
          <button key={day} className="btn btn-ghost"
            style={{
              flex: 1, justifyContent: 'center', fontSize: 12,
              background: activeDay === day ? 'var(--ind-l)' : 'transparent',
              color: activeDay === day ? 'var(--ind)' : 'var(--tx3)',
              borderColor: activeDay === day ? 'var(--ind-m)' : 'var(--bdr2)',
            }}
            onClick={() => setActiveDay(day)}>
            {day === 'today' ? 'Today' : 'Tomorrow'}
            <span style={{
              fontSize: 10, fontWeight: 700,
              background: activeDay === day ? 'var(--ind)' : 'var(--sf3)',
              color: activeDay === day ? '#fff' : 'var(--tx3)',
              padding: '1px 6px', borderRadius: 10, marginLeft: 4,
            }}>
              {(day === 'today' ? todayTasks : tomorrowTasks).filter(t => !t.is_done).length}
            </span>
          </button>
        ))}
      </div>

      {/* Task list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 18px' }}>
        {pendingTasks.length === 0 && doneTasks.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '32px 16px',
            color: 'var(--tx3)', fontSize: 13, lineHeight: 1.7,
            border: '1.5px dashed var(--bdr2)', borderRadius: 'var(--rs)', marginTop: 8,
          }}>
            No tasks yet.<br />
            <span style={{ fontSize: 12 }}>Add one below or ask the AI ✨</span>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {pendingTasks.map(task => (
            <TaskCard key={task.id} task={task} onToggle={() => toggleDone(task.id)}
              onDelete={() => deleteTask(task.id)}
              onMove={() => moveTask(task.id, task.day === 'today' ? 'tomorrow' : 'today')}
              onStar={() => updateTask(task.id, { is_starred: !task.is_starred })} />
          ))}
        </div>

        {doneTasks.length > 0 && (
          <>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--tx3)', margin: '16px 0 8px' }}>
              Done · {doneTasks.length}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, opacity: 0.6 }}>
              {doneTasks.map(task => (
                <TaskCard key={task.id} task={task} onToggle={() => toggleDone(task.id)}
                  onDelete={() => deleteTask(task.id)}
                  onMove={() => {}} onStar={() => {}} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Add task */}
      <div style={{ padding: '10px 18px 18px', borderTop: '1px solid var(--bdr2)', flexShrink: 0 }}>
        {showAdd
          ? <AddTaskForm day={activeDay} onDone={() => setShowAdd(false)} />
          : <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center', color: 'var(--ind)' }}
              onClick={() => setShowAdd(true)}>
              <Plus size={15} /> Add task
            </button>
        }
      </div>
    </div>
  );
}

function TaskCard({ task, onToggle, onDelete, onMove, onStar }: {
  task: Task;
  onToggle: () => void;
  onDelete: () => void;
  onMove: () => void;
  onStar: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'var(--sf)', border: '1px solid var(--bdr2)',
        borderRadius: 'var(--rs)', padding: '10px 12px',
        display: 'flex', alignItems: 'flex-start', gap: 9,
        transition: 'border-color .14s',
        borderColor: hovered ? 'var(--bdr2)' : 'var(--bdr)',
      }}>

      <button onClick={onToggle} className="btn-icon" style={{ padding: 2, marginTop: 1 }}>
        {task.is_done
          ? <CheckCircle size={16} color="var(--sage)" />
          : <Circle size={16} color="var(--tx3)" />}
      </button>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 500,
          textDecoration: task.is_done ? 'line-through' : 'none',
          color: task.is_done ? 'var(--tx3)' : 'var(--tx)',
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          <span className={`dot ${task.priority}`} style={{ flexShrink: 0 }} />
          {task.is_starred && <Star size={11} fill="var(--must)" color="var(--must)" />}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {task.title}
          </span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 2, fontFamily: "'DM Mono', monospace" }}>
          {formatDuration(task.duration_minutes)}
          {task.travel_minutes > 0 && ` · +${task.travel_minutes}m travel`}
          {task.break_after > 0 && ` · +${task.break_after}m break`}
          {task.fixed_time && ` · @${task.fixed_time}`}
        </div>
      </div>

      {hovered && (
        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
          <button className="btn-icon" onClick={onStar} title="Star">
            <Star size={13} fill={task.is_starred ? 'var(--must)' : 'none'} color={task.is_starred ? 'var(--must)' : 'var(--tx3)'} />
          </button>
          <button className="btn-icon" onClick={onMove} title={`Move to ${task.day === 'today' ? 'tomorrow' : 'today'}`}>
            <ArrowRight size={13} />
          </button>
          <button className="btn-icon" onClick={onDelete} title="Delete">
            <Trash2 size={13} />
          </button>
        </div>
      )}
    </div>
  );
}

function AddTaskForm({ day, onDone }: { day: 'today' | 'tomorrow'; onDone: () => void }) {
  const { addTask } = useStore();
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState('30');
  const [priority, setPriority] = useState<Priority>('medium');
  const [travel, setTravel] = useState('0');

  const handleAdd = async () => {
    if (!title.trim()) return;
    await addTask({
      title: title.trim(),
      duration_minutes: parseInt(duration) || 30,
      break_after: 0,
      travel_minutes: parseInt(travel) || 0,
      priority,
      category: 'general',
      is_starred: false,
      is_done: false,
      day,
    });
    onDone();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <input
        autoFocus
        placeholder="Task title…"
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') onDone(); }}
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--tx3)', marginBottom: 4 }}>Duration (min)</div>
          <input type="number" value={duration} onChange={e => setDuration(e.target.value)} min="1" />
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--tx3)', marginBottom: 4 }}>Travel (min)</div>
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
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleAdd}>Add</button>
        <button className="btn btn-ghost" onClick={onDone}>Cancel</button>
      </div>
    </div>
  );
}
