'use client';

import { ScoredMetric } from '@/types';
import RAGBadge from './RAGBadge';

export default function MetricCard({ metric }: { metric: ScoredMetric }) {
  return (
    <div className={`rounded-lg p-4 border border-[var(--color-border)] bg-[var(--color-surface)]`}>
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">{metric.label}</span>
        <RAGBadge status={metric.status} />
      </div>
      <div className="text-2xl font-bold text-[var(--color-text)] mb-1">
        {typeof metric.value === 'number' ? metric.value.toLocaleString() : metric.value}
      </div>
      <div className="text-xs text-[var(--color-text-muted)]">
        Source: {metric.source}
      </div>
      {metric.explanation && (
        <div className="text-xs text-[var(--color-text-muted)] mt-1 opacity-70">
          {metric.explanation}
        </div>
      )}
    </div>
  );
}
