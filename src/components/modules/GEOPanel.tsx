'use client';

import { GEOData } from '@/types';
import { ragFromScore } from '@/lib/utils';
import ModuleHeader from '../ui/ModuleHeader';
import RAGBadge from '../ui/RAGBadge';
import SpiderChart from '../charts/SpiderChart';
import BarChartModule from '../charts/BarChartModule';

export default function GEOPanel({ data }: { data: GEOData }) {
  const dimData = [
    { dimension: 'AI Mentions', score: data.dimensions.mentionFrequency.score },
    { dimension: 'Citations', score: data.dimensions.citationAppearance.score },
    { dimension: 'Content/E-E-A-T', score: data.dimensions.contentStructure.score },
    { dimension: 'Knowledge Graph', score: data.dimensions.knowledgeGraph.score },
    { dimension: 'Schema', score: data.dimensions.schemaMarkup.score },
    { dimension: 'Media/PR', score: data.dimensions.mediaCitation.score },
  ];

  const compData = data.competitorComparison.map(c => ({
    name: c.company,
    value: c.score,
  }));

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
      <ModuleHeader
        title="GEO Engine Analysis"
        score={data.overallScore}
        status={ragFromScore(data.overallScore)}
        icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"/><path d="M12 2c-3 3.5-3 8.5 0 12s3 8.5 0 12"/><path d="M2 12h20"/></svg>}
      />

      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Spider Chart */}
        <div>
          <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-3">GEO Dimension Scores</h3>
          <SpiderChart data={dimData} name="GEO Score" />
        </div>

        {/* Dimension Detail */}
        <div>
          <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-3">Dimension Breakdown</h3>
          <div className="space-y-3">
            {Object.entries(data.dimensions).map(([key, dim]) => (
              <div key={key} className="rounded-lg bg-[var(--color-surface-2)] p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-[var(--color-text)]">
                    {key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[var(--color-text-muted)]">{dim.score}/10</span>
                    <span className="text-xs text-[var(--color-text-muted)]">({(dim.weight * 100).toFixed(0)}%)</span>
                  </div>
                </div>
                <div className="w-full h-1.5 rounded-full bg-[var(--color-border)] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${(dim.score / 10) * 100}%`,
                      background: dim.score >= 7 ? 'var(--color-green)' : dim.score >= 4 ? 'var(--color-amber)' : 'var(--color-red)',
                    }}
                  />
                </div>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">{dim.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Competitor GEO Comparison */}
      {compData.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-3">GEO Score vs Competitors</h3>
          <BarChartModule data={compData} yAxisLabel="GEO Score" />
        </div>
      )}

      {/* AI Query Results */}
      {data.queryResults.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-3">AI Answer Sampling</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="text-left py-2 px-3 text-[var(--color-text-muted)] font-medium">Query</th>
                  <th className="text-left py-2 px-3 text-[var(--color-text-muted)] font-medium">Engine</th>
                  <th className="text-center py-2 px-3 text-[var(--color-text-muted)] font-medium">Mentioned</th>
                  <th className="text-center py-2 px-3 text-[var(--color-text-muted)] font-medium">Cited</th>
                  <th className="text-center py-2 px-3 text-[var(--color-text-muted)] font-medium">Sentiment</th>
                </tr>
              </thead>
              <tbody>
                {data.queryResults.map((r, i) => (
                  <tr key={i} className="border-b border-[var(--color-border)]/50 hover:bg-[var(--color-surface-2)]">
                    <td className="py-2 px-3 text-[var(--color-text)] max-w-[200px] truncate">{r.query}</td>
                    <td className="py-2 px-3 text-[var(--color-text-muted)]">{r.engine}</td>
                    <td className="py-2 px-3 text-center">
                      <span className={r.brandMentioned ? 'text-emerald-400' : 'text-red-400'}>{r.brandMentioned ? '✓' : '✕'}</span>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className={r.citedAsSource ? 'text-emerald-400' : 'text-red-400'}>{r.citedAsSource ? '✓' : '✕'}</span>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <RAGBadge
                        status={r.sentiment === 'positive' ? 'green' : r.sentiment === 'negative' ? 'red' : 'amber'}
                        label={r.sentiment}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recommendations */}
      {data.recommendations.length > 0 && (
        <div className="rounded-lg bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/20 p-4">
          <h3 className="text-sm font-medium text-[var(--color-primary)] mb-3">GEO Recommendations</h3>
          <ol className="space-y-2">
            {data.recommendations.map((r, i) => (
              <li key={i} className="text-xs text-[var(--color-text)] flex items-start gap-2">
                <span className="text-[var(--color-primary)] font-bold min-w-[16px]">{i + 1}.</span>
                {r}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
