import { useEffect } from 'react';
import { useStore } from './store';
import { SidebarHeader } from './components/layout/SidebarHeader';
import { TaskList } from './components/tasks/TaskList';
import { Timeline } from './components/timeline/Timeline';
import { ChatPanel } from './components/chat/ChatPanel';
import './styles/globals.css';

export default function App() {
  const { config } = useStore();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', config.theme);
  }, [config.theme]);

  return (
    <div className="shell">
      <aside className="sidebar">
        <SidebarHeader />
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <TaskList />
        </div>
      </aside>
      <main className="main">
        <Timeline />
      </main>
      <ChatPanel />
    </div>
  );
}
