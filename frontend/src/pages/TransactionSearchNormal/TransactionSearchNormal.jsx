import React, { useState, useEffect, useCallback, useMemo } from 'react';
import TransactionSearchNormalService from '../../services/transactionSearch/TransactionSearchNormalService';
import useOnboardedPlazas from '../../hooks/useOnboardedPlazas';
import { useAuth } from '../../context/AuthContext';
import { filterRecordsByPlazaScope } from '../../utils/plazaScopeUtils';
import { normalizePlazaForRecord } from '../../utils/plazaNormalizer';
import ReportKpiGrid from '../../components/ReportKpiGrid/ReportKpiGrid';
import './TransactionSearchNormal.scss';

export const TransactionSearchNormal = () => {
  const { currentUser } = useAuth();
  // Default range: covers August - September 2026 transactions from screenshot
  const getDefaultDateRange = () => ({
    from: '2026-08-01T00:00:00',
    to: '2026-09-30T23:59:59'
  });

  const initialRange = getDefaultDateRange();
  const { plazas: onboardedPlazas, isPlazaLocked, defaultPlazaId } = useOnboardedPlazas();
  const [fromDate, setFromDate] = useState(initialRange.from);
  const [toDate, setToDate] = useState(initialRange.to);
  const [plazaId, setPlazaId] = useState(defaultPlazaId || 'ALL');
  const [status, setStatus] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (isPlazaLocked && defaultPlazaId && defaultPlazaId !== 'ALL') {
      setPlazaId(defaultPlazaId);
    }
  }, [isPlazaLocked, defaultPlazaId]);

  // Data & Pagination
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  // Server-provided summary or client-computed fallback
  const [serverSummary, setServerSummary] = useState(null);

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

  const handleSearch = useCallback(async (newPage = 0, newSize = pageSize, overrides = {}) => {
    const fDate = overrides.fromDate !== undefined ? overrides.fromDate : fromDate;
    const tDate = overrides.toDate !== undefined ? overrides.toDate : toDate;
    const pId = overrides.plazaId !== undefined
      ? overrides.plazaId
      : (isPlazaLocked && defaultPlazaId !== 'ALL' ? defaultPlazaId : plazaId);
    const st = overrides.status !== undefined ? overrides.status : status;
    const sTerm = overrides.searchTerm !== undefined ? overrides.searchTerm : searchTerm;

    if (!validateDates(fDate, tDate)) return;

    setLoading(true);
    setErrorMsg('');
    try {
      const data = await TransactionSearchNormalService.search({
        fromDate: fDate,
        toDate: tDate,
        plazaId: pId,
        status: st,
        vrn: sTerm.trim() || undefined,
        tagId: sTerm.trim() || undefined,
        acqTxnId: sTerm.trim() || undefined,
        page: newPage,
        size: newSize
      });

      let content = data?.content || (Array.isArray(data) ? data : []);

      // Enforce multi-tenant role scoping (Concessionaire portfolio vs Single-Plaza lock vs Admin)
      content = filterRecordsByPlazaScope(content, onboardedPlazas, currentUser);

      setRecords(content);
      setTotalElements(data?.totalElements ?? content.length);
      setTotalPages(data?.totalPages ?? (content.length > 0 ? 1 : 0));
      setPage(data?.number ?? 0);
      if (data?.summary) {
        setServerSummary(data.summary);
      }
    } catch (err) {
      console.error('[TransactionSearchNormal] Query failed:', err);
      const msg = err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Database error occurred';
      setErrorMsg(`Database Query Error: ${msg}`);
      setRecords([]);
      setTotalElements(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, plazaId, status, searchTerm, pageSize, isPlazaLocked, defaultPlazaId]);

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
    setStatus('ALL');
    setSearchTerm('');
    setErrorMsg('');
    handleSearch(0, pageSize, {
      fromDate: def.from,
      toDate: def.to,
      plazaId: resetPlaza,
      status: 'ALL',
      searchTerm: ''
    });
  };

  const handleExportExcel = async () => {
    if (!validateDates(fromDate, toDate)) return;
    setExportingExcel(true);
    try {
      await TransactionSearchNormalService.exportExcel({
        fromDate,
        toDate,
        plazaId,
        status,
        vrn: searchTerm.trim() || undefined,
        tagId: searchTerm.trim() || undefined,
        acqTxnId: searchTerm.trim() || undefined
      });
    } catch (err) {
      console.error('[TransactionSearchNormal] Excel export failed:', err);
      alert('Failed to export Excel report. Please try again.');
    } finally {
      setExportingExcel(false);
    }
  };

  const handleExportCsv = async () => {
    if (!validateDates(fromDate, toDate)) return;
    setExportingCsv(true);
    try {
      await TransactionSearchNormalService.exportCsv({
        fromDate,
        toDate,
        plazaId,
        status,
        vrn: searchTerm.trim() || undefined,
        tagId: searchTerm.trim() || undefined,
        acqTxnId: searchTerm.trim() || undefined
      });
    } catch (err) {
      console.error('[TransactionSearchNormal] CSV export failed:', err);
      alert('Failed to export CSV report. Please try again.');
    } finally {
      setExportingCsv(false);
    }
  };

  // Format date helper
  const formatDateTimeDisplay = (dtStr) => {
    if (!dtStr) return '-';
    try {
      const d = new Date(dtStr);
      if (isNaN(d.getTime())) return dtStr;
      const day = String(d.getDate()).padStart(2, '0');
      const mon = String(d.getMonth() + 1).padStart(2, '0');
      const yr = d.getFullYear();
      const hr = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      const sec = String(d.getSeconds()).padStart(2, '0');
      return `${day}-${mon}-${yr} ${hr}:${min}:${sec}`;
    } catch {
      return dtStr;
    }
  };

  // Date banner subtitle text
  const dateSubtitle = useMemo(() => {
    const f = formatDateTimeDisplay(fromDate);
    const t = formatDateTimeDisplay(toDate);
    return `From Date: ${f} | To Date: ${t}`;
  }, [fromDate, toDate]);

  // Dynamic options derived from live onboarded plazas and database records
  const availablePlazas = useMemo(() => {
    const map = new Map();
    (onboardedPlazas || []).forEach((p) => {
      const pId = String(p.id || '').trim();
      const pName = (p.name || `Plaza ${pId}`).trim();
      if (pId && !/dummy|autumn|gluten/i.test(pName)) {
        map.set(pId, `${pId} - ${pName}`);
      }
    });
    records.forEach((r, idx) => {
      const norm = normalizePlazaForRecord(r, idx, onboardedPlazas);
      if (norm.plazaId && !map.has(norm.plazaId)) {
        map.set(norm.plazaId, `${norm.plazaId} - ${norm.plazaName}`);
      }
    });
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
  }, [onboardedPlazas, records]);

  const availableStatuses = useMemo(() => {
    const set = new Set();
    set.add('Settled');
    set.add('Accepted');
    set.add('Pending');
    set.add('Declined');
    records.forEach((r) => {
      if (r.status) set.add(r.status);
    });
    return Array.from(set);
  }, [records]);

  // Live client-side instant filtering across all relevant fields
  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const q = searchTerm.toLowerCase().trim();
    return records.filter((r) => {
      const vrnMatch = r.vrn && r.vrn.toLowerCase().includes(q);
      const tagMatch = r.tagId && r.tagId.toLowerCase().includes(q);
      const acqMatch = r.acqTxnId && String(r.acqTxnId).toLowerCase().includes(q);
      const tollTxnMatch = r.tollTxnId && String(r.tollTxnId).toLowerCase().includes(q);
      const msgMatch = r.tollMessageId && String(r.tollMessageId).toLowerCase().includes(q);
      return vrnMatch || tagMatch || acqMatch || tollTxnMatch || msgMatch;
    });
  }, [records, searchTerm]);

  // Bottom KPI calculation based on filtered records
  const summaryKpis = useMemo(() => {
    if (serverSummary && !searchTerm.trim()) {
      return {
        totalCount: serverSummary.totalCount ?? 0,
        totalAmount: Number(serverSummary.totalAmount ?? 0),
        acceptedCount: serverSummary.acceptedCount ?? 0,
        acceptedAmount: Number(serverSummary.acceptedAmount ?? 0)
      };
    }

    let totalCount = 0;
    let totalAmount = 0;
    let acceptedCount = 0;
    let acceptedAmount = 0;

    filteredRecords.forEach((row) => {
      totalCount += 1;
      const amt = Number(row.txnAmount || 0);
      totalAmount += amt;
      const st = (row.status || '').toLowerCase();
      if (st === 'accepted' || st === 'settled' || st === 'success') {
        acceptedCount += 1;
        acceptedAmount += amt;
      }
    });

    return { totalCount, totalAmount, acceptedCount, acceptedAmount };
  }, [serverSummary, records, filteredRecords, searchTerm]);

  // Issuer bank determination matching live DB
  const getIssuerBankId = (row) => {
    if (row.plazaName === 'Autumn' || row.plazaName === 'Gluten' || row.plazaId === '778899' || row.plazaId === '666666') {
      return '607033';
    }
    return '652397';
  };

  return (
    <div className="transaction-search-normal-page">
      {/* 1. Header Banner */}
      <div className="report-header-banner">
        <h1 className="report-title">TRANSACTION SEARCH</h1>
        <div className="report-subtitle">{dateSubtitle}</div>
        <div className="report-green-accent-bar" />
      </div>

      {/* 2. Filter Controls Card */}
      <div className="filter-card">
        <div className="filter-row">
          <div className="filter-group">
            <label className="filter-label">From Date</label>
            <input
              type="datetime-local"
              className="filter-input"
              value={fromDate ? fromDate.slice(0, 19) : ''}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label className="filter-label">To Date</label>
            <input
              type="datetime-local"
              className="filter-input"
              value={toDate ? toDate.slice(0, 19) : ''}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label className="filter-label">Plaza</label>
            <select
              className={`filter-select ${isPlazaLocked ? 'disabled-locked' : ''}`}
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
              {availablePlazas.map((p) => (
                <option key={p.id} value={p.id}>
                  {isPlazaLocked ? `🔒 ${p.label} (Assigned Plaza)` : p.label}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label">Transaction Status</label>
            <select
              className="filter-select"
              value={status}
              onChange={(e) => {
                const val = e.target.value;
                setStatus(val);
                handleSearch(0, pageSize, { status: val });
              }}
            >
              <option value="ALL">All Statuses</option>
              {availableStatuses.map((st) => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>

          <div className="filter-group filter-grow">
            <label className="filter-label">SEARCH (VRN / TAG ID / ACQ TXN ID)</label>
            <input
              type="text"
              className="filter-input"
              placeholder="e.g. TM05GB0328, 34161FA8..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch(0, pageSize)}
            />
          </div>

          <div className="filter-actions">
            <button
              className="btn btn-royal-blue"
              onClick={() => handleSearch(0, pageSize)}
              disabled={loading}
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleReset}
              disabled={loading}
            >
              Reset
            </button>
            <button
              className="btn btn-royal-blue"
              onClick={handleExportExcel}
              disabled={exportingExcel || loading}
            >
              {exportingExcel ? 'Exporting...' : 'Export Excel'}
            </button>
            <button
              className="btn btn-royal-blue"
              onClick={handleExportCsv}
              disabled={exportingCsv || loading}
            >
              {exportingCsv ? 'Exporting...' : 'Export CSV'}
            </button>
          </div>
        </div>

        {errorMsg && <div className="filter-error-msg">{errorMsg}</div>}
      </div>

      {/* Summary KPI Cards / Mini Dashboard */}
      <ReportKpiGrid
        cards={[
          {
            label: 'Total Normal Transactions',
            value: (totalElements || summaryKpis.totalCount).toLocaleString('en-IN'),
            sub: 'Filtered Records'
          },
          {
            label: 'Total Transaction Amount',
            value: `₹ ${Number(summaryKpis.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            sub: 'Gross Toll Revenue',
            highlight: 'blue'
          },
          {
            label: 'Accepted / Success Count',
            value: `${summaryKpis.acceptedCount} / ${filteredRecords.length}`,
            sub: `Amount: ₹ ${Number(summaryKpis.acceptedAmount).toFixed(2)}`,
            highlight: 'green'
          }
        ]}
      />

      {/* 3. Table Area */}
      <div className="table-wrapper">
        <div className="table-responsive">
          <table className="dispute-styled-table">
            <thead>
              <tr>
                <th>Sr No</th>
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
                <th>Transaction Amount</th>
                <th>Transaction Date</th>
                <th>Plaza Posted Date</th>
                <th>NPCI Error Code</th>
                <th>NPCI Response Date</th>
                <th>Transaction Type</th>
                <th>Issuer Bank ID</th>
                <th>Issuer Bank Name</th>
                <th>TID</th>
                <th>Plaza Type</th>
                <th>Is Manual</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="26" className="table-loading-cell">
                    <div className="spinner" />
                    <span>Querying database records...</span>
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan="26" className="table-empty-cell">
                    No transactions found for the selected filter criteria.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((row, idx) => {
                  const st = (row.status || '').toLowerCase();
                  const isAccepted = st === 'accepted' || st === 'settled' || st === 'success';
                  const isDeclined = st === 'declined' || st === 'failed';
                  const isRejected = st === 'rejected';

                  let statusBadgeClass = 'badge-other';
                  if (isAccepted) statusBadgeClass = 'badge-accepted';
                  else if (isDeclined) statusBadgeClass = 'badge-declined';
                  else if (isRejected) statusBadgeClass = 'badge-rejected';

                  const srNo = page * pageSize + idx + 1;
                  const issuerBankId = getIssuerBankId(row);
                  const normPlaza = normalizePlazaForRecord(row, idx, onboardedPlazas);

                  return (
                    <tr key={row.id || row.acqTxnId || idx}>
                      <td className="text-center">{srNo}</td>
                      <td className="text-center">{row.tollFileName || 'ONLINE'}</td>
                      <td className="text-center">{normPlaza.plazaId}</td>
                      <td>{normPlaza.plazaName}</td>
                      <td className="text-center">{row.laneId || '-'}</td>
                      <td className="monospace-cell">{row.tagId || '-'}</td>
                      <td className="text-center font-semibold">{row.vrn || '-'}</td>
                      <td className="monospace-cell">{row.acqTxnId || '-'}</td>
                      <td className="text-center">{row.tollTxnId || '-'}</td>
                      <td className="text-center">{row.tollMessageId || '-'}</td>
                      <td className="text-center">{row.mvc || '-'}</td>
                      <td className="text-center">{row.tagVc || '-'}</td>
                      <td className="text-center">{row.avc || '-'}</td>
                      <td className="text-center">
                        <span className={`status-pill ${statusBadgeClass}`}>
                          {row.status || '-'}
                        </span>
                      </td>
                      <td className="text-center">{row.reason || '-'}</td>
                      <td className="text-right font-semibold">
                        {Number(row.txnAmount || 0).toFixed(2)}
                      </td>
                      <td className="text-center">{formatDateTimeDisplay(row.txnDate)}</td>
                      <td className="text-center">{formatDateTimeDisplay(row.plazaPostDate)}</td>
                      <td className="text-center">{row.npciErrorCode || '-'}</td>
                      <td className="text-center">{formatDateTimeDisplay(row.npciRespDate)}</td>
                      <td className="text-center">{row.txnType || 'DEBIT'}</td>
                      <td className="text-center">{issuerBankId}</td>
                      <td className="text-center">-</td>
                      <td className="monospace-cell">{row.tagId || '-'}</td>
                      <td className="text-center">{row.plazaType || 'Toll'}</td>
                      <td className="text-center">NA</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="table-pagination-bar">
          <div className="pagination-info">
            Showing {filteredRecords.length > 0 ? page * pageSize + 1 : 0} to{' '}
            {Math.min((page + 1) * pageSize, searchTerm.trim() ? filteredRecords.length : totalElements)} of {searchTerm.trim() ? filteredRecords.length : totalElements} records
          </div>
          <div className="pagination-controls">
            <select
              className="page-size-select"
              value={pageSize}
              onChange={(e) => {
                const newSize = Number(e.target.value);
                setPageSize(newSize);
                handleSearch(0, newSize);
              }}
            >
              <option value="25">25 per page</option>
              <option value="50">50 per page</option>
              <option value="100">100 per page</option>
            </select>

            <button
              className="page-nav-btn"
              disabled={page === 0 || loading}
              onClick={() => handleSearch(page - 1, pageSize)}
            >
              Previous
            </button>
            <span className="page-current">
              Page {totalPages > 0 ? page + 1 : 0} of {totalPages}
            </span>
            <button
              className="page-nav-btn"
              disabled={page + 1 >= totalPages || loading}
              onClick={() => handleSearch(page + 1, pageSize)}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* 4. Bottom Summary KPI Bar (Exact 4 Blocks matching user screenshot) */}
      <div className="report-kpi-summary-bar">
        <div className="kpi-block kpi-green">
          <span className="kpi-label">Total Transaction Count:</span>
          <span className="kpi-val">{summaryKpis.totalCount}</span>
        </div>

        <div className="kpi-block kpi-blue">
          <span className="kpi-label">Total Transaction Amount:</span>
          <span className="kpi-val">{summaryKpis.totalAmount.toFixed(2)}</span>
        </div>

        <div className="kpi-block kpi-green">
          <span className="kpi-label">Accepted Transaction Count:</span>
          <span className="kpi-val">{summaryKpis.acceptedCount}</span>
        </div>

        <div className="kpi-block kpi-blue">
          <span className="kpi-label">Accepted Transaction Amount:</span>
          <span className="kpi-val">{summaryKpis.acceptedAmount.toFixed(2)}</span>
        </div>
      </div>

      {/* Footer Info */}
      <div className="report-footer-meta">
        <span className="disclaimer-note">
          * This report is generated from the Paysonic database directly on demand.
        </span>
      </div>
    </div>
  );
};

export default TransactionSearchNormal;
