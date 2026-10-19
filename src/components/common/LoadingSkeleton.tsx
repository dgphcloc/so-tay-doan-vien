import React from 'react';

export const TableSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => {
  return (
    <div className="w-full bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-xs animate-pulse">
      <div className="h-12 bg-slate-100 border-b border-slate-200 flex items-center px-4 gap-4">
        <div className="h-4 bg-slate-200 rounded w-1/4"></div>
        <div className="h-4 bg-slate-200 rounded w-1/5"></div>
        <div className="h-4 bg-slate-200 rounded w-1/6"></div>
        <div className="h-4 bg-slate-200 rounded w-1/6"></div>
      </div>
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-1/3">
              <div className="w-9 h-9 rounded-lg bg-slate-200 shrink-0"></div>
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                <div className="h-3 bg-slate-100 rounded w-1/2"></div>
              </div>
            </div>
            <div className="h-4 bg-slate-200 rounded w-1/5"></div>
            <div className="h-6 bg-slate-200 rounded-full w-20"></div>
            <div className="h-8 bg-slate-200 rounded-lg w-20"></div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const CardListSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex justify-between items-center">
            <div className="h-4 bg-slate-200 rounded w-1/2"></div>
            <div className="w-8 h-8 rounded-lg bg-slate-100"></div>
          </div>
          <div className="h-8 bg-slate-200 rounded w-1/3"></div>
          <div className="h-3 bg-slate-100 rounded w-2/3"></div>
        </div>
      ))}
    </div>
  );
};
