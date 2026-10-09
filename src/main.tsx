import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/globals.css';

const raiz = document.getElementById('root');
if (!raiz) {
  throw new Error('No se encontró el elemento #root en index.html');
}

ReactDOM.createRoot(raiz).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
