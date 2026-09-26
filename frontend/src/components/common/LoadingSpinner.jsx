import React from 'react';
import { Loader2 } from 'lucide-react';

export function LoadingSpinner({ message = 'Loading exam telemetry...' }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-slate-400 bg-slate-900/50 border border-slate-800 rounded-xl">
      <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mb-3" />
      <p className="text-sm font-medium text-slate-300">{message}</p>
    </div>
  );
}
