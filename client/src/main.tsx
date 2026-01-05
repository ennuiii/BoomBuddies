import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/unified.css';

// Register service worker for PWA support (production only)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/bomberman/sw.js').catch((err) => {
      console.warn('Service worker registration failed:', err);
    });
  });
}

// Note: StrictMode removed to prevent socket double-connection issues
// React StrictMode causes useEffect to run twice in development, which
// interferes with WebSocket connections
createRoot(document.getElementById('root')!).render(<App />);
