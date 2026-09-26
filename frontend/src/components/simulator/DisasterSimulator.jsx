import React from 'react';
import { Zap, AlertTriangle, ShieldCheck, Server, Database, Users } from 'lucide-react';

export function DisasterSimulator({ activeScenario, onSelectScenario, isTransitioning }) {
  const scenarios = [
    {
      id: 'NORMAL',
      label: 'Normal Exam',
      description: 'Baseline operational state',
      icon: ShieldCheck,
      color: 'hover:border-emerald-500 hover:bg-emerald-950/40 text-emerald-400',
      activeColor: 'bg-emerald-950/80 border-emerald-500 text-emerald-300 ring-2 ring-emerald-500/50',
    },
    {
      id: 'LOGIN_SPIKE',
      label: 'Login Spike',
      description: 'Mass authentication surge',
      icon: Users,
      color: 'hover:border-amber-500 hover:bg-amber-950/40 text-amber-400',
      activeColor: 'bg-amber-950/80 border-amber-500 text-amber-300 ring-2 ring-amber-500/50',
    },
    {
      id: 'NETWORK_DEGRADATION',
      label: 'Network Degradation',
      description: 'Main Day 1 Demo Scenario',
      icon: Zap,
      color: 'hover:border-rose-500 hover:bg-rose-950/40 text-rose-400',
      activeColor: 'bg-rose-950/80 border-rose-500 text-rose-300 ring-2 ring-rose-500/50',
    },
    {
      id: 'SERVER_OVERLOAD',
      label: 'Server Overload',
      description: 'CPU & memory saturation',
      icon: Server,
      color: 'hover:border-purple-500 hover:bg-purple-950/40 text-purple-400',
      activeColor: 'bg-purple-950/80 border-purple-500 text-purple-300 ring-2 ring-purple-500/50',
    },
    {
      id: 'DATABASE_SLOWDOWN',
      label: 'Database Slowdown',
      description: 'Disk I/O latency & write lock',
      icon: Database,
      color: 'hover:border-blue-500 hover:bg-blue-950/40 text-blue-400',
      activeColor: 'bg-blue-950/80 border-blue-500 text-blue-300 ring-2 ring-blue-500/50',
    },
  ];

  return (
    <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-xl p-5 shadow-2xl mb-6 relative overflow-hidden">
      
      {/* Background Accent glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full filter blur-3xl pointer-events-none" />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-800/80 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400 animate-pulse" />
            <h3 className="text-base font-extrabold text-slate-100 tracking-wide uppercase">
              Disaster Simulator (Day 1 Operational Control)
            </h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800/80">
              DEMO MODE
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Trigger real-time telemetry anomalies to test command center resilience visualizations.
          </p>
        </div>

        {/* Active Scenario Indicator */}
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs">
          <span className="text-slate-400">ACTIVE SCENARIO:</span>
          <span className="font-bold text-cyan-400 uppercase tracking-wide">
            {activeScenario}
          </span>
        </div>
      </div>

      {/* Simulator Buttons Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {scenarios.map((sc) => {
          const Icon = sc.icon;
          const isActive = activeScenario === sc.id;
          const style = isActive ? sc.activeColor : `bg-slate-950/80 border-slate-800 ${sc.color}`;

          return (
            <button
              key={sc.id}
              onClick={() => onSelectScenario(sc.id)}
              disabled={isTransitioning}
              className={`p-3.5 rounded-xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between ${style} ${
                isTransitioning ? 'opacity-70 cursor-not-allowed' : 'hover:scale-[1.03] shadow-md'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">
                  {sc.label}
                </span>
                <div className="p-1.5 rounded-lg bg-slate-900/60">
                  <Icon className="w-4 h-4" />
                </div>
              </div>

              <p className="text-[11px] opacity-80 line-clamp-2">
                {sc.description}
              </p>

              {isActive && (
                <div className="mt-2 text-[10px] font-mono font-bold tracking-widest text-cyan-300 uppercase flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                  [ ACTIVE INJECT ]
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
