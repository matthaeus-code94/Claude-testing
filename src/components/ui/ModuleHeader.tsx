'use client';

import { RAGStatus } from '@/types';
import RAGBadge from './RAGBadge';

interface ModuleHeaderProps {
  title: string;
  score: number;
  status: RAGStatus;
  icon: React.ReactNode;
}

export default function ModuleHeader({ title, score, status, icon }: ModuleHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center text-[var(--color-primary)]">
          {icon}
        </div>
        <h2 className="text-lg font-semibold text-[var(--color-text)]">{title}</h2>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-[var(--color-text-muted)]">Score: {score}/100</span>
        <RAGBadge status={status} />
      </div>
    </div>
  );
}
