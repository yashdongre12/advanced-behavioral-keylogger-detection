// components/StatusBar.js — Full monitor status bar with dark/light toggle
import React, { useState, useEffect } from 'react';
import { getHealth } from '../services/api';
import { useTheme } from '../context/ThemeContext';

export default function StatusBar() {
  const [online, setOnline]     = useState(false);
  const [uptime, setUptime]     = useState('—');
  const [lastCheck, setLastCheck] = useState('');
  const { theme, toggleTheme }  = useTheme();

  const isDark = theme === 'dark';

  useEffect(() => {
    const check = async () => {
      try {
        const h = await getHealth();
        setOnline(true);
        if (h?.uptime_seconds != null) setUptime(fmt(h.uptime_seconds));
      } catch (_) {
        setOnline(false);
      }
      setLastCheck(new Date().toLocaleTimeString());
    };
    check();
    const id = setInterval(check, 5000);
    return () => clearInterval(id);
  }, []);

  const monitors = ['Keyboard', 'Processes', 'System', 'Detector'];

  return (
    <header style={{
      height: 38,
      background: isDark ? '#0d0d0d' : '#ffffff',
      borderBottom: `1px solid ${isDark ? '#1e1e1e' : '#e0e0e0'}`,
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '0 20px', flexShrink: 0, flexWrap: 'nowrap', overflowX: 'auto', zIndex: 9,
      transition: 'background 0.25s, border-color 0.25s',
    }}>
      {/* Connection indicator */}
      <Dot active={online} />
      <span style={{ ...s.label(isDark), color: online ? '#c8ff00' : '#ef4444', fontWeight: 700 }}>
        {online ? 'BACKEND ONLINE' : 'BACKEND OFFLINE'}
      </span>

      <div style={s.divider(isDark)} />

      {monitors.map(m => (
        <React.Fragment key={m}>
          <Dot active={online} />
          <span style={{ ...s.label(isDark), color: online ? (isDark ? '#aaa' : '#555') : '#999' }}>{m.toUpperCase()}</span>
        </React.Fragment>
      ))}

      <div style={s.divider(isDark)} />

      <span style={s.label(isDark)}>UPTIME</span>
      <span style={{ ...s.label(isDark), color: '#c8ff00', fontWeight: 700 }}>{uptime}</span>

      {/* Right: last check + theme toggle */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ ...s.label(isDark), color: isDark ? '#333' : '#bbb' }}>
          LAST CHECK {lastCheck}
        </span>

        {/* ☀️ / 🌙 toggle */}
        <button
          onClick={toggleTheme}
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          style={{
            width: 28, height: 28, borderRadius: 7, border: `1px solid ${isDark ? '#2a2a2a' : '#ddd'}`,
            background: isDark ? '#161616' : '#f5f5f5',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.85rem', flexShrink: 0, transition: 'background 0.2s',
          }}
        >
          {isDark ? '☀' : '🌙'}
        </button>
      </div>
    </header>
  );
}

function Dot({ active }) {
  return (
    <span style={{
      width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
      background: active ? '#c8ff00' : '#ef4444',
      boxShadow: active ? '0 0 5px #c8ff00' : 'none',
      animation: 'pulse 1.5s ease-in-out infinite',
    }} />
  );
}

function fmt(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

const s = {
  label: (isDark) => ({
    fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em',
    color: isDark ? '#555' : '#999', textTransform: 'uppercase', whiteSpace: 'nowrap',
  }),
  divider: (isDark) => ({
    width: 1, height: 14, background: isDark ? '#2a2a2a' : '#e0e0e0', flexShrink: 0,
  }),
};
