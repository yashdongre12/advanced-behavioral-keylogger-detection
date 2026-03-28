// pages/Processes.js
import React, { useState, useEffect, useCallback } from 'react';
import { getProcessLive, getProcessSuspicious } from '../services/api';
import ThreatBadge from '../components/ThreatBadge';
import ProcessDrilldown from '../components/ProcessDrilldown';

const REFRESH_MS = 4000;

function susLevel(score) {
  if (score >= 0.7) return 'Critical';
  if (score >= 0.5) return 'High';
  if (score >= 0.3) return 'Medium';
  if (score >= 0.1) return 'Low';
  return 'Normal';
}

function BarMini({ value, max = 100, colour = '#3b82f6' }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div style={{ width: 60, height: 4, background: '#1e2d45', borderRadius: 2, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: colour, borderRadius: 2, transition: 'width 0.3s' }}/>
    </div>
  );
}

export default function Processes() {
  const [processes, setProcesses] = useState([]);
  const [suspicious, setSuspicious] = useState([]);
  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState('suspicion_score');
  const [sortDir, setSortDir] = useState('desc');
  const [selectedProc, setSelectedProc] = useState(null);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [live, sus] = await Promise.all([getProcessLive(), getProcessSuspicious(10)]);
      setProcesses(live.processes || []);
      setSuspicious(sus || []);
      setLastUpdate(new Date().toLocaleTimeString());
      setError(null);
    } catch (e) {
      setError('Failed to fetch process data.');
    }
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchData]);

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  };

  const filtered = processes
    .filter(p => !search || p.name?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const va = a[sortCol] ?? 0;
      const vb = b[sortCol] ?? 0;
      return sortDir === 'asc' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
    });

  const SortHdr = ({ col, label }) => (
    <th onClick={() => handleSort(col)} style={{ ...thStyle, cursor: 'pointer', userSelect: 'none' }}>
      {label} {sortCol === col ? (sortDir === 'asc' ? '↑' : '↓') : ''}
    </th>
  );

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Process Monitor</h1>
        <p className="page-subtitle">
          {processes.length} processes · {suspicious.filter(p => p.suspicion_score > 0.3).length} suspicious
          {lastUpdate && <span style={{ marginLeft: 12, color: '#3b82f6' }}>↻ {lastUpdate}</span>}
        </p>
      </div>

      {error && <div className="error-box" style={{ marginBottom: 16 }}>{error}</div>}

      {/* Top suspicious panel */}
      {suspicious.some(p => p.suspicion_score > 0.1) && (
        <div className="card" style={{ marginBottom: 20, borderColor: '#ef444466' }}>
          <div className="section-title" style={{ color: '#ef4444' }}>⚠ Top Suspicious Processes</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {suspicious.filter(p => p.suspicion_score > 0.1).slice(0, 6).map(p => (
              <div key={p.pid} style={susChip(p.suspicion_score)}>
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.8rem', color: '#e2e8f0' }}>
                  {p.name}
                </div>
                <div style={{ fontSize: '0.65rem', color: '#8ba3c4', marginTop: 2 }}>
                  PID {p.pid} · Score {p.suspicion_score?.toFixed(2)}
                </div>
                <ThreatBadge level={susLevel(p.suspicion_score)} size="sm" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search bar */}
      <div style={{ marginBottom: 14 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search process name…"
          style={searchStyle}
        />
      </div>

      {/* Process table */}
      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <SortHdr col="name"             label="Process Name" />
              <SortHdr col="pid"              label="PID" />
              <SortHdr col="cpu_percent"      label="CPU %" />
              <SortHdr col="mem_percent"      label="MEM %" />
              <SortHdr col="num_threads"      label="Threads" />
              <SortHdr col="status"           label="Status" />
              <SortHdr col="suspicion_score"  label="Suspicion" />
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 200).map(p => {
              const sus = p.suspicion_score > 0.3;
              return (
                <tr key={`${p.pid}-${p.name}`} className={sus ? 'suspicious' : ''}
                    onClick={() => setSelectedProc(p)}
                    style={{ cursor: 'pointer' }}>
                  <td style={{ color: '#e2e8f0', fontWeight: sus ? 600 : 400 }}>
                    {p.name}
                    {p.is_background && (
                      <span style={{ marginLeft: 6, fontSize: '0.6rem', color: '#4a6080',
                        background: '#0d1424', borderRadius: 4, padding: '1px 5px' }}>BG</span>
                    )}
                  </td>
                  <td>{p.pid}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {p.cpu_percent?.toFixed(1)}%
                      <BarMini value={p.cpu_percent} colour="#3b82f6"/>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {p.mem_percent?.toFixed(1)}%
                      <BarMini value={p.mem_percent} colour="#8b5cf6"/>
                    </div>
                  </td>
                  <td>{p.num_threads}</td>
                  <td>
                    <span style={{ fontSize: '0.7rem', padding: '2px 7px', borderRadius: 4,
                      background: p.status === 'running' ? 'rgba(34,197,94,0.1)' : '#0d1424',
                      color: p.status === 'running' ? '#22c55e' : '#8ba3c4' }}>
                      {p.status}
                    </span>
                  </td>
                  <td>
                    <ThreatBadge level={susLevel(p.suspicion_score)} size="sm"/>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: '#4a6080' }}>No processes found.</div>
        )}
      </div>

      {selectedProc && (
        <ProcessDrilldown process={selectedProc} onClose={() => setSelectedProc(null)} />
      )}
    </div>
  );
}

const thStyle = { padding: '10px 14px', color: '#4a6080', fontSize: '0.7rem',
  fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
  borderBottom: '1px solid #1e2d45', background: '#0d1424', };

const searchStyle = {
  background: '#111827', border: '1px solid #1e2d45', borderRadius: 8,
  color: '#e2e8f0', padding: '8px 14px', fontSize: '0.82rem',
  width: 280, outline: 'none', fontFamily: "'Share Tech Mono', monospace",
};

const susChip = (score) => ({
  background: score > 0.5 ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.06)',
  border: `1px solid ${score > 0.5 ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.2)'}`,
  borderRadius: 10, padding: '10px 14px',
  display: 'flex', flexDirection: 'column', gap: 4, minWidth: 160,
});
