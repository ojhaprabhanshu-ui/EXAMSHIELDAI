import React from 'react';
import { AlertTriangle, CheckCircle, Info } from 'lucide-react';

export function EmptyState({ title = 'No Data Available', message = 'No active incidents or telemetry data found.', icon: Icon = Info }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-900/40 border border-slate-800/80 rounded-xl">
      <div className="p-3 bg-slate-800/60 rounded-full mb-3 text-slate-400">
        <Icon className="w-6 h-6" />
      </div>
      <h4 className="text-sm font-semibold text-slate-200">{title}</h4>
      <p className="text-xs text-slate-400 max-w-sm mt-1">{message}</p>
    </div>
  );
}
