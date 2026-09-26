import React from 'react';
import { Activity, Server, Wifi, FileCheck, RefreshCw, CheckCircle } from 'lucide-react';
import { formatPercent } from '../../utils/formatters';

export function ErssCard({ erScore = 95, erBreakdown = {} }) {
  const {
    availability = 98,
    networkStability = 94,
    serverHealth = 91,
    submissionHealth = 97,
    recoveryPerformance = 95,
  } = erBreakdown;

  const metrics = [
    { label: 'Availability', value: availability, icon: Server },
    { label: 'Network Stability', value: networkStability, icon: Wifi },
    { label: 'Server Health', value: serverHealth, icon: Activity },
    { label: 'Submission Health', value: submissionHealth, icon: FileCheck },
    { label: 'Recovery Performance', value: recoveryPerformance, icon: RefreshCw },
  ];

  // Calculate SVG circle properties
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (erScore / 100) * circumference;

  const getScoreColor = (score) => {
    if (score >= 90) return { stroke: '#10b981', text: 'text-emerald-400', label: 'EXCELLENT RESILIENCE' };
    if (score >= 75) return { stroke: '#f59e0b', text: 'text-amber-400', label: 'MODERATE RESILIENCE' };
    return { stroke: '#f43f5e', text: 'text-rose-400', label: 'RESILIENCE CRITICAL' };
  };

  const scoreTheme = getScoreColor(erScore);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col justify-between">
      
      {/* Title */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-cyan-400" />
          <h3 className="text-sm font-bold text-slate-100 tracking-wide uppercase">
            Examination Resilience Score (ERS)
          </h3>
        </div>
        <span className="text-[11px] text-slate-400 font-mono">WEIGHTED AGGREGATE</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
        
        {/* Overall Circular Gauge */}
        <div className="md:col-span-5 flex flex-col items-center justify-center p-3 bg-slate-950/60 rounded-xl border border-slate-800/60">
          <div className="relative w-28 h-28 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r={radius}
                className="stroke-slate-800"
                strokeWidth="9"
                fill="transparent"
              />
              <circle
                cx="50"
                cy="50"
                r={radius}
                stroke={scoreTheme.stroke}
                strokeWidth="9"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
                className="transition-all duration-700 ease-out"
              />
            </svg>

            <div className="absolute flex flex-col items-center justify-center text-center">
              <span className={`text-2xl font-black font-mono tracking-tight ${scoreTheme.text}`}>
                {erScore}
              </span>
              <span className="text-[10px] font-semibold text-slate-400">OUT OF 100</span>
            </div>
          </div>

          <div className={`mt-2 text-[11px] font-bold tracking-wider ${scoreTheme.text} uppercase`}>
            {scoreTheme.label}
          </div>
        </div>

        {/* 5 ERS Metrics Breakdown Progress Bars */}
        <div className="md:col-span-7 space-y-2.5">
          {metrics.map((m) => {
            const Icon = m.icon;
            const barColor = m.value >= 90 ? 'bg-emerald-500' : m.value >= 75 ? 'bg-amber-500' : 'bg-rose-500';
            const textColor = m.value >= 90 ? 'text-emerald-400' : m.value >= 75 ? 'text-amber-400' : 'text-rose-400';

            return (
              <div key={m.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-medium flex items-center gap-1.5">
                    <Icon className="w-3.5 h-3.5 text-slate-400" />
                    {m.label}
                  </span>
                  <span className={`font-mono font-bold ${textColor}`}>
                    {formatPercent(m.value)}
                  </span>
                </div>
                <div className="w-full bg-slate-800/80 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full ${barColor} transition-all duration-500 rounded-full`}
                    style={{ width: `${Math.min(100, Math.max(0, m.value))}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

      </div>

    </div>
  );
}
