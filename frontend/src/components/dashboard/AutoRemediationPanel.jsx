import { CheckCircle2, CircleAlert, LoaderCircle, ShieldCheck, Siren } from 'lucide-react';

const stateLabel = {
  DETECTED: 'Problem detected', DIAGNOSING: 'Diagnosing', REMEDIATING: 'Applying recovery playbook',
  VERIFYING: 'Verifying system health', RECOVERED: 'System recovered', ESCALATED: 'Escalated to administrator',
};

function MetricList({ metrics = {} }) {
  const labels = { latency_ms: 'Latency', packet_loss_pct: 'Packet loss', cpu_pct: 'CPU', memory_pct: 'Memory', db_response_ms: 'Database', availability_pct: 'Availability' };
  const entries = Object.entries(labels).filter(([key]) => metrics[key] !== undefined);
  if (!entries.length) return <p className="text-xs text-slate-500">No health metrics recorded.</p>;
  return <dl className="grid grid-cols-2 gap-2">{entries.map(([key, label]) => <div key={key} className="rounded bg-slate-950/70 p-2"><dt className="text-[10px] uppercase text-slate-500">{label}</dt><dd className="font-mono text-xs font-bold text-slate-200">{metrics[key]}{key.endsWith('_pct') ? '%' : key.endsWith('_ms') ? ' ms' : ''}</dd></div>)}</dl>;
}

export function AutoRemediationPanel({ remediation, pendingSubmissions = 0, recoveredSubmissions = 0 }) {
  if (!remediation) return null;
  const succeeded = remediation.state === 'RECOVERED';
  const escalated = remediation.state === 'ESCALATED';
  const Icon = succeeded ? CheckCircle2 : escalated ? Siren : LoaderCircle;
  const tone = succeeded ? 'border-emerald-700/70 bg-emerald-950/20' : escalated ? 'border-rose-700/70 bg-rose-950/20' : 'border-amber-700/70 bg-amber-950/20';
  return <section className={`rounded-xl border ${tone} p-5 shadow-lg`} aria-live="polite">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
      <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-cyan-300"/><div><h2 className="text-sm font-extrabold uppercase tracking-wide">Automatic remediation</h2><p className="text-xs text-slate-400">Problem occurred → ExamShield responded → exam continued → recovery verified</p></div></div>
      <span className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1 text-xs font-bold"><Icon className={`h-4 w-4 ${succeeded ? 'text-emerald-300' : escalated ? 'text-rose-300' : 'text-amber-300'}`}/>{stateLabel[remediation.state] || remediation.state}</span>
    </header>
    <div className="grid gap-4 pt-4 lg:grid-cols-3">
      <div><p className="text-[10px] uppercase tracking-wider text-slate-500">Current problem</p><p className="mt-1 font-bold text-slate-100">{String(remediation.cause).replaceAll('_', ' ')}</p><p className="mt-3 text-[10px] uppercase tracking-wider text-slate-500">Probable cause · AI confidence</p><p className="mt-1 text-sm text-slate-200">{remediation.probableCause} · {Math.round((remediation.confidence || 0) * 100)}%</p><ul className="mt-2 space-y-1">{(remediation.evidence || []).map((item) => <li key={item} className="flex gap-1.5 text-xs text-slate-400"><CircleAlert className="mt-0.5 h-3 w-3 shrink-0 text-amber-300"/>{item}</li>)}</ul></div>
      <div><p className="mb-2 text-[10px] uppercase tracking-wider text-slate-500">Approved actions executed</p><ol className="space-y-1.5">{(remediation.actions || []).map((action, index) => <li key={`${action.name}-${index}`} className="flex items-start gap-2 text-xs"><span className="font-mono text-slate-500">{String(index + 1).padStart(2, '0')}</span><span className={action.status === 'FAILED' ? 'text-rose-300' : action.status === 'COMPLETED' ? 'text-emerald-200' : 'text-amber-200'}>{action.name.replaceAll('_', ' ')} <span className="text-slate-500">· {action.status}</span>{action.details && <span className="mt-0.5 block text-[10px] text-slate-500">{action.details}</span>}</span></li>)}</ol><p className="mt-3 text-xs text-slate-300">Pending submissions: <b>{pendingSubmissions}</b> · Recovered: <b>{recoveredSubmissions}</b></p>{remediation.failureReason && <p className="mt-2 text-xs text-rose-300">Escalation: {remediation.failureReason}</p>}</div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1"><div><p className="mb-2 text-[10px] uppercase tracking-wider text-slate-500">Health before</p><MetricList metrics={remediation.metricsBefore}/></div><div><p className="mb-2 text-[10px] uppercase tracking-wider text-slate-500">Health after</p><MetricList metrics={remediation.metricsAfter}/></div><p className={`text-xs font-bold ${succeeded ? 'text-emerald-300' : escalated ? 'text-rose-300' : 'text-amber-200'}`}>{succeeded ? 'EXAM CONTINUED · RECOVERY VERIFIED' : escalated ? 'ADMINISTRATOR ACTION REQUIRED' : 'REMEDIATION IN PROGRESS · EXAM CONTINUITY PROTECTED'}</p>{remediation.simulation && <p className="text-[10px] text-slate-500">Scenario simulation: after metrics are the deterministic healthy baseline.</p>}</div>
    </div>
  </section>;
}
