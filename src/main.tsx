import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'sonner';

import '@fontsource/space-grotesk/latin-500.css';
import '@fontsource/space-grotesk/latin-ext-500.css';
import '@fontsource/space-grotesk/latin-700.css';
import '@fontsource/space-grotesk/latin-ext-700.css';
import '@fontsource/inter-tight/latin-400.css';
import '@fontsource/inter-tight/latin-ext-400.css';
import '@fontsource/inter-tight/latin-600.css';
import '@fontsource/inter-tight/latin-ext-600.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import '@fontsource/ibm-plex-mono/latin-ext-500.css';

import './index.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Toaster position="bottom-right" richColors />
  </StrictMode>,
);
