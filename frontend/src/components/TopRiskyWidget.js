// components/TopRiskyWidget.js — Theme-aware version using CSS variables
import React, { useState, useEffect, useCallback } from 'react';
import { getProcessSuspicious } from '../services/api';
import ThreatBadge from './ThreatBadge';

const REFRESH_MS = 5000;

function susLevel(score) {
  if (score >= 0.7) return 'Critical';
  if (score >= 0.5) return 'High';
  if (score >= 0.3) return 'Medium';
  if (score >= 0.1) return 'Low';
  return 'Normal';
}

const LEVEL_COLOUR = {
  Normal: '#22c55e', Low: '#84cc16',
  Medium: '#f59e0b', High: '#ef4444', Critical: '#a855f7',
};

export default function TopRiskyWidget({ onSelectProcess }) {
  const [procs, setProcs] = useState([]);

  const fetchData = useCallback(async () => {
    try {
      const data = await getProcessSuspicious(5);
      setProcs(data || []);
    } catch (_) {}
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchData]);

  const visible = procs.filter(p => (p.suspicion_score || 0) > 0.05);

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div className="section-title" style={{ margin: 0, border: 'none', padding: 0 }}>
          Top Risky Processes
        </div>
        {visible.length === 0 && (
          <span style={{ fontSize: '0.68rem', color: 'var(--normal)' }}>✓ All Clear</span>
        )}
      </div>

      {visible.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
          No suspicious processes detected
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {visible.map((p, i) => {
            const level  = susLevel(p.suspicion_score || 0);
            const colour = LEVEL_COLOUR[level];
            const pct    = Math.min(100, (p.suspicion_score || 0) * 100);

            return (
              <div
                key={p.pid || i}
                onClick={() => onSelectProcess && onSelectProcess(p)}
                style={{
                  display: 'flex', flexDirection: 'column', gap: 5,
                  padding: '10px 12px',
                  background: 'var(--bg-base)',
                  border: `1px solid ${colour}33`,
                  borderRadius: 8,
                  cursor: onSelectProcess ? 'pointer' : 'default',
                  transition: 'background 0.15s',
                }}
              >
                {/* Top row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{
                    fontSize: '0.8rem', color: 'var(--text-primary)',
                    fontWeight: 600, maxWidth: 160,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {p.name}
                  </span>
                  <ThreatBadge level={level} size="sm"/>
                </div>

                {/* Risk bar */}
                <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{
                    width: `${pct}%`, height: '100%',
                    background: colour, borderRadius: 2,
                    transition: 'width 0.5s ease',
                    boxShadow: `0 0 6px ${colour}66`,
                  }}/>
                </div>

                {/* Meta row */}
                <div style={{ display: 'flex', gap: 12, fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                  <span>PID <span style={{ color: 'var(--text-secondary)' }}>{p.pid}</span></span>
                  <span>CPU <span style={{ color: 'var(--text-secondary)' }}>{(p.cpu_percent || 0).toFixed(1)}%</span></span>
                  <span>Score <span style={{ color: colour }}>{(p.suspicion_score || 0).toFixed(3)}</span></span>
                  {p.is_background && <span style={{ color: 'var(--medium)' }}>BG</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: 10, fontSize: '0.62rem', color: 'var(--text-muted)', textAlign: 'right' }}>
        Refreshes every {REFRESH_MS / 1000}s
      </div>
    </div>
  );
}
