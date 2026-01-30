import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './i18n/config'; // Initialize i18n
import './src/index.css'; // Import Tailwind CSS

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
