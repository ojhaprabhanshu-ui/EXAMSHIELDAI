import { CommandCenter } from './pages/CommandCenter';
import { LoginScreen } from './pages/LoginScreen';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useState } from 'react';

function AppContent() {
  const { user, accessToken, signIn, signOut } = useAuth();
  const [connecting, setConnecting] = useState(false);

  if (accessToken) return <CommandCenter user={user} accessToken={accessToken} onLogout={signOut} />;
  if (connecting) return <LoginScreen onSignIn={signIn} onDemo={() => setConnecting(false)} />;
  return <CommandCenter user={{ displayName: 'Demo Operator', role: 'Demo' }} onConnectLive={() => setConnecting(true)} />;
}

export default function App() {
  return <AuthProvider><AppContent /></AuthProvider>;
}
