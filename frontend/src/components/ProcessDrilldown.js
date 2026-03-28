// components/ProcessDrilldown.js — Theme-aware using CSS variables
import React, { useEffect } from 'react';
import ThreatBadge from './ThreatBadge';

function susLevel(score) {
  if (score >= 0.7) return 'Critical';
  if (score >= 0.5) return 'High';
  if (score >= 0.3) return 'Medium';
  if (score >= 0.1) return 'Low';
  return 'Normal';
}

function DataRow({ label, value, highlight = false }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      padding: '8px 0',
      borderBottom: '1px solid var(--border)',
    }}>
      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.06em', minWidth: 160 }}>
        {label}
      </span>
      <span style={{
        fontSize: '0.78rem',
        color: highlight ? 'var(--high)' : 'var(--text-primary)',
        textAlign: 'right', wordBreak: 'break-all', maxWidth: 280,
      }}>
        {value ?? '—'}
      </span>
    </div>
  );
}

export default function ProcessDrilldown({ process: proc, onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!proc) return null;

  const level      = susLevel(proc.suspicion_score || 0);
  const isHighRisk = ['High', 'Critical'].includes(level);

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={{
        background: 'var(--bg-card)',
        border: `1px solid ${isHighRisk ? '#ef444455' : 'var(--border)'}`,
        borderRadius: 16, padding: '24px 28px',
        width: '100%', maxWidth: 560,
        boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
        animation: 'fadeIn 0.18s ease',
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
          <div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{proc.name}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 3 }}>
              PID {proc.pid} · PPID {proc.ppid}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ThreatBadge level={level} size="md"/>
            <button onClick={onClose} style={{
              background: 'none', border: 'none', color: 'var(--text-muted)',
              cursor: 'pointer', fontSize: '1rem', padding: '2px 4px', borderRadius: 4,
            }}>✕</button>
          </div>
        </div>

        {/* Risk score bar */}
        <div style={{ margin: '16px 0 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Suspicion Score</span>
            <span style={{ fontSize: '0.85rem', color: isHighRisk ? 'var(--high)' : 'var(--normal)' }}>
              {((proc.suspicion_score || 0) * 100).toFixed(0)}%
            </span>
          </div>
          <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              width: `${Math.min(100, (proc.suspicion_score || 0) * 100)}%`,
              height: '100%',
              background: isHighRisk ? '#ef4444' : level === 'Medium' ? '#f59e0b' : 'var(--normal)',
              borderRadius: 4, transition: 'width 0.4s ease',
              boxShadow: isHighRisk ? '0 0 8px #ef444488' : 'none',
            }}/>
          </div>
        </div>

        {/* Details */}
        <div style={{ overflowY: 'auto', maxHeight: 340 }}>
          <SectionTitle>Process Information</SectionTitle>
          <DataRow label="Executable Path"  value={proc.exe || 'Not accessible'} highlight={!proc.exe}/>
          <DataRow label="Status"           value={proc.status}/>
          <DataRow label="Created At"       value={proc.create_time ? proc.create_time.substring(0, 19).replace('T', ' ') : '—'}/>
          <DataRow label="Thread Count"     value={proc.num_threads} highlight={proc.num_threads > 50}/>
          <DataRow label="Running in BG"    value={proc.is_background ? 'Yes' : 'No'} highlight={!!proc.is_background}/>

          <SectionTitle mt>Resource Usage</SectionTitle>
          <DataRow label="CPU Usage"  value={`${(proc.cpu_percent || 0).toFixed(2)}%`} highlight={(proc.cpu_percent || 0) > 30}/>
          <DataRow label="Memory %"   value={`${(proc.mem_percent || 0).toFixed(2)}%`}/>
          <DataRow label="RSS Memory" value={`${(proc.rss_mb || 0).toFixed(2)} MB`}/>

          <SectionTitle mt>Risk Assessment</SectionTitle>
          <DataRow label="Suspicion Score" value={(proc.suspicion_score || 0).toFixed(4)} highlight={isHighRisk}/>
          <DataRow label="Threat Level"    value={level}/>
          <DataRow label="Background Flag" value={proc.is_background ? '⚠ Background process' : '✓ Foreground'} highlight={!!proc.is_background}/>
        </div>

        {isHighRisk && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 12,
            marginTop: 18, background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8,
            padding: '12px 14px', color: '#ef4444',
          }}>
            <span style={{ fontSize: '1rem' }}>⚠</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.78rem' }}>High Suspicion Detected</div>
              <div style={{ fontSize: '0.7rem', color: '#fca5a5', marginTop: 2 }}>
                This process matches behavioral patterns associated with stealth keylogger activity.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ children, mt }) {
  return (
    <div style={{
      fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.14em',
      textTransform: 'uppercase', color: 'var(--text-muted)',
      marginBottom: 6, marginTop: mt ? 16 : 0,
      paddingBottom: 4, borderBottom: '1px solid var(--border)',
    }}>
      {children}
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.65)',
    backdropFilter: 'blur(4px)',
    zIndex: 1000,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
  },
};
