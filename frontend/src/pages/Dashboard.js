// pages/Dashboard.js — Full layout with all original elements in new black/lime-green theme
import React, { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { getStatus, getSystemHistory, getHistoryThreats } from '../services/api';
import { useApp } from '../context/AppContext';
import ThreatBadge     from '../components/ThreatBadge';
import TopRiskyWidget  from '../components/TopRiskyWidget';
import ProcessDrilldown from '../components/ProcessDrilldown';

const REFRESH_MS = 3000;

const threatColour = (level) => ({
  Normal: '#c8ff00', Low: '#84cc16',
  Medium: '#f59e0b', High: '#ef4444', Critical: '#ef4444',
}[level] || '#c8ff00');

// ── Single KPI Card ─────────────────────────────────────────────────────────────
function KpiCard({ title, value, sub, icon, colour }) {
  return (
    <div style={{
      background: 'var(--bg-card)', border: `1px solid ${colour}22`,
      borderRadius: 14, padding: '18px 20px', borderLeft: `3px solid ${colour}`,
      transition: 'background 0.25s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{title}</span>
        <span style={{ fontSize: '1.1rem', opacity: 0.7 }}>{icon}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: colour, boxShadow: `0 0 6px ${colour}`, animation: 'pulse 1.5s infinite', flexShrink: 0 }} />
        <span style={{ fontSize: '2rem', fontWeight: 800, color: colour, letterSpacing: '-0.04em', lineHeight: 1 }}>{value}</span>
      </div>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 8 }}>{sub}</div>
    </div>
  );
}

