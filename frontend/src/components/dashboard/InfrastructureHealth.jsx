import { Wifi, Radio, Cpu, HardDrive, Users, UserX, AlertOctagon } from 'lucide-react';
import { StatusBadge } from '../common/StatusBadge';
import { formatMs, formatPercent, formatNumber } from '../../utils/formatters';

export function InfrastructureHealth({ infrastructure = {} }) {
  const {
    latency = 48,
    packetLoss = 0.5,
    cpu = 54,
    memory = 42,
    concurrentUsers = 992,
    loginFailures = 2,
    submissionFailures = 1,
  } = infrastructure;

  // Evaluate status rules for metrics
  const getMetricStatus = (key, val) => {
    switch (key) {
      case 'latency':
        return val > 200 ? 'CRITICAL' : val > 100 ? 'WARNING' : 'NORMAL';
      case 'packetLoss':
        return val > 5.0 ? 'CRITICAL' : val > 2.0 ? 'WARNING' : 'NORMAL';
      case 'cpu':
        return val > 85 ? 'CRITICAL' : val > 70 ? 'WARNING' : 'NORMAL';
      case 'memory':
        return val > 85 ? 'CRITICAL' : val > 75 ? 'WARNING' : 'NORMAL';
      case 'concurrentUsers':
        return val > 2000 ? 'WARNING' : 'NORMAL';
      case 'loginFailures':
        return val > 25 ? 'CRITICAL' : val > 10 ? 'WARNING' : 'NORMAL';
      case 'submissionFailures':
        return val > 15 ? 'CRITICAL' : val > 5 ? 'WARNING' : 'NORMAL';
      default:
        return 'NORMAL';
    }
  };

  const items = [
    {
      key: 'latency',
      label: 'Network Latency',
      valDisplay: formatMs(latency),
      status: getMetricStatus('latency', latency),
      icon: Wifi,
    },
    {
      key: 'packetLoss',
      label: 'Packet Loss',
      valDisplay: formatPercent(packetLoss),
      status: getMetricStatus('packetLoss', packetLoss),
      icon: Radio,
    },
    {
      key: 'cpu',
      label: 'CPU Usage',
      valDisplay: formatPercent(cpu),
      status: getMetricStatus('cpu', cpu),
      icon: Cpu,
    },
    {
      key: 'memory',
      label: 'Memory Usage',
      valDisplay: formatPercent(memory),
      status: getMetricStatus('memory', memory),
      icon: HardDrive,
    },
    {
      key: 'concurrentUsers',
      label: 'Concurrent Users',
      valDisplay: formatNumber(concurrentUsers),
      status: getMetricStatus('concurrentUsers', concurrentUsers),
      icon: Users,
    },
    {
      key: 'loginFailures',
      label: 'Login Failures',
      valDisplay: formatNumber(loginFailures),
      status: getMetricStatus('loginFailures', loginFailures),
      icon: UserX,
    },
    {
      key: 'submissionFailures',
      label: 'Submission Failures',
      valDisplay: formatNumber(submissionFailures),
      status: getMetricStatus('submissionFailures', submissionFailures),
      icon: AlertOctagon,
    },
  ];

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-lg overflow-hidden w-full">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800/80 mb-4">
        <div className="flex items-center gap-2">
          <Cpu className="w-5 h-5 text-cyan-400 shrink-0" />
          <h3 className="text-sm font-bold text-slate-100 tracking-wide uppercase truncate">
            Infrastructure Health Telemetry
          </h3>
        </div>
        <span className="text-[11px] text-amber-300 font-mono shrink-0">PYTHON SIMULATION</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 w-full">
        {items.map((item) => {
          const Icon = item.icon;
          const isCritical = item.status === 'CRITICAL';
          const isWarning = item.status === 'WARNING';

          const cardBorder = isCritical
            ? 'border-rose-500/40 bg-rose-950/20'
            : isWarning
            ? 'border-amber-500/40 bg-amber-950/20'
            : 'border-slate-800 bg-slate-950/60';

          return (
            <div
              key={item.key}
              className={`p-3 rounded-lg border ${cardBorder} flex flex-col justify-between transition-all duration-300 min-w-0 overflow-hidden shadow-sm`}
            >
              <div className="flex items-center justify-between gap-1 mb-2 min-w-0">
                <span className="text-[11px] font-medium text-slate-400 truncate min-w-0" title={item.label}>
                  {item.label}
                </span>
                <Icon className={`w-3.5 h-3.5 shrink-0 ${isCritical ? 'text-rose-400' : isWarning ? 'text-amber-400' : 'text-slate-400'}`} />
              </div>

              <div className="min-w-0">
                <div className={`text-base sm:text-lg font-bold font-mono truncate ${isCritical ? 'text-rose-400' : isWarning ? 'text-amber-400' : 'text-slate-100'}`}>
                  {item.valDisplay}
                </div>
                <div className="mt-2 flex items-center min-w-0">
                  <StatusBadge status={item.status} size="sm" animate={isCritical} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
