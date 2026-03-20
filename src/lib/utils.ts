import { RAGStatus } from '@/types';

export function ragFromScore(score: number, thresholds = { green: 70, amber: 40 }): RAGStatus {
  if (score >= thresholds.green) return 'green';
  if (score >= thresholds.amber) return 'amber';
  return 'red';
}

export function ragColor(status: RAGStatus): string {
  return { green: 'var(--color-green)', amber: 'var(--color-amber)', red: 'var(--color-red)' }[status];
}

export function ragBg(status: RAGStatus): string {
  return `rag-${status}-bg`;
}

export function formatNumber(n: number | null | undefined): string {
  if (n == null) return 'N/A';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}

export function formatPercent(n: number | null | undefined): string {
  if (n == null) return 'N/A';
  return `${(n * 100).toFixed(1)}%`;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

export function extractDomain(input: string): string {
  let d = input.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, '');
  d = d.replace(/^www\./, '');
  d = d.split('/')[0];
  d = d.split('?')[0];
  return d;
}
