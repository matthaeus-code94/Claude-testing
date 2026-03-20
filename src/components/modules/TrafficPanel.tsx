'use client';

import { TrafficData } from '@/types';
import { ragFromScore, formatNumber } from '@/lib/utils';
import ModuleHeader from '../ui/ModuleHeader';
import MetricCard from '../ui/MetricCard';
import DonutChart from '../charts/DonutChart';

export default function TrafficPanel({ data }: { data: TrafficData }) {
  const sourceData = [
    { name: 'Organic', value: data.trafficSources.organic, color: '#34d399' },
    { name: 'Paid', value: data.trafficSources.paid, color: '#f87171' },
    { name: 'Direct', value: data.trafficSources.direct, color: '#4f8ff7' },
    { name: 'Referral', value: data.trafficSources.referral, color: '#a78bfa' },
    { name: 'Social', value: data.trafficSources.social, color: '#fbbf24' },
  ];

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
      <ModuleHeader
        title="Digital Footprint & Traffic Intelligence"
        score={data.score}
        status={ragFromScore(data.score)}
        icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>}
      />

      <div className="grid grid-cols-4 gap-4 mb-6">
        {data.metrics.slice(0, 4).map((m, i) => (
          <MetricCard key={i} metric={m} />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div>
          <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-3">Traffic Source Breakdown</h3>
          <DonutChart data={sourceData} />
        </div>
        <div>
          <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-3">Top Markets</h3>
          <div className="space-y-2">
            {data.topCountries.map((c, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-sm text-[var(--color-text)]">{c.country}</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 h-2 rounded-full bg-[var(--color-border)] overflow-hidden">
                    <div className="h-full rounded-full bg-[var(--color-primary)]" style={{ width: `${c.share * 100}%` }} />
                  </div>
                  <span className="text-xs text-[var(--color-text-muted)] w-12 text-right">{(c.share * 100).toFixed(1)}%</span>
                </div>
              </div>
            ))}
          </div>

          <h3 className="text-sm font-medium text-[var(--color-text-muted)] mt-6 mb-3">Device Split</h3>
          <div className="flex gap-4">
            <div className="flex-1 rounded-lg bg-[var(--color-surface-2)] p-3 text-center">
              <div className="text-lg font-bold text-[var(--color-text)]">{(data.deviceSplit.desktop * 100).toFixed(0)}%</div>
              <div className="text-xs text-[var(--color-text-muted)]">Desktop</div>
            </div>
            <div className="flex-1 rounded-lg bg-[var(--color-surface-2)] p-3 text-center">
              <div className="text-lg font-bold text-[var(--color-text)]">{(data.deviceSplit.mobile * 100).toFixed(0)}%</div>
              <div className="text-xs text-[var(--color-text-muted)]">Mobile</div>
            </div>
          </div>
        </div>
      </div>

      {data.anomalies.length > 0 && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-4">
          <h3 className="text-sm font-medium text-red-400 mb-2">Anomalies Detected</h3>
          <ul className="space-y-1">
            {data.anomalies.map((a, i) => (
              <li key={i} className="text-xs text-red-300 flex items-start gap-2">
                <span className="text-red-400 mt-0.5">▸</span> {a}
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.topReferrers.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-3">Top Referring Domains</h3>
          <div className="grid grid-cols-2 gap-2">
            {data.topReferrers.map((r, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg bg-[var(--color-surface-2)] px-3 py-2">
                <span className="text-xs text-[var(--color-text)]">{r.domain}</span>
                <span className="text-xs text-[var(--color-text-muted)]">DA {r.authority}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
