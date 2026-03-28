// components/StatCard.js — Theme-aware using CSS variables
import React from 'react';

export default function StatCard({ title, value, sub, colour, icon, pulse }) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 16, padding: '18px 20px',
      transition: 'border-color 0.2s, background 0.25s',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: `${colour}14`, border: `1px solid ${colour}28`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: '1rem' }}>{icon}</span>
        </div>
        {pulse && (
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: colour, boxShadow: `0 0 8px ${colour}`, animation: 'pulse 1.5s ease-in-out infinite', flexShrink: 0 }} />
        )}
      </div>
      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: '1.9rem', fontWeight: 800, color: colour, lineHeight: 1, letterSpacing: '-0.03em' }}>{value}</div>
      {sub && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 6 }}>{sub}</div>}
    </div>
  );
}
