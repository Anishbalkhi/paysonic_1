import React, { useState, useEffect, useCallback, useMemo } from 'react';
import TransactionSummaryService from '../../services/summary/TransactionSummaryService';
import useOnboardedPlazas from '../../hooks/useOnboardedPlazas';
import { useAuth } from '../../context/AuthContext';
import { filterRecordsByPlazaScope } from '../../utils/plazaScopeUtils';
import { normalizePlazaForRecord } from '../../utils/plazaNormalizer';
import { formatFetchTime } from '../../utils/dateUtils';
import ReportKpiGrid from '../../components/ReportKpiGrid/ReportKpiGrid';
import TablePagination from '../../components/common/TablePagination';
import './TransactionSummaryReport.scss';

const STATUS_DISPLAY_ORDER = ['Accepted', 'Rejected', 'NPCI Decline'];

const normalizeStatusName = (st) => {
  const s = String(st || '').trim().toLowerCase();
  if (s === 'accepted') return 'Accepted';
  if (s === 'declined' || s === 'rejected') return 'Rejected';
  if (s === 'npcidecline' || s === 'npci-decline' || s === 'npci decline') return 'NPCI Decline';
  return st;
};

export const TransactionSummaryReport = () => {
  const { currentUser } = useAuth();
  const getDefaultDateRange = () => ({ from: '2026-09-01', to: '2026-09-30' });

  const initial = getDefaultDateRange();
  const { plazas: onboardedPlazas, isPlazaLocked, defaultPlazaId } = useOnboardedPlazas();
  const [fromDate, setFromDate] = useState(initial.from);
  const [toDate, setToDate] = useState(initial.to);
  const [plazaId, setPlazaId] = useState(defaultPlazaId || 'ALL');

  useEffect(() => {
    if (isPlazaLocked && defaultPlazaId && defaultPlazaId !== 'ALL') {
      setPlazaId(defaultPlazaId);
    }
  }, [isPlazaLocked, defaultPlazaId]);

  const [reportData, setReportData] = useState([]);
  const [fetchTime, setFetchTime] = useState('');
  const [downloadTime, setDownloadTime] = useState('');
  const [grandTotal, setGrandTotal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const validateDates = (start, end) => {
    if (!start || !end) { setErrorMsg('Both From Date and To Date are required.'); return false; }
    if (new Date(start) > new Date(end)) { setErrorMsg('From Date cannot be later than To Date.'); return false; }
    setErrorMsg(''); return true;
  };

  const handleSearch = useCallback(async (overrideFrom, overrideTo, overridePlaza) => {
    const fDate = (typeof overrideFrom === 'string' && overrideFrom) ? overrideFrom : fromDate;
    const tDate = (typeof overrideTo === 'string' && overrideTo) ? overrideTo : toDate;
    const pId = (typeof overridePlaza === 'string' && overridePlaza)
      ? overridePlaza
      : (isPlazaLocked && defaultPlazaId !== 'ALL' ? defaultPlazaId : plazaId);

    if (!validateDates(fDate, tDate)) return;
    setLoading(true); setErrorMsg('');
    try {
      const data = await TransactionSummaryService.getReport({ fromDate: fDate, toDate: tDate, plazaId: pId });
      let rawPlazas = data?.plazas || (Array.isArray(data) ? data : []);
      
      // Enforce multi-tenant role scoping (Concessionaire portfolio vs Single-Plaza lock vs Admin)
      rawPlazas = filterRecordsByPlazaScope(rawPlazas, onboardedPlazas, currentUser);

      // Clean & deduplicate duplicate response code rows per status group and normalize plaza IDs
      const distinctPlazaMap = new Map();
      rawPlazas.forEach((p, idx) => {
        const norm = normalizePlazaForRecord(p, idx, onboardedPlazas);
        const pKey = norm.plazaId;

        // Group status groups into Accepted, Rejected, NPCI Decline
        const groupsByStatus = new Map();
        (p.statusGroups || []).forEach((sg) => {
          const normStatus = normalizeStatusName(sg.transactionStatus);
          if (!groupsByStatus.has(normStatus)) {
            groupsByStatus.set(normStatus, new Map());
          }
          const rowMap = groupsByStatus.get(normStatus);
          (sg.rows || []).forEach((r) => {
            const code = String(r.responseCode || '').trim();
            if (!rowMap.has(code)) {
              rowMap.set(code, {
                ...r,
                responseCode: code,
                transactionCount: Number(r.transactionCount || 0),
                transactionAmount: Number(r.transactionAmount || 0),
              });
            }
          });
        });

        const orderedGroups = [];
        STATUS_DISPLAY_ORDER.forEach((statusName) => {
          if (groupsByStatus.has(statusName)) {
            const dedupedRows = Array.from(groupsByStatus.get(statusName).values());
            const subtotalCount = dedupedRows.reduce((acc, r) => acc + r.transactionCount, 0);
            const subtotalAmount = dedupedRows.reduce((acc, r) => acc + r.transactionAmount, 0);
            orderedGroups.push({
              transactionStatus: statusName,
              rows: dedupedRows,
              subtotalCount,
              subtotalAmount,
            });
          }
        });

        const plazaTotalCount = orderedGroups.reduce((acc, g) => acc + g.subtotalCount, 0);
        const plazaTotalAmount = orderedGroups.reduce((acc, g) => acc + g.subtotalAmount, 0);

        if (!distinctPlazaMap.has(pKey)) {
          distinctPlazaMap.set(pKey, {
            ...p,
            plazaId: norm.plazaId,
            plazaName: norm.plazaName,
            statusGroups: orderedGroups,
            plazaTotalCount,
            plazaTotalAmount,
          });
        }
      });

      const sanitizedPlazas = Array.from(distinctPlazaMap.values());

      setReportData(sanitizedPlazas);
      setFetchTime(formatFetchTime(new Date()));
      setCurrentPage(1);
      setGrandTotal(null);
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Database error occurred';
      setErrorMsg(`Error: ${msg}`);
      setReportData([]);
      setCurrentPage(1);
    } finally { setLoading(false); }
  }, [fromDate, toDate, plazaId, isPlazaLocked, defaultPlazaId, onboardedPlazas, currentUser]);

  useEffect(() => { 
    handleSearch(fromDate, toDate, isPlazaLocked ? defaultPlazaId : plazaId); 
  }, [isPlazaLocked, defaultPlazaId]);

  const handleReset = () => {
    const def = getDefaultDateRange();
    const resetPlaza = isPlazaLocked ? defaultPlazaId : 'ALL';
    setFromDate(def.from); setToDate(def.to); setPlazaId(resetPlaza); setErrorMsg('');
    setCurrentPage(1);
    handleSearch(def.from, def.to, resetPlaza);
  };

  const handleExportExcel = async () => {
    if (!validateDates(fromDate, toDate)) return;
    setExportingExcel(true);
    try {
      await TransactionSummaryService.exportExcel({ fromDate, toDate, plazaId });
      setDownloadTime(formatFetchTime(new Date()));
    }
    catch (err) { alert('Excel export failed. Please try again.'); }
    finally { setExportingExcel(false); }
  };

  const handleExportCsv = async () => {
    if (!validateDates(fromDate, toDate)) return;
    setExportingCsv(true);
    try {
      await TransactionSummaryService.exportCsv({ fromDate, toDate, plazaId });
      setDownloadTime(formatFetchTime(new Date()));
    }
    catch (err) { alert('CSV export failed. Please try again.'); }
    finally { setExportingCsv(false); }
  };

  const dateSubtitle = useMemo(() => {
    if (!fromDate || !toDate) return '';
    const f = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    return `Report Period: ${f(fromDate)} — ${f(toDate)}`;
  }, [fromDate, toDate]);

  const [knownPlazas, setKnownPlazas] = useState([]);

  useEffect(() => {
    const map = new Map();
    (onboardedPlazas || []).forEach((p) => {
      const pId = String(p.id || '').trim();
      const pName = (p.name || `Plaza ${pId}`).trim();
      if (pId && !/dummy|autumn|gluten/i.test(pName)) {
        map.set(pId, { id: pId, label: `${pId} - ${pName}` });
      }
    });

    if (reportData && Array.isArray(reportData) && reportData.length > 0) {
      reportData.forEach((p, idx) => {
        const norm = normalizePlazaForRecord(p, idx, onboardedPlazas);
        if (norm.plazaId && !map.has(norm.plazaId)) {
          if (!isPlazaLocked || norm.plazaId === defaultPlazaId) {
            map.set(norm.plazaId, { id: norm.plazaId, label: `${norm.plazaId} - ${norm.plazaName}` });
          }
        }
      });
    }
    setKnownPlazas(Array.from(map.values()));
  }, [onboardedPlazas, reportData, isPlazaLocked, defaultPlazaId]);

  // KPI Aggregation
  const summaryKpis = useMemo(() => {
    if (!reportData || !Array.isArray(reportData) || reportData.length === 0) {
      return { totalCount: 0, totalAmount: 0, acceptedCount: 0, rejectedCount: 0, npciCount: 0 };
    }
    let totalCount = 0, totalAmount = 0, acceptedCount = 0, rejectedCount = 0, npciCount = 0;
    for (const plaza of reportData) {
      for (const statusGroup of (plaza.statusGroups || [])) {
        for (const row of (statusGroup.rows || [])) {
          const c = Number(row.transactionCount || 0);
          const a = Number(row.transactionAmount || 0);
          totalCount += c;
          totalAmount += a;
          if (statusGroup.transactionStatus === 'Accepted') acceptedCount += c;
          else if (statusGroup.transactionStatus === 'Rejected') rejectedCount += c;
          else if (statusGroup.transactionStatus === 'NPCI Decline') npciCount += c;
        }
      }
    }
    return { totalCount, totalAmount, acceptedCount, rejectedCount, npciCount };
  }, [reportData]);

  const kpiMetrics = summaryKpis;

  const hasData = reportData && Array.isArray(reportData) && reportData.length > 0;

  // Paginated plazas for table view
  const paginatedPlazas = useMemo(() => {
    const from = (currentPage - 1) * pageSize;
    return reportData.slice(from, from + pageSize);
  }, [reportData, currentPage, pageSize]);

  return (
    <div className="txn-summary-page">
      {/* Header */}
      <div className="page-header">
        <div className="header-titles">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h1 className="page-title">Transaction Summary Report</h1>
              <p className="subtitle">{dateSubtitle}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-card">
        <div className="filter-row">
          <div className="filter-group">
            <label className="filter-label">From Date</label>
            <input type="date" className="filter-input" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div className="filter-group">
            <label className="filter-label">To Date</label>
            <input type="date" className="filter-input" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <div className="filter-group filter-grow">
            <label className="filter-label">Plaza</label>
            <select
              className={`filter-select ${isPlazaLocked ? 'disabled-locked' : ''}`}
              value={plazaId}
              disabled={isPlazaLocked}
              onChange={(e) => {
                const val = e.target.value;
                setPlazaId(val);
                handleSearch(fromDate, toDate, val);
              }}
            >
              {!isPlazaLocked && (
                <option value="ALL">
                  {currentUser?.role === 'Concessionaire' ? 'All Portfolio Plazas' : 'All Plazas'}
                </option>
              )}
              {knownPlazas.map((p) => (
                <option key={p.id} value={p.id}>
                  {isPlazaLocked ? `🔒 ${p.label} (Assigned Plaza)` : p.label}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-actions">
            <button className="btn btn-royal-blue" onClick={() => handleSearch()} disabled={loading}>
              {loading ? 'Loading...' : 'Search'}
            </button>
            <button className="btn btn-secondary" onClick={handleReset} disabled={loading}>Reset</button>
            <button className="btn btn-royal-blue" onClick={handleExportExcel} disabled={exportingExcel || loading}>
              {exportingExcel ? 'Exporting...' : 'Export Excel'}
            </button>
            <button className="btn btn-royal-blue" onClick={handleExportCsv} disabled={exportingCsv || loading}>
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
            label: 'Total Transactions',
            value: Number(summaryKpis.totalCount).toLocaleString('en-IN'),
            sub: 'Aggregated Processed Passes'
          },
          {
            label: 'Total Transaction Amount',
            value: `₹ ${Number(summaryKpis.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            sub: 'Gross FASTag Collection',
            highlight: 'blue'
          },
          {
            label: 'Accepted / Rejected',
            value: `${summaryKpis.acceptedCount.toLocaleString()} / ${summaryKpis.rejectedCount.toLocaleString()}`,
            sub: 'Transaction Status Ratio',
            highlight: 'green'
          }
        ]}
      />

      {/* Table */}
      <div className="table-wrapper">
        <div className="table-top-banner">
          <div className="banner-title">TRANSACTION SUMMARY REPORT</div>
          <div className="banner-subtitle">
            From Date: {fromDate} &nbsp; | &nbsp; To Date: {toDate}
          </div>
          <div className="banner-green-bar" />
        </div>

        <div className="table-responsive">
          <table className="txn-summary-table">
            <thead>
              <tr>
                <th>Plaza Id</th>
                <th>Plaza Name</th>
                <th>Transaction Status</th>
                <th>Response Code</th>
                <th className="text-right">Transaction Count</th>
                <th className="text-right">Transaction Amount</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="table-loading-cell">
                    <div className="spinner" />
                    <span>Aggregating Transaction Summary Data...</span>
                  </td>
                </tr>
              ) : !hasData ? (
                <tr>
                  <td colSpan="6" className="table-empty-cell">No records found for the selected criteria.</td>
                </tr>
              ) : (
                <>
                  {paginatedPlazas.map((plaza, pIdx) => {
                    const normPlaza = normalizePlazaForRecord(plaza, pIdx, onboardedPlazas);
                    const plazaTotalRows = (plaza.statusGroups || []).reduce((sum, sg) => sum + (sg.rows || []).length, 0);
                    let plazaFirstRendered = false;

                    return (
                      <React.Fragment key={`plaza-group-${normPlaza.plazaId}-${pIdx}`}>
                        {(plaza.statusGroups || []).map((statusGroup) => {
                          const sgRows = statusGroup.rows || [];
                          let sgFirstRendered = false;

                          return sgRows.map((row, rIdx) => {
                            const isPlazaFirst = !plazaFirstRendered && (plazaFirstRendered = true);
                            const isStatusFirst = !sgFirstRendered && (sgFirstRendered = true);
                            const statusCssClass = statusGroup.transactionStatus.toLowerCase().replace(/\s+/g, '-');

                            return (
                              <tr key={`${normPlaza.plazaId}-${statusGroup.transactionStatus}-${row.responseCode}-${rIdx}`}>
                                {isPlazaFirst && (
                                  <td rowSpan={plazaTotalRows} className="merged-cell text-center font-semibold">
                                    {normPlaza.plazaId}
                                  </td>
                                )}
                                {isPlazaFirst && (
                                  <td rowSpan={plazaTotalRows} className="merged-cell font-semibold">
                                    {normPlaza.plazaName}
                                  </td>
                                )}
                                {isStatusFirst && (
                                  <td rowSpan={sgRows.length} className={`merged-cell status-cell status-${statusCssClass}`}>
                                    {statusGroup.transactionStatus}
                                  </td>
                                )}
                                <td className="response-code-cell">{row.responseCode}</td>
                                <td className="text-right">{Number(row.transactionCount || 0).toLocaleString()}</td>
                                <td className="text-right font-semibold">
                                  {Number(row.transactionAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                              </tr>
                            );
                          });
                        })}

                        {/* Total Row For This Plaza */}
                        <tr key={`plaza-total-${normPlaza.plazaId}-${pIdx}`} className="row-plaza-total">
                          <td colSpan="4" className="plaza-total-label-cell">
                            Total for {normPlaza.plazaName} ({normPlaza.plazaId})
                          </td>
                          <td className="plaza-total-val-cell text-right font-semibold">
                            {Number(plaza.plazaTotalCount || 0).toLocaleString()}
                          </td>
                          <td className="plaza-total-val-cell text-right font-semibold">
                            ₹ {Number(plaza.plazaTotalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })}

                  {/* Overall Grand Total Row */}
                  <tr className="row-grand-total">
                    <td colSpan="4" className="grand-total-label-cell">Grand Total</td>
                    <td className="grand-total-val-cell text-right">
                      {summaryKpis.totalCount.toLocaleString()}
                    </td>
                    <td className="grand-total-val-cell text-right">
                      ₹ {summaryKpis.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Table Pagination Bar */}
        <TablePagination
          totalItems={reportData.length}
          currentPage={currentPage}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
          pageSizeOptions={[10, 25, 50, 100]}
        />

        {/* Table Bottom Export Download Time Strip */}
        <div
          className="table-bottom-export-bar"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '8px',
            padding: '10px 18px',
            backgroundColor: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            fontSize: '0.84rem',
            color: '#0369a1',
            marginTop: '8px'
          }}
        >
          <span style={{ fontWeight: 600 }}>📥 Export Download Time:</span>
          <span
            style={{
              fontFamily: 'monospace',
              color: downloadTime ? '#0369a1' : '#64748b',
              fontWeight: downloadTime ? 600 : 400
            }}
          >
            {downloadTime || 'Not exported yet'}
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="report-kpi-summary-bar">
        <div className="kpi-card kpi-blue">
          <span className="kpi-label">Total Transactions</span>
          <span className="kpi-val">{summaryKpis.totalCount.toLocaleString()}</span>
        </div>
        <div className="kpi-card kpi-green">
          <span className="kpi-label">Accepted</span>
          <span className="kpi-val">{summaryKpis.acceptedCount.toLocaleString()}</span>
        </div>
        <div className="kpi-card kpi-red">
          <span className="kpi-label">Rejected</span>
          <span className="kpi-val">{summaryKpis.rejectedCount.toLocaleString()}</span>
        </div>
        <div className="kpi-card kpi-amber">
          <span className="kpi-label">NPCI Decline</span>
          <span className="kpi-val">{summaryKpis.npciCount.toLocaleString()}</span>
        </div>
        <div className="kpi-card kpi-purple">
          <span className="kpi-label">Total Revenue (₹)</span>
          <span className="kpi-val">₹{summaryKpis.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
      </div>

      {/* Footer */}
      <div className="report-footer-meta">
        <span className="disclaimer-note">* Aggregated transaction data from Paysonic database.</span>
      </div>
    </div>
  );
};

export default TransactionSummaryReport;
