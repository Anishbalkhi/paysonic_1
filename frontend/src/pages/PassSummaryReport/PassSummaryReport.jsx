import React, { useState, useEffect, useCallback, useMemo } from 'react';
import PassSummaryService from '../../services/summary/PassSummaryService';
import useOnboardedPlazas from '../../hooks/useOnboardedPlazas';
import { useAuth } from '../../context/AuthContext';
import { filterRecordsByPlazaScope } from '../../utils/plazaScopeUtils';
import { normalizePlazaForRecord } from '../../utils/plazaNormalizer';
import { formatFetchTime } from '../../utils/dateUtils';
import ReportKpiGrid from '../../components/ReportKpiGrid/ReportKpiGrid';
import TablePagination from '../../components/common/TablePagination';
import './PassSummaryReport.scss';

export const PassSummaryReport = () => {
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

  const [reportData, setReportData] = useState(null);
  const [fetchTime, setFetchTime] = useState('');
  const [downloadTime, setDownloadTime] = useState('');
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
      const data = await PassSummaryService.getReport({ fromDate: fDate, toDate: tDate, plazaId: pId });
      let filtered = data;
      if (Array.isArray(data)) {
        filtered = filterRecordsByPlazaScope(data, onboardedPlazas, currentUser);
      }
      setReportData(filtered);
      setFetchTime(formatFetchTime(new Date()));
      setCurrentPage(1);
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Database error occurred';
      setErrorMsg(`Error: ${msg}`);
      setReportData(null);
      setCurrentPage(1);
    } finally { setLoading(false); }
  }, [fromDate, toDate, plazaId, isPlazaLocked, defaultPlazaId]);

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
      await PassSummaryService.exportExcel({ fromDate, toDate, plazaId });
      setDownloadTime(formatFetchTime(new Date()));
    }
    catch (err) { alert('Excel export failed. Please try again.'); }
    finally { setExportingExcel(false); }
  };

  const handleExportCsv = async () => {
    if (!validateDates(fromDate, toDate)) return;
    setExportingCsv(true);
    try {
      await PassSummaryService.exportCsv({ fromDate, toDate, plazaId });
      setDownloadTime(formatFetchTime(new Date()));
    }
    catch (err) { alert('CSV export failed. Please try again.'); }
    finally { setExportingCsv(false); }
  };

  const formatDisplayDate = (dStr) => {
    if (!dStr) return '';
    try {
      const d = new Date(dStr);
      if (isNaN(d.getTime())) return dStr;
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dStr;
    }
  };

  const dateSubtitle = useMemo(() => {
    if (!fromDate || !toDate) return '';
    return `Report Period: ${formatDisplayDate(fromDate)} — ${formatDisplayDate(toDate)}`;
  }, [fromDate, toDate]);

  // KPI Aggregation
  const kpiMetrics = useMemo(() => {
    if (!reportData || !Array.isArray(reportData) || reportData.length === 0) {
      return { grandCount: 0, grandAmount: 0, cashCount: 0, onlineCount: 0, plazaCount: 0 };
    }
    let grandCount = 0, grandAmount = 0, cashCount = 0, onlineCount = 0;
    for (const plaza of reportData) {
      grandCount += Number(plaza.grandTotalCount || 0);
      grandAmount += Number(plaza.grandTotalAmount || 0);
      for (const mode of (plaza.paymentModes || [])) {
        if (mode.paymentMode === 'Cash') cashCount += Number(mode.totalCount || 0);
        if (mode.paymentMode === 'Online') onlineCount += Number(mode.totalCount || 0);
      }
    }
    return { grandCount, grandAmount, cashCount, onlineCount, plazaCount: reportData.length };
  }, [reportData]);

  const hasData = reportData && Array.isArray(reportData) && reportData.length > 0;

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
          map.set(norm.plazaId, { id: norm.plazaId, label: `${norm.plazaId} - ${norm.plazaName}` });
        }
      });
    }
    setKnownPlazas(Array.from(map.values()));
  }, [onboardedPlazas, reportData]);

  const paginatedPlazas = useMemo(() => {
    if (!Array.isArray(reportData)) return [];
    const from = (currentPage - 1) * pageSize;
    return reportData.slice(from, from + pageSize);
  }, [reportData, currentPage, pageSize]);

  return (
    <div className="pass-summary-page">
      {/* Header */}
      <div className="page-header">
        <div className="header-titles">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h1 className="page-title">Pass Summary Report</h1>
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
              onChange={(e) => setPlazaId(e.target.value)}
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
            label: 'Total Pass Count',
            value: kpiMetrics.grandCount.toLocaleString('en-IN'),
            sub: 'Issued FASTag Passes'
          },
          {
            label: 'Total Pass Revenue',
            value: `₹ ${kpiMetrics.grandAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            sub: 'Gross Pass Sales',
            highlight: 'blue'
          },
          {
            label: 'Cash vs Online',
            value: `${kpiMetrics.cashCount} / ${kpiMetrics.onlineCount}`,
            sub: 'Payment Mode Distribution',
            highlight: 'green'
          }
        ]}
      />

      {/* Table */}
      <div className="table-wrapper">
        <div className="table-top-banner">
          <div className="banner-title">PASS SUMMARY REPORT</div>
          <div className="banner-subtitle">
            {dateSubtitle || `Report Period: ${formatDisplayDate(fromDate)} — ${formatDisplayDate(toDate)}`}
          </div>
          <div className="banner-green-bar" />
        </div>

        <div className="table-responsive">
          <table className="pass-summary-table">
            <thead>
              <tr>
                <th className="text-center">Plaza ID</th>
                <th>Plaza Name</th>
                <th className="text-center">Payment Mode</th>
                <th>Pass Type</th>
                <th className="text-right">Count</th>
                <th className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="table-loading-cell">
                    <div className="spinner" />
                    <span>Aggregating Pass Summary Data...</span>
                  </td>
                </tr>
              ) : !hasData ? (
                <tr>
                  <td colSpan="6" className="table-empty-cell">No pass records found for the selected criteria.</td>
                </tr>
              ) : (
                <>
                  {paginatedPlazas.map((plaza, pIdx) => {
                    const normPlaza = normalizePlazaForRecord(plaza, pIdx, onboardedPlazas);
                    // Count total rows per plaza: for each mode, rows.length + 1 (subtotal)
                    // Plaza ID and Name merge stops before the Grand Total row
                    const totalPlazaRows = (plaza.paymentModes || []).reduce(
                      (sum, mode) => sum + (mode.rows || []).length + 1, 0
                    );
                    let plazaFirstRendered = false;

                    return (
                      <React.Fragment key={normPlaza.plazaId}>
                        {(plaza.paymentModes || []).map((mode) => {
                          let modeFirstRendered = false;
                          const modeRows = mode.rows || [];
                          const modeSpan = modeRows.length + 1; // rows + subtotal

                          return (
                            <React.Fragment key={`${normPlaza.plazaId}-${mode.paymentMode}`}>
                              {modeRows.map((pt) => {
                                const isPlazaFirst = !plazaFirstRendered && (plazaFirstRendered = true);
                                const isModeFirst = !modeFirstRendered && (modeFirstRendered = true);

                                return (
                                  <tr key={`${normPlaza.plazaId}-${mode.paymentMode}-${pt.passType}`}>
                                    {isPlazaFirst && (
                                      <td rowSpan={totalPlazaRows} className="merged-cell text-center font-semibold plaza-id-cell">
                                        {normPlaza.plazaId}
                                      </td>
                                    )}
                                    {isPlazaFirst && (
                                      <td rowSpan={totalPlazaRows} className="merged-cell font-semibold plaza-name-cell">
                                        {normPlaza.plazaName}
                                      </td>
                                    )}
                                    {isModeFirst && (
                                      <td rowSpan={modeSpan} className="merged-cell payment-mode-cell text-center">
                                        <span className={`mode-badge mode-${mode.paymentMode.toLowerCase()}`}>
                                          {mode.paymentMode}
                                        </span>
                                      </td>
                                    )}
                                    <td className="pass-type-cell">{pt.passType}</td>
                                    <td className="text-right">{Number(pt.count || 0).toLocaleString()}</td>
                                    <td className="text-right font-semibold">
                                      {Number(pt.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                  </tr>
                                );
                              })}

                              {/* Subtotal row per payment mode */}
                              <tr className="row-subtotal">
                                <td className="subtotal-label-cell text-center">Total</td>
                                <td className="subtotal-val-cell text-right font-bold">
                                  {Number(mode.totalCount || 0).toLocaleString()}
                                </td>
                                <td className="subtotal-val-cell text-right font-bold">
                                  {Number(mode.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                              </tr>
                            </React.Fragment>
                          );
                        })}

                        {/* Grand Total row per plaza: spans columns 1-4, count in col 5, amount in col 6 */}
                        <tr className="row-grand-total">
                          <td colSpan={4} className="grand-total-label-cell text-center">
                            Grand Total
                          </td>
                          <td className="grand-total-val-cell text-right font-bold">
                            {Number(plaza.grandTotalCount || 0).toLocaleString()}
                          </td>
                          <td className="grand-total-val-cell text-right font-bold">
                            {Number(plaza.grandTotalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })}

                  {/* Overall Grand Total row when multiple plazas are displayed */}
                  {reportData.length > 1 && (
                    <tr className="row-grand-total overall-total">
                      <td colSpan={4} className="grand-total-label-cell text-center">
                        Overall Grand Total
                      </td>
                      <td className="grand-total-val-cell text-right font-bold">
                        {kpiMetrics.grandCount.toLocaleString()}
                      </td>
                      <td className="grand-total-val-cell text-right font-bold">
                        {kpiMetrics.grandAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Table Pagination Bar */}
        <TablePagination
          totalItems={Array.isArray(reportData) ? reportData.length : 0}
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

      {/* Footer */}
      <div className="report-footer-meta">
        <span className="disclaimer-note">* Pass issuance summary aggregated from Paysonic database.</span>
      </div>
    </div>
  );
};

export default PassSummaryReport;
