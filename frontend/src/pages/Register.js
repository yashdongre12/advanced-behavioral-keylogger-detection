import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import AnimatedLogo from '../components/AnimatedLogo';
import ParticleBackground from '../components/ParticleBackground';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

function getStrength(pwd) {
  if (!pwd) return { level: 0, label: '', color: '#222' };
  let score = 0;
  if (pwd.length >= 8)             score++;
  if (pwd.length >= 12)            score++;
  if (/[A-Z]/.test(pwd))           score++;
  if (/[0-9]/.test(pwd))           score++;
  if (/[^A-Za-z0-9]/.test(pwd))   score++;
  if (score <= 1) return { level: 1, label: 'Weak',   color: '#ef4444' };
  if (score <= 3) return { level: 2, label: 'Medium', color: '#f59e0b' };
  return              { level: 3, label: 'Strong', color: '#c8ff00' };
}

export default function Register() {
  const [form, setForm] = useState({ username: '', email: '', phone_number: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  const strength = useMemo(() => getStrength(form.password), [form.password]);
  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));
  const canSubmit = form.username && form.email && form.phone_number && form.password && !loading;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError(''); setSuccess('');
    try {
      await axios.post(`${API_URL}/auth/register`, form);
      setSuccess('Account created! Redirecting…');
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed. Please try again.');
    } finally { setLoading(false); }
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
          {/* Username */}
          <Field label="Username">
            <input type="text"   value={form.username}     onChange={set('username')}     placeholder="Choose a username"    style={styles.input} autoFocus required />
          </Field>
          {/* Email */}
          <Field label="Email Address">
            <input type="email"  value={form.email}        onChange={set('email')}        placeholder="you@example.com"      style={styles.input} required />
          </Field>
          {/* Phone */}
          <Field label="Phone Number">
            <input type="tel"    value={form.phone_number} onChange={set('phone_number')} placeholder="+91 98765 43210"      style={styles.input} required />
          </Field>
          {/* Password */}
          <Field label="Password">
            <input type="password" value={form.password}   onChange={set('password')}     placeholder="Create a strong password" style={styles.input} required />
            {/* Strength meter */}
            {form.password && (
              <div style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', gap: 5 }}>
                  {[1,2,3].map(n => (
                    <div key={n} style={{ flex: 1, height: 3, borderRadius: 2, transition: 'background 0.3s', background: strength.level >= n ? strength.color : '#222' }}/>
                  ))}
                </div>
                <div style={{ fontSize: '0.65rem', color: strength.color, fontWeight: 700, marginTop: 5, letterSpacing: '0.1em' }}>
                  {strength.label.toUpperCase()}
                </div>
              </div>
            )}
          </Field>

          {error   && <Alert color="#ef4444" bg="rgba(239,68,68,0.08)" icon="⚠">{error}</Alert>}
          {success && <Alert color="#c8ff00" bg="rgba(200,255,0,0.08)"  icon="✓">{success}</Alert>}

          <button type="submit" disabled={!canSubmit} style={{ ...styles.btn, opacity: canSubmit ? 1 : 0.4, cursor: canSubmit ? 'pointer' : 'not-allowed' }}>
            {loading ? 'CREATING ACCOUNT…' : 'CREATE ACCOUNT'}
          </button>
        </form>

        <p style={styles.hint}>
          Already have an account?{' '}
          <a href="/login" style={{ color: '#c8ff00', textDecoration: 'none', fontWeight: 600 }}>Sign in</a>
        </p>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><label style={styles.label}>{label}</label>{children}</div>;
}
function Alert({ color, bg, icon, children }) {
  return <div style={{ background: bg, border: `1px solid ${color}33`, borderRadius: 8, padding: '10px 12px', color, fontSize: '0.78rem', display: 'flex', alignItems: 'flex-start', gap: 6 }}><span>{icon}</span><span>{children}</span></div>;
}

const styles = {
  bg: { minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 0' },
  card: { width: 420, background: '#111111', border: '1px solid #222', borderRadius: 20, padding: '38px 36px', boxShadow: '0 24px 80px rgba(0,0,0,0.7)' },
  logoArea: { textAlign: 'center', marginBottom: 28 },
  logoIcon: { width: 52, height: 52, borderRadius: 14, background: 'rgba(200,255,0,0.08)', border: '1px solid rgba(200,255,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' },
  logoTitle: { fontSize: '1.1rem', fontWeight: 800, color: '#fff', letterSpacing: '0.22em', marginBottom: 4 },
  logoSub: { fontSize: '0.7rem', color: '#444', letterSpacing: '0.04em' },
  form: { display: 'flex', flexDirection: 'column', gap: 14 },
  label: { fontSize: '0.72rem', fontWeight: 600, color: '#666', letterSpacing: '0.04em' },
  input: { background: '#161616', border: '1px solid #2a2a2a', borderRadius: 10, padding: '12px 14px', color: '#fff', fontSize: '0.9rem', outline: 'none', transition: 'border-color 0.2s', width: '100%', boxSizing: 'border-box' },
  btn: { background: '#c8ff00', color: '#0a0a0a', border: 'none', borderRadius: 10, padding: '13px', fontSize: '0.82rem', fontWeight: 800, letterSpacing: '0.08em', transition: 'opacity 0.15s', marginTop: 4 },
  hint: { textAlign: 'center', marginTop: 22, fontSize: '0.72rem', color: '#444' },
};
