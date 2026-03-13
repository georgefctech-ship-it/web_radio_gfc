import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { PlayerProvider } from './context/PlayerContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import App from './App.tsx';
import './index.css';

console.log("Mounting application...");
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <PlayerProvider>
          <App />
        </PlayerProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);
