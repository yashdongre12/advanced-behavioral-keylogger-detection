// services/api.js
// ──────────────────────────────────────────────────────────────
// Centralised Axios API client for all backend endpoints.
// All calls target the FastAPI server at localhost:8000.
// ──────────────────────────────────────────────────────────────

import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 8000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Interceptors ──────────────────────────────────────────────
api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    console.error('[API]', err.message);
    return Promise.reject(err);
  }
);

// ── Endpoints ─────────────────────────────────────────────────

/** Health / meta */
export const getHealth    = () => api.get('/health');
export const getStatus    = () => api.get('/status');

/** System */
export const getSystemLive    = () => api.get('/system/live');
export const getSystemHistory = (n = 60) => api.get(`/system/history?n=${n}`);

/** Processes */
export const getProcessLive       = () => api.get('/process/live');
export const getProcessSuspicious = (n = 10) => api.get(`/process/suspicious?n=${n}`);

/** Keyboard */
export const getKeyboardLive    = () => api.get('/keyboard/live');
export const getKeyboardHistory = (n = 50) => api.get(`/keyboard/history?n=${n}`);

/** Predictions / Detection */
export const getPredictionsLive   = () => api.get('/predictions/live');
export const getPredictionsRecent = (n = 50) => api.get(`/predictions/recent?n=${n}`);

/** Alerts */
export const getAlertsLive    = () => api.get('/alerts/live');
export const getAlertsRecent  = (n = 50) => api.get(`/alerts/recent?n=${n}`);
export const getAlertsHistory = (page = 1, perPage = 50, level = '') =>
  api.get(`/alerts/history?page=${page}&per_page=${perPage}${level ? `&level=${level}` : ''}`);

/** Historical analytics */
export const getHistoryMetrics  = (n = 100) => api.get(`/history/metrics?n=${n}`);
export const getHistoryThreats  = (n = 100) => api.get(`/history/threats?n=${n}`);
export const getHistoryKeyboard = (n = 100) => api.get(`/history/keyboard?n=${n}`);

/** CSV downloads */
export const getDownloadUrl = (filename) => `${BASE_URL}/download/${filename}`;

export default api;
