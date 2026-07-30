'use client';

import type { TokenUsageSummary } from '@/types';

interface TokenUsagePanelProps {
  data: TokenUsageSummary;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatCost(n: number): string {
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(4)}`;
}

export default function TokenUsagePanel({ data }: TokenUsagePanelProps) {
  const byModule: Record<string, { input: number; output: number; calls: number }> = {};
  const byProvider: Record<string, { input: number; output: number; calls: number; model: string }> = {};

  for (const entry of data.entries) {
    if (!byModule[entry.module]) byModule[entry.module] = { input: 0, output: 0, calls: 0 };
    byModule[entry.module].input += entry.inputTokens;
    byModule[entry.module].output += entry.outputTokens;
    byModule[entry.module].calls += 1;

    if (!byProvider[entry.provider]) byProvider[entry.provider] = { input: 0, output: 0, calls: 0, model: entry.model };
    byProvider[entry.provider].input += entry.inputTokens;
    byProvider[entry.provider].output += entry.outputTokens;
    byProvider[entry.provider].calls += 1;
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center text-[var(--color-primary)]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text)]">Token Usage</h2>
          <p className="text-xs text-[var(--color-text-muted)]">LLM API consumption for this analysis</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="rounded-lg bg-[var(--color-surface-2)] p-4">
          <p className="text-xs text-[var(--color-text-muted)] mb-1">Total Tokens</p>
          <p className="text-xl font-semibold text-[var(--color-text)]">{formatTokens(data.totalTokens)}</p>
        </div>
        <div className="rounded-lg bg-[var(--color-surface-2)] p-4">
          <p className="text-xs text-[var(--color-text-muted)] mb-1">Input Tokens</p>
          <p className="text-xl font-semibold text-[var(--color-text)]">{formatTokens(data.totalInputTokens)}</p>
        </div>
        <div className="rounded-lg bg-[var(--color-surface-2)] p-4">
          <p className="text-xs text-[var(--color-text-muted)] mb-1">Output Tokens</p>
          <p className="text-xl font-semibold text-[var(--color-text)]">{formatTokens(data.totalOutputTokens)}</p>
        </div>
        <div className="rounded-lg bg-[var(--color-surface-2)] p-4">
          <p className="text-xs text-[var(--color-text-muted)] mb-1">Estimated Cost</p>
          <p className="text-xl font-semibold text-[var(--color-text)]">{formatCost(data.estimatedCost)}</p>
        </div>
      </div>

      {/* Breakdown by Provider */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <h3 className="text-sm font-medium text-[var(--color-text)] mb-3">By Provider</h3>
          <div className="space-y-2">
            {Object.entries(byProvider).map(([provider, usage]) => (
              <div key={provider} className="rounded-lg bg-[var(--color-surface-2)] p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--color-text)]">{provider}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{usage.model} &middot; {usage.calls} call{usage.calls !== 1 ? 's' : ''}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-[var(--color-text)]">{formatTokens(usage.input + usage.output)}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{formatTokens(usage.input)} in / {formatTokens(usage.output)} out</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-[var(--color-text)] mb-3">By Module</h3>
          <div className="space-y-2">
            {Object.entries(byModule).map(([module, usage]) => (
              <div key={module} className="rounded-lg bg-[var(--color-surface-2)] p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--color-text)]">{module}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{usage.calls} call{usage.calls !== 1 ? 's' : ''}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-[var(--color-text)]">{formatTokens(usage.input + usage.output)}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{formatTokens(usage.input)} in / {formatTokens(usage.output)} out</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Per-call detail table */}
      {data.entries.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-medium text-[var(--color-text)] mb-3">All API Calls</h3>
          <div className="overflow-hidden rounded-lg border border-[var(--color-border)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--color-surface-2)]">
                  <th className="text-left px-3 py-2 text-xs font-medium text-[var(--color-text-muted)]">Provider</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-[var(--color-text-muted)]">Model</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-[var(--color-text-muted)]">Module</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-[var(--color-text-muted)]">Input</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-[var(--color-text-muted)]">Output</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-[var(--color-text-muted)]">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.entries.map((entry, i) => (
                  <tr key={i} className="border-t border-[var(--color-border)]">
                    <td className="px-3 py-2 text-[var(--color-text)]">{entry.provider}</td>
                    <td className="px-3 py-2 text-[var(--color-text-muted)]">{entry.model}</td>
                    <td className="px-3 py-2 text-[var(--color-text)]">{entry.module}</td>
                    <td className="px-3 py-2 text-right text-[var(--color-text-muted)]">{entry.inputTokens.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-[var(--color-text-muted)]">{entry.outputTokens.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-[var(--color-text)]">{(entry.inputTokens + entry.outputTokens).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
