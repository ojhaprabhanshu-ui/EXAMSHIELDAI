import { useState } from 'react';
import { CommandCenter } from './pages/CommandCenter';
import { LoginScreen } from './pages/LoginScreen';
import { AuthProvider, useAuth } from './context/AuthContext';

function AppContent() {
  const { user, accessToken, signIn, signOut } = useAuth();
  const [demoMode, setDemoMode] = useState(false);
  if (user) return <CommandCenter user={user} accessToken={accessToken} onLogout={signOut} />;
  if (demoMode) return <CommandCenter onLogout={() => setDemoMode(false)} />;
  return <LoginScreen onSignIn={signIn} onDemo={() => setDemoMode(true)} />;
}

export default function App() {
  return <AuthProvider><AppContent /></AuthProvider>;
}
