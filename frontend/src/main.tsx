import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const style = document.createElement('style');
style.textContent = `
  @keyframes spin { to { transform: rotate(360deg); } }
  input:focus, select:focus {
    border-color: var(--blue) !important;
    box-shadow: 0 0 0 3px var(--blue-dim);
  }
  button:hover:not(:disabled) { opacity: 0.88; }
  select option { background: #1c1c28; }
`;
document.head.appendChild(style);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
