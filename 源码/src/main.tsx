import { createRoot } from 'react-dom/client';
import { App } from './ui/App.tsx';
import './ui/styles.css';
import './ui/subtitles.css';

createRoot(document.getElementById('root')!).render(<App />);
