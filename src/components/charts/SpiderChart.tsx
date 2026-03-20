'use client';

import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend } from 'recharts';

interface SpiderChartProps {
  data: { dimension: string; score: number; benchmark?: number }[];
  name?: string;
}

export default function SpiderChart({ data, name = 'Score' }: SpiderChartProps) {
  const hasBenchmark = data.some(d => d.benchmark != null);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart data={data} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
        <PolarGrid stroke="var(--color-border)" />
        <PolarAngleAxis dataKey="dimension" tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} />
        <PolarRadiusAxis angle={30} domain={[0, 10]} tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} />
        <Radar name={name} dataKey="score" stroke="var(--color-primary)" fill="var(--color-primary)" fillOpacity={0.3} />
        {hasBenchmark && (
          <Radar name="Benchmark" dataKey="benchmark" stroke="var(--color-amber)" fill="var(--color-amber)" fillOpacity={0.1} strokeDasharray="4 4" />
        )}
        <Legend wrapperStyle={{ fontSize: 11, color: 'var(--color-text-muted)' }} />
      </RadarChart>
    </ResponsiveContainer>
  );
}
