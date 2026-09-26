import React from 'react';
import { X, MapPin, Users, Wifi, Radio, UserX, AlertOctagon, Brain, ShieldAlert, CheckCircle } from 'lucide-react';
import { StatusBadge } from '../common/StatusBadge';
import { formatMs, formatPercent, getRiskScoreColor } from '../../utils/formatters';

export function SessionDrillDownModal({ session, onClose }) {
  if (!session) return null;

  const {
    id = 'A103',
    center = 'Bhopal Center',
    room = 'Lab 103',
    students = 120,
    status = 'AT_RISK',
    riskScore = 78,
    latency = 218,
    packetLoss = 5.2,
    loginFailures = 12,
    submissionFailures = 7,
    diagnosis = 'Pending AI diagnosis',
    recommendation = 'Pending backend/AI integration',
  } = session;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div
        className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl transition-all scale-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-950 border border-cyan-800 text-cyan-400 font-mono text-xl font-bold">
              {id}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-100">Session Inspection Drill-Down</h3>
                <StatusBadge status={status} size="md" />
              </div>
              <p className="text-xs text-slate-400">
                {center} • Room {room}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          
          {/* Top Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400">Candidates</span>
              <div className="text-lg font-bold text-slate-100 flex items-center gap-1.5 mt-0.5">
                <Users className="w-4 h-4 text-cyan-400" />
                <span>{students}</span>
              </div>
            </div>

            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400">Risk Score</span>
              <div className={`text-lg font-bold font-mono mt-0.5 ${getRiskScoreColor(riskScore)}`}>
                {riskScore} / 100
              </div>
            </div>

            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400">Network Latency</span>
              <div className="text-lg font-bold text-slate-100 flex items-center gap-1.5 mt-0.5 font-mono">
                <Wifi className="w-4 h-4 text-cyan-400" />
                <span>{formatMs(latency)}</span>
              </div>
            </div>

            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400">Packet Loss</span>
              <div className="text-lg font-bold text-slate-100 flex items-center gap-1.5 mt-0.5 font-mono">
                <Radio className="w-4 h-4 text-rose-400" />
                <span>{formatPercent(packetLoss)}</span>
              </div>
            </div>
          </div>

          {/* Detailed Failures Telemetry */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserX className="w-4 h-4 text-amber-400" />
                <span className="text-xs text-slate-300 font-medium">Login Failures</span>
              </div>
              <span className="text-base font-bold font-mono text-amber-400">{loginFailures}</span>
            </div>

            <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertOctagon className="w-4 h-4 text-rose-400" />
                <span className="text-xs text-slate-300 font-medium">Submission Failures</span>
              </div>
              <span className="text-base font-bold font-mono text-rose-400">{submissionFailures}</span>
            </div>
          </div>

          {/* AI Root Cause & Diagnosis Section (Integration Slot) */}
          <div className="bg-gradient-to-r from-slate-950 to-purple-950/30 border border-purple-800/40 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-purple-400 text-xs font-bold uppercase tracking-wider">
              <Brain className="w-4 h-4" />
              <span>AI Anomaly Diagnosis (Nikita's AI Slot)</span>
            </div>
            <p className="text-sm text-slate-200 bg-slate-900/80 p-3 rounded-lg border border-slate-800/80 leading-relaxed font-sans">
              {diagnosis}
            </p>
          </div>

          {/* Recommended Resilience Action Section (Integration Slot) */}
          <div className="bg-gradient-to-r from-slate-950 to-cyan-950/30 border border-cyan-800/40 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-wider">
              <ShieldAlert className="w-4 h-4" />
              <span>Recommended Resilience Action (Junaid's Backend Slot)</span>
            </div>
            <p className="text-sm text-slate-200 bg-slate-900/80 p-3 rounded-lg border border-slate-800/80 leading-relaxed font-sans">
              {recommendation}
            </p>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
          <span className="text-xs text-slate-400 font-mono">
            Telemetry Stream ID: TEL-{id}-{Date.now().toString().slice(-4)}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Close Drill-Down
          </button>
        </div>
      </div>
    </div>
  );
}
