import React, { useId } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CompactPaginationProps {
  page: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  itemLabel?: string;
  ariaLabel?: string;
}

/** Shared compact pagination used by long operational lists. */
export const CompactPagination: React.FC<CompactPaginationProps> = ({
  page,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [50],
  itemLabel = 'baris',
  ariaLabel = 'Paginasi',
}) => {
  const controlId = useId();
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const firstRow = totalItems > 0 ? (safePage - 1) * pageSize + 1 : 0;
  const lastRow = Math.min(safePage * pageSize, totalItems);

  return (
    <nav className="compact-pagination" aria-label={ariaLabel}>
      <div className="compact-pagination-size">
        <label htmlFor={`${controlId}-page-size`}>Baris per halaman</label>
        {onPageSizeChange ? (
          <select
            id={`${controlId}-page-size`}
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            aria-label="Baris per halaman"
          >
            {pageSizeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        ) : <span className="compact-pagination-static-size">{pageSize}</span>}
      </div>
      <span className="compact-pagination-range">
        Menampilkan {firstRow}–{lastRow} dari {totalItems} {itemLabel}
      </span>
      <div className="compact-pagination-controls">
        <button type="button" className="warehouse-button compact-pagination-button" disabled={safePage <= 1} onClick={() => onPageChange(Math.max(1, safePage - 1))} aria-label="Halaman sebelumnya">
          <ChevronLeft size={15} aria-hidden="true" /><span>Sebelumnya</span>
        </button>
        <span className="compact-pagination-current">Halaman {safePage} dari {totalPages}</span>
        <button type="button" className="warehouse-button compact-pagination-button" disabled={safePage >= totalPages} onClick={() => onPageChange(Math.min(totalPages, safePage + 1))} aria-label="Halaman berikutnya">
          <span>Berikutnya</span><ChevronRight size={15} aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
};
