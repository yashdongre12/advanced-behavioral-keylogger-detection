// pages/History.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { getHistoryMetrics, getHistoryThreats, getHistoryKeyboard } from '../services/api';

const REFRESH_MS = 10000;

export default function History() {
  const [sysData, setSysData]   = useState([]);
  const [thrData, setThrData]   = useState([]);
  const [kbData,  setKbData]    = useState([]);
  const [error, setError]       = useState(null);
  const [lastUpdate, setLastUpdate] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [s, t, k] = await Promise.all([
        getHistoryMetrics(150),
        getHistoryThreats(150),
        getHistoryKeyboard(150),
      ]);
      setSysData((s.data||[]).map(r => ({
        t:    (r.timestamp||'').substring(11,16),
        cpu:  parseFloat(r.cpu_total_percent)||0,
        mem:  parseFloat(r.mem_percent)||0,
        procs:parseFloat(r.active_process_count)||0,
        dR:   parseFloat(r.disk_read_mb_s)||0,
        dW:   parseFloat(r.disk_write_mb_s)||0,
      })));
      setThrData((t.data||[]).map(r => ({
        t:     (r.timestamp||'').substring(11,16),
        score: parseFloat(r.final_threat_score)||0,
        lstm:  Math.round((parseFloat(r.lstm_anomaly_prob)||0)*100),
        ifS:   Math.round(Math.max(0,(-(parseFloat(r.if_score)||0)+0.1)/0.6)*100),
      })));
      setKbData((k.data||[]).map(r => ({
        t:     (r.timestamp||'').substring(11,16),
        speed: parseFloat(r.typing_speed_kps)||0,
        burst: parseFloat(r.burst_score)||0,
        back:  parseFloat(r.backspace_ratio)||0,
      })));
      setLastUpdate(new Date().toLocaleTimeString());
      setError(null);
    } catch(e) { setError('Cannot reach backend.'); }
  }, []);

  useEffect(() => { fetchData(); const id = setInterval(fetchData, REFRESH_MS); return () => clearInterval(id); }, [fetchData]);

  const chartProps = { margin: { top: 5, right: 10, left: -20, bottom: 0 } };
  const ttStyle = { contentStyle: { background: '#111827', border: '1px solid #1e2d45', borderRadius: 8, fontSize: 12 }, labelStyle: { color: '#8ba3c4' } };
  const axStyle = { tick: { fill: '#4a6080', fontSize: 10 }, tickLine: false };
  const lgStyle = { wrapperStyle: { fontSize: 11, color: '#8ba3c4' } };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Historical Analytics</h1>
        <p className="page-subtitle">
          System, threat, and keyboard trends over time
          {lastUpdate && <span style={{ marginLeft: 12, color: '#3b82f6' }}>↻ {lastUpdate}</span>}
        </p>
      </div>
      {error && <div className="error-box" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-title">CPU &amp; Memory Usage</div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={sysData} {...chartProps}>
            <defs>
              <linearGradient id="gc" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient>
              <linearGradient id="gm" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/><stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/></linearGradient>
            </defs>
            <CartesianGrid stroke="#1e2d45" strokeDasharray="3 3"/>
            <XAxis dataKey="t" {...axStyle}/>
            <YAxis domain={[0,100]} {...axStyle}/>
            <Tooltip {...ttStyle}/>
            <Legend {...lgStyle}/>
            <Area type="monotone" dataKey="cpu" stroke="#3b82f6" fill="url(#gc)" name="CPU %" strokeWidth={2}/>
            <Area type="monotone" dataKey="mem" stroke="#8b5cf6" fill="url(#gm)" name="MEM %" strokeWidth={2}/>
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-title">Threat Score History</div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={thrData} {...chartProps}>
            <CartesianGrid stroke="#1e2d45" strokeDasharray="3 3"/>
            <XAxis dataKey="t" {...axStyle}/>
            <YAxis domain={[0,100]} {...axStyle}/>
            <Tooltip {...ttStyle}/>
            <Legend {...lgStyle}/>
            <Line type="monotone" dataKey="score" stroke="#ef4444" dot={false} name="Threat Score" strokeWidth={2}/>
            <Line type="monotone" dataKey="lstm"  stroke="#f59e0b" dot={false} name="LSTM % (norm)" strokeWidth={1.5} strokeDasharray="4 2"/>
            <Line type="monotone" dataKey="ifS"   stroke="#3b82f6" dot={false} name="IF Score %" strokeWidth={1.5} strokeDasharray="4 2"/>
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid-2" style={{ gap: 16 }}>
        <div className="card">
          <div className="section-title">Disk I/O (MB/s)</div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={sysData} {...chartProps}>
              <defs>
                <linearGradient id="gdR" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/><stop offset="95%" stopColor="#22c55e" stopOpacity={0}/></linearGradient>
                <linearGradient id="gdW" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/><stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/></linearGradient>
              </defs>
              <CartesianGrid stroke="#1e2d45" strokeDasharray="3 3"/>
              <XAxis dataKey="t" {...axStyle}/>
              <YAxis {...axStyle}/>
              <Tooltip {...ttStyle}/>
              <Legend {...lgStyle}/>
              <Area type="monotone" dataKey="dR" stroke="#22c55e" fill="url(#gdR)" name="Read MB/s" strokeWidth={1.5}/>
              <Area type="monotone" dataKey="dW" stroke="#f59e0b" fill="url(#gdW)" name="Write MB/s" strokeWidth={1.5}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="section-title">Keyboard Behavior Trends</div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={kbData} {...chartProps}>
              <CartesianGrid stroke="#1e2d45" strokeDasharray="3 3"/>
              <XAxis dataKey="t" {...axStyle}/>
              <YAxis {...axStyle}/>
              <Tooltip {...ttStyle}/>
              <Legend {...lgStyle}/>
              <Line type="monotone" dataKey="speed" stroke="#00d4ff" dot={false} name="Speed (kps)" strokeWidth={2}/>
              <Line type="monotone" dataKey="burst" stroke="#f59e0b" dot={false} name="Burst Score" strokeWidth={1.5}/>
              <Line type="monotone" dataKey="back"  stroke="#ef4444" dot={false} name="Backspace Ratio" strokeWidth={1.5}/>
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
