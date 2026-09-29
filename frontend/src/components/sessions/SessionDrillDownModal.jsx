import { X, Brain, ShieldAlert, Activity, Database, Clock3 } from 'lucide-react';
import { StatusBadge } from '../common/StatusBadge';

function Metric({ label, value, unit = '' }) {
  return <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3"><span className="text-[11px] font-semibold text-slate-400">{label}</span><div className="mt-1 font-mono text-lg font-bold text-slate-100">{value === undefined || value === null ? '—' : `${value}${unit}`}</div></div>;
}

export function SessionDrillDownModal({ session, onClose }) {
  if (!session) return null;
  const analysis = session.analysis || null;
  const evidence = analysis?.evidence || analysis?.rootCause?.evidence || [];
  const cause = analysis?.rootCause?.classification || analysis?.rootCause || session.diagnosis;
  const recommendedAction = analysis?.recommendedAction || analysis?.prediction?.recommendedAction || session.recommendation;
  const actionStatus = session.remediation?.state || session.remediation?.status;
  const timeline = session.timeline || [];
  const recovery = session.recovery || {};
  const continuityActive = Boolean(session.continuity?.active ?? session.continuityActive);
  const recommendationReason = analysis?.explanation || session.recommendationReason;
  const id = session.sessionKey || session.id;

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="session-drilldown-title" onClick={onClose}>
    <section className="w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl" onClick={(event) => event.stopPropagation()}>
      <header className="flex items-center justify-between border-b border-slate-800 bg-slate-950/80 p-5">
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 id="session-drilldown-title" className="font-mono text-xl font-bold text-cyan-200">{id}</h2><h3 className="text-lg font-bold text-slate-100">Session Inspection</h3><StatusBadge status={session.status || 'UNKNOWN'} size="md" /></div><p className="mt-1 text-xs text-slate-400">{[session.center, session.room].filter(Boolean).join(' · ') || 'Session location not reported'}</p></div>
        <button aria-label="Close session details" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"><X className="h-5 w-5" /></button>
      </header>

      <div className="max-h-[78vh] space-y-5 overflow-y-auto p-5">
        <section><h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Live session telemetry</h4><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Metric label="Candidates" value={session.students} />
          <Metric label="Risk score" value={session.riskScore} unit={session.riskScore === undefined ? '' : ' / 100'} />
          <Metric label="Network latency" value={session.latency} unit=" ms" />
          <Metric label="Packet loss" value={session.packetLoss} unit="%" />
          <Metric label="Login failures" value={session.loginFailures} />
          <Metric label="Submission failures" value={session.submissionFailures} />
          <Metric label="CPU usage" value={session.cpu} unit="%" />
          <Metric label="Memory usage" value={session.memory} unit="%" />
          <Metric label="DB response" value={session.dbResponseTime} unit=" ms" />
          <Metric label="Concurrent users" value={session.concurrentUsers} />
        </div><p className="mt-2 text-[10px] text-slate-500">Values are shown only when reported for this session.</p></section>

        <section className="rounded-xl border border-purple-800/50 bg-purple-950/20 p-4">
          <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-200"><Brain className="h-4 w-4"/>AI anomaly diagnosis</h4>
          {analysis ? <><div className="mt-3 grid gap-2 sm:grid-cols-3"><Metric label="Anomaly" value={analysis.anomalyDetected === undefined ? (analysis.anomaly?.detected ? 'DETECTED' : 'NOT DETECTED') : analysis.anomalyDetected ? 'DETECTED' : 'NOT DETECTED'} /><Metric label="Probable cause" value={cause} /><Metric label="Confidence" value={analysis.confidence === undefined ? analysis.rootCause?.confidence : `${Math.round(analysis.confidence * 100)}%`} /></div><ul className="mt-3 space-y-1">{evidence.map((item) => <li key={item} className="text-xs text-slate-300">• {item}</li>)}</ul><p className="mt-3 text-sm leading-relaxed text-slate-300">{analysis.explanation || 'Deterministic analysis is based on the latest session telemetry.'}</p></> : <p className="mt-2 text-xs text-slate-400">No session-specific AI analysis has been received yet.</p>}
        </section>

        <section className="rounded-xl border border-cyan-800/50 bg-cyan-950/15 p-4">
          <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-200"><ShieldAlert className="h-4 w-4"/>Recommended resilience action</h4>
          <p className="mt-2 text-sm font-semibold text-slate-100">{recommendedAction || 'No action recommended'}</p>
          {recommendationReason && <p className="mt-1 text-xs text-slate-400">{recommendationReason}</p>}
          <p className="mt-2 text-xs text-slate-300">Action status: <strong>{actionStatus || 'NOT STARTED'}</strong></p>
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          <div className={`rounded-xl border p-4 ${continuityActive ? 'border-emerald-700/70 bg-emerald-950/20' : 'border-slate-800 bg-slate-950/50'}`}><h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-200"><Activity className="h-4 w-4"/>Continuity</h4><p className="mt-2 text-sm font-bold">{continuityActive ? 'ACTIVE' : 'INACTIVE'}</p><p className="mt-1 text-xs text-slate-400">Protected candidates: {continuityActive ? (session.students ?? '—') : '—'}</p><p className="text-xs text-slate-400">Session state: {session.status || '—'}</p></div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4"><h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-200"><Database className="h-4 w-4"/>Submission recovery</h4><div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-300"><span>Pending: {recovery.pending ?? '—'}</span><span>Processing: {recovery.processing ?? '—'}</span><span>Recovered: {recovery.recovered ?? '—'}</span><span>Failed: {recovery.failed ?? '—'}</span></div>{recovery.progress !== undefined && <p className="mt-2 text-xs text-slate-400">Recovery progress: {recovery.progress}%</p>}</div>
        </section>

        <section><h4 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400"><Clock3 className="h-4 w-4"/>Session event timeline</h4>{timeline.length ? <ol className="space-y-2">{timeline.map((event, index) => <li key={event.id || `${event.type}-${index}`} className="flex gap-3 rounded-lg border border-slate-800 bg-slate-950/50 p-3"><time className="shrink-0 font-mono text-[11px] text-slate-500">{event.time || (event.timestamp ? new Date(event.timestamp).toLocaleTimeString() : '—')}</time><span className="text-xs text-slate-200"><b>{event.type || event.eventType}</b>{(event.message || event.summary) && <span className="ml-2 text-slate-400">{event.message || event.summary}</span>}</span></li>)}</ol> : <p className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-xs text-slate-500">No events have been recorded for this session.</p>}</section>
      </div>
      <footer className="flex justify-end border-t border-slate-800 bg-slate-950 p-3"><button onClick={onClose} className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700">Close</button></footer>
    </section>
  </div>;
}
