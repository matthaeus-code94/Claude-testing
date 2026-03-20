'use client';

import { StrategicScorecard } from '@/types';
import { ragFromScore } from '@/lib/utils';
import RAGBadge from '../ui/RAGBadge';
import BarChartModule from '../charts/BarChartModule';

export default function ScorecardPanel({ data, companyName }: { data: StrategicScorecard; companyName: string }) {
  const moduleData = data.moduleScores.map(m => ({
    name: m.module.replace('&', '&\n'),
    value: m.score,
  }));

  return (
    <div className="space-y-6">
      {/* Header with Digital Health Score */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-[var(--color-text)] mb-1">Strategic DD Summary</h2>
            <p className="text-sm text-[var(--color-text-muted)]">{companyName} — Digital Due Diligence Scorecard</p>
          </div>
          <div className="text-right">
            <div className="text-5xl font-bold" style={{ color: ragFromScore(data.digitalHealthScore) === 'green' ? 'var(--color-green)' : ragFromScore(data.digitalHealthScore) === 'amber' ? 'var(--color-amber)' : 'var(--color-red)' }}>
              {data.digitalHealthScore}
            </div>
            <div className="text-xs text-[var(--color-text-muted)] mt-1">Digital Health Score</div>
            {data.benchmarkPercentile && (
              <div className="text-xs text-[var(--color-text-muted)]">{data.benchmarkPercentile}th percentile</div>
            )}
          </div>
        </div>

        {/* Executive Summary */}
        <div className="rounded-lg bg-[var(--color-surface-2)] p-5 mb-6">
          <h3 className="text-sm font-semibold text-[var(--color-text)] mb-3 uppercase tracking-wider">Executive Summary</h3>
          <ul className="space-y-2">
            {data.executiveSummary.map((s, i) => (
              <li key={i} className="text-sm text-[var(--color-text)] flex items-start gap-2">
                <span className="text-[var(--color-primary)] mt-0.5 font-bold">•</span> {s}
              </li>
            ))}
          </ul>
        </div>

        {/* Module Scores */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-[var(--color-text-muted)] mb-3">Module Scores</h3>
          <BarChartModule data={moduleData} yAxisLabel="Score" height={200} />
        </div>
      </div>

      {/* Findings Grid */}
      <div className="grid grid-cols-3 gap-6">
        {/* Strengths */}
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5">
          <h3 className="text-sm font-semibold text-emerald-400 mb-3 uppercase tracking-wider">Strengths — Value Creation Levers</h3>
          <ul className="space-y-2">
            {data.strengths.map((s, i) => (
              <li key={i} className="text-xs text-[var(--color-text)] flex items-start gap-2">
                <span className="text-emerald-400 mt-0.5">▲</span> {s}
              </li>
            ))}
          </ul>
        </div>

        {/* Risks */}
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-5">
          <h3 className="text-sm font-semibold text-red-400 mb-3 uppercase tracking-wider">Risks — Value at Risk</h3>
          <ul className="space-y-2">
            {data.risks.map((r, i) => (
              <li key={i} className="text-xs text-[var(--color-text)] flex items-start gap-2">
                <span className="text-red-400 mt-0.5">▼</span> {r}
              </li>
            ))}
          </ul>
        </div>

        {/* Opportunities */}
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
          <h3 className="text-sm font-semibold text-amber-400 mb-3 uppercase tracking-wider">Opportunities — Post-Acquisition Upside</h3>
          <ul className="space-y-2">
            {data.opportunities.map((o, i) => (
              <li key={i} className="text-xs text-[var(--color-text)] flex items-start gap-2">
                <span className="text-amber-400 mt-0.5">◆</span> {o}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Management Questions */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <h3 className="text-sm font-semibold text-[var(--color-text)] mb-4 uppercase tracking-wider">Due Diligence Questions for Management</h3>
        <ol className="space-y-3">
          {data.managementQuestions.map((q, i) => (
            <li key={i} className="text-sm text-[var(--color-text)] flex items-start gap-3">
              <span className="text-[var(--color-primary)] font-bold min-w-[24px] text-right">{i + 1}.</span>
              {q}
            </li>
          ))}
        </ol>
      </div>

      {/* 100-Day Priorities */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <h3 className="text-sm font-semibold text-[var(--color-text)] mb-4 uppercase tracking-wider">100-Day Digital Value Creation Priorities</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="text-left py-2 px-3 text-[var(--color-text-muted)] font-medium">#</th>
                <th className="text-left py-2 px-3 text-[var(--color-text-muted)] font-medium">Priority</th>
                <th className="text-center py-2 px-3 text-[var(--color-text-muted)] font-medium">Impact</th>
                <th className="text-center py-2 px-3 text-[var(--color-text-muted)] font-medium">Effort</th>
              </tr>
            </thead>
            <tbody>
              {data.valuationPriorities.map((p, i) => (
                <tr key={i} className="border-b border-[var(--color-border)]/50">
                  <td className="py-2 px-3 text-[var(--color-text-muted)]">{i + 1}</td>
                  <td className="py-2 px-3 text-[var(--color-text)]">{p.priority}</td>
                  <td className="py-2 px-3 text-center"><RAGBadge status={p.impact} label={p.impact === 'red' ? 'High' : p.impact === 'amber' ? 'Medium' : 'Low'} /></td>
                  <td className="py-2 px-3 text-center"><RAGBadge status={p.effort} label={p.effort === 'red' ? 'High' : p.effort === 'amber' ? 'Medium' : 'Low'} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
