import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App'; // <--- ИМПОРТИРУЕМ ФАЙЛ С МАРШРУТИЗАЦИЕЙ
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);