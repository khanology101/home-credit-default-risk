import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { ApplicantProvider } from './context/ApplicantContext';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <ApplicantProvider>
    <App />
  </ApplicantProvider>
);
