import { createRoot } from 'react-dom/client';
import './styles/app.css';
import App from './app/App';

// StrictMode is deliberately not enabled: its double effect invocation would
// double every relay request during development, and the relay is rate limited.
const root = document.getElementById('root');
if (!root) throw new Error('Missing #root');
createRoot(root).render(<App />);
