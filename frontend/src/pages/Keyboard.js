// pages/Keyboard.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { getKeyboardLive, getKeyboardHistory } from '../services/api';

const REFRESH_MS = 3000;

function MetricRow({ label, value, unit = '', max = 1, colour = '#00d4ff' }) {
  const pct = Math.min(100, (parseFloat(value) / max) * 100);
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: '0.72rem', color: '#8ba3c4', fontWeight: 600, letterSpacing: '0.06em' }}>{label}</span>
        <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.82rem', color: colour }}>
          {value}{unit}
        </span>
      </div>
      <div style={{ height: 4, background: '#1e2d45', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: colour, borderRadius: 2, transition: 'width 0.4s ease' }}/>
      </div>
    </div>
  );
}

export default function Keyboard() {
  const [live, setLive]       = useState({});
  const [history, setHistory] = useState([]);
  const [error, setError]     = useState(null);
  const [lastUpdate, setLastUpdate] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [l, h] = await Promise.all([getKeyboardLive(), getKeyboardHistory(80)]);
      setLive(l || {});
      const rows = (h?.data || []).map((r, i) => ({
        i,
        t:      r.timestamp ? r.timestamp.substring(11, 19) : '',
        speed:  parseFloat(r.typing_speed_kps) || 0,
        hold:   parseFloat(r.avg_hold_ms) || 0,
        delay:  parseFloat(r.avg_inter_key_ms) || 0,
        burst:  parseFloat(r.burst_score) || 0,
        repeat: parseFloat(r.repeat_key_ratio) || 0,
      }));
      setHistory(rows);
      setLastUpdate(new Date().toLocaleTimeString());
      setError(null);
    } catch (e) {
      setError('Keyboard data unavailable — ensure backend is running.');
    }
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchData]);

  const f = (key, dec = 2) => (parseFloat(live[key]) || 0).toFixed(dec);
  const hasData = live.event_count > 0;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Keyboard Behavior</h1>
        <p className="page-subtitle">
          Typing analytics from real keystroke monitoring
          {lastUpdate && <span style={{ marginLeft: 12, color: '#3b82f6' }}>↻ {lastUpdate}</span>}
        </p>
      </div>

      {error && <div className="error-box" style={{ marginBottom: 16 }}>{error}</div>}

      {!hasData && !error && (
        <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)',
          borderRadius: 10, padding: '14px 18px', marginBottom: 20, fontSize: '0.82rem', color: '#8ba3c4' }}>
          ⌨️ Start typing to generate keyboard behavioral data. The monitor captures keystrokes in real time.
        </div>
      )}

      <div className="grid-2" style={{ gap: 16, marginBottom: 20 }}>
        {/* Live metrics */}
        <div className="card">
          <div className="section-title">Live Behavioral Metrics</div>
          <MetricRow label="Typing Speed"        value={f('typing_speed_kps', 2)} unit=" kps" max={10}   colour="#00d4ff"/>
          <MetricRow label="Avg Hold Duration"   value={f('avg_hold_ms', 0)}      unit=" ms"  max={500}  colour="#3b82f6"/>
          <MetricRow label="Avg Inter-Key Delay" value={f('avg_inter_key_ms', 0)} unit=" ms"  max={2000} colour="#8b5cf6"/>
          <MetricRow label="Burst Score"         value={f('burst_score', 3)}      unit=""     max={1}    colour="#f59e0b"/>
          <MetricRow label="Backspace Ratio"     value={f('backspace_ratio', 3)}  unit=""     max={0.5}  colour="#ef4444"/>
          <MetricRow label="Enter Key Ratio"     value={f('enter_ratio', 3)}      unit=""     max={0.5}  colour="#06b6d4"/>
          <MetricRow label="Special Key Ratio"   value={f('special_key_ratio', 3)}unit=""     max={0.5}  colour="#84cc16"/>
          <MetricRow label="Repeat Key Ratio"    value={f('repeat_key_ratio', 3)} unit=""     max={0.5}  colour="#f97316"/>
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #1e2d45',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.68rem', color: '#4a6080', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Total Events Captured
            </span>
            <span style={{ fontFamily: "'Share Tech Mono', monospace", color: '#00d4ff', fontSize: '1.1rem' }}>
              {live.event_count || 0}
            </span>
          </div>
        </div>

        {/* Risk indicators */}
        <div className="card">
          <div className="section-title">Behavioral Risk Indicators</div>
          {[
            { label: 'Burst Typing',      score: parseFloat(live.burst_score) || 0,         desc: 'Unusually fast consecutive keystrokes may indicate automated input' },
            { label: 'Key Repetition',    score: parseFloat(live.repeat_key_ratio) || 0,    desc: 'High repeat ratio may indicate macro playback or injection' },
            { label: 'Backspace Freq',    score: (parseFloat(live.backspace_ratio) || 0)*2,  desc: 'Elevated correction rate can signal unusual input patterns' },
            { label: 'Special Key Usage', score: parseFloat(live.special_key_ratio) || 0,   desc: 'Excessive control key use may indicate shortcut automation' },
          ].map(({ label, score, desc }) => {
            const c = Math.min(1, score);
            const colour = c > 0.6 ? '#ef4444' : c > 0.3 ? '#f59e0b' : '#22c55e';
            const risk   = c > 0.6 ? 'HIGH' : c > 0.3 ? 'MEDIUM' : 'LOW';
            return (
              <div key={label} style={{ marginBottom: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)', fontWeight: 600 }}>{label}</span>
                  <span style={{ fontSize: '0.65rem', fontWeight: 700, color: colour, letterSpacing: '0.1em',
                    fontFamily: "'Share Tech Mono', monospace" }}>{risk}</span>
                </div>
                <div style={{ height: 6, background: '#1e2d45', borderRadius: 3, overflow: 'hidden', marginBottom: 4 }}>
                  <div style={{ width: `${c * 100}%`, height: '100%', background: colour,
                    borderRadius: 3, transition: 'width 0.4s ease', boxShadow: `0 0 6px ${colour}66` }}/>
                </div>
                <div style={{ fontSize: '0.65rem', color: '#4a6080' }}>{desc}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Time-series charts */}
      <div className="grid-2" style={{ gap: 16, marginBottom: 16 }}>
        <div className="card">
          <div className="section-title">Typing Speed Over Time</div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={history} margin={{ top: 4, right: 8, left: -25, bottom: 0 }}>
              <CartesianGrid stroke="#1e2d45" strokeDasharray="3 3"/>
              <XAxis dataKey="t" tick={{ fill: '#4a6080', fontSize: 9 }} tickLine={false} interval="preserveStartEnd"/>
              <YAxis tick={{ fill: '#4a6080', fontSize: 9 }} tickLine={false}/>
              <Tooltip contentStyle={{ background: '#111827', border: '1px solid #1e2d45', fontSize: 11, borderRadius: 8 }}/>
              <Line type="monotone" dataKey="speed" stroke="#00d4ff" dot={false} strokeWidth={2} name="Speed (kps)"/>
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="section-title">Hold & Delay Trends (ms)</div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={history} margin={{ top: 4, right: 8, left: -25, bottom: 0 }}>
              <CartesianGrid stroke="#1e2d45" strokeDasharray="3 3"/>
              <XAxis dataKey="t" tick={{ fill: '#4a6080', fontSize: 9 }} tickLine={false} interval="preserveStartEnd"/>
              <YAxis tick={{ fill: '#4a6080', fontSize: 9 }} tickLine={false}/>
              <Tooltip contentStyle={{ background: '#111827', border: '1px solid #1e2d45', fontSize: 11, borderRadius: 8 }}/>
              <Legend wrapperStyle={{ fontSize: 10, color: '#8ba3c4' }}/>
              <Line type="monotone" dataKey="hold"  stroke="#3b82f6" dot={false} strokeWidth={2} name="Avg Hold"/>
              <Line type="monotone" dataKey="delay" stroke="#8b5cf6" dot={false} strokeWidth={2} name="Avg Delay"/>
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <div className="section-title">Burst & Repeat Patterns</div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={history.slice(-40)} margin={{ top: 4, right: 8, left: -25, bottom: 0 }}>
            <CartesianGrid stroke="#1e2d45" strokeDasharray="3 3"/>
            <XAxis dataKey="t" tick={{ fill: '#4a6080', fontSize: 9 }} tickLine={false} interval={4}/>
            <YAxis tick={{ fill: '#4a6080', fontSize: 9 }} tickLine={false} domain={[0, 1]}/>
            <Tooltip contentStyle={{ background: '#111827', border: '1px solid #1e2d45', fontSize: 11, borderRadius: 8 }}/>
            <Legend wrapperStyle={{ fontSize: 10, color: '#8ba3c4' }}/>
            <Bar dataKey="burst"  fill="#f59e0b" name="Burst Score"  opacity={0.85} radius={[2,2,0,0]}/>
            <Bar dataKey="repeat" fill="#ef4444" name="Repeat Ratio" opacity={0.85} radius={[2,2,0,0]}/>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
