import React from 'react';
import { Users, CheckCircle2, AlertTriangle, XCircle, ShieldAlert, Activity } from 'lucide-react';
import { getRiskScoreColor, formatNumber } from '../../utils/formatters';

export function KpiCards({ state }) {
  const {
    students = { total: 1000, normal: 970, atRisk: 25, affected: 5 },
    riskScore = 24,
    erScore = 95,
  } = state || {};

  const cards = [
    {
      id: 'total',
      label: 'Total Students',
      value: formatNumber(students.total),
      subtext: 'Registered across 4 centers',
      icon: Users,
      accent: 'border-slate-700 bg-slate-900/80 text-slate-200',
      iconColor: 'text-cyan-400 bg-cyan-950/50',
    },
    {
      id: 'normal',
      label: 'Normal',
      value: formatNumber(students.normal),
      subtext: `${Math.round((students.normal / students.total) * 100)}% operating smoothly`,
      icon: CheckCircle2,
      accent: 'border-emerald-500/30 bg-slate-900/80 text-emerald-400',
      iconColor: 'text-emerald-400 bg-emerald-950/50',
    },
    {
      id: 'at_risk',
      label: 'At Risk',
      value: formatNumber(students.atRisk),
      subtext: 'Jitter & telemetry latency',
      icon: AlertTriangle,
      accent: 'border-amber-500/30 bg-slate-900/80 text-amber-400',
      iconColor: 'text-amber-400 bg-amber-950/50',
    },
    {
      id: 'affected',
      label: 'Affected',
      value: formatNumber(students.affected),
      subtext: 'Delayed/re-routed responses',
      icon: XCircle,
      accent: 'border-rose-500/30 bg-slate-900/80 text-rose-400',
      iconColor: 'text-rose-400 bg-rose-950/50',
    },
    {
      id: 'risk_score',
      label: 'Risk Score',
      value: `${riskScore} / 100`,
      subtext: riskScore < 40 ? 'LOW RISK' : riskScore < 75 ? 'MODERATE RISK' : 'HIGH RISK ALERT',
      icon: ShieldAlert,
      accent: getRiskScoreColor(riskScore),
      iconColor: riskScore >= 75 ? 'text-rose-400 bg-rose-950/60' : 'text-amber-400 bg-amber-950/60',
    },
    {
      id: 'ers',
      label: 'Examination Resilience (ERS)',
      value: `${erScore} / 100`,
      subtext: erScore >= 90 ? 'HEALTHY' : erScore >= 75 ? 'MODERATE' : 'DEGRADED',
      icon: Activity,
      accent: 'border-cyan-500/40 bg-gradient-to-br from-cyan-950/30 to-blue-950/30 text-cyan-300',
      iconColor: 'text-cyan-300 bg-cyan-950/80',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5 mb-6">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.id}
            className={`p-4 rounded-xl border ${card.accent} backdrop-blur-sm shadow-lg transition-all duration-300 hover:scale-[1.02] flex flex-col justify-between`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase">
                {card.label}
              </span>
              <div className={`p-1.5 rounded-lg ${card.iconColor}`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>

            <div>
              <div className="text-2xl font-extrabold tracking-tight font-mono">
                {card.value}
              </div>
              <p className="text-[11px] text-slate-400 font-medium mt-1 truncate">
                {card.subtext}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
