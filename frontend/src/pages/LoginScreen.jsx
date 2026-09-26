import { useState } from 'react';
import { Activity, Shield, ArrowRight } from 'lucide-react';

export function LoginScreen({ onSignIn, onDemo }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onSignIn(email, password);
    } catch (signInError) {
      setError(signInError.message || 'Authentication failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 selection:bg-cyan-500">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/90 p-7 shadow-2xl backdrop-blur-md">
        
        {/* Header */}
        <div className="flex items-center gap-3.5 mb-7">
          <div className="rounded-xl border border-cyan-500/40 bg-cyan-500/10 p-3 text-cyan-400 shadow-inner">
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-white">ExamShield AI</h1>
            <p className="text-xs text-slate-400 font-medium">Command Center Operational Access</p>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Work Email
            <input
              required
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@university.edu"
              className="mt-1.5 w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-cyan-500 transition font-sans"
            />
          </label>

          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Password
            <input
              required
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••••••"
              className="mt-1.5 w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-cyan-500 transition font-sans"
            />
          </label>

          {error && (
            <div role="alert" className="rounded-xl border border-rose-800/80 bg-rose-950/60 p-3 text-xs text-rose-200">
              {error}
            </div>
          )}

          <button
            disabled={busy}
            className="w-full rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-extrabold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-60 cursor-pointer shadow-lg flex items-center justify-center gap-2"
          >
            <span>{busy ? 'Authenticating…' : 'Sign In to Command Center'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="my-5 flex items-center gap-3 text-xs text-slate-600">
          <span className="h-px flex-1 bg-slate-800" />
          <span>OR</span>
          <span className="h-px flex-1 bg-slate-800" />
        </div>

        {/* Demo Mode Button */}
        <button
          type="button"
          onClick={onDemo}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-950/80 px-4 py-2.5 text-xs font-bold text-slate-300 hover:border-slate-700 hover:text-white transition cursor-pointer"
        >
          <Activity className="h-4 w-4 text-amber-400" />
          <span>Continue with Interactive Demo Data</span>
        </button>

      </div>
    </main>
  );
}
