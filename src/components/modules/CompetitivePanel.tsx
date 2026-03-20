'use client';

import { CompetitiveData } from '@/types';
import { ragFromScore } from '@/lib/utils';
import ModuleHeader from '../ui/ModuleHeader';
import RAGBadge from '../ui/RAGBadge';
import BarChartModule from '../charts/BarChartModule';

export default function CompetitivePanel({ data, companyName }: { data: CompetitiveData; companyName: string }) {
  const sovData = data.shareOfVoiceChart.map(c => ({
    name: c.company,
    value: Math.round((c.organic + c.paid + c.ai) / 3 * 100),
  }));

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
      <ModuleHeader
        title="Competitive Benchmarking"
        score={data.score}
        status={ragFromScore(data.score)}
        icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
      />

      {data.competitors.length === 0 ? (
        <div className="text-sm text-[var(--color-text-muted)] text-center py-8">
          No competitors identified. Add competitor domains to enable benchmarking.
        </div>
      ) : (
        <>
          {/* Competitor Table */}
          <div className="mb-6 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="text-left py-2 px-3 text-[var(--color-text-muted)] font-medium">Company</th>
                  <th className="text-center py-2 px-3 text-[var(--color-text-muted)] font-medium">Domain Authority</th>
                  <th className="text-center py-2 px-3 text-[var(--color-text-muted)] font-medium">Tech Tier</th>
                  <th className="text-center py-2 px-3 text-[var(--color-text-muted)] font-medium">Organic SOV</th>
                </tr>
              </thead>
              <tbody>
                {data.competitors.map((c, i) => (
                  <tr key={i} className="border-b border-[var(--color-border)]/50 hover:bg-[var(--color-surface-2)]">
                    <td className="py-2 px-3">
                      <div className="text-[var(--color-text)] font-medium">{c.name}</div>
                      <div className="text-[var(--color-text-muted)]">{c.domain}</div>
                    </td>
                    <td className="py-2 px-3 text-center text-[var(--color-text)]">{c.domainAuthority ?? 'N/A'}</td>
                    <td className="py-2 px-3 text-center"><RAGBadge status={c.techTier} /></td>
                    <td className="py-2 px-3 text-center text-[var(--color-text)]">
                      {c.shareOfVoice.organic > 0 ? `${(c.shareOfVoice.organic * 100).toFixed(0)}%` : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Share of Voice Chart */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-3">Combined Share of Voice</h3>
            <BarChartModule data={sovData} yAxisLabel="SOV %" />
          </div>

          {/* Whitespace */}
          {data.whitespaceKeywords.length > 0 && (
            <div className="rounded-lg bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/20 p-4">
              <h3 className="text-sm font-medium text-[var(--color-primary)] mb-3">Whitespace Opportunities</h3>
              <p className="text-xs text-[var(--color-text-muted)] mb-2">Keywords/topics where {companyName} is underrepresented vs. category leaders:</p>
              <div className="flex flex-wrap gap-2">
                {data.whitespaceKeywords.map((k, i) => (
                  <span key={i} className="px-3 py-1 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-xs">{k}</span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
