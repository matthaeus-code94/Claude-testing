'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface BarChartModuleProps {
  data: { name: string; value: number; color?: string }[];
  yAxisLabel?: string;
  height?: number;
  colorFn?: (value: number) => string;
}

function defaultColor(value: number): string {
  if (value >= 70) return '#34d399';
  if (value >= 40) return '#fbbf24';
  return '#f87171';
}

export default function BarChartModule({ data, yAxisLabel, height = 250, colorFn = defaultColor }: BarChartModuleProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
        <XAxis dataKey="name" tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} label={yAxisLabel ? { value: yAxisLabel, angle: -90, position: 'insideLeft', fill: 'var(--color-text-muted)', fontSize: 10 } : undefined} />
        <Tooltip
          contentStyle={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 8, color: 'var(--color-text)', fontSize: 12 }}
        />
        <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={40}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color || colorFn(entry.value)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
