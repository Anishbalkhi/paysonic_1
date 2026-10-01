import React, { useState, useEffect, useCallback } from 'react';
import TrsReportService from '../../services/trs/TrsReportService';
import './TrsReport.scss';

export const TrsReport = () => {

  // Helper to format ISO datetime for <input type="datetime-local" step="1" />
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
  const [plazaId, setPlazaId] = useState('');
  const [status, setStatus] = useState('All');
  const [activePreset, setActivePreset] = useState('today');

  // Table & Pagination state
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  // Quick Date Presets
  const applyPreset = (preset) => {
    setActivePreset(preset);
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');

    if (preset === 'today') {
      setFromDate(`${yyyy}-${mm}-${dd}T00:00:01`);
      setToDate(`${yyyy}-${mm}-${dd}T23:59:59`);
    } else if (preset === 'yesterday') {
      const yest = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const yyyyy = yest.getFullYear();
      const ymm = String(yest.getMonth() + 1).padStart(2, '0');
      const ydd = String(yest.getDate()).padStart(2, '0');
      setFromDate(`${yyyyy}-${ymm}-${ydd}T00:00:01`);
      setToDate(`${yyyyy}-${ymm}-${ydd}T23:59:59`);
    } else if (preset === '7days') {
      const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const pyyyy = past.getFullYear();
      const pmm = String(past.getMonth() + 1).padStart(2, '0');
      const pdd = String(past.getDate()).padStart(2, '0');
      setFromDate(`${pyyyy}-${pmm}-${pdd}T00:00:01`);
      setToDate(`${yyyy}-${mm}-${dd}T23:59:59`);
    } else if (preset === '30days') {
      const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const pyyyy = past.getFullYear();
      const pmm = String(past.getMonth() + 1).padStart(2, '0');
      const pdd = String(past.getDate()).padStart(2, '0');
      setFromDate(`${pyyyy}-${pmm}-${pdd}T00:00:01`);
      setToDate(`${yyyy}-${mm}-${dd}T23:59:59`);
    }
  };

  // Validate 31-day range limit
  const validateDates = () => {
    if (!fromDate || !toDate) {
      setErrorMsg('Both From Date and To Date are required.');
      return false;
    }
    const fromTime = new Date(fromDate).getTime();
    const toTime = new Date(toDate).getTime();

    if (fromTime > toTime) {
      setErrorMsg('From Date cannot be later than To Date.');
      return false;
    }

    const dayDiff = (toTime - fromTime) / (1000 * 60 * 60 * 24);
    if (dayDiff > 31) {
      setErrorMsg('Selected date range exceeds maximum allowed limit of 31 days.');
      return false;
    }

    setErrorMsg('');
    return true;
  };

  // Fetch data
  const handleSearch = useCallback(async (newPage = 0, newSize = pageSize) => {
    if (!validateDates()) return;

    setLoading(true);
    setErrorMsg('');
    try {
      const data = await TrsReportService.searchTransactions({
        fromDate,
        toDate,
        plazaId,
        status,
        page: newPage,
        size: newSize
      });

      setRecords(data.content || []);
      setTotalElements(data.totalElements || 0);
      setTotalPages(data.totalPages || 0);
      setPage(data.number || 0);
    } catch (err) {
      setErrorMsg(err?.response?.data?.error || err.message || 'Failed to fetch TRS records');
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, plazaId, status, pageSize]);

  // Initial load
  useEffect(() => {
    handleSearch(0, pageSize);
  }, []);

  // Export Excel directly with current filters without requiring Search first
  const handleExportExcel = async () => {
    if (!validateDates()) return;

    setExporting(true);
    try {
      await TrsReportService.exportExcel({
        fromDate,
        toDate,
        plazaId,
        status
      });
    } catch (err) {
      setErrorMsg('Failed to export TRS report: ' + (err?.message || 'Server error'));
    } finally {
      setExporting(false);
    }
  };

  const handleReset = () => {
    const today = getTodayRange();
    setFromDate(today.from);
    setToDate(today.to);
    setPlazaId('');
    setStatus('All');
    setActivePreset('today');
    setErrorMsg('');
  };

  // Format date helper for table
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

  // Format currency
  const formatCurrency = (amt) => {
    if (amt === null || amt === undefined || amt === '') return '';
    const num = Number(amt);
    if (isNaN(num)) return amt;
    return `₹${num.toFixed(2)}`;
  };

  // Metrics calculation
  const totalAmountSettled = records
    .filter(r => r.settledAmount != null)
    .reduce((acc, curr) => acc + (Number(curr.settledAmount) || 0), 0);
  const rejectedCount = records.filter(r => (r.status || '').toLowerCase() === 'rejected').length;
  const pendingCount = records.filter(r => (r.status || '').toLowerCase() === 'pending').length;

  return (
    <div className="trs-report-container">
      {/* Header */}
      <div className="trs-header">
        <div className="header-left">
          <div className="breadcrumb">
            <span>Recon Management</span> › Transaction Reconciliation and Settlement Report
          </div>
          <h1>Transaction Reconciliation and Settlement Report</h1>
        </div>

        {/* Quick Date Range Presets */}
        <div className="header-quick-presets">
          <button
            type="button"
            className={`preset-btn ${activePreset === 'today' ? 'active' : ''}`}
            onClick={() => applyPreset('today')}
          >
            Today
          </button>
          <button
            type="button"
            className={`preset-btn ${activePreset === 'yesterday' ? 'active' : ''}`}
            onClick={() => applyPreset('yesterday')}
          >
            Yesterday
          </button>
          <button
            type="button"
            className={`preset-btn ${activePreset === '7days' ? 'active' : ''}`}
            onClick={() => applyPreset('7days')}
          >
            Last 7 Days
          </button>
          <button
            type="button"
            className={`preset-btn ${activePreset === '30days' ? 'active' : ''}`}
            onClick={() => applyPreset('30days')}
          >
            Last 30 Days
          </button>
        </div>
      </div>

      {/* Filter Card */}
      <div className="trs-filter-card">
        <div className="filter-grid">
          <div className="form-group">
            <label htmlFor="trsFromDate">
              From Date <span className="required">*</span>
            </label>
            <input
              id="trsFromDate"
              type="datetime-local"
              step="1"
              className="input-control"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setActivePreset('');
              }}
            />
          </div>

          <div className="form-group">
            <label htmlFor="trsToDate">
              To Date <span className="required">*</span>
            </label>
            <input
              id="trsToDate"
              type="datetime-local"
              step="1"
              className="input-control"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setActivePreset('');
              }}
            />
          </div>

          <div className="form-group">
            <label htmlFor="trsPlazaId">Plaza (Optional)</label>
            <input
              id="trsPlazaId"
              type="text"
              placeholder="e.g. 600601, Dummytoll"
              className="input-control"
              value={plazaId}
              onChange={(e) => setPlazaId(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="trsStatus">Status</label>
            <select
              id="trsStatus"
              className="input-control"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="All">All Statuses</option>
              <option value="Settled">Settled</option>
              <option value="Pending">Pending</option>
              <option value="Rejected">Rejected</option>
              <option value="Declined">Declined</option>
            </select>
          </div>

          <div className="filter-actions">
            <button
              type="button"
              className="btn-search"
              onClick={() => handleSearch(0, pageSize)}
              disabled={loading}
              id="trsSearchBtn"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              {loading ? 'Searching...' : 'Search'}
            </button>

            <button
              type="button"
              className="btn-export"
              onClick={handleExportExcel}
              disabled={exporting}
              id="trsExportBtn"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {exporting ? 'Exporting...' : 'Export Excel'}
            </button>

            <button
              type="button"
              className="btn-reset"
              onClick={handleReset}
              disabled={loading}
            >
              Reset
            </button>
          </div>
        </div>

        {errorMsg && (
          <div style={{ color: '#ef4444', fontSize: '13px', marginTop: '10px', fontWeight: '500' }}>
            ⚠️ {errorMsg}
          </div>
        )}

        <div className="filter-footer">
          <div className="hint-text">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            * Filter criteria applies strictly to Transaction Date (Max range: 31 days). Export downloads filtered results directly.
          </div>
          <div className="range-status">
            Active Window: {formatDateDisplay(fromDate)} → {formatDateDisplay(toDate)}
          </div>
        </div>
      </div>

      {/* Metrics Ribbon */}
      <div className="trs-metric-ribbon">
        <div className="metric-card">
          <span className="label">Total Records Found</span>
          <span className="value">{totalElements}</span>
        </div>
        <div className="metric-card settled">
          <span className="label">Current View Settled ₹</span>
          <span className="value">₹{totalAmountSettled.toFixed(2)}</span>
        </div>
        <div className="metric-card pending">
          <span className="label">Pending Records</span>
          <span className="value">{pendingCount}</span>
        </div>
        <div className="metric-card rejected">
          <span className="label">Rejected Records</span>
          <span className="value">{rejectedCount}</span>
        </div>
      </div>

      {/* Data Table Card */}
      <div className="trs-table-card">
        <div className="table-top-bar">
          <div className="results-count">
            Showing <span>{records.length > 0 ? page * pageSize + 1 : 0}</span> to{' '}
            <span>{Math.min((page + 1) * pageSize, totalElements)}</span> of{' '}
            <span>{totalElements}</span> transactions
          </div>

          <div className="table-page-size">
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

        {/* Scrollable Table */}
        <div className="table-wrapper">
          {loading ? (
            <div className="loading-container">
              <div className="spinner"></div>
              <p>Loading transaction reconciliation data...</p>
            </div>
          ) : records.length === 0 ? (
            <div className="empty-state">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
              <h3>No Transactions Found</h3>
              <p>No toll transactions match the selected date range and filter criteria.</p>
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
                    <tr key={r.id || index}>
                      {/* 1. Sr No */}
                      <td className="text-center">{page * pageSize + index + 1}</td>

                      {/* 2. Toll File Name */}
                      <td>{r.tollFileName || <span className="empty-cell">—</span>}</td>

                      {/* 3. Plaza ID */}
                      <td>{r.plazaId || <span className="empty-cell">—</span>}</td>

                      {/* 4. Plaza Name */}
                      <td style={{ fontWeight: 500 }}>{r.plazaName || <span className="empty-cell">—</span>}</td>

                      {/* 5. Lane ID */}
                      <td>{r.laneId || <span className="empty-cell">—</span>}</td>

                      {/* 6. Tag ID */}
                      <td>
                        <span className="code-val">{r.tagId}</span>
                      </td>

                      {/* 7. VRN */}
                      <td>
                        <span className="vrn-tag">{r.vrn}</span>
                      </td>

                      {/* 8. Acq Txn ID (Monospace text format to display all 18 digits) */}
                      <td>
                        <span className="code-val" style={{ background: '#f8fafc', borderColor: '#cbd5e1' }}>
                          {r.acqTxnId}
                        </span>
                      </td>

                      {/* 9. Toll Txn ID */}
                      <td>{r.tollTxnId || <span className="empty-cell">—</span>}</td>

                      {/* 10. Toll Message ID */}
                      <td>{r.tollMessageId || <span className="empty-cell">—</span>}</td>

                      {/* 11. MVC */}
                      <td>{r.mvc || <span className="empty-cell">—</span>}</td>

                      {/* 12. Tag VC */}
                      <td>{r.tagVc || <span className="empty-cell">—</span>}</td>

                      {/* 13. AVC */}
                      <td>{r.avc || <span className="empty-cell">—</span>}</td>

                      {/* 14. Transaction Status */}
                      <td>
                        <span className={`status-badge ${statusLower}`}>
                          {r.status || 'Unknown'}
                        </span>
                      </td>

                      {/* 15. Reason */}
                      <td>{r.reason || <span className="empty-cell">—</span>}</td>

                      {/* 16. Transaction Amount */}
                      <td className="text-right">
                        <span className="amount-val">{formatCurrency(r.txnAmount)}</span>
                      </td>

                      {/* 17. Settled Amount (blank if rejected or null) */}
                      <td className="text-right">
                        {r.settledAmount != null ? (
                          <span className="amount-val" style={{ color: '#16a34a' }}>
                            {formatCurrency(r.settledAmount)}
                          </span>
                        ) : (
                          <span className="empty-cell">—</span>
                        )}
                      </td>

                      {/* 18. Transaction Date */}
                      <td>{formatDateDisplay(r.txnDate)}</td>

                      {/* 19. Plaza Post Date */}
                      <td>{formatDateDisplay(r.plazaPostDate) || <span className="empty-cell">—</span>}</td>

                      {/* 20. NPCI Error Code */}
                      <td>{r.npciErrorCode || <span className="empty-cell">—</span>}</td>

                      {/* 21. NPCI Settled Date */}
                      <td>{formatDateDisplay(r.npciSettledDate) || <span className="empty-cell">—</span>}</td>

                      {/* 22. NPCI Clearing Cycle */}
                      <td>{r.clearingCycle || <span className="empty-cell">—</span>}</td>

                      {/* 23. Plaza Settlement Date */}
                      <td>{formatDateDisplay(r.plazaSettleDate) || <span className="empty-cell">—</span>}</td>

                      {/* 24. Transaction Type */}
                      <td>{r.txnType || <span className="empty-cell">—</span>}</td>

                      {/* 25. NPCI Response Date */}
                      <td>{formatDateDisplay(r.npciRespDate) || <span className="empty-cell">—</span>}</td>

                      {/* 26. Plaza Type */}
                      <td>{r.plazaType || 'Toll'}</td>

                      {/* 27. Is Violation */}
                      <td className="text-center">
                        <span className={`violation-badge ${isViolation ? 'yes' : 'no'}`}>
                          {r.isViolation || 'No'}
                        </span>
                      </td>

                      {/* 28. Audit VC */}
                      <td>{r.auditVc || 'NA'}</td>

                      {/* 29. Violation Settlement Amount */}
                      <td className="text-right">
                        {r.violationSettledAmount != null ? formatCurrency(r.violationSettledAmount) : <span className="empty-cell">—</span>}
                      </td>

                      {/* 30. Violation Settlement Date */}
                      <td>{formatDateDisplay(r.violationSettledDate) || <span className="empty-cell">—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Controls */}
        {totalElements > 0 && (
          <div className="table-pagination">
            <div className="pagination-info">
              Page <strong>{page + 1}</strong> of <strong>{totalPages || 1}</strong>
            </div>

            <div className="pagination-controls">
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

              {/* Render dynamic page window */}
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
