// components/ThreatBadge.js
import React from 'react';

const CONFIG = {
  Normal:   { bg: 'rgba(34,197,94,0.12)',  text: '#22c55e', border: 'rgba(34,197,94,0.35)'  },
  Low:      { bg: 'rgba(132,204,22,0.12)', text: '#84cc16', border: 'rgba(132,204,22,0.35)' },
  Medium:   { bg: 'rgba(245,158,11,0.12)', text: '#f59e0b', border: 'rgba(245,158,11,0.35)' },
  High:     { bg: 'rgba(239,68,68,0.12)',  text: '#ef4444', border: 'rgba(239,68,68,0.35)'  },
  Critical: { bg: 'rgba(168,85,247,0.12)', text: '#a855f7', border: 'rgba(168,85,247,0.35)' },
};

export default function ThreatBadge({ level = 'Normal', size = 'md' }) {
  const cfg = CONFIG[level] || CONFIG.Normal;
  const fontSize = size === 'lg' ? '0.85rem' : size === 'sm' ? '0.62rem' : '0.72rem';
  const padding  = size === 'lg' ? '5px 14px' : size === 'sm' ? '2px 8px' : '3px 10px';

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding, borderRadius: 999,
      background: cfg.bg,
      color: cfg.text,
      border: `1px solid ${cfg.border}`,
      fontSize, fontWeight: 700,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      fontFamily: "'Share Tech Mono', monospace",
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: cfg.text,
        boxShadow: `0 0 4px ${cfg.text}`,
        animation: level !== 'Normal' ? 'pulse 1.5s ease-in-out infinite' : 'none',
        flexShrink: 0,
      }}/>
      {level}
    </span>
  );
}
