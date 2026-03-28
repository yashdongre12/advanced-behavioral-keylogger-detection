// pages/Downloads.js
// ─────────────────────────────────────────────────────────────────────────────
// A dedicated page to download reports (JSON/CSV) and raw log files.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect } from 'react';
import axios from 'axios';

const BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const RAW_LOGS = [
  { name: 'keyboard_logs.csv',     icon: '⌨️', label: 'Keyboard Logs',      desc: 'Raw keystroke event log' },
  { name: 'keyboard_features.csv', icon: '📊', label: 'Keyboard Features',  desc: 'Extracted typing behaviour features' },
  { name: 'process_logs.csv',      icon: '⚙️', label: 'Process Logs',       desc: 'Process monitoring snapshots' },
  { name: 'system_logs.csv',       icon: '🖥️', label: 'System Metrics',     desc: 'CPU, memory & system resource logs' },
  { name: 'predictions.csv',       icon: '🤖', label: 'ML Predictions',     desc: 'Detection engine output history' },
  { name: 'alerts.csv',            icon: '🚨', label: 'Alert History',      desc: 'Threat alerts that were triggered' },
];

export default function Downloads() {
  const [reportState, setReportState] = useState({ csv: 'idle', json: 'idle' });
  const [prevReports, setPrevReports] = useState([]);
  const [reportsErr, setReportsErr]   = useState('');

  useEffect(() => {
    axios.get(`${BASE}/reports/list`)
      .then(res => setPrevReports(res.data || []))
      .catch(() => setReportsErr('Could not fetch previous reports.'));
  }, []);

  const downloadReport = async (type) => {
    setReportState(s => ({ ...s, [type]: 'loading' }));
    try {
      const res = await axios.get(`${BASE}/reports/download/${type}`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: res.headers['content-type'] });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      const ts   = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      a.href     = url;
      a.download = `sentinel_report_${ts}.${type}`;
      a.click();
      URL.revokeObjectURL(url);
      setReportState(s => ({ ...s, [type]: 'done' }));
    } catch (e) {
      const detail = e.response?.data?.detail || e.message;
      setReportState(s => ({ ...s, [type]: 'error:' + detail }));
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Downloads</h1>
        <p className="page-subtitle">Export reports and raw telemetry log files</p>
      </div>

      {/* ── Threat Summary Reports ─────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="section-title" style={{ marginBottom: 16 }}>📋 Threat Summary Reports</div>
        <p style={{ fontSize: '0.78rem', color: '#4a6080', marginBottom: 20, lineHeight: 1.7 }}>
          Generates a fresh summary report from all accumulated telemetry data.
          The backend must have processed at least some data for these to work.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <DownloadButton
            label="Download JSON Report"
            icon="{ }"
            color="#8b5cf6"
            state={reportState.json}
            onClick={() => downloadReport('json')}
          />
          <DownloadButton
            label="Download CSV Report"
            icon="⬇"
            color="#00d4ff"
            state={reportState.csv}
            onClick={() => downloadReport('csv')}
          />
        </div>

        {/* Previous reports list */}
        {prevReports.length > 0 && (
          <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #1e2d45' }}>
            <div style={styles.subTitle}>Previously Generated Reports</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
              {prevReports.map((r) => (
                <div key={r.filename} style={styles.reportRow}>
                  <span style={{ color: '#8ba3c4', fontSize: '0.75rem', fontFamily: "'Share Tech Mono', monospace" }}>
                    {r.filename}
                  </span>
                  <span style={{ color: '#4a6080', fontSize: '0.7rem' }}>
                    {r.size_kb} KB · {r.created_at?.slice(0, 19).replace('T', ' ')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        {reportsErr && <p style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: 12 }}>{reportsErr}</p>}
      </div>

      {/* ── Raw Log Files ─────────────────────────────────────────────────── */}
      <div className="card">
        <div className="section-title" style={{ marginBottom: 16 }}>🗂️ Raw Log Files</div>
        <p style={{ fontSize: '0.78rem', color: '#4a6080', marginBottom: 20, lineHeight: 1.7 }}>
          Direct download links for each raw telemetry CSV log file. These files are written in real-time
          by the monitors and may not exist yet if the system has just started.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {RAW_LOGS.map(log => (
            <RawLogCard key={log.name} log={log} />
          ))}
        </div>
      </div>
    </div>
  );
}

function DownloadButton({ label, icon, color, state, onClick }) {
  const isLoading = state === 'loading';
  const isDone    = state === 'done';
  const isError   = state.startsWith('error:');
  const errMsg    = isError ? state.slice(6) : '';

  return (
    <div>
      <button
        onClick={onClick}
        disabled={isLoading}
        style={{
          ...styles.btn,
          borderColor: `rgba(${hexToRgb(color)},0.4)`,
          color,
          background: `rgba(${hexToRgb(color)},0.07)`,
          cursor: isLoading ? 'wait' : 'pointer',
          opacity: isLoading ? 0.7 : 1,
        }}
      >
        <span>{isLoading ? '⏳ Generating…' : isDone ? '✓ Downloaded' : `${icon} ${label}`}</span>
      </button>
      {isError && (
        <div style={{ color: '#ef4444', fontSize: '0.7rem', marginTop: 6, maxWidth: 260 }}>
          ⚠ {errMsg}
        </div>
      )}
    </div>
  );
}

function RawLogCard({ log }) {
  const [status, setStatus] = useState('idle');

  const handleClick = async () => {
    setStatus('loading');
    try {
      const res = await axios.get(
        `${BASE}/download/${log.name}`,
        { responseType: 'blob' }
      );
      const blob = new Blob([res.data], { type: 'text/csv' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = log.name;
      a.click();
      URL.revokeObjectURL(url);
      setStatus('done');
    } catch (e) {
      setStatus('error');
    }
  };

  return (
    <div style={styles.logCard}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: '1.3rem' }}>{log.icon}</span>
        <div>
          <div style={{ color: '#e2e8f0', fontSize: '0.82rem', fontWeight: 600 }}>{log.label}</div>
          <div style={{ color: '#4a6080', fontSize: '0.66rem' }}>{log.desc}</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <code style={{ fontSize: '0.62rem', color: '#2a3a52' }}>{log.name}</code>
        <button onClick={handleClick} disabled={status === 'loading'} style={styles.smallBtn}>
          {status === 'loading' ? '⏳' : status === 'done' ? '✓' : status === 'error' ? '✗ N/A' : '⬇ Download'}
        </button>
      </div>
    </div>
  );
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? `${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)}`
    : '0,212,255';
}

const styles = {
  btn: {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    border: '1px solid',
    borderRadius: 8, padding: '10px 20px',
    fontSize: '0.8rem', fontWeight: 700,
    letterSpacing: '0.06em',
    fontFamily: "'Share Tech Mono', monospace",
    transition: 'opacity 0.2s',
  },
  smallBtn: {
    background: 'rgba(0,212,255,0.07)',
    border: '1px solid rgba(0,212,255,0.25)',
    borderRadius: 6, padding: '4px 10px',
    color: '#00d4ff', fontSize: '0.68rem',
    fontFamily: "'Share Tech Mono', monospace",
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  logCard: {
    background: '#070b14',
    border: '1px solid #1e2d45',
    borderRadius: 10, padding: '14px 16px',
  },
  subTitle: {
    fontSize: '0.65rem', fontWeight: 700,
    letterSpacing: '0.12em', color: '#4a6080',
    textTransform: 'uppercase',
  },
  reportRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '8px 10px',
    background: '#070b14',
    borderRadius: 6, border: '1px solid #1e2d45',
  },
};
