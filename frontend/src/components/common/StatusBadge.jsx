import React from 'react';
import { getStatusColor } from '../../utils/formatters';

export function StatusBadge({ status, size = 'md', animate = false }) {
  const styles = getStatusColor(status);
  
  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-[10px] font-semibold',
    md: 'px-2.5 py-1 text-xs font-semibold',
    lg: 'px-3 py-1.5 text-sm font-semibold',
  }[size] || 'px-2.5 py-1 text-xs font-semibold';

  const normalizedText = status?.replace('_', ' ') || 'UNKNOWN';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border ${styles.badge} ${sizeClasses} shadow-sm tracking-wide uppercase max-w-full shrink-0`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${styles.dot} ${animate ? 'animate-ping' : ''}`} />
      <span className="truncate">{normalizedText}</span>
    </span>
  );
}
