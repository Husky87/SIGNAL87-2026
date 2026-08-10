import React from 'react';

interface TraceItem {
  id: string;
  time: string;
  query: string;
  citationsCount: number;
  status: 'verified' | 'indexing';
}

const INITIAL_TRACES: TraceItem[] = [
  { id: '1', time: '02:14', query: 'Post-closing indemnity limits', citationsCount: 3, status: 'verified' },
  { id: '2', time: '01:52', query: 'Change-of-control triggers', citationsCount: 5, status: 'verified' },
  { id: '3', time: 'YEST', query: 'Revenue recognition policy', citationsCount: 2, status: 'verified' },
  { id: '4', time: 'YEST', query: 'Escrow release conditions', citationsCount: 4, status: 'verified' },
  { id: '5', time: '28 JUL', query: 'Employee retention obligations', citationsCount: 1, status: 'indexing' },
  { id: '6', time: '28 JUL', query: 'Assignment and novation rights', citationsCount: 3, status: 'verified' },
];

interface TracesViewProps {
  onSelectTrace?: (query: string) => void;
}

export const TracesView: React.FC<TracesViewProps> = ({ onSelectTrace }) => {
  return (
    <div className="flex-1 overflow-y-auto bg-[#EDEFF2] text-[#131C25] min-h-full p-4 sm:p-6 space-y-5">
      {/* Workspace Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#D3D9DE]">
        <div>
          <span className="font-mono text-[9px] font-bold text-[#6E7C89] uppercase tracking-widest block">
            WORKSPACE
          </span>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#131C25] tracking-tight">
            Meridian Acquisition
          </h1>
        </div>

        <span className="font-mono text-[10px] font-bold px-2.5 py-1 rounded-full bg-[#E8F2F0] text-[#0F6E66] uppercase tracking-wider">
          {INITIAL_TRACES.length} TRACES GROUNDED
        </span>
      </div>

      <div className="space-y-1">
        <h2 className="text-xs font-mono font-bold text-[#6E7C89] uppercase tracking-wider">
          EVERY GROUNDED ANSWER
        </h2>
      </div>

      {/* Trace list items */}
      <div className="space-y-2.5">
        {INITIAL_TRACES.map((trace) => (
          <div
            key={trace.id}
            onClick={() => onSelectTrace?.(trace.query)}
            className="p-3.5 bg-[#FFFFFF] border border-[#D3D9DE] rounded-xl flex items-center justify-between gap-3 cursor-pointer hover:border-[#131C25] transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <span className="font-mono text-[10px] font-bold text-[#6E7C89] uppercase w-12 flex-shrink-0">
                {trace.time}
              </span>
              <span className="font-bold text-sm text-[#131C25] truncate">
                {trace.query}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <span
                className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
 trace.status === 'verified'
 ? 'bg-[#E8F2F0] text-[#0F6E66]'
 : 'bg-[#FBEECB] text-[#8A6414]'
 }`}
              >
                {trace.citationsCount} {trace.citationsCount === 1 ? 'CLAIM' : 'CLAIMS'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
