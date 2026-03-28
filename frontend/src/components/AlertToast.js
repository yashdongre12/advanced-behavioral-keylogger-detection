// components/AlertToast.js — Theme-aware using CSS variables
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getAlertsRecent } from '../services/api';

const POLL_MS      = 5000;
const AUTO_HIDE_MS = 8000;

const LEVEL_STYLE = {
  High:     { border: '#ef4444', icon: '⚠',  glow: '0 0 20px rgba(239,68,68,0.25)'  },
  Critical: { border: '#a855f7', icon: '🚨', glow: '0 0 24px rgba(168,85,247,0.3)' },
};

export default function AlertToast() {
  const [toasts, setToasts] = useState([]);
  const seenIds  = useRef(new Set());
  const nextId   = useRef(0);

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => {
    const poll = async () => {
      try {
        const recent = await getAlertsRecent(5);
        const alerts = recent?.data || [];
        alerts.forEach(a => {
          if (!['High', 'Critical'].includes(a.threat_level)) return;
          const key = `${a.timestamp}-${a.threat_level}`;
          if (seenIds.current.has(key)) return;
          seenIds.current.add(key);
          const id = nextId.current++;
          setToasts(prev => [...prev.slice(-3), { id, alert: a }]);
          setTimeout(() => dismissToast(id), AUTO_HIDE_MS);
        });
      } catch (_) {}
    };
    poll();
    const timer = setInterval(poll, POLL_MS);
    return () => clearInterval(timer);
  }, [dismissToast]);

  if (toasts.length === 0) return null;

  return (
    <div style={containerStyle}>
      {toasts.map(({ id, alert }) => {
        const cfg = LEVEL_STYLE[alert.threat_level] || LEVEL_STYLE.High;
        return (
          <div key={id} style={{
            border: `1px solid ${cfg.border}`,
            background: 'var(--bg-card)',
            borderRadius: 12, padding: '14px 16px',
            boxShadow: cfg.glow,
            backdropFilter: 'blur(8px)',
            animation: 'slideIn 0.3s ease',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: '1.1rem' }}>{cfg.icon}</span>
              <span style={{ fontWeight: 700, color: cfg.border, fontSize: '0.78rem', letterSpacing: '0.1em' }}>
                {alert.threat_level.toUpperCase()} THREAT DETECTED
              </span>
              <button onClick={() => dismissToast(id)} style={{
                marginLeft: 'auto', background: 'none', border: 'none',
                color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.85rem', padding: '0 2px',
              }}>✕</button>
            </div>

            {/* Body */}
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 6 }}>
              {(alert.reason || '').split(';')[0].trim()}
            </div>

            {/* Meta row */}
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              {[
                ['Score',   parseFloat(alert.final_threat_score||0).toFixed(1)],
                ['CPU',     `${parseFloat(alert.cpu_percent||0).toFixed(1)}%`],
                ['Process', alert.top_process || '—'],
              ].map(([label, val]) => (
                <div key={label}>
                  <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {label}{' '}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-primary)' }}>{val}</span>
                </div>
              ))}
            </div>

            {/* Drain bar */}
            <div style={{ marginTop: 10, height: 2, background: 'var(--border)', borderRadius: 1, overflow: 'hidden' }}>
              <div style={{
                height: '100%', background: cfg.border, borderRadius: 1,
                animation: `drain ${AUTO_HIDE_MS}ms linear forwards`,
              }}/>
            </div>
          </div>
        );
      })}

      <style>{`
        @keyframes drain { from { width: 100%; } to { width: 0%; } }
        @keyframes slideIn { from { transform: translateX(110%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      `}</style>
    </div>
  );
}

const containerStyle = {
  position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
  display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 360, width: '100%',
};
