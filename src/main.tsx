import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { useStore } from './store/index.ts';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// ── Reliable saveDayStats: runs every 5 minutes ──
// This ensures stats are saved even if user never closes the tab
setInterval(() => {
  useStore.getState().saveDayStats();
}, 5 * 60 * 1000);

// Also save on visibility change (tab hide/switch)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    useStore.getState().saveDayStats();
  }
});
