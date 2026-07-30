import type { TokenUsageEntry, TokenUsageSummary } from '@/types';

const COST_PER_MILLION: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'gpt-4o': { input: 2.5, output: 10 },
  'sonar-pro': { input: 3, output: 15 },
};

export class TokenTracker {
  private entries: TokenUsageEntry[] = [];

  add(entry: TokenUsageEntry) {
    this.entries.push(entry);
  }

  getSummary(): TokenUsageSummary {
    const totalInputTokens = this.entries.reduce((s, e) => s + e.inputTokens, 0);
    const totalOutputTokens = this.entries.reduce((s, e) => s + e.outputTokens, 0);

    let estimatedCost = 0;
    for (const entry of this.entries) {
      const rates = COST_PER_MILLION[entry.model] ?? { input: 3, output: 15 };
      estimatedCost += (entry.inputTokens / 1_000_000) * rates.input;
      estimatedCost += (entry.outputTokens / 1_000_000) * rates.output;
    }

    return {
      entries: [...this.entries],
      totalInputTokens,
      totalOutputTokens,
      totalTokens: totalInputTokens + totalOutputTokens,
      estimatedCost: parseFloat(estimatedCost.toFixed(6)),
    };
  }
}
