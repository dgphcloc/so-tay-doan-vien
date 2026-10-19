import React from 'react';
import { ReviewStatus } from '../../types';
import { AlertTriangle, Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

interface ReviewStatusBadgeProps {
  status: ReviewStatus;
  size?: 'sm' | 'md';
}

export const ReviewStatusBadge: React.FC<ReviewStatusBadgeProps> = ({ status, size = 'sm' }) => {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm';

  switch (status) {
    case 'pending':
      return (
        <span
          className={`inline-flex items-center gap-1 font-medium rounded-full bg-amber-50 text-amber-700 border border-amber-200/80 ${sizeClasses}`}
        >
          <Clock className="w-3.5 h-3.5 text-amber-500" />
          Chờ duyệt
        </span>
      );
    case 'approved':
      return (
        <span
          className={`inline-flex items-center gap-1 font-medium rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 ${sizeClasses}`}
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          Đã duyệt
        </span>
      );
    case 'rejected':
      return (
        <span
          className={`inline-flex items-center gap-1 font-medium rounded-full bg-rose-50 text-rose-700 border border-rose-200/80 ${sizeClasses}`}
        >
          <XCircle className="w-3.5 h-3.5 text-rose-500" />
          Từ chối
        </span>
      );
    default:
      return null;
  }
};

interface DeadlineWarningProps {
  dueDate: string;
  isOverdue?: boolean;
}

export const DeadlineWarningBadge: React.FC<DeadlineWarningProps> = ({ dueDate, isOverdue }) => {
  const due = new Date(dueDate);
  const now = new Date();
  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (isOverdue || diffDays < 0) {
    const daysLate = Math.abs(diffDays) === 0 ? 1 : Math.abs(diffDays);
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-700 border border-red-200">
        <AlertCircle className="w-3.5 h-3.5 text-red-600" />
        Trễ {daysLate} ngày
      </span>
    );
  }

  if (diffDays <= 1) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-red-50 text-red-700 border border-red-200">
        <AlertCircle className="w-3.5 h-3.5 text-red-600" />
        Còn ≤1 ngày
      </span>
    );
  }

  if (diffDays <= 3) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-orange-50 text-orange-700 border border-orange-200">
        <AlertTriangle className="w-3.5 h-3.5 text-orange-600" />
        Còn 2–3 ngày
      </span>
    );
  }

  if (diffDays <= 7) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-50 text-amber-700 border border-amber-200">
        <Clock className="w-3.5 h-3.5 text-amber-600" />
        Còn 4–7 ngày
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-600 border border-slate-200">
      <Clock className="w-3.5 h-3.5 text-slate-400" />
      Còn {diffDays} ngày
    </span>
  );
};
