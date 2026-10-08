import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ViolationSettlementService from '../../services/violation/ViolationSettlementService';
import useOnboardedPlazas from '../../hooks/useOnboardedPlazas';
import { useAuth } from '../../context/AuthContext';
import { filterRecordsByPlazaScope } from '../../utils/plazaScopeUtils';
import { normalizePlazaForRecord } from '../../utils/plazaNormalizer';
import ReportKpiGrid from '../../components/ReportKpiGrid/ReportKpiGrid';
import './ViolationSettlementReport.scss';

export const ViolationSettlementReport = () => {
  const { currentUser } = useAuth();
  // Default range: August 2026 to September 2026 covering screenshot records
  const getDefaultDateRange = () => ({
    from: '2026-08-01T00:00:00',
    to: '2026-09-30T23:59:59'
  });

  const initialRange = getDefaultDateRange();
  const [fromDate, setFromDate] = useState(initialRange.from);
  const [toDate, setToDate] = useState(initialRange.to);
  const { plazas: onboardedPlazas, isPlazaLocked, defaultPlazaId, assignedPlaza } = useOnboardedPlazas();
  const [plazaId, setPlazaId] = useState(isPlazaLocked ? (defaultPlazaId || 'ALL') : 'ALL');
  const [status, setStatus] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (isPlazaLocked && defaultPlazaId && plazaId !== defaultPlazaId) {
      setPlazaId(defaultPlazaId);
    }
  }, [isPlazaLocked, defaultPlazaId, plazaId]);

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
      : (isPlazaLocked && defaultPlazaId && defaultPlazaId !== 'ALL' ? defaultPlazaId : plazaId);
    const st = overrides.status !== undefined ? overrides.status : status;
    const sTerm = overrides.searchTerm !== undefined ? overrides.searchTerm : searchTerm;

    if (!validateDates(fDate, tDate)) return;

    setLoading(true);
    setErrorMsg('');
    try {
      const data = await ViolationSettlementService.search({
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
      content = filterRecordsByPlazaScope(content, onboardedPlazas, currentUser);
      setRecords(content);
      setTotalElements(data?.totalElements ?? content.length);
      setTotalPages(data?.totalPages ?? (content.length > 0 ? 1 : 0));
      setPage(data?.number ?? 0);
      if (data?.summary) {
        setServerSummary(data.summary);
      }
    } catch (err) {
      console.error('[ViolationSettlementReport] Query failed:', err);
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
    handleSearch(0, pageSize);
  }, [handleSearch]);

  const handleReset = () => {
    const def = getDefaultDateRange();
    const targetPlaza = isPlazaLocked ? (defaultPlazaId || 'ALL') : 'ALL';
    setFromDate(def.from);
    setToDate(def.to);
    setPlazaId(targetPlaza);
    setStatus('ALL');
    setSearchTerm('');
    setErrorMsg('');
    handleSearch(0, pageSize, {
      fromDate: def.from,
      toDate: def.to,
      plazaId: targetPlaza,
      status: 'ALL',
      searchTerm: ''
    });
  };

  const handleExportExcel = async () => {
    if (!validateDates(fromDate, toDate)) return;
    setExportingExcel(true);
    try {
      await ViolationSettlementService.exportExcel({
        fromDate,
        toDate,
        plazaId,
        status,
        vrn: searchTerm.trim() || undefined,
        tagId: searchTerm.trim() || undefined,
        acqTxnId: searchTerm.trim() || undefined
      });
    } catch (err) {
      console.error('[ViolationSettlementReport] Excel export failed:', err);
      alert('Failed to export Excel report. Please try again.');
    } finally {
      setExportingExcel(false);
    }
  };

  const handleExportCsv = async () => {
    if (!validateDates(fromDate, toDate)) return;
    setExportingCsv(true);
    try {
      await ViolationSettlementService.exportCsv({
        fromDate,
        toDate,
        plazaId,
        status,
        vrn: searchTerm.trim() || undefined,
        tagId: searchTerm.trim() || undefined,
        acqTxnId: searchTerm.trim() || undefined
      });
    } catch (err) {
      console.error('[ViolationSettlementReport] CSV export failed:', err);
      alert('Failed to export CSV report. Please try again.');
    } finally {
      setExportingCsv(false);
    }
  };

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

  const formatDateDisplay = (dStr) => {
    if (!dStr) return '';
    try {
      const d = new Date(dStr);
      if (isNaN(d.getTime())) return dStr;
      const day = String(d.getDate()).padStart(2, '0');
      const mon = String(d.getMonth() + 1).padStart(2, '0');
      const yr = d.getFullYear();
      return `${day}-${mon}-${yr}`;
    } catch {
      return dStr;
    }
  };

  const dateSubtitle = useMemo(() => {
    const f = formatDateTimeDisplay(fromDate);
    const t = formatDateTimeDisplay(toDate);
    return `Date Range: ${f} to ${t}`;
  }, [fromDate, toDate]);

  // Dynamic options derived from real onboarded plazas and database records
  const availablePlazas = useMemo(() => {
    const map = new Map();
    // 1. Add live onboarded plazas created by user/system
    (onboardedPlazas || []).forEach((p) => {
      const pId = String(p.id || '').trim();
      const pName = (p.name || `Plaza ${pId}`).trim();
      if (pId && !/dummy|autumn|gluten/i.test(pName)) {
        map.set(pId, `${pId} - ${pName}`);
      }
    });
    // 2. Add records, normalized
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
    set.add('ACCEPTED');
    records.forEach((r) => {
      if (r.npciViolationStatus) set.add(r.npciViolationStatus.toUpperCase());
      else if (r.status) set.add(r.status.toUpperCase());
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
      return vrnMatch || tagMatch || acqMatch || tollTxnMatch;
    });
  }, [records, searchTerm]);

  // Bottom KPI calculation
  const summaryKpis = useMemo(() => {
    if (serverSummary && !searchTerm.trim()) {
      return {
        totalCount: serverSummary.totalCount ?? 0,
        totalTxnAmount: Number(serverSummary.totalTxnAmount ?? 0),
        totalAdjustmentAmount: Number(serverSummary.totalAdjustmentAmount ?? 0),
        totalSettlementAmount: Number(serverSummary.totalSettlementAmount ?? 0)
      };
    }

    let totalCount = 0;
    let totalTxnAmount = 0;
    let totalAdjustmentAmount = 0;
    let totalSettlementAmount = 0;

    filteredRecords.forEach((row) => {
      totalCount += 1;
      totalTxnAmount += Number(row.txnAmount || 0);
      totalAdjustmentAmount += Number(row.violationAdjustmentAmount || 0);
      totalSettlementAmount += Number(row.violationSettlementAmount || 0);
    });

    return { totalCount, totalTxnAmount, totalAdjustmentAmount, totalSettlementAmount };
  }, [serverSummary, filteredRecords, searchTerm]);

  return (
    <div className="violation-settlement-page">
      {/* 1. Header Banner */}
      <div className="report-header-banner">
        <h1 className="report-title">VIOLATION SETTLEMENT REPORT</h1>
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
            <label className="filter-label">Toll Plaza</label>
            <select
              className="filter-select"
              value={plazaId}
              onChange={(e) => {
                const val = e.target.value;
                setPlazaId(val);
                handleSearch(0, pageSize, { plazaId: val });
              }}
              disabled={isPlazaLocked}
              title={isPlazaLocked ? `Locked to assigned plaza: ${assignedPlaza?.name || defaultPlazaId}` : 'Select Toll Plaza'}
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
            <label className="filter-label">NPCI Violation Status</label>
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
            label: 'Total Settlement Records',
            value: (totalElements || summaryKpis.totalCount).toLocaleString('en-IN'),
            sub: 'Filtered Violations'
          },
          {
            label: 'Total Transaction Amount',
            value: `₹ ${Number(summaryKpis.totalTxnAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            sub: 'Original Txn Value',
            highlight: 'blue'
          },
          {
            label: 'Total Settlement Amount',
            value: `₹ ${Number(summaryKpis.totalSettlementAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            sub: `Adjustment: ₹ ${Number(summaryKpis.totalAdjustmentAmount).toFixed(2)}`,
            highlight: 'purple'
          }
        ]}
      />

      {/* 3. Table Area */}
      <div className="table-wrapper">
        <div className="table-responsive">
          <table className="settlement-styled-table">
            <thead>
              <tr>
                <th>Sr No</th>
                <th>Plaza Id</th>
                <th>Plaza Name</th>
                <th>Tag_Id</th>
                <th>VRN</th>
                <th>ACQ Txn ID</th>
                <th>Toll Txn ID</th>
                <th>Txn Date Time</th>
                <th>MVC</th>
                <th>AVC</th>
                <th>AuditVC</th>
                <th>Audit Remark</th>
                <th>NPCI Violation Status</th>
                <th>Txn Amt</th>
                <th>Violation Adjustment Amount</th>
                <th>Violation Settlement Amount</th>
                <th>Settlement Date</th>
                <th>Img Received Time</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="18" className="table-loading-cell">
                    <div className="spinner" />
                    <span>Querying database records...</span>
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan="18" className="table-empty-cell">
                    No violation settlement records found for the selected criteria.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((row, idx) => {
                  const srNo = row.srNo ?? (page * pageSize + idx + 1);
                  const normPlaza = normalizePlazaForRecord(row, idx, onboardedPlazas);
                  return (
                    <tr key={row.id || idx}>
                      <td className="text-center">{srNo}</td>
                      <td className="text-center">{normPlaza.plazaId}</td>
                      <td>{normPlaza.plazaName}</td>
                      <td className="monospace-cell">{row.tagId || '-'}</td>
                      <td className="font-semibold">{row.vrn || '-'}</td>
                      <td className="monospace-cell">{row.acqTxnId || '-'}</td>
                      <td className="monospace-cell">{row.tollTxnId || '-'}</td>
                      <td className="text-center monospace-cell">{formatDateTimeDisplay(row.txnDateTime)}</td>
                      <td className="text-center">{row.mvc || '-'}</td>
                      <td className="text-center">{row.avc || '-'}</td>
                      <td className="text-center">{row.auditVc || ''}</td>
                      <td className="text-center">{row.auditRemark || ''}</td>
                      <td className="text-center">
                        <span className={`status-pill ${row.npciViolationStatus === 'ACCEPTED' ? 'status-accepted' : 'status-other'}`}>
                          {row.npciViolationStatus || '-'}
                        </span>
                      </td>
                      <td className="text-right font-semibold">
                        {Number(row.txnAmount || 0).toFixed(2)}
                      </td>
                      <td className="text-right font-semibold">
                        {Number(row.violationAdjustmentAmount || 0).toFixed(2)}
                      </td>
                      <td className="text-right font-semibold">
                        {Number(row.violationSettlementAmount || 0).toFixed(2)}
                      </td>
                      <td className="text-center">{formatDateDisplay(row.settlementDate)}</td>
                      <td className="text-center">{row.imgReceivedTime ? formatDateTimeDisplay(row.imgReceivedTime) : ''}</td>
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

      {/* 4. Bottom Summary KPI Cards */}
      <div className="report-kpi-summary-bar">
        <div className="kpi-card">
          <span className="kpi-label">Total Records</span>
          <span className="kpi-val">{summaryKpis.totalCount}</span>
        </div>

        <div className="kpi-card kpi-blue">
          <span className="kpi-label">Total Txn Amount</span>
          <span className="kpi-val">₹{summaryKpis.totalTxnAmount.toFixed(2)}</span>
        </div>

        <div className="kpi-card kpi-amber">
          <span className="kpi-label">Total Adjustment Amount</span>
          <span className="kpi-val">₹{summaryKpis.totalAdjustmentAmount.toFixed(2)}</span>
        </div>

        <div className="kpi-card kpi-green">
          <span className="kpi-label">Total Settlement Amount</span>
          <span className="kpi-val">₹{summaryKpis.totalSettlementAmount.toFixed(2)}</span>
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

export default ViolationSettlementReport;
