import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { Wifi, Radio, Cpu, Users, UserX, AlertOctagon, TrendingUp } from 'lucide-react';

const CustomTooltip = ({ active, payload, label, unit }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-950 border border-slate-800 p-2.5 rounded-lg shadow-xl text-xs font-mono">
        <p className="text-slate-400 font-bold mb-1">{label}</p>
        <p className="text-cyan-300 font-semibold">
          {payload[0].name}: {payload[0].value} {unit}
        </p>
      </div>
    );
  }
  return null;
};

export function LiveCharts({ chartData = [] }) {
  const chartConfigs = [
    {
      id: 'latency',
      title: 'A. Network Latency (ms)',
      dataKey: 'latency',
      unit: 'ms',
      color: '#38bdf8', // sky-400
      icon: Wifi,
      chartType: 'area',
    },
    {
      id: 'packetLoss',
      title: 'B. Packet Loss (%)',
      dataKey: 'packetLoss',
      unit: '%',
      color: '#f43f5e', // rose-500
      icon: Radio,
      chartType: 'area',
    },
    {
      id: 'cpu',
      title: 'C. CPU Usage (%)',
      dataKey: 'cpu',
      unit: '%',
      color: '#a855f7', // purple-500
      icon: Cpu,
      chartType: 'area',
    },
    {
      id: 'users',
      title: 'D. Concurrent Users',
      dataKey: 'users',
      unit: 'candidates',
      color: '#10b981', // emerald-500
      icon: Users,
      chartType: 'line',
    },
    {
      id: 'loginFailures',
      title: 'E. Login Failures',
      dataKey: 'loginFailures',
      unit: 'attempts',
      color: '#f59e0b', // amber-500
      icon: UserX,
      chartType: 'area',
    },
    {
      id: 'submissionFailures',
      title: 'F. Submission Failures',
      dataKey: 'submissionFailures',
      unit: 'drops',
      color: '#e11d48', // rose-600
      icon: AlertOctagon,
      chartType: 'area',
    },
  ];

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-lg mb-6">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-5">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-cyan-400" />
          <h3 className="text-sm font-bold text-slate-100 tracking-wide uppercase">
            Live Telemetry Time-Series Analytics (6 Channels)
          </h3>
        </div>
        <span className="text-[11px] text-slate-400 font-mono">DETERMINISTIC DATASTREAM</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {chartConfigs.map((cfg) => {
          const Icon = cfg.icon;
          return (
            <div
              key={cfg.id}
              className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Icon className="w-3.5 h-3.5 text-cyan-400" />
                  {cfg.title}
                </span>
                <span className="text-[10px] font-mono text-slate-400">LIVE FEED</span>
              </div>

              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  {cfg.chartType === 'area' ? (
                    <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id={`grad-${cfg.id}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={cfg.color} stopOpacity={0.4} />
                          <stop offset="95%" stopColor={cfg.color} stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
                      <XAxis dataKey="time" stroke="#64748b" fontSize={10} tickLine={false} />
                      <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                      <Tooltip content={<CustomTooltip unit={cfg.unit} />} />
                      <Area
                        type="monotone"
                        dataKey={cfg.dataKey}
                        name={cfg.title.split('. ')[1]}
                        stroke={cfg.color}
                        strokeWidth={2}
                        fillOpacity={1}
                        fill={`url(#grad-${cfg.id})`}
                        isAnimationActive={true}
                      />
                    </AreaChart>
                  ) : (
                    <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
                      <XAxis dataKey="time" stroke="#64748b" fontSize={10} tickLine={false} />
                      <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                      <Tooltip content={<CustomTooltip unit={cfg.unit} />} />
                      <Line
                        type="monotone"
                        dataKey={cfg.dataKey}
                        name={cfg.title.split('. ')[1]}
                        stroke={cfg.color}
                        strokeWidth={2}
                        dot={{ r: 3, fill: cfg.color }}
                        activeDot={{ r: 5 }}
                        isAnimationActive={true}
                      />
                    </LineChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
