'use client';

import { TechStackData } from '@/types';
import { ragFromScore } from '@/lib/utils';
import ModuleHeader from '../ui/ModuleHeader';
import MetricCard from '../ui/MetricCard';
import RAGBadge from '../ui/RAGBadge';

export default function TechStackPanel({ data }: { data: TechStackData }) {
  // Group technologies by category
  const techByCategory: Record<string, typeof data.technologies> = {};
  data.technologies.forEach(t => {
    (techByCategory[t.category] ??= []).push(t);
  });

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
      <ModuleHeader
        title="Technical Stack & Infrastructure"
        score={data.score}
        status={ragFromScore(data.score)}
        icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/></svg>}
      />

      <div className="grid grid-cols-4 gap-4 mb-6">
        {data.metrics.slice(0, 4).map((m, i) => (
          <MetricCard key={i} metric={m} />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Tech Stack Map */}
        <div>
          <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-3">Technology Stack</h3>
          <div className="space-y-4">
            {Object.entries(techByCategory).map(([category, techs]) => (
              <div key={category}>
                <h4 className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-2">{category}</h4>
                <div className="flex flex-wrap gap-2">
                  {techs.map((t, i) => (
                    <div key={i} className="px-3 py-1.5 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] text-xs text-[var(--color-text)] flex items-center gap-2">
                      <span>{t.name}</span>
                      {t.version && <span className="text-[var(--color-text-muted)]">v{t.version}</span>}
                      <span className="text-[var(--color-text-muted)]">{Math.round(t.confidence * 100)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Lighthouse + Security */}
        <div>
          {data.lighthouseScores && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-3">Lighthouse Scores</h3>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(data.lighthouseScores).map(([key, val]) => (
                  <div key={key} className={`rounded-lg p-3 text-center border ${val >= 90 ? 'border-emerald-500/30 bg-emerald-500/5' : val >= 50 ? 'border-amber-500/30 bg-amber-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
                    <div className="text-xl font-bold text-[var(--color-text)]">{val}</div>
                    <div className="text-xs text-[var(--color-text-muted)] capitalize">{key.replace(/([A-Z])/g, ' $1')}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-3">Security Posture</h3>
          <div className="space-y-2">
            {Object.entries(data.security).map(([key, val]) => (
              <div key={key} className="flex items-center justify-between rounded-lg bg-[var(--color-surface-2)] px-3 py-2">
                <span className="text-xs text-[var(--color-text)] uppercase">{key.replace(/([A-Z])/g, ' $1')}</span>
                <span className={`text-xs ${val === true ? 'text-emerald-400' : val === false ? 'text-red-400' : 'text-[var(--color-text-muted)]'}`}>
                  {val === true ? '✓ Enabled' : val === false ? '✕ Missing' : 'Unknown'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Third Party Scripts */}
      {data.thirdPartyScripts.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-3">Third-Party Scripts ({data.thirdPartyScripts.length})</h3>
          <div className="grid grid-cols-3 gap-2">
            {data.thirdPartyScripts.map((s, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg bg-[var(--color-surface-2)] px-3 py-2">
                <div>
                  <span className="text-xs text-[var(--color-text)]">{s.name}</span>
                  <span className="text-xs text-[var(--color-text-muted)] ml-2">{s.category}</span>
                </div>
                <RAGBadge status={s.riskLevel} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tech Debt */}
      {data.techDebtSignals.length > 0 && (
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-4">
          <h3 className="text-sm font-medium text-amber-400 mb-2">Tech Debt Signals</h3>
          <ul className="space-y-1">
            {data.techDebtSignals.map((s, i) => (
              <li key={i} className="text-xs text-amber-300 flex items-start gap-2">
                <span className="text-amber-400 mt-0.5">▸</span> {s}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
