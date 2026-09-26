import { useState } from 'react';
import { Activity, Shield } from 'lucide-react';

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
      setError(signInError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-7 shadow-2xl">
        <div className="flex items-center gap-3 mb-7">
          <div className="rounded-xl border border-cyan-500/40 bg-cyan-500/10 p-3 text-cyan-300"><Shield className="h-6 w-6" /></div>
          <div><h1 className="text-xl font-bold">ExamShield AI</h1><p className="text-sm text-slate-400">Command Center sign in</p></div>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm text-slate-300">Work email
            <input required type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-cyan-500" />
          </label>
          <label className="block text-sm text-slate-300">Password
            <input required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-cyan-500" />
          </label>
          {error && <p role="alert" className="rounded-lg border border-rose-800 bg-rose-950/50 px-3 py-2 text-sm text-rose-200">{error}</p>}
          <button disabled={busy} className="w-full rounded-lg bg-cyan-500 px-4 py-2.5 font-bold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-60">
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <div className="my-5 flex items-center gap-3 text-xs text-slate-600"><span className="h-px flex-1 bg-slate-800" />OR<span className="h-px flex-1 bg-slate-800" /></div>
        <button onClick={onDemo} className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:border-slate-500 hover:text-white">
          <Activity className="h-4 w-4" /> Continue with demo data
        </button>
      </div>
    </main>
  );
}
