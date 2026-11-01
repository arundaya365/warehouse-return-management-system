import React from 'react';
import { Download, Filter } from 'lucide-react';

interface ClaimPageHeaderProps {
  filterLabel: string;
  filterActive?: boolean;
  summary: React.ReactNode;
  onOpenFilter: () => void;
  onExport?: () => void;
  exportLabel: string;
  exportDisabled?: boolean;
}

/** Shared report-style toolbar used by CS and RMA claim pages. */
export const ClaimPageHeader: React.FC<ClaimPageHeaderProps> = ({
  filterLabel,
  filterActive = false,
  summary,
  onOpenFilter,
  onExport,
  exportLabel,
  exportDisabled = false,
}) => (
  <div className="claim-page-header rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-slate-600">
        <button type="button" className={`warehouse-button shrink-0 ${filterActive ? 'warehouse-button-primary' : ''}`} onClick={onOpenFilter}>
          <Filter size={15} aria-hidden="true" />{filterLabel}{filterActive ? ' aktif' : ''}
        </button>
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">{summary}</div>
      </div>
      {onExport && <button type="button" className="warehouse-button shrink-0 self-start lg:self-auto" onClick={onExport} disabled={exportDisabled}>
        <Download size={15} aria-hidden="true" />{exportLabel}
      </button>}
    </div>
  </div>
);
