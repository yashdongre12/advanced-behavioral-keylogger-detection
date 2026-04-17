// components/Sidebar.js — Full sidebar with threat level + text labels, themed
import React from 'react';
import { NavLink } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';

const NAV_ITEMS = [
  { path: '/',           label: 'Dashboard'  },
  { path: '/processes',  label: 'Processes'  },
  { path: '/keyboard',   label: 'Keyboard'   },
  { path: '/detection',  label: 'Detection'  },
  { path: '/alerts',     label: 'Alerts'     },
  { path: '/history',    label: 'Analytics'  },
  { path: '/downloads',  label: 'Downloads'  },
];

const LEVEL_COLOR = {
  Normal: '#c8ff00', Low: '#84cc16',
  Medium: '#f59e0b', High: '#ef4444', Critical: '#ef4444',
};

export default function Sidebar({ threatLevel = 'Normal', onLogout }) {
  const lc = LEVEL_COLOR[threatLevel] || '#c8ff00';
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const bg     = isDark ? '#0d0d0d' : '#ffffff';
  const border = isDark ? '#1e1e1e' : '#e0e0e0';
  const navClr = isDark ? '#555'    : '#999';
  const txtPri = isDark ? '#fff'    : '#111';
  const txtSub = isDark ? '#444'    : '#aaa';
  const cardBg = isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.04)';
  const footClr= isDark ? '#2a2a2a' : '#ccc';
  const logoBg = 'rgba(200,255,0,0.08)';
  const logoBd = 'rgba(200,255,0,0.2)';

  return (
    <aside style={{ ...styles.sidebar, background: bg, borderRight: `1px solid ${border}` }}>
      {/* Logo */}
      <div style={{ ...styles.logoWrap, borderBottom: `1px solid ${border}` }}>
        <div style={{ ...styles.logoIcon, background: 'var(--accent-dim)', border: `1px solid var(--accent)` }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L19 5V10C19 15 15.5 19.5 12 21C8.5 19.5 5 15 5 10V5L12 2Z"
              stroke="var(--accent)" strokeWidth="1.8" fill="var(--accent-dim)"/>
            <path d="M9.5 12L11.2 13.7L14.8 10.1" stroke="var(--accent)" strokeWidth="1.8"
              strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div>
          <div style={{ ...styles.logoTitle, color: txtPri }}>ABKDS</div>
          <div style={{ ...styles.logoSub, color: txtSub }}>KDS · Keylogger Detection</div>
        </div>
      </div>

      {/* Threat level pill */}
      <div style={{ ...styles.threatPill, borderColor: lc + '44', background: cardBg }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: lc, boxShadow: `0 0 6px ${lc}`, animation: 'pulse 1.5s infinite', flexShrink: 0 }} />
        <span style={styles.threatLabel}>THREAT LEVEL</span>
        <span style={{ ...styles.threatValue, color: lc, background: lc + '18', border: `1px solid ${lc}40`, padding: '1px 8px', borderRadius: 5, fontSize: '0.64rem', fontWeight: 800 }}>
          {threatLevel.toUpperCase()}
        </span>
      </div>

      {/* Navigation */}
      <nav style={styles.nav}>
        {NAV_ITEMS.map(({ path, label }) => (
          <NavLink key={path} to={path} end={path === '/'}
            style={({ isActive }) => isActive
              ? { ...styles.navItem, ...styles.navActive, color: 'var(--accent)' }
              : { ...styles.navItem, color: navClr }
            }
          >
            <span style={styles.navDot} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Sign out */}
      <div style={{ padding: '0 12px 8px' }}>
        {onLogout && (
          <button onClick={onLogout} style={{ ...styles.logoutBtn, border: `1px solid ${border}`, color: navClr }}>
            ⏻ Sign Out
          </button>
        )}
      </div>

      {/* Footer */}
      <div style={styles.footer}>
        <div style={{ ...styles.footerLine, color: footClr }}>v1.0.0 · Python + React</div>
        <div style={{ ...styles.footerLine, color: footClr }}>Isolation Forest + LSTM</div>
      </div>
    </aside>
  );
}

const styles = {
  sidebar: {
    width: 210, minHeight: '100vh',
    background: '#0d0d0d', borderRight: '1px solid #1e1e1e',
    display: 'flex', flexDirection: 'column', padding: '0 0 16px', flexShrink: 0,
  },
  logoWrap: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '20px 16px 16px', borderBottom: '1px solid #1e1e1e',
  },
  logoIcon: {
    width: 34, height: 34, borderRadius: 9, flexShrink: 0,
    background: 'var(--accent-dim)', border: '1px solid var(--accent)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  logoTitle: { fontSize: '0.9rem', fontWeight: 800, color: '#fff', letterSpacing: '0.04em' },
  logoSub: { fontSize: '0.58rem', color: '#444', marginTop: 1 },
  threatPill: {
    margin: '12px 12px 6px', border: '1px solid',
    borderRadius: 8, padding: '8px 10px',
    background: 'rgba(0,0,0,0.3)',
    display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap',
  },
  threatLabel: { fontSize: '0.56rem', fontWeight: 700, letterSpacing: '0.12em', color: '#555' },
  threatValue: { marginLeft: 'auto' },
  nav: { flex: 1, padding: '8px 8px', display: 'flex', flexDirection: 'column', gap: 2 },
  navItem: {
    display: 'flex', alignItems: 'center', gap: 9,
    padding: '8px 10px', borderRadius: 8,
    color: '#555', fontSize: '0.8rem', fontWeight: 500,
    textDecoration: 'none', transition: 'background 0.15s, color 0.15s',
  },
  navActive: {
    background: 'var(--accent-dim)', color: 'var(--accent)',
    borderLeft: '2px solid var(--accent)',
  },
  navDot: { width: 4, height: 4, borderRadius: '50%', background: 'currentColor', opacity: 0.7, flexShrink: 0 },
  logoutBtn: {
    width: '100%', background: 'transparent', border: '1px solid #222',
    borderRadius: 7, color: '#444', fontSize: '0.72rem', fontWeight: 600,
    letterSpacing: '0.06em', padding: '7px 10px', cursor: 'pointer',
    textAlign: 'left', transition: 'border-color 0.15s, color 0.15s',
  },
  footer: { padding: '8px 16px 0' },
  footerLine: { fontSize: '0.58rem', color: '#2a2a2a', lineHeight: 1.9 },
};
