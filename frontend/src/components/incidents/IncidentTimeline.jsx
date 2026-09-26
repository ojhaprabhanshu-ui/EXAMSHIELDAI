import React from 'react';
import { Clock, Info, AlertTriangle, AlertOctagon, CheckCircle2 } from 'lucide-react';

export function IncidentTimeline({ timeline = [] }) {
  const getIcon = (type) => {
    switch (type) {
      case 'danger':
        return <AlertOctagon className="w-4 h-4 text-rose-400" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      default:
        return <Info className="w-4 h-4 text-cyan-400" />;
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-lg mb-6">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-4">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-cyan-400" />
          <h3 className="text-sm font-bold text-slate-100 tracking-wide uppercase">
            Incident Event Log & Audit Timeline
          </h3>
        </div>
        <span className="text-[11px] text-slate-400 font-mono">CHRONOLOGICAL AUDIT TRAIL</span>
      </div>

      <div className="space-y-3 relative before:absolute before:inset-0 before:left-2.5 before:w-0.5 before:bg-slate-800">
        {timeline.map((item) => (
          <div key={item.id} className="relative flex items-start gap-3.5 pl-6 group">
            {/* Timeline Dot */}
            <div className="absolute left-0 top-1 p-1 rounded-full bg-slate-900 border border-slate-700 group-hover:scale-110 transition-transform">
              {getIcon(item.type)}
            </div>

            <div className="flex-1 bg-slate-950/70 border border-slate-800/80 p-3 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <p className="text-xs text-slate-200 font-medium leading-snug">
                {item.message}
              </p>
              <span className="text-[11px] font-mono text-slate-400 shrink-0">
                {item.time}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
