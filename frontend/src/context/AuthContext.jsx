import { createContext, useContext, useMemo, useState } from 'react';
import { setAccessToken } from '../services/apiClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [accessToken, setToken] = useState(null);

  const value = useMemo(() => ({
    user,
    accessToken,
    async signIn(email, password) {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `Sign-in failed (${response.status})`);
      setAccessToken(payload.accessToken);
      setToken(payload.accessToken);
      setUser(payload.user);
      return payload.user;
    },
    signOut() {
      setAccessToken(null);
      setToken(null);
      setUser(null);
    },
  }), [user, accessToken]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
