import React, { useState, useEffect, useCallback } from 'react';
import TrsReportService from '../../services/trs/TrsReportService';
import './TrsReport.scss';

export const TrsReport = () => {
  // Default range: Today 00:00:01 to 23:59:59
  const getTodayRange = () => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return {
      from: `${yyyy}-${mm}-${dd}T00:00:01`,
      to: `${yyyy}-${mm}-${dd}T23:59:59`
    };
  };

  const initialRange = getTodayRange();
  const [fromDate, setFromDate] = useState(initialRange.from);
  const [toDate, setToDate] = useState(initialRange.to);

  // Real Database Data State
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  // 31-day date range validation
  const validateDates = (start, end) => {
    if (!start || !end) {
      setErrorMsg('Both From Date and To Date are required.');
      return false;
    }
    const fromTime = new Date(start).getTime();
    const toTime = new Date(end).getTime();

    if (fromTime > toTime) {
      setErrorMsg('From Date cannot be later than To Date.');
      return false;
    }

    const dayDiff = (toTime - fromTime) / (1000 * 60 * 60 * 24);
    if (dayDiff > 90) {
      setErrorMsg('Selected date range exceeds maximum allowed limit of 90 days.');
      return false;
    }

    setErrorMsg('');
    return true;
  };

  // Search transactions from the real database
  const handleSearch = useCallback(async (newPage = 0, newSize = pageSize) => {
    if (!validateDates(fromDate, toDate)) return;

    setLoading(true);
    setErrorMsg('');
    try {
      const data = await TrsReportService.searchTransactions({
        fromDate,
        toDate,
        page: newPage,
        size: newSize
      });

      setRecords(data?.content || []);
      setTotalElements(data?.totalElements || 0);
      setTotalPages(data?.totalPages || 0);
      setPage(data?.number || 0);
    } catch (err) {
      console.error('[TrsReport] Database query failed:', err);
      const msg = err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Database error occurred';
      setErrorMsg(`Database Query Error: ${msg}`);
      setRecords([]);
      setTotalElements(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, pageSize]);

  // Initial load on mount
  useEffect(() => {
    handleSearch(0, pageSize);
  }, []);

  // Export Excel directly from real database
  const handleExportExcel = async () => {
    if (!validateDates(fromDate, toDate)) return;

    setExporting(true);
    try {
      await TrsReportService.exportExcel({
        fromDate,
        toDate
      });
    } catch (err) {
      console.error('[TrsReport] Excel export failed:', err);
      setErrorMsg('Export Error: ' + (err?.response?.data?.error || err?.message || 'Failed to download Excel'));
    } finally {
      setExporting(false);
    }
  };

  // Export CSV matching exact records currently displayed on screen (1:1 guaranteed)
  const handleExportCsv = () => {
    if (!records || records.length === 0) return;

    const headers = [
      'Acq Txn ID', 'Plaza ID', 'Plaza Name', 'Lane ID', 'Tag ID', 'VRN',
      'Toll Txn ID', 'Status', 'Txn Amount', 'Settled Amount', 'Txn Date',
      'Plaza Settle Date', 'Clearing Cycle'
    ];

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = records.map((t) => [
      t.acqTxnId || '',
      t.plazaId || '',
      t.plazaName || '',
      t.laneId || '',
      t.tagId || '',
      t.vrn || '',
      t.tollTxnId || '',
      t.status || '',
      t.txnAmount !== null && t.txnAmount !== undefined ? Number(t.txnAmount).toFixed(2) : '0.00',
      t.settledAmount !== null && t.settledAmount !== undefined ? Number(t.settledAmount).toFixed(2) : '0.00',
      formatDateDisplay(t.txnDate),
      formatDateDisplay(t.plazaSettleDate),
      t.clearingCycle || ''
    ]);

    const csvContent = [
      headers.map(escapeCsv).join(','),
      ...rows.map((row) => row.map(escapeCsv).join(','))
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `TRS_Report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Date formatter for table display
  const formatDateDisplay = (dateVal) => {
    if (!dateVal) return '';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return dateVal;
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      const hh = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      const ss = String(d.getSeconds()).padStart(2, '0');
      return `${dd}-${mm}-${yyyy} ${hh}:${min}:${ss}`;
    } catch {
      return dateVal;
    }
  };

  // Currency formatter
  const formatCurrency = (amt) => {
    if (amt === null || amt === undefined || amt === '') return '';
    const num = Number(amt);
    if (isNaN(num)) return amt;
    return `₹${num.toFixed(2)}`;
  };

  return (
    <div className="trs-page">
      {/* Title */}
      <h2 className="trs-page-title">Transaction Reconciliation and Settlement Report</h2>

      {/* Filter Card matching Image 2 */}
      <div className="trs-filter-box">
        <div className="filter-row">
          <div className="date-field">
            <label htmlFor="trsFromDate">
              From Date <span className="req">*</span>
            </label>
            <input
              id="trsFromDate"
              type="datetime-local"
              step="1"
              className="date-input"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>

          <div className="date-field">
            <label htmlFor="trsToDate">
              To Date <span className="req">*</span>
            </label>
            <input
              id="trsToDate"
              type="datetime-local"
              step="1"
              className="date-input"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>

          <div className="btn-actions">
            <button
              type="button"
              className="btn-orange"
              onClick={handleExportExcel}
              disabled={exporting || loading || records.length === 0}
              id="trsExportBtn"
            >
              {exporting ? 'Exporting...' : 'Export Excel'}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleExportCsv}
              disabled={loading || records.length === 0}
              id="trsExportCsvBtn"
            >
              Export CSV
            </button>

            <button
              type="button"
              className="btn-orange"
              onClick={() => handleSearch(0, pageSize)}
              disabled={loading}
              id="trsSearchBtn"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="error-banner">
            <span>⚠️</span> {errorMsg}
          </div>
        )}
      </div>

      {/* Real Data Table */}
      <div className="trs-table-container">
        <div className="table-header-info">
          <div className="records-count">
            Showing <strong>{records.length > 0 ? page * pageSize + 1 : 0}</strong> to{' '}
            <strong>{Math.min((page + 1) * pageSize, totalElements)}</strong> of{' '}
            <strong>{totalElements}</strong> real transactions
          </div>

          <div className="page-size-selector">
            <label htmlFor="trsPageSize">Rows per page:</label>
            <select
              id="trsPageSize"
              value={pageSize}
              onChange={(e) => {
                const newSize = Number(e.target.value);
                setPageSize(newSize);
                handleSearch(0, newSize);
              }}
            >
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </div>
        </div>

        <div className="table-scroll-wrapper">
          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Querying real database transactions...</p>
            </div>
          ) : records.length === 0 ? (
            <div className="empty-state">
              <h4>No Database Transactions Found</h4>
              <p>There are no transactions recorded in the database for the selected date range.</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th className="text-center">Sr No</th>
                  <th>Toll File Name</th>
                  <th>Plaza ID</th>
                  <th>Plaza Name</th>
                  <th>Lane ID</th>
                  <th>Tag ID</th>
                  <th>VRN</th>
                  <th>Acq Txn ID</th>
                  <th>Toll Txn ID</th>
                  <th>Toll Message ID</th>
                  <th>MVC</th>
                  <th>Tag VC</th>
                  <th>AVC</th>
                  <th>Transaction Status</th>
                  <th>Reason</th>
                  <th className="text-right">Transaction Amount</th>
                  <th className="text-right">Settled Amount</th>
                  <th>Transaction Date</th>
                  <th>Plaza Post Date</th>
                  <th>NPCI Error Code</th>
                  <th>NPCI Settled Date</th>
                  <th>NPCI Clearing Cycle</th>
                  <th>Plaza Settlement Date</th>
                  <th>Transaction Type</th>
                  <th>NPCI Response Date</th>
                  <th>Plaza Type</th>
                  <th className="text-center">Is Violation</th>
                  <th>Audit VC</th>
                  <th className="text-right">Violation Settlement Amount</th>
                  <th>Violation Settlement Date</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r, index) => {
                  const statusLower = (r.status || '').toLowerCase();
                  const isViolation = (r.isViolation || '').toLowerCase() === 'yes';

                  return (
                    <tr key={r.id || r.acqTxnId || index}>
                      {/* 1. Sr No */}
                      <td className="text-center">{page * pageSize + index + 1}</td>

                      {/* 2. Toll File Name */}
                      <td>{r.tollFileName || ''}</td>

                      {/* 3. Plaza ID */}
                      <td>{r.plazaId || ''}</td>

                      {/* 4. Plaza Name */}
                      <td style={{ fontWeight: 500 }}>{r.plazaName || ''}</td>

                      {/* 5. Lane ID */}
                      <td>{r.laneId || ''}</td>

                      {/* 6. Tag ID */}
                      <td>
                        <span className="acq-code">{r.tagId}</span>
                      </td>

                      {/* 7. VRN */}
                      <td style={{ fontWeight: 600 }}>{r.vrn}</td>

                      {/* 8. Acq Txn ID (Monospace text format to retain 18 digits) */}
                      <td>
                        <span className="acq-code">{r.acqTxnId}</span>
                      </td>

                      {/* 9. Toll Txn ID */}
                      <td>{r.tollTxnId || ''}</td>

                      {/* 10. Toll Message ID */}
                      <td>{r.tollMessageId || ''}</td>

                      {/* 11. MVC */}
                      <td>{r.mvc || ''}</td>

                      {/* 12. Tag VC */}
                      <td>{r.tagVc || ''}</td>

                      {/* 13. AVC */}
                      <td>{r.avc || ''}</td>

                      {/* 14. Transaction Status */}
                      <td>
                        <span className={`status-pill ${statusLower}`}>
                          {r.status || ''}
                        </span>
                      </td>

                      {/* 15. Reason */}
                      <td>{r.reason || ''}</td>

                      {/* 16. Transaction Amount */}
                      <td className="text-right" style={{ fontWeight: 600 }}>
                        {formatCurrency(r.txnAmount)}
                      </td>

                      {/* 17. Settled Amount (blank if null or rejected) */}
                      <td className="text-right" style={{ fontWeight: 600, color: '#16a34a' }}>
                        {r.settledAmount != null ? formatCurrency(r.settledAmount) : ''}
                      </td>

                      {/* 18. Transaction Date */}
                      <td>{formatDateDisplay(r.txnDate)}</td>

                      {/* 19. Plaza Post Date */}
                      <td>{formatDateDisplay(r.plazaPostDate)}</td>

                      {/* 20. NPCI Error Code */}
                      <td>{r.npciErrorCode || ''}</td>

                      {/* 21. NPCI Settled Date */}
                      <td>{formatDateDisplay(r.npciSettledDate)}</td>

                      {/* 22. NPCI Clearing Cycle */}
                      <td>{r.clearingCycle || ''}</td>

                      {/* 23. Plaza Settlement Date */}
                      <td>{formatDateDisplay(r.plazaSettleDate)}</td>

                      {/* 24. Transaction Type */}
                      <td>{r.txnType || ''}</td>

                      {/* 25. NPCI Response Date */}
                      <td>{formatDateDisplay(r.npciRespDate)}</td>

                      {/* 26. Plaza Type */}
                      <td>{r.plazaType || 'Toll'}</td>

                      {/* 27. Is Violation */}
                      <td className="text-center">
                        <span className={`badge-viol ${isViolation ? 'yes' : 'no'}`}>
                          {r.isViolation || 'No'}
                        </span>
                      </td>

                      {/* 28. Audit VC */}
                      <td>{r.auditVc || 'NA'}</td>

                      {/* 29. Violation Settlement Amount */}
                      <td className="text-right">
                        {r.violationSettledAmount != null ? formatCurrency(r.violationSettledAmount) : ''}
                      </td>

                      {/* 30. Violation Settlement Date */}
                      <td>{formatDateDisplay(r.violationSettledDate)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalElements > 0 && (
          <div className="table-pagination">
            <div className="page-info">
              Page <strong>{page + 1}</strong> of <strong>{totalPages || 1}</strong>
            </div>

            <div className="page-btns">
              <button
                type="button"
                onClick={() => handleSearch(0, pageSize)}
                disabled={page === 0 || loading}
                title="First Page"
              >
                ««
              </button>
              <button
                type="button"
                onClick={() => handleSearch(page - 1, pageSize)}
                disabled={page === 0 || loading}
                title="Previous Page"
              >
                ‹ Prev
              </button>

              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = Math.max(0, Math.min(totalPages - 5, page - 2)) + i;
                if (pageNum >= totalPages) return null;
                return (
                  <button
                    key={pageNum}
                    type="button"
                    className={pageNum === page ? 'active' : ''}
                    onClick={() => handleSearch(pageNum, pageSize)}
                    disabled={loading}
                  >
                    {pageNum + 1}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => handleSearch(page + 1, pageSize)}
                disabled={page >= totalPages - 1 || loading}
                title="Next Page"
              >
                Next ›
              </button>
              <button
                type="button"
                onClick={() => handleSearch(totalPages - 1, pageSize)}
                disabled={page >= totalPages - 1 || loading}
                title="Last Page"
              >
                »»
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrsReport;
