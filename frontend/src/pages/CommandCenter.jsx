import React from 'react';
import { useExamSimulation } from '../hooks/useExamSimulation';
import { Header } from '../components/dashboard/Header';
import { KpiCards } from '../components/dashboard/KpiCards';
import { ErssCard } from '../components/dashboard/ErssCard';
import { InfrastructureHealth } from '../components/dashboard/InfrastructureHealth';
import { DisasterSimulator } from '../components/simulator/DisasterSimulator';
import { LiveCharts } from '../components/charts/LiveCharts';
import { StudentImpactMap } from '../components/sessions/StudentImpactMap';
import { IncidentTimeline } from '../components/incidents/IncidentTimeline';
import { SessionDrillDownModal } from '../components/sessions/SessionDrillDownModal';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { AlertOctagon, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { apiRequest } from '../services/apiClient';

export function CommandCenter({ user, accessToken, onLogout }) {
  const {
    meta,
    scenarioKey,
    examState,
    isTransitioning,
    isLoading,
    error,
    selectedSession,
    triggerScenario,
    openSessionDrillDown,
    closeSessionDrillDown,
    isLive,
    retry,
  } = useExamSimulation(accessToken);
  const [setupBusy, setSetupBusy] = useState(false);
  const [setupError, setSetupError] = useState('');

  async function createFirstExam(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSetupBusy(true); setSetupError('');
    try {
      await apiRequest('/exams', { method: 'POST', body: JSON.stringify({
        title: form.get('title'), startsAt: new Date(form.get('startsAt')).toISOString(),
        endsAt: new Date(form.get('endsAt')).toISOString(), durationSeconds: Number(form.get('durationMinutes')) * 60,
      }) });
      await retry();
    } catch (err) { setSetupError(err.message); }
    finally { setSetupBusy(false); }
  }

  if (isLoading && !examState) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <LoadingSpinner message="Initializing ExamShield AI Command Center..." />
      </div>
    );
  }

  if (error) {
    if (error.includes('NO_EXAMS') || error.toLowerCase().includes('no scheduled or active exams')) {
      const canCreate = ['Admin', 'Examiner'].includes(user?.role);
      return <div className="min-h-screen bg-slate-950 text-slate-100"><Header meta={{ title: 'Exam setup', semester: 'Backend' }} user={user} onLogout={onLogout} isLive={false} examStatus="SCHEDULED" riskScore={0} /><main className="mx-auto mt-14 max-w-xl rounded-xl border border-slate-800 bg-slate-900 p-6"><h2 className="text-xl font-bold">No exam is available yet</h2><p className="mt-2 text-sm text-slate-400">{canCreate ? 'Create the first exam to populate the live Command Center.' : 'Ask an Admin or Examiner to create a scheduled exam.'}</p>{canCreate && <form onSubmit={createFirstExam} className="mt-5 space-y-3"><label className="block text-sm">Exam title<input name="title" required className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2" /></label><label className="block text-sm">Starts<input name="startsAt" type="datetime-local" required className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2" /></label><label className="block text-sm">Ends<input name="endsAt" type="datetime-local" required className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2" /></label><label className="block text-sm">Duration (minutes)<input name="durationMinutes" type="number" min="1" required className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2" /></label>{setupError && <p role="alert" className="text-sm text-rose-300">{setupError}</p>}<button disabled={setupBusy} className="rounded bg-cyan-500 px-4 py-2 font-bold text-slate-950 disabled:opacity-60">{setupBusy ? 'Creating…' : 'Create exam'}</button></form>}<button onClick={onLogout} className="ml-3 rounded border border-slate-700 px-4 py-2 text-sm">Sign out</button></main></div>;
    }
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-rose-950/40 border border-rose-800 p-6 rounded-xl text-center max-w-md">
          <AlertOctagon className="w-10 h-10 text-rose-400 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-rose-200">Telemetry Initialization Error</h3>
          <p className="text-xs text-rose-300 mt-2">{error}</p>
        </div>
      </div>
    );
  }

  const {
    examStatus = 'LIVE',
    riskScore = 24,
    erScore = 95,
    erBreakdown = {},
    infrastructure = {},
    sessions = [],
    timeline = [],
    chartData = [],
  } = examState || {};

  const isCriticalExam = examStatus === 'CRITICAL';
  const isAtRiskExam = examStatus === 'AT_RISK';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans pb-12">
      
      {/* Header */}
        <Header
        meta={meta}
        examStatus={examStatus}
        riskScore={riskScore}
        activeScenarioName={examState?.name || scenarioKey}
        isTransitioning={isTransitioning}
      />

      {/* Main Content Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        
        {/* Critical/Risk Warning Banner */}
        {(isCriticalExam || isAtRiskExam) && (
          <div
            className={`p-4 rounded-xl border flex items-center justify-between gap-3 animate-pulse shadow-lg ${
              isCriticalExam
                ? 'bg-rose-950/70 border-rose-500/80 text-rose-200'
                : 'bg-amber-950/70 border-amber-500/80 text-amber-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <ShieldAlert className={`w-6 h-6 shrink-0 ${isCriticalExam ? 'text-rose-400' : 'text-amber-400'}`} />
              <div>
                <h4 className="text-sm font-bold uppercase tracking-wide">
                  {isCriticalExam ? 'CRITICAL EXAM ANOMALY DETECTED' : 'EXAM TELEMETRY AT RISK'}
                </h4>
                <p className="text-xs opacity-90 mt-0.5">
                  {examState?.badge || 'Telemetry values exceed normal SLA tolerances. Review affected sessions below.'}
                </p>
              </div>
            </div>
            <span className="text-xs font-mono font-bold bg-slate-950/80 px-3 py-1.5 rounded border border-slate-800 shrink-0">
              Risk Score: {riskScore} / 100
            </span>
          </div>
        )}

        {/* Disaster Simulator Panel (Primary Day 1 Demo Requirement) */}
        <DisasterSimulator
          activeScenario={scenarioKey}
          onSelectScenario={triggerScenario}
          isTransitioning={isTransitioning}
          user={user}
          onLogout={onLogout}
          isLive={isLive}
        />

        {/* Top KPI Cards */}
        <KpiCards state={examState} />

        {/* Examination Resilience Score (ERS) */}
        <ErssCard erScore={erScore} erBreakdown={erBreakdown} />

        {/* Infrastructure Health Telemetry (7 Metrics) */}
        <InfrastructureHealth infrastructure={infrastructure} />

        {/* Live Charts (Recharts) */}
        <LiveCharts chartData={chartData} />

        {/* Student Impact Map (Regional Centers / Rooms / Sessions) */}
        <StudentImpactMap
          sessions={sessions}
          onSelectSession={openSessionDrillDown}
        />

        {/* Incident Timeline Log */}
        <IncidentTimeline timeline={timeline} />

      </main>

      {/* Session Drill-Down Modal */}
      {selectedSession && (
        <SessionDrillDownModal
          session={selectedSession}
          onClose={closeSessionDrillDown}
        />
      )}

      {/* Footer */}
      <footer className="mt-12 border-t border-slate-900 py-6 text-center text-xs text-slate-500 font-mono">
        <p>EXAMSHIELD AI • Live Examination Command Center • Hackathon Day 1 Demo Edition</p>
      </footer>
    </div>
  );
}
