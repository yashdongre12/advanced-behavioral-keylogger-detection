// pages/Alerts.js
import React, { useState, useEffect, useCallback } from 'react';
import { getAlertsHistory, getDownloadUrl } from '../services/api';
import ThreatBadge from '../components/ThreatBadge';

const REFRESH_MS = 5000;
const LEVELS = ['All', 'Critical', 'High', 'Medium', 'Low'];

export default function Alerts() {
  const [alerts, setAlerts]   = useState([]);
  const [filter, setFilter]   = useState('All');
  const [page, setPage]       = useState(1);
  const [total, setTotal]     = useState(0);
  const [error, setError]     = useState(null);
  const [lastUpdate, setLastUpdate] = useState('');
  const perPage = 25;

  const fetchData = useCallback(async () => {
    try {
      const level = filter === 'All' ? '' : filter;
      const h = await getAlertsHistory(page, perPage, level);
      setAlerts(h.data || []);
      setTotal(h.total || 0);
      setLastUpdate(new Date().toLocaleTimeString());
      setError(null);
    } catch (e) {
      setError('Cannot fetch alerts.');
    }
  }, [filter, page]);

  useEffect(() => { fetchData(); const id = setInterval(fetchData, REFRESH_MS); return () => clearInterval(id); }, [fetchData]);

  const totalPages = Math.ceil(total / perPage) || 1;

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 className="page-title">Security Alerts</h1>
            <p className="page-subtitle">{total} total alerts {lastUpdate && <span style={{ marginLeft: 12, color: '#3b82f6' }}>↻ {lastUpdate}</span>}</p>
          </div>
          <a href={getDownloadUrl('alerts.csv')} style={downloadBtn} target="_blank" rel="noreferrer">⬇ Download CSV</a>
        </div>
      </div>
      {error && <div className="error-box" style={{ marginBottom: 16 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
        {LEVELS.map(l => (
          <button key={l} onClick={() => { setFilter(l); setPage(1); }} style={{ ...filterBtn, background: filter === l ? 'rgba(0,212,255,0.1)' : 'transparent', color: filter === l ? '#00d4ff' : '#8ba3c4', borderColor: filter === l ? '#00d4ff' : '#1e2d45' }}>
            {l}
          </button>
        ))}
      </div>
      <div className="card" style={{ padding: 0, overflowX: 'auto', marginBottom: 16 }}>
        <table className="data-table">
          <thead>
            <tr>{['Timestamp','Level','Score','IF Score','LSTM Prob','Process','CPU','MEM','Reason'].map(h => (<th key={h} style={thStyle}>{h}</th>))}</tr>
          </thead>
          <tbody>
            {alerts.length === 0 ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: 32, color: '#4a6080' }}>No alerts{filter !== 'All' ? ` for level: ${filter}` : ''}</td></tr>
            ) : alerts.map((a, i) => (
              <tr key={i} className={['High','Critical'].includes(a.threat_level) ? 'suspicious' : ''}>
                <td style={{ fontSize: '0.73rem', whiteSpace: 'nowrap' }}>{(a.timestamp||'').substring(0,19).replace('T',' ')}</td>
                <td><ThreatBadge level={a.threat_level} size="sm"/></td>
                <td style={{ color: '#ef4444' }}>{parseFloat(a.final_threat_score||0).toFixed(1)}</td>
                <td>{parseFloat(a.if_score||0).toFixed(4)}</td>
                <td>{(parseFloat(a.lstm_anomaly_prob||0)*100).toFixed(1)}%</td>
                <td style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.top_process||'—'}</td>
                <td>{parseFloat(a.cpu_percent||0).toFixed(1)}%</td>
                <td>{parseFloat(a.mem_percent||0).toFixed(1)}%</td>
                <td style={{ maxWidth: 240, color: '#8ba3c4', fontSize: '0.73rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><span title={a.reason}>{a.reason}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page <= 1} style={pageBtn}>← Prev</button>
        <span style={{ color: '#4a6080', fontSize: '0.78rem', fontFamily: "'Share Tech Mono', monospace" }}>Page {page} / {totalPages}</span>
        <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page >= totalPages} style={pageBtn}>Next →</button>
      </div>
    </div>
  );
}

const thStyle = { padding: '10px 14px', color: '#4a6080', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', borderBottom: '1px solid #1e2d45', background: '#0d1424', whiteSpace: 'nowrap' };
const filterBtn = { padding: '5px 14px', borderRadius: 999, border: '1px solid', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, fontFamily: "'Share Tech Mono', monospace", transition: 'all 0.15s' };
const downloadBtn = { display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.3)', color: '#00d4ff', borderRadius: 8, padding: '7px 14px', fontSize: '0.78rem', fontWeight: 600, textDecoration: 'none', fontFamily: "'Share Tech Mono', monospace" };
const pageBtn = { background: '#111827', border: '1px solid #1e2d45', color: '#8ba3c4', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: '0.75rem', fontFamily: "'Share Tech Mono', monospace" };
