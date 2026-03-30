// context/AppContext.js
// ─────────────────────────────────────────────────────────────────────────────
// Global application context providing:
//   - Authentication state (token, isAuthenticated, login, logout)
//   - Live threat level (polled every 4s from /status)
//   - Global error state
// ─────────────────────────────────────────────────────────────────────────────
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getStatus } from '../services/api';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  // ── Auth ────────────────────────────────────────────────────────────────
  const [token, setToken]                   = useState(() => 'dummy-token');
  const [isAuthenticated, setIsAuthenticated] = useState(() => true);
  const [username, setUsername]               = useState(() => sessionStorage.getItem('sentinel_username') || '');

  const login = useCallback((newToken, newUsername = '') => {
    sessionStorage.setItem('sentinel_token', newToken);
    sessionStorage.setItem('sentinel_username', newUsername);
    setToken(newToken);
    setUsername(newUsername);
    setIsAuthenticated(true);
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem('sentinel_token');
    sessionStorage.removeItem('sentinel_username');
    setToken(null);
    setUsername('');
    setIsAuthenticated(false);
  }, []);

  // ── Live threat level ────────────────────────────────────────────────────
  const [threatLevel,      setThreatLevel]      = useState('Normal');
  const [finalThreatScore, setFinalThreatScore] = useState(0);
  const [backendOnline,    setBackendOnline]     = useState(false);

  useEffect(() => {
    const poll = async () => {
      try {
        const s = await getStatus();
        setThreatLevel(s?.threat_level || 'Normal');
        setFinalThreatScore(s?.final_threat_score || 0);
        setBackendOnline(true);
      } catch (_) {
        setBackendOnline(false);
      }
    };
    poll();
    const id = setInterval(poll, 4000);
    return () => clearInterval(id);
  }, []);

  return (
    <AppContext.Provider value={{
      // Auth
      token,
      isAuthenticated,
      username,
      login,
      logout,
      // Live data
      threatLevel,
      finalThreatScore,
      backendOnline,
    }}>
      {children}
    </AppContext.Provider>
  );
}

/** Hook to consume AppContext in any component. */
export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within <AppProvider>');
  return ctx;
}

export default AppContext;
