'use client';

import { RAGStatus } from '@/types';

const labels: Record<RAGStatus, string> = { green: 'Good', amber: 'Warning', red: 'Critical' };
const colors: Record<RAGStatus, string> = {
  green: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  amber: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  red: 'bg-red-500/15 text-red-400 border-red-500/30',
};

interface RAGBadgeProps {
  status: RAGStatus;
  label?: string;
}

export default function RAGBadge({ status, label }: RAGBadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${colors[status]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status === 'green' ? 'bg-emerald-400' : status === 'amber' ? 'bg-amber-400' : 'bg-red-400'}`} />
      {label || labels[status]}
    </span>
  );
}
