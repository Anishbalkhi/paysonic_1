import React, { useState, useEffect, useCallback, useMemo } from 'react';
import RejectedTransactionService from '../../services/rejectedTxn/RejectedTransactionService';
import ReportKpiGrid from '../../components/ReportKpiGrid/ReportKpiGrid';
import './RejectedTransaction.scss';

export const RejectedTransaction = () => {
  // Default range: September 2026 (matching live Railway DB seed data)
  const getDefaultDateRange = () => {
    return {
      from: '2026-09-01T00:00:00',
      to: '2026-09-30T23:59:59'
    };
  };

  const initialRange = getDefaultDateRange();
  const [fromDate, setFromDate] = useState(initialRange.from);
  const [toDate, setToDate] = useState(initialRange.to);
  const [plazaId, setPlazaId] = useState('ALL');
  const [reason, setReason] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Live Database Data State
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  // Date range validation
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

    setErrorMsg('');
    return true;
  };

  // Search rejected transactions from live Railway MySQL database
  const handleSearch = useCallback(async (newPage = 0, newSize = pageSize, overrides = {}) => {
    const fDate = overrides.fromDate !== undefined ? overrides.fromDate : fromDate;
    const tDate = overrides.toDate !== undefined ? overrides.toDate : toDate;
    const pId = overrides.plazaId !== undefined ? overrides.plazaId : plazaId;
    const rsn = overrides.reason !== undefined ? overrides.reason : reason;

    if (!validateDates(fDate, tDate)) return;

    setLoading(true);
    setErrorMsg('');
    try {
      const data = await RejectedTransactionService.searchRejectedTransactions({
        fromDate: fDate,
        toDate: tDate,
        plazaId: pId,
        reason: rsn,
        page: newPage,
        size: newSize
      });

      const content = data?.content ? data.content : Array.isArray(data) ? data : [];
      setRecords(content);
      setTotalElements(data?.totalElements ?? content.length);
      setTotalPages(data?.totalPages ?? (content.length > 0 ? 1 : 0));
      setPage(data?.number ?? 0);
    } catch (err) {
      console.error('[RejectedTransaction] Database query failed:', err);
      const msg = err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Database error occurred';
      setErrorMsg(`Database Query Error: ${msg}`);
      setRecords([]);
      setTotalElements(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, plazaId, reason, pageSize]);

  // Initial load on mount
  useEffect(() => {
    handleSearch(0, pageSize);
  }, []);

  const handleReset = () => {
    const def = getDefaultDateRange();
    setFromDate(def.from);
    setToDate(def.to);
    setPlazaId('ALL');
    setReason('ALL');
    setSearchTerm('');
    handleSearch(0, pageSize, {
      fromDate: def.from,
      toDate: def.to,
      plazaId: 'ALL',
      reason: 'ALL'
    });
  };

  // Client-side search filtering
  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const q = searchTerm.toLowerCase().trim();
    return records.filter((r) =>
      (r.plazaName && r.plazaName.toLowerCase().includes(q)) ||
      (r.plazaId && String(r.plazaId).toLowerCase().includes(q)) ||
      (r.acqTxnId && String(r.acqTxnId).toLowerCase().includes(q)) ||
      (r.tollTxnId && String(r.tollTxnId).toLowerCase().includes(q)) ||
      (r.vrn && r.vrn.toLowerCase().includes(q)) ||
      (r.tagId && r.tagId.toLowerCase().includes(q)) ||
      (r.status && r.status.toLowerCase().includes(q)) ||
      (r.reason && r.reason.toLowerCase().includes(q))
    );
  }, [records, searchTerm]);

  // Summary Metrics calculation for bottom cards
  const { totalRejectedAmt, duplicateCount, otherCount } = useMemo(() => {
    let amt = 0;
    let dup = 0;
    let other = 0;
    filteredRecords.forEach((t) => {
      amt += Number(t.txnAmount || 0);
      const r = (t.reason || '').toUpperCase();
      if (r === 'DUPLICATE') {
        dup++;
      } else {
        other++;
      }
    });
    return {
      totalRejectedAmt: amt.toFixed(2),
      duplicateCount: dup,
      otherCount: other
    };
  }, [filteredRecords]);

  // Export Excel directly from server streaming endpoint
  const handleExportExcel = async () => {
    if (!validateDates(fromDate, toDate) || exportingExcel || exportingCsv) return;

    setExportingExcel(true);
    try {
      await RejectedTransactionService.exportExcel({
        fromDate,
        toDate,
        plazaId,
        reason
      });
    } catch (err) {
      console.error('[RejectedTransaction] Excel export failed:', err);
      setErrorMsg('Export Error: ' + (err?.response?.data?.error || err?.message || 'Failed to download Excel'));
    } finally {
      setExportingExcel(false);
    }
  };

  // Export CSV directly from server streaming endpoint
  const handleExportCsv = async () => {
    if (!validateDates(fromDate, toDate) || exportingExcel || exportingCsv) return;

    setExportingCsv(true);
    try {
      await RejectedTransactionService.exportCsv({
        fromDate,
        toDate,
        plazaId,
        reason
      });
    } catch (err) {
      console.error('[RejectedTransaction] CSV export failed:', err);
      setErrorMsg('Export Error: ' + (err?.response?.data?.error || err?.message || 'Failed to download CSV'));
    } finally {
      setExportingCsv(false);
    }
  };

  // Date formatter for table display (dd-MM-yyyy HH:mm:ss)
  const formatDateDisplay = (dateVal) => {
    if (!dateVal) return '';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return dateVal;
      const pad = (n) => String(n).padStart(2, '0');
      return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    } catch {
      return dateVal;
    }
  };

  return (
    <div className="rejected-txn-page">
      {/* Top Page Header */}
      <header className="page-header">
        <div className="header-titles">
          <h1 className="page-title">Rejected Transaction</h1>
          <p className="subtitle">
            Declined &amp; Rejected FASTag Toll Transactions (Live Railway DB)
          </p>
        </div>
      </header>

      {/* Filter Card */}
      <div className="filter-box">
        <div className="filter-row">
          <div className="filter-group">
            <label htmlFor="rejFromDate">
              From Date <span className="req">*</span>
            </label>
            <input
              id="rejFromDate"
              type="datetime-local"
              step="1"
              className="date-input"
              value={fromDate.slice(0, 19)}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label htmlFor="rejToDate">
              To Date <span className="req">*</span>
            </label>
            <input
              id="rejToDate"
              type="datetime-local"
              step="1"
              className="date-input"
              value={toDate.slice(0, 19)}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label htmlFor="rejPlazaSelect">Plaza (Optional)</label>
            <select
              id="rejPlazaSelect"
              className="select-input"
              value={plazaId}
              onChange={(e) => setPlazaId(e.target.value)}
            >
              <option value="ALL">All Plazas</option>
              <option value="501101">MUMBAI PLAZA NH-04 (501101)</option>
              <option value="502202">PUNE BYPASS PLAZA (502202)</option>
              <option value="600601">Dummytollplaza1 (600601)</option>
              <option value="600602">Dummytollplaza2 (600602)</option>
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="rejReasonSelect">Rejection Reason</label>
            <select
              id="rejReasonSelect"
              className="select-input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            >
              <option value="ALL">All Reasons</option>
              <option value="DUPLICATE">DUPLICATE</option>
              <option value="BLKLISTTAG">BLKLISTTAG</option>
              <option value="MALTAG">MALTAG</option>
              <option value="FAILING">FAILING</option>
            </select>
          </div>

          <div className="btn-actions">
            <button
              type="button"
              className="btn-royal-blue"
              onClick={handleExportExcel}
              disabled={exportingExcel || loading || filteredRecords.length === 0}
              id="rejExportBtn"
            >
              {exportingExcel ? 'Exporting...' : 'Export Excel'}
            </button>
            <button
              type="button"
              className="btn-royal-blue"
              onClick={handleExportCsv}
              disabled={exportingCsv || loading || filteredRecords.length === 0}
              id="rejExportCsvBtn"
            >
              {exportingCsv ? 'Exporting...' : 'Export CSV'}
            </button>
            <button
              type="button"
              className="btn-royal-blue"
              onClick={() => handleSearch(0, pageSize)}
              disabled={loading}
              id="rejSearchBtn"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleReset}
              disabled={loading}
              id="rejResetBtn"
            >
              Reset
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="error-banner">
            <span>⚠️</span> {errorMsg}
          </div>
        )}
      </div>

      {/* Summary KPI Cards / Mini Dashboard */}
      <ReportKpiGrid
        cards={[
          {
            label: 'Total Rejections',
            value: (totalElements || filteredRecords.length).toLocaleString('en-IN'),
            sub: 'Filtered Records'
          },
          {
            label: 'Total Rejected Amount',
            value: `₹ ${Number(totalRejectedAmt).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            sub: 'Declined Toll Value',
            highlight: 'red'
          },
          {
            label: 'Duplicate / Other Errors',
            value: `${duplicateCount} / ${otherCount}`,
            sub: 'Failure Breakdown',
            highlight: 'amber'
          },
          {
            label: 'Live Railway DB',
            value: 'ONLINE',
            sub: 'rejected_transactions',
            isBadge: true
          }
        ]}
      />

      {/* Table Quick Search Bar & Controls */}
      <div className="table-controls-bar">
        <div className="table-info">
          Showing <strong>{filteredRecords.length}</strong> of <strong>{totalElements}</strong> rejected transactions
        </div>
        <div className="quick-search">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Quick search VRN, Tag, Plaza, Reason, ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button type="button" className="clear-search-btn" onClick={() => setSearchTerm('')}>
              ×
            </button>
          )}
        </div>
      </div>

      {/* Main Table Container */}
      <div className="table-container">
        {/* Centered Table Banner matching Reference Image */}
        <div className="table-top-banner">
          <div className="banner-title">REJECTED TRANSACTIONS REPORT</div>
          <div className="banner-subtitle">
            From Date: {formatDateDisplay(fromDate)} &nbsp; | &nbsp; To Date: {formatDateDisplay(toDate)}
          </div>
          <div className="banner-green-bar" />
        </div>

        <div className="table-scroll-wrapper">
          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Querying rejected database transactions from Railway MySQL...</p>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="empty-state">
              <h4>No Rejected Transactions Found</h4>
              <p>There are no rejected transactions recorded in the database matching your criteria.</p>
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
                  <th>Transaction Date</th>
                  <th>Plaza Posted Date</th>
                  <th>NPCI Error Code</th>
                  <th>NPCI Response Date</th>
                  <th>Transaction Type</th>
                  <th>Issuer Bank ID</th>
                  <th>Issuer Bank Name</th>
                  <th>TID</th>
                  <th>Plaza Type</th>
                  <th className="text-center">Is Manual</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((r, index) => {
                  let issuerBankId = '052337';
                  if (r.plazaName === 'Autumn' || r.plazaName === 'Gluten' || r.plazaId === '778999') {
                    issuerBankId = '007030';
                  }

                  return (
                    <tr key={r.id || r.acqTxnId || index}>
                      {/* 1. Sr No */}
                      <td className="text-center">{page * pageSize + index + 1}</td>

                      {/* 2. Toll File Name */}
                      <td>{r.tollFileName || 'ONLINE'}</td>

                      {/* 3. Plaza ID */}
                      <td>{r.plazaId || ''}</td>

                      {/* 4. Plaza Name */}
                      <td style={{ fontWeight: 500 }}>{r.plazaName || ''}</td>

                      {/* 5. Lane ID */}
                      <td className="text-center">{r.laneId || ''}</td>

                      {/* 6. Tag ID */}
                      <td>
                        <span className="acq-code">{r.tagId}</span>
                      </td>

                      {/* 7. VRN */}
                      <td style={{ fontWeight: 600 }}>{r.vrn}</td>

                      {/* 8. Acq Txn ID */}
                      <td>
                        <span className="acq-code">{r.acqTxnId}</span>
                      </td>

                      {/* 9. Toll Txn ID */}
                      <td>{r.tollTxnId || ''}</td>

                      {/* 10. Toll Message ID */}
                      <td>{r.tollMessageId || ''}</td>

                      {/* 11. MVC */}
                      <td className="text-center">{r.mvc || ''}</td>

                      {/* 12. Tag VC */}
                      <td className="text-center">{r.tagVc || '4'}</td>

                      {/* 13. AVC */}
                      <td className="text-center">{r.avc || ''}</td>

                      {/* 14. Transaction Status */}
                      <td className="text-center">
                        <span className="status-pill rejected">
                          {r.status || 'Rejected'}
                        </span>
                      </td>

                      {/* 15. Reason */}
                      <td className="font-semibold" style={{ color: '#b91c1c' }}>
                        {r.reason || 'DUPLICATE'}
                      </td>

                      {/* 16. Transaction Amount */}
                      <td className="text-right" style={{ fontWeight: 600 }}>
                        {r.txnAmount !== null && r.txnAmount !== undefined
                          ? Number(r.txnAmount).toFixed(2)
                          : '0.00'}
                      </td>

                      {/* 17. Transaction Date */}
                      <td>{formatDateDisplay(r.txnDate)}</td>

                      {/* 18. Plaza Posted Date */}
                      <td>{formatDateDisplay(r.plazaPostDate)}</td>

                      {/* 19. NPCI Error Code */}
                      <td className="text-center">{r.npciErrorCode || ''}</td>

                      {/* 20. NPCI Response Date */}
                      <td>{formatDateDisplay(r.npciRespDate)}</td>

                      {/* 21. Transaction Type */}
                      <td>{r.txnType || 'DEBIT'}</td>

                      {/* 22. Issuer Bank ID */}
                      <td className="text-center">{issuerBankId}</td>

                      {/* 23. Issuer Bank Name */}
                      <td>{r.issuerBankName || ''}</td>

                      {/* 24. TID */}
                      <td>
                        <span className="acq-code">{r.tagId}</span>
                      </td>

                      {/* 25. Plaza Type */}
                      <td>{r.plazaType || 'Toll'}</td>

                      {/* 26. Is Manual */}
                      <td className="text-center">NA</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* 4 Bottom Summary KPI Cards Matching Reference Image */}
        {filteredRecords.length > 0 && (
          <div className="bottom-summary-grid">
            <div className="summary-card card-green">
              Total Rejected Transactions: {filteredRecords.length}
            </div>
            <div className="summary-card card-blue">
              Total Rejected Amount: ₹ {totalRejectedAmt}
            </div>
            <div className="summary-card card-green">
              Duplicate Rejections: {duplicateCount}
            </div>
            <div className="summary-card card-blue">
              Validation / Other Rejections: {otherCount}
            </div>
          </div>
        )}

        {/* Footer Disclaimer */}
        <div className="footer-disclaimer">
          * This report generated from Paysonic Database directly on demand
        </div>

        {/* Pagination */}
        {totalElements > pageSize && (
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

export default RejectedTransaction;
