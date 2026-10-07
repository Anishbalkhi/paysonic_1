import React from 'react';

/**
 * Standard Reusable Table Pagination Component for Paysonic Dashboard
 * 
 * @param {number} totalItems - Total number of records (after filtering)
 * @param {number} currentPage - 1-indexed current page number (e.g. 1, 2, 3...)
 * @param {number} pageSize - Number of items displayed per page
 * @param {function} onPageChange - Callback when user navigates page: (newPage: number) => void
 * @param {function} onPageSizeChange - Callback when user changes page size: (newSize: number) => void
 * @param {number[]} pageSizeOptions - Array of selectable page sizes, default [10, 25, 50, 100]
 * @param {string} className - Optional container CSS class name
 */
export default function TablePagination({
  totalItems = 0,
  currentPage = 1,
  pageSize = 10,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  className = ''
}) {
  const effectivePageSize = pageSize > 0 ? pageSize : 10;
  const totalPages = Math.max(1, Math.ceil(totalItems / effectivePageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const startRecord = totalItems === 0 ? 0 : (safePage - 1) * effectivePageSize + 1;
  const endRecord = Math.min(safePage * effectivePageSize, totalItems);

  return (
    <div className={`table-pagination-bar ${className}`.trim()}>
      <div className="pagination-info">
        Showing {startRecord} to {endRecord} of {totalItems} records
      </div>
      <div className="pagination-controls">
        {onPageSizeChange && (
          <select
            className="page-size-select"
            value={effectivePageSize}
            onChange={(e) => {
              const newSize = Number(e.target.value);
              onPageSizeChange(newSize);
            }}
            aria-label="Records per page"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt} per page
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          className="page-nav-btn"
          disabled={safePage <= 1}
          onClick={() => onPageChange && onPageChange(safePage - 1)}
          aria-label="Previous page"
        >
          Previous
        </button>
        <span className="page-current">
          Page {totalItems > 0 ? safePage : 0} of {totalItems > 0 ? totalPages : 0}
        </span>
        <button
          type="button"
          className="page-nav-btn"
          disabled={safePage >= totalPages || totalItems === 0}
          onClick={() => onPageChange && onPageChange(safePage + 1)}
          aria-label="Next page"
        >
          Next
        </button>
      </div>
    </div>
  );
}
