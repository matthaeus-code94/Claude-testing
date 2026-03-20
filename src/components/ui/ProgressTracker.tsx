'use client';

type ModuleStatus = 'pending' | 'running' | 'done' | 'error';

interface ProgressTrackerProps {
  progress: Record<string, ModuleStatus>;
}

const moduleNames: Record<string, string> = {
  traffic: 'Traffic Intelligence',
  seo: 'SEO Health',
  geo: 'GEO Engine',
  techStack: 'Tech Stack',
  competitive: 'Competitive',
  scorecard: 'Scorecard',
};

const statusIcon: Record<ModuleStatus, string> = {
  pending: '○',
  running: '◎',
  done: '●',
  error: '✕',
};

const statusColor: Record<ModuleStatus, string> = {
  pending: 'text-[var(--color-text-muted)]',
  running: 'text-[var(--color-primary)] animate-pulse',
  done: 'text-[var(--color-green)]',
  error: 'text-[var(--color-red)]',
};

export default function ProgressTracker({ progress }: ProgressTrackerProps) {
  const entries = Object.entries(progress);
  const done = entries.filter(([, s]) => s === 'done').length;
  const total = entries.length;
  const pct = (done / total) * 100;

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[var(--color-text)]">Analysis Progress</h3>
        <span className="text-xs text-[var(--color-text-muted)]">{done}/{total} complete</span>
      </div>
      <div className="w-full h-2 rounded-full bg-[var(--color-border)] mb-4 overflow-hidden">
        <div
          className="h-full rounded-full bg-[var(--color-primary)] transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {entries.map(([key, status]) => (
          <div key={key} className="flex items-center gap-2">
            <span className={`text-sm ${statusColor[status]}`}>{statusIcon[status]}</span>
            <span className={`text-xs ${status === 'done' ? 'text-[var(--color-text)]' : 'text-[var(--color-text-muted)]'}`}>
              {moduleNames[key] || key}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
