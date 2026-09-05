import React from 'react';

export const PageSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-pulse p-2 sm:p-4">
      {/* Header bar skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-6 w-48 bg-[var(--bg-surface-muted)] rounded-lg" />
          <div className="h-3.5 w-64 bg-[var(--bg-surface-muted)]/60 rounded-md" />
        </div>
        <div className="h-9 w-32 bg-[var(--bg-surface-muted)] rounded-xl" />
      </div>

      {/* KPI Cards row skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-5 space-y-3 shadow-sm">
            <div className="flex justify-between items-center">
              <div className="h-3 w-24 bg-[var(--bg-surface-muted)] rounded" />
              <div className="w-8 h-8 rounded-xl bg-[var(--bg-surface-muted)]" />
            </div>
            <div className="h-8 w-20 bg-[var(--bg-surface-muted)] rounded-lg" />
            <div className="h-2.5 w-32 bg-[var(--bg-surface-muted)]/50 rounded" />
          </div>
        ))}
      </div>

      {/* Main Content card skeleton */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
          <div className="h-5 w-36 bg-[var(--bg-surface-muted)] rounded" />
          <div className="h-8 w-48 bg-[var(--bg-surface-muted)] rounded-xl" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-12 bg-[var(--bg-surface-muted)]/50 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
};
