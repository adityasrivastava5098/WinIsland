// ============================================================
// React Entry Point
// Mounts the Dynamic Island root component into the DOM.
// ============================================================

import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/index.css';

const root = createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
