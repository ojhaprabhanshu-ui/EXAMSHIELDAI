import React, { useState } from 'react';
import { MapPin, Users, ChevronRight, Filter, AlertTriangle } from 'lucide-react';
import { StatusBadge } from '../common/StatusBadge';
import { getRiskScoreColor } from '../../utils/formatters';

export function StudentImpactMap({ sessions = [], onSelectSession }) {
  const [filterStatus, setFilterStatus] = useState('ALL');

  const filteredSessions = sessions.filter((s) => {
    if (filterStatus === 'ALL') return true;
    return s.status === filterStatus;
  });

  const countByStatus = {
    ALL: sessions.length,
    NORMAL: sessions.filter((s) => s.status === 'NORMAL').length,
    AT_RISK: sessions.filter((s) => s.status === 'AT_RISK').length,
    AFFECTED: sessions.filter((s) => s.status === 'AFFECTED').length,
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-lg mb-6">
      
      {/* Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800/80 mb-4">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-cyan-400" />
          <div>
            <h3 className="text-sm font-bold text-slate-100 tracking-wide uppercase">
              Regional Center & Session Impact Map
            </h3>
            <p className="text-xs text-slate-400">
              Click any exam session card to open telemetry drill-down analysis
            </p>
          </div>
        </div>

        {/* Status Filter Buttons */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-medium">
          <Filter className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
          {['ALL', 'NORMAL', 'AT_RISK', 'AFFECTED'].map((st) => {
            const count = countByStatus[st] || 0;
            const isActive = filterStatus === st;
            return (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  isActive
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {st.replace('_', ' ')} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid of Session Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
        {filteredSessions.map((session) => {
          const isAffected = session.status === 'AFFECTED';
          const isAtRisk = session.status === 'AT_RISK';

          const cardStyle = isAffected
            ? 'border-rose-500/40 bg-rose-950/20 hover:border-rose-500'
            : isAtRisk
            ? 'border-amber-500/40 bg-amber-950/20 hover:border-amber-500'
            : 'border-slate-800 bg-slate-950/60 hover:border-slate-700';

          return (
            <button
              key={session.id}
              type="button"
              aria-label={`Drill down into session ${session.id}`}
              onClick={() => onSelectSession(session.id)}
              className={`w-full p-4 rounded-xl border ${cardStyle} transition-all duration-200 cursor-pointer flex flex-col justify-between group shadow-md hover:scale-[1.02] text-left`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-base font-extrabold font-mono text-cyan-400 tracking-wider">
                    {session.id}
                  </span>
                  <StatusBadge status={session.status} size="sm" animate={isAffected} />
                </div>

                <div className="text-xs text-slate-300 font-medium">
                  {session.center}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Room: {session.room}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-slate-400">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  <span>{session.students} students</span>
                </div>

                {session.riskScore !== undefined && (
                  <div className={`px-2 py-0.5 rounded border text-[11px] font-mono font-bold ${getRiskScoreColor(session.riskScore)}`}>
                    Risk {session.riskScore}
                  </div>
                )}
              </div>

              <div className="mt-2 text-[11px] text-cyan-400 font-semibold group-hover:translate-x-1 transition-transform flex items-center justify-end gap-1">
                <span>Drill Down</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </button>
          );
        })}
      </div>

    </div>
  );
}