export default function Dashboard() {
  const [status, setStatus]             = useState(null);
  const [sysHistory, setSysHistory]     = useState([]);
  const [threatHistory, setThreatHistory] = useState([]);
  const [selectedProc, setSelectedProc]   = useState(null);
  const [error, setError]               = useState(null);
  const [lastUpdate, setLastUpdate]     = useState('');
  const { username } = useApp();

  const doFetch = useCallback(async () => {
    try {
      const [s, sh, th] = await Promise.all([
        getStatus(),
        getSystemHistory(60),
        getHistoryThreats(60),
      ]);
      setStatus(s);
      setSysHistory((sh || []).map(r => ({
        t: r.timestamp ? r.timestamp.substring(11, 19) : '',
        cpu: parseFloat(r.cpu_total_percent) || 0,
        mem: parseFloat(r.mem_percent) || 0,
      })));
      setThreatHistory((th?.data || []).map(r => ({
        t: r.timestamp ? r.timestamp.substring(11, 19) : '',
        score: parseFloat(r.final_threat_score) || 0,
        lstm:  parseFloat(r.lstm_anomaly_prob) * 100 || 0,
      })));
      setLastUpdate(new Date().toLocaleTimeString());
      setError(null);
    } catch (e) {
      setError('API unreachable — is the backend running?');
    }
  }, []);

  useEffect(() => {
    doFetch();
    const id = setInterval(doFetch, REFRESH_MS);
    return () => clearInterval(id);
  }, [doFetch]);

  const tc = threatColour(status?.threat_level);
  const tip = { contentStyle: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, color: 'var(--text-secondary)' }, labelStyle: { color: 'var(--text-muted)' } };

  return (
    <div>
      {/* ─── Page header ─────────────────────────────────────────── */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div>
            <h1 className="page-title">
              Hello <span style={{ color: '#c8ff00' }}>{username || 'User'}</span>
            </h1>
            <p className="page-subtitle">
              Real-time behavioral keylogger detection dashboard
              {lastUpdate && <span style={{ marginLeft: 12, color: '#c8ff00' }}>↻ {lastUpdate}</span>}
            </p>
          </div>
          {status && (
            <div style={{ marginLeft: 'auto' }}>
              <ThreatBadge level={status.threat_level} size="lg" />
            </div>
          )}
        </div>
      </div>

      {error && <div className="error-box" style={{ marginBottom: 20 }}>{error}</div>}

      {/* ─── 4 KPI Cards ─────────────────────────────────────────── */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        <KpiCard
          title="CPU Usage"
          value={status ? `${status.cpu_percent}%` : '—'}
          sub="Total system CPU"
          colour="#f59e0b"
          icon="⚡"
        />
        <KpiCard
          title="Memory Usage"
          value={status ? `${status.mem_percent}%` : '—'}
          sub="RAM utilisation"
          colour="#a855f7"
          icon="🧠"
        />
        <KpiCard
          title="Active Processes"
          value={status?.active_process_count ?? '—'}
          sub="Running right now"
          colour="#3b82f6"
          icon="⚙️"
        />
        <KpiCard
          title="Threat Score"
          value={status ? `${status.final_threat_score}` : '—'}
          sub={`Level: ${status?.threat_level || '…'}`}
          colour={tc}
          icon="🛡️"
        />
      </div>

      {/* ─── Two Charts ──────────────────────────────────────────── */}
      <div className="grid-2" style={{ gap: 16, marginBottom: 20 }}>
        {/* CPU & Memory Trend */}
        <div className="card">
          <div className="section-title">CPU &amp; Memory Trend</div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={sysHistory} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gcpu" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#c8ff00" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#c8ff00" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="gmem" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#a855f7" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#1e1e1e" strokeDasharray="3 3"/>
              <XAxis dataKey="t" tick={{ fill: '#444', fontSize: 9 }} tickLine={false} axisLine={false}/>
              <YAxis domain={[0,100]} tick={{ fill: '#444', fontSize: 9 }} tickLine={false} axisLine={false}/>
              <Tooltip {...tip}/>
              <Legend wrapperStyle={{ fontSize: 11, color: '#555' }}/>
              <Area type="monotone" dataKey="cpu" stroke="#c8ff00" fill="url(#gcpu)" name="CPU %" strokeWidth={2} dot={false}/>
              <Area type="monotone" dataKey="mem" stroke="#a855f7" fill="url(#gmem)" name="MEM %" strokeWidth={2} dot={false}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Threat Score Trend */}
        <div className="card">
          <div className="section-title">Threat Score Trend</div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={threatHistory} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid stroke="#1e1e1e" strokeDasharray="3 3"/>
              <XAxis dataKey="t" tick={{ fill: '#444', fontSize: 9 }} tickLine={false} axisLine={false}/>
              <YAxis domain={[0,100]} tick={{ fill: '#444', fontSize: 9 }} tickLine={false} axisLine={false}/>
              <Tooltip {...tip}/>
              <Legend wrapperStyle={{ fontSize: 11, color: '#555' }}/>
              <Line type="monotone" dataKey="score" stroke="#ef4444" dot={false} name="Threat Score" strokeWidth={2}/>
              <Line type="monotone" dataKey="lstm"  stroke="#c8ff00" dot={false} name="LSTM Prob %" strokeWidth={1.5} strokeDasharray="4 2"/>
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ─── Session Stats + Top Risky Processes ─────────────────── */}
      <div className="grid-2" style={{ gap: 16 }}>
        {/* Session Statistics */}
        {status && (
          <div className="card">
            <div className="section-title">Session Statistics</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {[{label:'Keyboard Events',val:status.keyboard_event_count||0},{label:'Uptime',val:formatUptime(status.uptime_seconds||0)},{label:'Threat Level',val:<ThreatBadge level={status.threat_level} size="sm" />},{label:'Process Count',val:status.active_process_count||0}].map(({label,val})=>(
                <div key={label}>
                  <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 5 }}>{label}</div>
                  <div style={{ fontWeight: 700, color: 'var(--accent)', fontSize: '1.1rem' }}>{val}</div>
                </div>
              ))}
            </div>

            {/* Report downloads */}
            <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid var(--border)', display: 'flex', gap: 10 }}>
              <a href="http://localhost:8000/reports/download/csv" target="_blank" rel="noreferrer" style={dlBtn('#c8ff00')}>
                ⬇ CSV Report
              </a>
              <a href="http://localhost:8000/reports/download/json" target="_blank" rel="noreferrer" style={dlBtn('#a855f7')}>
                ⬇ JSON Report
              </a>
            </div>
          </div>
        )}

        {/* Top Risky Processes */}
        <TopRiskyWidget onSelectProcess={setSelectedProc}/>
      </div>

      {/* Drill-down modal */}
      {selectedProc && <ProcessDrilldown process={selectedProc} onClose={() => setSelectedProc(null)}/>}
    </div>
  );
}

function formatUptime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

const dlBtn = (color) => ({
  display: 'inline-flex', alignItems: 'center', gap: 5,
  background: color + '14', border: `1px solid ${color}30`,
  color, borderRadius: 7, padding: '6px 14px',
  fontSize: '0.72rem', fontWeight: 600, textDecoration: 'none',
  transition: 'background 0.15s',
});
