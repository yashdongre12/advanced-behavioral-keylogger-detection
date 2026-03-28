import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import AnimatedLogo from '../components/AnimatedLogo';
import ParticleBackground from '../components/ParticleBackground';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await axios.post(`${API_URL}/auth/login`, { username, password });
      const token = res.data.access_token;
      sessionStorage.setItem('sentinel_token', token);
      if (onLogin) onLogin(token, username);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.bg}>
      <ParticleBackground count={180} speedMin={0.4} speedMax={2.2} opacityFactor={1} fadeStrength={0.18} />
      <div style={{ ...styles.card, position: 'relative', zIndex: 1 }}>
        {/* Logo */}
        <div style={styles.logoArea}>
          <AnimatedLogo size={110} />
          <div style={{ ...styles.logoTitle, marginTop: 12 }}>ABKDS</div>
          <div style={styles.logoSub}>Advanced Behavioral Keylogger Detection System</div>
          <div style={{ fontSize: '0.6rem', color: '#444', marginTop: 2, letterSpacing: '0.02em' }}>Using Isolation Forest and LSTM</div>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Enter your username"
              style={styles.input}
              autoFocus required
            />
          </div>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter your password"
              style={styles.input}
              required
            />
          </div>

          {error && (
            <div style={styles.errorBox}>
              <span>⚠</span> {error}
            </div>
          )}

          <button type="submit" disabled={loading || !username || !password} style={{
            ...styles.btn,
            opacity: (!username || !password || loading) ? 0.5 : 1,
            cursor: (!username || !password || loading) ? 'not-allowed' : 'pointer',
          }}>
            {loading ? 'SIGNING IN…' : 'SIGN IN'}
          </button>
        </form>

        <p style={styles.hint}>
          Don't have an account?{' '}
          <a href="/register" style={{ color: '#c8ff00', textDecoration: 'none', fontWeight: 600 }}>Create one</a>
        </p>
      </div>
    </div>
  );
}

const styles = {
  bg: {
    minHeight: '100vh', background: '#0a0a0a',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  card: {
    width: 400, background: '#111111',
    border: '1px solid #222', borderRadius: 20,
    padding: '40px 36px',
    boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
  },
  logoArea: { textAlign: 'center', marginBottom: 32 },
  logoIcon: {
    width: 52, height: 52, borderRadius: 14,
    background: 'rgba(200,255,0,0.08)', border: '1px solid rgba(200,255,0,0.2)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    margin: '0 auto 14px',
  },
  logoTitle: {
    fontSize: '1.1rem', fontWeight: 800, color: '#fff',
    letterSpacing: '0.22em', marginBottom: 5,
  },
  logoSub: { fontSize: '0.7rem', color: '#444', letterSpacing: '0.04em' },
  form: { display: 'flex', flexDirection: 'column', gap: 14 },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: '0.72rem', fontWeight: 600, color: '#666', letterSpacing: '0.04em' },
  input: {
    background: '#161616', border: '1px solid #2a2a2a', borderRadius: 10,
    padding: '12px 14px', color: '#fff', fontSize: '0.9rem', outline: 'none',
    transition: 'border-color 0.2s', width: '100%', boxSizing: 'border-box',
  },
  errorBox: {
    background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
    borderRadius: 8, padding: '10px 12px', color: '#ef4444',
    fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 6,
  },
  btn: {
    background: '#c8ff00', color: '#0a0a0a', border: 'none',
    borderRadius: 10, padding: '13px',
    fontSize: '0.82rem', fontWeight: 800, letterSpacing: '0.08em',
    transition: 'opacity 0.15s', marginTop: 4,
  },
  hint: { textAlign: 'center', marginTop: 22, fontSize: '0.72rem', color: '#444' },
};
