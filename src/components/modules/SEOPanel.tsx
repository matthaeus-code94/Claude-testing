'use client';

import { SEOData } from '@/types';
import { ragFromScore } from '@/lib/utils';
import ModuleHeader from '../ui/ModuleHeader';
import MetricCard from '../ui/MetricCard';
import RAGBadge from '../ui/RAGBadge';

export default function SEOPanel({ data }: { data: SEOData }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
      <ModuleHeader
        title="SEO Health & Keyword Authority"
        score={data.score}
        status={ragFromScore(data.score)}
        icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>}
      />

      <div className="grid grid-cols-4 gap-4 mb-6">
        {data.metrics.slice(0, 4).map((m, i) => (
          <MetricCard key={i} metric={m} />
        ))}
      </div>

      {/* Core Web Vitals */}
      {data.coreWebVitals && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-3">Core Web Vitals</h3>
          <div className="grid grid-cols-3 gap-4">
            {([['LCP', 'lcp', 's'], ['INP', 'inp', 'ms'], ['CLS', 'cls', '']] as const).map(([label, key, unit]) => {
              const vital = data.coreWebVitals![key];
              return (
                <div key={key} className={`rounded-lg p-4 border ${vital.status === 'green' ? 'border-emerald-500/30 bg-emerald-500/5' : vital.status === 'amber' ? 'border-amber-500/30 bg-amber-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-[var(--color-text-muted)]">{label}</span>
                    <RAGBadge status={vital.status} />
                  </div>
                  <div className="text-xl font-bold text-[var(--color-text)]">
                    {vital.value}{unit}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        {/* Top Keywords */}
        {data.topKeywords.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-3">Top Organic Keywords</h3>
            <div className="space-y-1">
              {data.topKeywords.map((k, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg bg-[var(--color-surface-2)] px-3 py-2">
                  <span className="text-xs text-[var(--color-text)] truncate flex-1">{k.keyword}</span>
                  <span className="text-xs text-[var(--color-text-muted)] ml-2">#{k.position}</span>
                  <span className="text-xs text-[var(--color-text-muted)] ml-2 w-16 text-right">{k.volume.toLocaleString()} vol</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          {/* Structured Data */}
          <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-3">Structured Data</h3>
          <div className="flex flex-wrap gap-2 mb-4">
            {data.structuredData.length > 0 ? data.structuredData.map((s, i) => (
              <span key={i} className="px-2 py-1 rounded-md bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-xs">{s}</span>
            )) : (
              <span className="text-xs text-[var(--color-text-muted)]">No structured data detected</span>
            )}
          </div>

          {/* SERP Features */}
          <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-3">SERP Features</h3>
          <div className="space-y-1">
            {Object.entries(data.serpFeatures).map(([k, v]) => (
              <div key={k} className="flex items-center gap-2">
                <span className={`w-4 text-center ${v ? 'text-emerald-400' : 'text-red-400'}`}>{v ? '✓' : '✕'}</span>
                <span className="text-xs text-[var(--color-text)]">{k.replace(/([A-Z])/g, ' $1').trim()}</span>
              </div>
            ))}
          </div>

          {/* Crawl Issues */}
          {data.crawlIssues.length > 0 && (
            <>
              <h3 className="text-sm font-medium text-[var(--color-text-muted)] mt-4 mb-2">Crawl Issues</h3>
              <ul className="space-y-1">
                {data.crawlIssues.map((issue, i) => (
                  <li key={i} className="text-xs text-amber-400 flex items-start gap-2">
                    <span className="mt-0.5">⚠</span> {issue}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
