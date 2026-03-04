import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles.css';
import { AuthProvider } from './auth/auth';
import { pushClientLog, flushClientLogs } from './api/client';

window.addEventListener('error', (event) => {
  pushClientLog({
    event: 'client_error',
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    ts: new Date().toISOString()
  });
  flushClientLogs();
});

window.addEventListener('unhandledrejection', (event) => {
  pushClientLog({
    event: 'client_unhandledrejection',
    reason: event.reason ? String(event.reason) : '',
    ts: new Date().toISOString()
  });
  flushClientLogs();
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
