/**
 * Formatters and helper functions for ExamShield AI Command Center
 */

export const formatPercent = (val) => `${Math.round(val)}%`;

export const formatMs = (val) => `${Math.round(val)} ms`;

export const formatNumber = (val) => new Intl.NumberFormat().format(val);

export const getStatusColor = (status) => {
  switch (status?.toUpperCase()) {
    case 'NORMAL':
    case 'LIVE':
    case 'HEALTHY':
      return {
        bg: 'bg-emerald-500/10',
        text: 'text-emerald-400',
        border: 'border-emerald-500/30',
        dot: 'bg-emerald-500',
        badge: 'bg-emerald-950 text-emerald-300 border-emerald-800',
      };
    case 'WARNING':
    case 'AT_RISK':
    case 'AT RISK':
      return {
        bg: 'bg-amber-500/10',
        text: 'text-amber-400',
        border: 'border-amber-500/30',
        dot: 'bg-amber-500',
        badge: 'bg-amber-950 text-amber-300 border-amber-800',
      };
    case 'CRITICAL':
    case 'AFFECTED':
    case 'HIGH_RISK':
      return {
        bg: 'bg-rose-500/10',
        text: 'text-rose-400',
        border: 'border-rose-500/30',
        dot: 'bg-rose-500',
        badge: 'bg-rose-950 text-rose-300 border-rose-800',
      };
    default:
      return {
        bg: 'bg-slate-500/10',
        text: 'text-slate-400',
        border: 'border-slate-500/30',
        dot: 'bg-slate-500',
        badge: 'bg-slate-900 text-slate-300 border-slate-700',
      };
  }
};

export const getRiskScoreColor = (score) => {
  if (score < 40) return 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10';
  if (score < 75) return 'text-amber-400 border-amber-500/40 bg-amber-500/10';
  return 'text-rose-400 border-rose-500/40 bg-rose-500/10';
};
