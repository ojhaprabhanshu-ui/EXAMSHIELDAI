import React, { useState, useEffect } from 'react';
import { Shield, Activity, Clock, Zap, AlertTriangle } from 'lucide-react';
import { StatusBadge } from '../common/StatusBadge';

export function Header({ meta, examStatus, riskScore, activeScenarioName, isTransitioning, user, onLogout, isLive }) {
  const [timeStr, setTimeStr] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30 shadow-xl backdrop-blur-md bg-slate-900/95">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          
          {/* Title & Brand */}
          <div className="flex items-center gap-3.5">
            <div className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/40 text-cyan-400 shadow-inner">
              <Shield className="w-6 h-6" />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
              </span>
            </div>
            
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  EXAMSHIELD AI
                </h1>
                <span className="text-xs px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/80 font-mono font-semibold">
                  {isLive ? 'LIVE BACKEND' : 'DEMO MODE'}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium tracking-wide">
                Live Examination Command Center
              </p>
            </div>
          </div>

          {/* Exam Details Center Tag */}
          <div className="flex flex-wrap items-center gap-3 px-3.5 py-1.5 bg-slate-950/70 border border-slate-800 rounded-lg text-xs">
            <span className="text-slate-400">Exam:</span>
            <span className="font-semibold text-slate-200">{meta?.title || 'Database Management Systems'} — {meta?.semester || 'Semester VI'}</span>
            <span className="text-slate-600">|</span>
            <span className="font-mono text-cyan-400 font-medium">{meta?.code || 'CS-601'}</span>
          </div>

          {/* Live Indicators & Controls Right Side */}
          <div className="flex items-center justify-between lg:justify-end gap-4">
            
            {/* Live Indicator */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-xs">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="font-semibold text-emerald-400 tracking-wider uppercase">LIVE STREAM</span>
            </div>

            {/* Current Status Badge */}
            <div className="flex items-center gap-2">
              <StatusBadge status={examStatus} size="lg" animate={examStatus === 'CRITICAL'} />
            </div>

            {/* Live Clock */}
            <div className="flex items-center gap-1.5 text-xs font-mono font-semibold text-slate-300 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span>{timeStr || '10:32:45'}</span>
            </div>
            {user && <div className="flex items-center gap-2 text-xs text-slate-300"><span>{user.displayName || user.email}</span><button onClick={onLogout} className="rounded border border-slate-700 px-2.5 py-1.5 hover:border-cyan-500 hover:text-white">Sign out</button></div>}
          </div>

        </div>

        {/* Transition Progress Banner */}
        {isTransitioning && (
          <div className="mt-2.5 px-3 py-1.5 bg-cyan-950/70 border border-cyan-500/40 rounded-lg flex items-center justify-between text-xs text-cyan-300 animate-pulse">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyan-400 animate-bounce" />
              <span>Simulating disaster scenario transition step: <strong>{activeScenarioName}</strong></span>
            </div>
            <span className="font-mono text-cyan-400">Updating telemetry state...</span>
          </div>
        )}
      </div>
    </header>
  );
}
