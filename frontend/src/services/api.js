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

const getMockState = () => {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    return params.get('mock');
  }
  return null;
};

// ── Endpoints ─────────────────────────────────────────────────

/** Health / meta */
export const getHealth    = () => api.get('/health');
export const getStatus    = () => {
  const mock = getMockState();
  if (mock === '1') return Promise.resolve({ threat_level: 'Normal', cpu_percent: 12.4, mem_percent: 45.2, active_process_count: 142, final_threat_score: 5.2, keyboard_event_count: 34, uptime_seconds: 12400 });
  if (mock === '2') return Promise.resolve({ threat_level: 'Medium', cpu_percent: 88.5, mem_percent: 62.1, active_process_count: 245, final_threat_score: 65.4, keyboard_event_count: 120, uptime_seconds: 12500 });
  if (mock === '3') return Promise.resolve({ threat_level: 'Critical', cpu_percent: 34.2, mem_percent: 48.6, active_process_count: 148, final_threat_score: 98.7, keyboard_event_count: 4520, uptime_seconds: 12600 });
  if (mock === '4') return Promise.resolve({ threat_level: 'High', cpu_percent: 99.1, mem_percent: 92.4, active_process_count: 380, final_threat_score: 82.5, keyboard_event_count: 65, uptime_seconds: 12700 });
  return api.get('/status');
};

/** System */
export const getSystemLive    = () => api.get('/system/live');
export const getSystemHistory = (n = 60) => {
  const mock = getMockState();
  if (mock) {
    const data = [];
    for(let i=0; i<n; i++) {
       data.push({ timestamp: new Date(Date.now() - (n-i)*3000).toISOString(), cpu_total_percent: mock==='4'? 95+Math.random()*5 : (mock==='2'? 80+Math.random()*15 : 10+Math.random()*20), mem_percent: mock==='4'? 90+Math.random()*5 : 40+Math.random()*10 });
    }
    return Promise.resolve(data);
  }
  return api.get(`/system/history?n=${n}`);
};

/** Processes */
export const getProcessLive       = () => api.get('/process/live');
export const getProcessSuspicious = (n = 10) => {
  const mock = getMockState();
  if (mock === '1') return Promise.resolve([]);
  if (mock === '2') return Promise.resolve([
    { name: 'unknown_miner.exe', pid: 4012, cpu_percent: 65.4, suspicion_score: 0.68, is_background: true },
    { name: 'cmd.exe', pid: 512, cpu_percent: 15.2, suspicion_score: 0.45, is_background: true }
  ]);
  if (mock === '3') return Promise.resolve([
    { name: 'winlogon_hook.exe', pid: 8824, cpu_percent: 2.1, suspicion_score: 0.98, is_background: true },
    { name: 'conhost.exe', pid: 992, cpu_percent: 0.1, suspicion_score: 0.55, is_background: true }
  ]);
  if (mock === '4') return Promise.resolve([
    { name: 'backup_service.exe', pid: 1102, cpu_percent: 85.0, suspicion_score: 0.75, is_background: true }
  ]);
  return api.get(`/process/suspicious?n=${n}`);
};

/** Keyboard */
export const getKeyboardLive    = () => api.get('/keyboard/live');
export const getKeyboardHistory = (n = 50) => api.get(`/keyboard/history?n=${n}`);

/** Predictions / Detection */
export const getPredictionsLive   = () => api.get('/predictions/live');
export const getPredictionsRecent = (n = 50) => api.get(`/predictions/recent?n=${n}`);

/** Alerts */
export const getAlertsLive    = () => api.get('/alerts/live');
export const getAlertsRecent  = (n = 50) => {
  const mock = getMockState();
  if (mock === '1') return Promise.resolve({ data: [] });
  if (mock === '2') return Promise.resolve({ data: [] });
  if (mock === '3') return Promise.resolve({ data: [
    { id: 101, threat_level: 'Critical', timestamp: new Date().toISOString(), reason: 'LSTM detected anomalous temporal sequence (prob=0.99)', final_threat_score: 98.7, cpu_percent: 34.2, top_process: 'winlogon_hook.exe' }
  ]});
  if (mock === '4') return Promise.resolve({ data: [
    { id: 102, threat_level: 'High', timestamp: new Date().toISOString(), reason: 'High Resource Anomaly: Excessive Disk & Network Activity', final_threat_score: 82.5, cpu_percent: 99.1, top_process: 'backup_service.exe' }
  ]});
  return api.get(`/alerts/recent?n=${n}`);
};
export const getAlertsHistory = (page = 1, perPage = 50, level = '') =>
  api.get(`/alerts/history?page=${page}&per_page=${perPage}${level ? `&level=${level}` : ''}`);

/** Historical analytics */
export const getHistoryMetrics  = (n = 100) => api.get(`/history/metrics?n=${n}`);
export const getHistoryThreats  = (n = 100) => {
  const mock = getMockState();
  if (mock) {
     const data = [];
     for(let i=0; i<n; i++) {
        data.push({ timestamp: new Date(Date.now() - (n-i)*3000).toISOString(), final_threat_score: mock==='3'? 95+Math.random()*4 : (mock==='4'? 80+Math.random()*5 : (mock==='2'? 60+Math.random()*10 : 5+Math.random()*2)), lstm_anomaly_prob: mock==='3'? 0.99 : 0.05 });
     }
     return Promise.resolve({ data });
  }
  return api.get(`/history/threats?n=${n}`);
};
export const getHistoryKeyboard = (n = 100) => api.get(`/history/keyboard?n=${n}`);

/** CSV downloads */
export const getDownloadUrl = (filename) => `${BASE_URL}/download/${filename}`;

export default api;
