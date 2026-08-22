import React from 'react';

/**
 * Placeholder rows and cards for the file library while it loads.
 *
 * Deliberately laid out to the same geometry as the real thing, so the list
 * does not jump when the files arrive. A spinner would be easier and would tell
 * the reader nothing about what is coming.
 */

const shimmer =
  'relative overflow-hidden bg-[var(--surface-2)] before:absolute before:inset-0 ' +
  'before:-translate-x-full before:animate-[s87-shimmer_1.4s_infinite] ' +
  // The sweep is a lighter parchment passing over the raised tone. It used to
// be white at 4%, which read on the old dark surfaces and is invisible on paper.
  'before:bg-gradient-to-r before:from-transparent before:via-[var(--surface)]/70 before:to-transparent';

const Bar: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`${shimmer} rounded-md ${className}`} />
);

export const DocumentGridSkeleton: React.FC<{ count?: number }> = ({ count = 8 }) => (
  <div
    className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"
    aria-hidden="true"
  >
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        className="rounded-2xl border border-[var(--rule)] bg-[var(--surface)] overflow-hidden"
      >
        <div className={`${shimmer} aspect-[4/3] w-full`} />
        <div className="p-3 space-y-2">
          <Bar className="h-3 w-3/4" />
          <Bar className="h-2.5 w-1/2" />
        </div>
      </div>
    ))}
  </div>
);

export const DocumentListSkeleton: React.FC<{ count?: number }> = ({ count = 8 }) => (
  <div className="space-y-1" aria-hidden="true">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="flex items-center gap-3 px-3 py-3 rounded-xl">
        <div className={`${shimmer} h-8 w-8 rounded-lg flex-shrink-0`} />
        <Bar className="h-3 flex-1 max-w-[min(60%,320px)]" />
        <Bar className="h-2.5 w-16 hidden sm:block" />
        <Bar className="h-2.5 w-12 hidden md:block" />
      </div>
    ))}
  </div>
);

/**
 * One announcement for the whole list, rather than letting a screen reader walk
 * a dozen meaningless placeholder rows.
 */
export const LoadingAnnouncement: React.FC<{ label: string }> = ({ label }) => (
  <span role="status" aria-live="polite" className="sr-only">
    {label}
  </span>
);
