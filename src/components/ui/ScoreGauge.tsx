'use client';

import { RAGStatus } from '@/types';
import { ragFromScore } from '@/lib/utils';

interface ScoreGaugeProps {
  score: number;
  maxScore?: number;
  label: string;
  size?: 'sm' | 'md' | 'lg';
}

const colorMap: Record<RAGStatus, string> = {
  green: '#34d399',
  amber: '#fbbf24',
  red: '#f87171',
};

export default function ScoreGauge({ score, maxScore = 100, label, size = 'md' }: ScoreGaugeProps) {
  const status = ragFromScore(score);
  const color = colorMap[status];
  const pct = (score / maxScore) * 100;
  const dims = { sm: 80, md: 120, lg: 160 }[size];
  const strokeWidth = { sm: 6, md: 8, lg: 10 }[size];
  const radius = (dims - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - pct / 100);
  const fontSize = { sm: '1rem', md: '1.5rem', lg: '2rem' }[size];

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={dims} height={dims} className="-rotate-90">
        <circle
          cx={dims / 2} cy={dims / 2} r={radius}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={dims / 2} cy={dims / 2} r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease-out' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center" style={{ width: dims, height: dims }}>
        <span style={{ fontSize, color, fontWeight: 700 }}>{score}</span>
        <span className="text-xs text-[var(--color-text-muted)]">/ {maxScore}</span>
      </div>
      <span className="text-xs text-[var(--color-text-muted)] mt-1">{label}</span>
    </div>
  );
}
