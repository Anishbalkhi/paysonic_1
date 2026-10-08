import React, { useState, useEffect, useCallback, useMemo } from 'react';
import TransactionSearchDisputeService from '../../services/transactionSearch/TransactionSearchDisputeService';
import useOnboardedPlazas from '../../hooks/useOnboardedPlazas';
import { useAuth } from '../../context/AuthContext';
import { filterRecordsByPlazaScope } from '../../utils/plazaScopeUtils';
import { normalizePlazaForRecord } from '../../utils/plazaNormalizer';
import ReportKpiGrid from '../../components/ReportKpiGrid/ReportKpiGrid';
import './TransactionSearchDispute.scss';

export const TransactionSearchDispute = () => {
  const { currentUser } = useAuth();
  // Default range: September 2026 (matching live Railway DB seed data)
  const getDefaultDateRange = () => {
    return {
      from: '2026-09-01T00:00:00',
      to: '2026-09-30T23:59:59'
    };
  };

  const initialRange = getDefaultDateRange();
  const { plazas, isPlazaLocked, defaultPlazaId } = useOnboardedPlazas();
  const [fromDate, setFromDate] = useState(initialRange.from);
  const [toDate, setToDate] = useState(initialRange.to);
  const [plazaId, setPlazaId] = useState(defaultPlazaId || 'ALL');
  const [functionCode, setFunctionCode] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (isPlazaLocked && defaultPlazaId && defaultPlazaId !== 'ALL') {
      setPlazaId(defaultPlazaId);
    }
  }, [isPlazaLocked, defaultPlazaId]);

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

  // Search dispute transactions from live Railway MySQL database
  const handleSearch = useCallback(async (newPage = 0, newSize = pageSize, overrides = {}) => {
    const fDate = overrides.fromDate !== undefined ? overrides.fromDate : fromDate;
    const tDate = overrides.toDate !== undefined ? overrides.toDate : toDate;
    const pId = overrides.plazaId !== undefined
      ? overrides.plazaId
      : (isPlazaLocked && defaultPlazaId !== 'ALL' ? defaultPlazaId : plazaId);
    const fCode = overrides.functionCode !== undefined ? overrides.functionCode : functionCode;

    if (!validateDates(fDate, tDate)) return;

    setLoading(true);
    setErrorMsg('');
    try {
      const data = await TransactionSearchDisputeService.searchDisputes({
        fromDate: fDate,
        toDate: tDate,
        plazaId: pId,
        functionCode: fCode,
        page: newPage,
        size: newSize
      });

      let content = data?.content ? data.content : Array.isArray(data) ? data : [];

      // Enforce multi-tenant role scoping (Concessionaire portfolio vs Single-Plaza lock vs Admin)
      content = filterRecordsByPlazaScope(content, plazas, currentUser);

      setRecords(content);
      setTotalElements(data?.totalElements ?? content.length);
      setTotalPages(data?.totalPages ?? (content.length > 0 ? 1 : 0));
      setPage(data?.number ?? 0);
    } catch (err) {
      console.error('[TransactionSearchDispute] Database query failed:', err);
      const msg = err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Database error occurred';
      setErrorMsg(`Database Query Error: ${msg}`);
      setRecords([]);
      setTotalElements(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, plazaId, functionCode, pageSize, isPlazaLocked, defaultPlazaId]);

  // Initial load on mount & when scope changes
  useEffect(() => {
    handleSearch(0, pageSize, {
      plazaId: isPlazaLocked ? defaultPlazaId : plazaId
    });
  }, [isPlazaLocked, defaultPlazaId]);

  const handleReset = () => {
    const def = getDefaultDateRange();
    const resetPlaza = isPlazaLocked ? defaultPlazaId : 'ALL';
    setFromDate(def.from);
    setToDate(def.to);
    setPlazaId(resetPlaza);
    setFunctionCode('ALL');
    setSearchTerm('');
    handleSearch(0, pageSize, {
      fromDate: def.from,
      toDate: def.to,
      plazaId: resetPlaza,
      functionCode: 'ALL'
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
      (r.vehicleNo && r.vehicleNo.toLowerCase().includes(q)) ||
      (r.tagId && r.tagId.toLowerCase().includes(q)) ||
      (r.functionCode && r.functionCode.toLowerCase().includes(q)) ||
      (r.memberMessageText && r.memberMessageText.toLowerCase().includes(q))
    );
  }, [records, searchTerm]);

  // Summary Metrics calculation for bottom cards
  const { totalTxnAmt, totalDisputeAmt } = useMemo(() => {
    let tAmt = 0;
    let dAmt = 0;
    filteredRecords.forEach((d) => {
      tAmt += Number(d.txnAmount || 0);
      dAmt += Number(d.disputeAmount || 0);
    });
    return {
      totalTxnAmt: tAmt.toFixed(2),
      totalDisputeAmt: dAmt.toFixed(2)
    };
  }, [filteredRecords]);

  // Export Excel directly from server streaming endpoint
  const handleExportExcel = async () => {
    if (!validateDates(fromDate, toDate) || exportingExcel || exportingCsv) return;

    setExportingExcel(true);
    try {
      await TransactionSearchDisputeService.exportExcel({
        fromDate,
        toDate,
        plazaId,
        functionCode
      });
    } catch (err) {
      console.error('[TransactionSearchDispute] Excel export failed:', err);
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
      await TransactionSearchDisputeService.exportCsv({
        fromDate,
        toDate,
        plazaId,
        functionCode
      });
    } catch (err) {
      console.error('[TransactionSearchDispute] CSV export failed:', err);
      setErrorMsg('Export Error: ' + (err?.response?.data?.error || err?.message || 'Failed to download CSV'));
    } finally {
      setExportingCsv(false);
    }
  };

  // Date formatters
  const formatDateTimeDisplay = (dateVal) => {
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

  const formatDateDisplay = (dateVal) => {
    if (!dateVal) return '';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return dateVal;
      const pad = (n) => String(n).padStart(2, '0');
      return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
    } catch {
      return dateVal;
    }
  };

  const extractCode = (desc) => {
    if (!desc) return '';
    const colonIdx = desc.indexOf(':');
    return colonIdx > 0 ? desc.substring(0, colonIdx).trim() : desc.trim();
  };

  return (
    <div className="search-dispute-page">
      {/* Top Page Header */}
      <header className="page-header">
        <div className="header-titles">
          <h1 className="page-title">Dispute Detail Report</h1>
          <p className="subtitle">
            Audited Dispute Transactions &amp; Adjustments
          </p>
        </div>
      </header>

      {/* Filter Card */}
      <div className="filter-box">
        <div className="filter-row">
          <div className="filter-group">
            <label htmlFor="dispFromDate">
              From Date <span className="req">*</span>
            </label>
            <input
              id="dispFromDate"
              type="datetime-local"
              step="1"
              className="date-input"
              value={fromDate.slice(0, 19)}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label htmlFor="dispToDate">
              To Date <span className="req">*</span>
            </label>
            <input
              id="dispToDate"
              type="datetime-local"
              step="1"
              className="date-input"
              value={toDate.slice(0, 19)}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label htmlFor="dispPlazaSelect">Plaza (Optional)</label>
            <select
              id="dispPlazaSelect"
              className={`select-input ${isPlazaLocked ? 'disabled-locked' : ''}`}
              value={plazaId}
              disabled={isPlazaLocked}
              onChange={(e) => {
                const val = e.target.value;
                setPlazaId(val);
                handleSearch(0, pageSize, { plazaId: val });
              }}
            >
              {!isPlazaLocked && (
                <option value="ALL">
                  {currentUser?.role === 'Concessionaire' ? 'All Portfolio Plazas' : 'All Plazas'}
                </option>
              )}
              {plazas.map((p) => (
                <option key={p.id} value={p.id}>
                  {isPlazaLocked ? `🔒 ${p.name} (${p.id}) [Assigned Plaza]` : `${p.name} (${p.id})`}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="dispFuncSelect">Function Code</label>
            <select
              id="dispFuncSelect"
              className="select-input"
              value={functionCode}
              onChange={(e) => setFunctionCode(e.target.value)}
            >
              <option value="ALL">All Codes</option>
              <option value="753: Debit Adjustment">753: Debit Adjustment</option>
              <option value="762: Credit Adjustment">762: Credit Adjustment</option>
            </select>
          </div>

          <div className="btn-actions">
            <button
              type="button"
              className="btn-royal-blue"
              onClick={handleExportExcel}
              disabled={exportingExcel || loading || filteredRecords.length === 0}
              id="dispExportExcelBtn"
            >
              {exportingExcel ? 'Exporting...' : 'Export Excel'}
            </button>
            <button
              type="button"
              className="btn-royal-blue"
              onClick={handleExportCsv}
              disabled={exportingCsv || loading || filteredRecords.length === 0}
              id="dispExportCsvBtn"
            >
              {exportingCsv ? 'Exporting...' : 'Export CSV'}
            </button>
            <button
              type="button"
              className="btn-royal-blue"
              onClick={() => handleSearch(0, pageSize)}
              disabled={loading}
              id="dispSearchBtn"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleReset}
              disabled={loading}
              id="dispResetBtn"
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
            label: 'Total Disputes',
            value: (totalElements || filteredRecords.length).toLocaleString('en-IN'),
            sub: 'Filtered Records'
          },
          {
            label: 'Total Transaction Amount',
            value: `₹ ${Number(totalTxnAmt).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            sub: 'Gross FASTag Toll Value',
            highlight: 'blue'
          },
          {
            label: 'Total Dispute Amount',
            value: `₹ ${Number(totalDisputeAmt).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            sub: 'Adjusted / Chargebacked',
            highlight: 'purple'
          }
        ]}
      />

      {/* Table Quick Search Bar & Controls */}
      <div className="table-controls-bar">
        <div className="table-info">
          Showing <strong>{filteredRecords.length}</strong> of <strong>{totalElements}</strong> dispute transactions
        </div>
        <div className="quick-search">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Quick search Vehicle, Tag, Plaza, Function..."
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
          <div className="banner-title">DISPUTE DETAIL REPORT</div>
          <div className="banner-subtitle">
            From Date: {formatDateTimeDisplay(fromDate)} &nbsp; | &nbsp; To Date: {formatDateTimeDisplay(toDate)}
          </div>
          <div className="banner-green-bar" />
        </div>

        <div className="table-scroll-wrapper">
          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Querying dispute transactions from database...</p>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="empty-state">
              <h4>No Dispute Transactions Found</h4>
              <p>There are no dispute records in the database matching your criteria.</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th className="text-center">Sr No</th>
                  <th>Plaza Name</th>
                  <th>Plaza ID</th>
                  <th>Acq Txn ID</th>
                  <th>Toll Txn ID</th>
                  <th>Txn Date Time</th>
                  <th className="text-right">Txn Amount</th>
                  <th className="text-right">Dispute Amount</th>
                  <th>Vehicle No</th>
                  <th>Tag ID</th>
                  <th>TID</th>
                  <th>Issuer ID</th>
                  <th>Int Tracking No</th>
                  <th>Function Code</th>
                  <th className="text-center">Settlement Indicator</th>
                  <th>Message Reason Code</th>
                  <th>Member Message Text</th>
                  <th>NPCI Settlement Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((d, index) => {
                  const funcDesc = d.functionCode || '';
                  const funcCode = extractCode(funcDesc);
                  const ind = (d.settlementIndicator || '').trim();

                  const normPlaza = normalizePlazaForRecord(d, index, plazas);

                  return (
                    <tr key={d.id || index}>
                      {/* 1. Sr No */}
                      <td className="text-center">{page * pageSize + index + 1}</td>

                      {/* 2. Plaza Name */}
                      <td style={{ fontWeight: 600 }}>{normPlaza.plazaName}</td>

                      {/* 3. Plaza ID */}
                      <td className="code-font text-center">{normPlaza.plazaId}</td>

                      {/* 4. Acq Txn ID */}
                      <td>
                        <span className="acq-code">{d.acqTxnId}</span>
                      </td>

                      {/* 5. Toll Txn ID */}
                      <td className="code-font text-center">{d.tollTxnId}</td>

                      {/* 6. Txn Date Time */}
                      <td>{formatDateTimeDisplay(d.txnDateTime)}</td>

                      {/* 7. Txn Amount */}
                      <td className="text-right font-bold">
                        {d.txnAmount !== null && d.txnAmount !== undefined
                          ? Number(d.txnAmount).toFixed(2)
                          : '0.00'}
                      </td>

                      {/* 8. Dispute Amount */}
                      <td className="text-right font-bold dispute-amount-cell">
                        {d.disputeAmount !== null && d.disputeAmount !== undefined
                          ? Number(d.disputeAmount).toFixed(2)
                          : '0.00'}
                      </td>

                      {/* 9. Vehicle No */}
                      <td className="code-font" style={{ fontWeight: 600 }}>{d.vehicleNo}</td>

                      {/* 10. Tag ID */}
                      <td>
                        <span className="acq-code">{d.tagId}</span>
                      </td>

                      {/* 11. TID */}
                      <td>
                        <span className="acq-code">{d.tid}</span>
                      </td>

                      {/* 12. Issuer ID */}
                      <td className="text-center code-font">{d.issuerId}</td>

                      {/* 13. Int Tracking No */}
                      <td className="text-center">{d.intTrackingNo || 'NA'}</td>

                      {/* 14. Function Code */}
                      <td className="font-semibold">
                        {funcDesc || funcCode}
                      </td>

                      {/* 15. Settlement Indicator */}
                      <td className="text-center">
                        <span className={`settle-badge ${ind.toLowerCase()}`}>
                          {ind || '--'}
                        </span>
                      </td>

                      {/* 17. Message Reason Code */}
                      <td className="text-center">{d.messageReasonCode || ''}</td>

                      {/* 18. Member Message Text */}
                      <td className="msg-text-cell" title={d.memberMessageText}>
                        {d.memberMessageText || ''}
                      </td>

                      {/* 19. NPCI Settlement Date */}
                      <td className="text-center">{formatDateDisplay(d.npciSettlementDate)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* 4 Bottom Summary KPI Cards Matching Reference Design */}
        {filteredRecords.length > 0 && (
          <div className="bottom-summary-grid">
            <div className="summary-card card-green">
              Total Dispute Records: {filteredRecords.length}
            </div>
            <div className="summary-card card-blue">
              Total Txn Amount: ₹ {totalTxnAmt}
            </div>
            <div className="summary-card card-green">
              Total Dispute Amount: ₹ {totalDisputeAmt}
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

export default TransactionSearchDispute;
