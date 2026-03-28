// pages/Detection.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { getPredictionsLive, getPredictionsRecent } from '../services/api';
import ThreatBadge from '../components/ThreatBadge';

const REFRESH_MS = 3000;

const threatColour = (level) => ({
  Normal: '#22c55e', Low: '#84cc16', Medium: '#f59e0b', High: '#ef4444', Critical: '#a855f7',
}[level] || '#22c55e');

function ScoreRing({ value = 0, max = 100, colour = '#00d4ff', label }) {
  const r = 42, cx = 56, cy = 56;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (Math.min(value, max) / max) * circumference;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <svg width="112" height="112" viewBox="0 0 112 112">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e2d45" strokeWidth="10"/>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={colour} strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: 'stroke-dashoffset 0.5s ease', filter: `drop-shadow(0 0 6px ${colour})` }}
        />
        <text x={cx} y={cy + 5} textAnchor="middle"
          fill={colour} fontSize="15" fontFamily="'Share Tech Mono', monospace" fontWeight="700">
          {typeof value === 'number' ? value.toFixed(1) : value}
        </text>
      </svg>
      <div style={{ fontSize: '0.64rem', color: '#4a6080', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        {label}
      </div>
    </div>
  );
}

export default function Detection() {
  const [result, setResult]   = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError]     = useState(null);
  const [lastUpdate, setLastUpdate] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [r, h] = await Promise.all([getPredictionsLive(), getPredictionsRecent(60)]);
      setResult(r);
      const rows = (h?.data || []).map(row => ({
        t:       (row.timestamp || '').substring(11, 19),
        threat:  parseFloat(row.final_threat_score) || 0,
        lstm:    Math.round((parseFloat(row.lstm_anomaly_prob) || 0) * 100),
        ifNorm:  Math.round(Math.max(0, (-(parseFloat(row.if_score)||0) + 0.1) / 0.6) * 100),
      }));
      setHistory(rows);
      setLastUpdate(new Date().toLocaleTimeString());
      setError(null);
    } catch (e) {
      setError('Cannot reach backend.');
    }
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchData]);

  const tc = threatColour(result?.threat_level);
  const ifNorm = result ? Math.round(Math.max(0, (-(result.if_score||0) + 0.1) / 0.6) * 100) : 0;
  const lstmPct = result ? Math.round((result.lstm_anomaly_prob||0) * 100) : 0;

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div>
            <h1 className="page-title">Detection Results</h1>
            <p className="page-subtitle">
              Hybrid ML: Isolation Forest + LSTM Autoencoder
              {lastUpdate && <span style={{ marginLeft: 12, color: '#3b82f6' }}>↻ {lastUpdate}</span>}
            </p>
          </div>
          {result && <div style={{ marginLeft: 'auto' }}><ThreatBadge level={result.threat_level} size="lg"/></div>}
        </div>
      </div>

      {error && <div className="error-box" style={{ marginBottom: 16 }}>{error}</div>}

      {result && (
        <div className="grid-3" style={{ marginBottom: 20, gap: 16 }}>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 20px' }}>
            <div className="section-title" style={{ alignSelf: 'stretch' }}>Isolation Forest</div>
            <ScoreRing value={ifNorm} colour={result.if_is_anomaly ? '#ef4444' : '#22c55e'} label="IF Anomaly Score"/>
            <div style={{ marginTop: 10, textAlign: 'center' }}>
              <ThreatBadge level={result.if_is_anomaly ? 'High' : 'Normal'} size="sm"/>
              <div style={{ fontSize: '0.68rem', color: '#4a6080', marginTop: 6 }}>
                Raw: <span style={{ fontFamily: "'Share Tech Mono', monospace", color: '#8ba3c4' }}>{(result.if_score||0).toFixed(5)}</span>
              </div>
            </div>
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 20px' }}>
            <div className="section-title" style={{ alignSelf: 'stretch' }}>LSTM Autoencoder</div>
            <ScoreRing value={lstmPct} colour={result.lstm_is_anomaly ? '#f59e0b' : '#22c55e'} label="LSTM Anomaly Prob"/>
            <div style={{ marginTop: 10, textAlign: 'center' }}>
              <ThreatBadge level={result.lstm_is_anomaly ? 'Medium' : 'Normal'} size="sm"/>
              <div style={{ fontSize: '0.68rem', color: '#4a6080', marginTop: 6 }}>
                MSE: <span style={{ fontFamily: "'Share Tech Mono', monospace", color: '#8ba3c4' }}>{(result.lstm_mse||0).toFixed(6)}</span>
              </div>
            </div>
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 20px', borderColor: tc + '55' }}>
            <div className="section-title" style={{ alignSelf: 'stretch' }}>Final Threat Score</div>
            <ScoreRing value={result.final_threat_score || 0} colour={tc} label="Combined Score"/>
            <div style={{ marginTop: 10, textAlign: 'center' }}>
              <ThreatBadge level={result.threat_level} size="md"/>
            </div>
          </div>
        </div>
      )}

      {result?.reason && (
        <div className="card" style={{ marginBottom: 20, borderLeft: `3px solid ${tc}` }}>
          <div className="section-title">Detection Reason</div>
          {result.reason.split(';').map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
              <span style={{ color: tc, fontSize: '0.8rem', marginTop: 1, flexShrink: 0 }}>▸</span>
              <span style={{ color: '#8ba3c4', fontSize: '0.82rem', lineHeight: 1.5 }}>{r.trim()}</span>
            </div>
          ))}
        </div>
      )}

      {result && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="section-title">Model Signal Summary</div>
          <table className="data-table">
            <thead>
              <tr>
                <th style={thStyle}>Signal</th>
                <th style={thStyle}>Value</th>
                <th style={thStyle}>Assessment</th>
              </tr>
            </thead>
            <tbody>
              {[
                { sig: 'IF Raw Score',          val: (result.if_score||0).toFixed(5),                          bad: !!result.if_is_anomaly },
                { sig: 'IF Anomaly Flag',        val: result.if_is_anomaly ? 'ANOMALY' : 'NORMAL',             bad: !!result.if_is_anomaly },
                { sig: 'LSTM MSE',               val: (result.lstm_mse||0).toFixed(6),                         bad: !!result.lstm_is_anomaly },
                { sig: 'LSTM Anomaly Prob',      val: `${((result.lstm_anomaly_prob||0)*100).toFixed(1)}%`,    bad: !!result.lstm_is_anomaly },
                { sig: 'CPU Usage',              val: `${result.cpu_percent || 0}%`,                           bad: (result.cpu_percent||0) > 80 },
                { sig: 'Memory Usage',           val: `${result.mem_percent || 0}%`,                           bad: (result.mem_percent||0) > 85 },
                { sig: 'Final Threat Score',     val: (result.final_threat_score||0).toFixed(2),               bad: result.threat_level !== 'Normal' },
              ].map(({ sig, val, bad }) => (
                <tr key={sig}>
                  <td style={{ color: '#8ba3c4' }}>{sig}</td>
                  <td style={{ fontFamily: "'Share Tech Mono', monospace", color: bad ? '#ef4444' : '#00d4ff' }}>{val}</td>
                  <td><ThreatBadge level={bad ? 'High' : 'Normal'} size="sm"/></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {history.length > 1 && (
        <div className="card">
          <div className="section-title">Score Trends Over Time</div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={history} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid stroke="#1e2d45" strokeDasharray="3 3"/>
              <XAxis dataKey="t" tick={{ fill: '#4a6080', fontSize: 10 }} tickLine={false}/>
              <YAxis domain={[0, 100]} tick={{ fill: '#4a6080', fontSize: 10 }} tickLine={false}/>
              <Tooltip contentStyle={{ background: '#111827', border: '1px solid #1e2d45', borderRadius: 8, fontSize: 12 }}/>
              <Legend wrapperStyle={{ fontSize: 11, color: '#8ba3c4' }}/>
              <Line type="monotone" dataKey="threat" stroke="#ef4444" dot={false} name="Threat Score" strokeWidth={2}/>
              <Line type="monotone" dataKey="lstm"   stroke="#f59e0b" dot={false} name="LSTM % (norm)" strokeWidth={1.5} strokeDasharray="4 2"/>
              <Line type="monotone" dataKey="ifNorm" stroke="#3b82f6" dot={false} name="IF Score %" strokeWidth={1.5} strokeDasharray="4 2"/>
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

const thStyle = {
  padding: '10px 14px', color: '#4a6080', fontSize: '0.7rem',
  fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
  borderBottom: '1px solid #1e2d45', background: '#0d1424',
};
