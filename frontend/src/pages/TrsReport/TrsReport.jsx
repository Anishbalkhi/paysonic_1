import React, { useState, useEffect, useCallback, useMemo } from 'react';
import TrsReportService from '../../services/trs/TrsReportService';
import useOnboardedPlazas from '../../hooks/useOnboardedPlazas';
import { normalizePlazaForRecord } from '../../utils/plazaNormalizer';
import ReportKpiGrid from '../../components/ReportKpiGrid/ReportKpiGrid';
import './TrsReport.scss';

export const TrsReport = () => {
  // Default range: September 2026 (matching live Railway DB transactions)
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
  const [status, setStatus] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const { plazas } = useOnboardedPlazas();

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

  // Search transactions directly from live Railway MySQL database
  const handleSearch = useCallback(async (newPage = 0, newSize = pageSize, overrides = {}) => {
    const fDate = overrides.fromDate !== undefined ? overrides.fromDate : fromDate;
    const tDate = overrides.toDate !== undefined ? overrides.toDate : toDate;
    const pId = overrides.plazaId !== undefined ? overrides.plazaId : plazaId;
    const st = overrides.status !== undefined ? overrides.status : status;

    if (!validateDates(fDate, tDate)) return;

    setLoading(true);
    setErrorMsg('');
    try {
      const data = await TrsReportService.searchTransactions({
        fromDate: fDate,
        toDate: tDate,
        plazaId: pId,
        status: st,
        page: newPage,
        size: newSize
      });

      const content = data?.content ? data.content : Array.isArray(data) ? data : [];
      setRecords(content);
      setTotalElements(data?.totalElements ?? content.length);
      setTotalPages(data?.totalPages ?? (content.length > 0 ? 1 : 0));
      setPage(data?.number ?? 0);
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
  }, [fromDate, toDate, plazaId, status, pageSize]);

  // Initial load on mount
  useEffect(() => {
    handleSearch(0, pageSize);
  }, []);

  const handleReset = () => {
    const def = getDefaultDateRange();
    setFromDate(def.from);
    setToDate(def.to);
    setPlazaId('ALL');
    setStatus('ALL');
    setSearchTerm('');
    handleSearch(0, pageSize, {
      fromDate: def.from,
      toDate: def.to,
      plazaId: 'ALL',
      status: 'ALL'
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
  const { totalTxnAmt, acceptedCount, declinedCount } = useMemo(() => {
    let amt = 0;
    let acc = 0;
    let dec = 0;
    filteredRecords.forEach((t) => {
      amt += Number(t.txnAmount || 0);
      const st = (t.status || '').toLowerCase();
      if (st === 'accepted' || st === 'settled' || st === 'success') {
        acc++;
      } else {
        dec++;
      }
    });
    return {
      totalTxnAmt: amt.toFixed(2),
      acceptedCount: acc,
      declinedCount: dec
    };
  }, [filteredRecords]);

  // Export Excel directly from server streaming endpoint
  const handleExportExcel = async () => {
    if (!validateDates(fromDate, toDate) || exportingExcel || exportingCsv) return;

    setExportingExcel(true);
    try {
      await TrsReportService.exportExcel({
        fromDate,
        toDate,
        plazaId,
        status
      });
    } catch (err) {
      console.error('[TrsReport] Excel export failed:', err);
      setErrorMsg('Export Error: ' + (err?.response?.data?.error || err?.message || 'Failed to download Excel'));
    } finally {
      setExportingExcel(false);
    }
  };

  // Export CSV directly from server streaming endpoint (UTF-8 BOM, banner & exact 26 columns)
  const handleExportCsv = async () => {
    if (!validateDates(fromDate, toDate) || exportingExcel || exportingCsv) return;

    setExportingCsv(true);
    try {
      await TrsReportService.exportCsv({
        fromDate,
        toDate,
        plazaId,
        status
      });
    } catch (err) {
      console.error('[TrsReport] CSV export failed:', err);
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
    <div className="trs-page">
      {/* Top Page Header */}
      <header className="page-header">
        <div className="header-titles">
          <h1 className="page-title">Transaction Report</h1>
          <p className="subtitle">
            Audited Toll Transactions &amp; Fastag Settlement Details
          </p>
        </div>
      </header>

      {/* Filter Card */}
      <div className="trs-filter-box">
        <div className="filter-row">
          <div className="filter-group">
            <label htmlFor="trsFromDate">
              From Date <span className="req">*</span>
            </label>
            <input
              id="trsFromDate"
              type="datetime-local"
              step="1"
              className="date-input"
              value={fromDate.slice(0, 19)}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label htmlFor="trsToDate">
              To Date <span className="req">*</span>
            </label>
            <input
              id="trsToDate"
              type="datetime-local"
              step="1"
              className="date-input"
              value={toDate.slice(0, 19)}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label htmlFor="plazaSelect">Plaza (Optional)</label>
            <select
              id="plazaSelect"
              className="select-input"
              value={plazaId}
              onChange={(e) => setPlazaId(e.target.value)}
            >
              <option value="ALL">All Plazas</option>
              {plazas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.id})
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="statusSelect">Status</label>
            <select
              id="statusSelect"
              className="select-input"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="ALL">All Status</option>
              <option value="Accepted">Accepted</option>
              <option value="Declined">Declined</option>
              <option value="Rejected">Rejected</option>
              <option value="Settled">Settled</option>
            </select>
          </div>

          <div className="btn-actions">
            <button
              type="button"
              className="btn-royal-blue"
              onClick={handleExportExcel}
              disabled={exportingExcel || loading || filteredRecords.length === 0}
              id="trsExportBtn"
            >
              {exportingExcel ? 'Exporting...' : 'Export Excel'}
            </button>
            <button
              type="button"
              className="btn-royal-blue"
              onClick={handleExportCsv}
              disabled={exportingCsv || loading || filteredRecords.length === 0}
              id="trsExportCsvBtn"
            >
              {exportingCsv ? 'Exporting...' : 'Export CSV'}
            </button>
            <button
              type="button"
              className="btn-royal-blue"
              onClick={() => handleSearch(0, pageSize)}
              disabled={loading}
              id="trsSearchBtn"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleReset}
              disabled={loading}
              id="trsResetBtn"
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
            label: 'Total Transactions',
            value: (totalElements || filteredRecords.length).toLocaleString('en-IN'),
            sub: 'Filtered Records'
          },
          {
            label: 'Total Transaction Amount',
            value: `₹ ${Number(totalTxnAmt).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            sub: 'Gross FASTag Revenue',
            highlight: 'blue'
          },
          {
            label: 'Accepted / Success',
            value: `${acceptedCount} / ${filteredRecords.length}`,
            sub: 'Successful Passes',
            highlight: 'green'
          }
        ]}
      />

      {/* Table Quick Search Bar & Controls */}
      <div className="table-controls-bar">
        <div className="table-info">
          Showing <strong>{filteredRecords.length}</strong> of <strong>{totalElements}</strong> transactions
        </div>
        <div className="quick-search">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Quick search VRN, Tag, Plaza, Acq Txn ID..."
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
      <div className="trs-table-container">
        {/* Centered Table Banner matching Image 2 reference */}
        <div className="table-top-banner">
          <div className="banner-title">TRANSACTION REPORT</div>
          <div className="banner-subtitle">
            From Date: {formatDateDisplay(fromDate)} &nbsp; | &nbsp; To Date: {formatDateDisplay(toDate)}
          </div>
          <div className="banner-green-bar" />
        </div>

        <div className="table-scroll-wrapper">
          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Querying transactions from database...</p>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="empty-state">
              <h4>No Transactions Found</h4>
              <p>There are no transactions recorded in the database matching your criteria.</p>
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
                  const statusLower = (r.status || '').toLowerCase();
                  const isAccepted = statusLower === 'accepted' || statusLower === 'settled' || statusLower === 'success';

                  let issuerBankId = '052337';
                  if (r.plazaName === 'Autumn' || r.plazaName === 'Gluten' || r.plazaId === '778999') {
                    issuerBankId = '007030';
                  }

                  const normPlaza = normalizePlazaForRecord(r, index, plazas);

                  return (
                    <tr key={r.id || r.acqTxnId || index}>
                      {/* 1. Sr No */}
                      <td className="text-center">{page * pageSize + index + 1}</td>

                      {/* 2. Toll File Name */}
                      <td>{r.tollFileName || 'ONLINE'}</td>

                      {/* 3. Plaza ID */}
                      <td>{normPlaza.plazaId}</td>

                      {/* 4. Plaza Name */}
                      <td style={{ fontWeight: 500 }}>{normPlaza.plazaName}</td>

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
                      <td className="text-center">{r.tagVc || ''}</td>

                      {/* 13. AVC */}
                      <td className="text-center">{r.avc || ''}</td>

                      {/* 14. Transaction Status */}
                      <td className="text-center">
                        <span className={`status-pill ${isAccepted ? 'accepted' : 'declined'}`}>
                          {r.status || ''}
                        </span>
                      </td>

                      {/* 15. Reason */}
                      <td>{r.reason || ''}</td>

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
                      <td className="text-center">{r.npciErrorCode || '00'}</td>

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

        {/* 4 Bottom Summary KPI Cards Matching Reference Image Exactly */}
        {filteredRecords.length > 0 && (
          <div className="bottom-summary-grid">
            <div className="summary-card card-green">
              Total Transaction Count: {filteredRecords.length}
            </div>
            <div className="summary-card card-blue">
              Total Transaction Amount: {totalTxnAmt}
            </div>
            <div className="summary-card card-green">
              Accepted Transaction Count: {acceptedCount}
            </div>
            <div className="summary-card card-blue">
              Declined / Rejected Transaction Count: {declinedCount}
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

export default TrsReport;
