// App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './index.css';

import { AppProvider, useApp } from './context/AppContext';
import { ThemeProvider } from './context/ThemeContext';
import Sidebar     from './components/Sidebar';
import StatusBar   from './components/StatusBar';
import AlertToast  from './components/AlertToast';
import Login       from './pages/Login';
import Register    from './pages/Register';
import Dashboard   from './pages/Dashboard';
import Processes   from './pages/Processes';
import Keyboard    from './pages/Keyboard';
import Detection   from './pages/Detection';
import Alerts      from './pages/Alerts';
import History     from './pages/History';
import Downloads   from './pages/Downloads';

// ── Protected layout (requires auth) ─────────────────────────────────────────
function AppShell() {
  const { isAuthenticated, threatLevel, logout } = useApp();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <StatusBar />
      <div className="app-wrapper" style={{ flex: 1 }}>
        <Sidebar threatLevel={threatLevel} onLogout={logout} />
        <main className="main-content">
          <Routes>
            <Route path="/"          element={<Dashboard />}  />
            <Route path="/processes" element={<Processes />}  />
            <Route path="/keyboard"  element={<Keyboard />}   />
            <Route path="/detection" element={<Detection />}  />
            <Route path="/alerts"    element={<Alerts />}     />
            <Route path="/history"   element={<History />}    />
            <Route path="/downloads" element={<Downloads />}  />
            <Route path="*"          element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
      <AlertToast />
    </div>
  );
}

// ── Root App ──────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <ThemeProvider>
      <AppProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<LoginGuard />} />
            <Route path="/register" element={<RegisterGuard />} />
            <Route path="/*"     element={<AppShell />}   />
          </Routes>
        </Router>
      </AppProvider>
    </ThemeProvider>
  );
}

// Redirect to "/" if already logged in
function LoginGuard() {
  const { isAuthenticated, login } = useApp();
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <Login onLogin={login} />;
}

// Redirect to "/" if already logged in, otherwise show Register
function RegisterGuard() {
  const { isAuthenticated } = useApp();
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <Register />;
}
