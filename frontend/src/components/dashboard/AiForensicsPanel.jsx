import { Activity, BrainCircuit, CircleAlert, FileSearch, Gauge, RadioTower, ServerCrash } from 'lucide-react';

function Metric({ label, value }) {
  return <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3"><p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p><p className="mt-1 font-mono text-sm font-bold text-slate-100">{value}</p></div>;
}

export function AiForensicsPanel({ analysis, loading, error, onRetry }) {
  if (!analysis && loading) return <section className="rounded-xl border border-cyan-900/60 bg-slate-900/80 p-5 text-sm text-cyan-200">Python analysis service is generating 1,000 simulated entity signals…</section>;
  if (!analysis && error) return <section className="rounded-xl border border-rose-900 bg-rose-950/30 p-5"><p className="font-bold text-rose-200">AI analysis service unavailable</p><p className="mt-1 text-sm text-rose-300">{error}</p><button onClick={onRetry} className="mt-3 rounded border border-rose-800 px-3 py-1.5 text-sm hover:bg-rose-900/50">Retry analysis</button></section>;
  if (!analysis) return null;

  const { metrics, anomaly, risk, rootCause, forensics } = analysis;
  const riskColor = risk.status === 'CRITICAL' ? 'text-rose-300' : risk.status === 'AT_RISK' ? 'text-amber-300' : 'text-emerald-300';
  return (
    <section className="overflow-hidden rounded-xl border border-cyan-900/50 bg-gradient-to-br from-slate-900 to-slate-950 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-5 py-4">
        <div className="flex items-center gap-2"><BrainCircuit className="h-5 w-5 text-cyan-300" /><div><h2 className="text-sm font-extrabold uppercase tracking-wide">AI / ML analysis & post-exam forensics</h2><p className="mt-0.5 text-xs text-slate-400">Telemetry → anomaly detection → risk → root cause → incident report</p></div></div>
        <span className="rounded border border-amber-800/70 bg-amber-950/40 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-300">{analysis.mode} · {analysis.entityCount.toLocaleString()} virtual entities</span>
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-5">
        <article className="rounded-lg border border-slate-800 bg-slate-950/50 p-3.5">
          <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-cyan-200"><RadioTower className="h-4 w-4" />1. Telemetry</h3>
          <div className="grid grid-cols-2 gap-2"><Metric label="Latency" value={`${metrics.latency_ms} ms`} /><Metric label="Packet loss" value={`${metrics.packet_loss_pct}%`} /><Metric label="CPU / memory" value={`${metrics.cpu_pct}% / ${metrics.memory_pct}%`} /><Metric label="Power" value={metrics.power_status} /></div>
          <p className="mt-2 text-[11px] text-slate-500">{metrics.active_students.toLocaleString()} active of {metrics.registered_students.toLocaleString()} registered</p>
        </article>

        <article className="rounded-lg border border-slate-800 bg-slate-950/50 p-3.5">
          <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-cyan-200"><Activity className="h-4 w-4" />2. Anomaly detection</h3>
          <p className={`text-lg font-black ${riskColor}`}>{anomaly.status.replace('_', ' ')}</p>
          <p className="mt-1 text-xs text-slate-400">{anomaly.detected ? 'Threshold / trend anomaly detected' : 'Signals inside baseline thresholds'}</p>
          <p className="mt-3 text-xs text-slate-300">Moving average: <strong>{anomaly.movingAverage}/100</strong></p>
          <p className="mt-1 text-xs text-slate-300">Risk trend: <strong>{anomaly.trend}</strong></p>
        </article>

        <article className="rounded-lg border border-slate-800 bg-slate-950/50 p-3.5">
          <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-cyan-200"><Gauge className="h-4 w-4" />3. Unified risk</h3>
          <p className={`font-mono text-4xl font-black ${riskColor}`}>{risk.score}<span className="text-base text-slate-500"> / 100</span></p>
          <div className="mt-3 flex h-2 overflow-hidden rounded bg-slate-800"><div className={`rounded ${risk.score >= 75 ? 'bg-rose-500' : risk.score >= 45 ? 'bg-amber-400' : 'bg-emerald-500'}`} style={{ width: `${risk.score}%` }} /></div>
          <div className="mt-3 flex h-12 items-end gap-1" aria-label="Recent risk score trajectory">{risk.trajectory.map((point) => <div key={point.sample} className="flex-1 rounded-t bg-cyan-500/70" style={{ height: `${Math.max(5, point.risk)}%` }} title={`Sample ${point.sample}: ${point.risk}`} />)}</div>
          <p className="mt-1 text-[10px] text-slate-500">Recent analysis scores · 0–100</p>
        </article>

        <article className="rounded-lg border border-slate-800 bg-slate-950/50 p-3.5">
          <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-cyan-200"><ServerCrash className="h-4 w-4" />4. Root cause</h3>
          <p className="font-bold text-slate-100">{rootCause.classification}</p>
          <p className="mt-1 text-xs text-slate-400">Signal match strength: {rootCause.confidence}%</p>
          <ul className="mt-3 space-y-1.5">{rootCause.evidence.map((item) => <li key={item} className="flex gap-1.5 text-[11px] text-slate-300"><CircleAlert className="mt-0.5 h-3 w-3 shrink-0 text-amber-400" />{item}</li>)}</ul>
          <p className="mt-3 text-[11px] leading-relaxed text-slate-400">{analysis.explanation}</p>
        </article>

        <article className="rounded-lg border border-slate-800 bg-slate-950/50 p-3.5 sm:col-span-2 xl:col-span-1">
          <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-cyan-200"><FileSearch className="h-4 w-4" />5. Forensics report</h3>
          <dl className="space-y-2 text-xs"><div className="flex justify-between gap-2"><dt className="text-slate-400">Affected candidates</dt><dd className="font-mono font-bold text-slate-100">{forensics.affectedStudents} / {forensics.totalStudents}</dd></div><div className="flex justify-between gap-2"><dt className="text-slate-400">Estimated downtime</dt><dd className="font-mono font-bold text-slate-100">{forensics.estimatedDowntimeMinutes} min</dd></div><div className="flex justify-between gap-2"><dt className="text-slate-400">Recovered</dt><dd className="font-mono font-bold text-emerald-300">{forensics.successfulRecoveries} ({forensics.recoveryRatePct}%)</dd></div><div className="flex justify-between gap-2"><dt className="text-slate-400">Recovery time</dt><dd className="font-mono font-bold text-slate-100">{forensics.estimatedRecoveryMinutes} min</dd></div></dl>
          <h4 className="mt-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Recommended actions</h4>
          <ul className="mt-1.5 list-inside list-disc space-y-1 text-[11px] leading-relaxed text-slate-300">{forensics.recommendations.map((item) => <li key={item}>{item}</li>)}</ul>
          <p className="mt-3 border-t border-slate-800 pt-2 text-[10px] leading-relaxed text-amber-300/80">{forensics.note}</p>
          <p className="mt-2 text-[10px] text-slate-500">Run {analysis.id.slice(0, 8)} · {analysis.persisted ? 'saved to backend' : 'not persisted (database unavailable)'}</p>
        </article>
      </div>
    </section>
  );
}
