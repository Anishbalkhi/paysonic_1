import React, { useState, useEffect, useCallback, useMemo } from 'react';
import PassSummaryService from '../../services/summary/PassSummaryService';
import ReportKpiGrid from '../../components/ReportKpiGrid/ReportKpiGrid';
import TablePagination from '../../components/common/TablePagination';
import './PassSummaryReport.scss';

export const PassSummaryReport = () => {
  const getDefaultDateRange = () => ({ from: '2026-09-01', to: '2026-09-30' });

  const initial = getDefaultDateRange();
  const [fromDate, setFromDate] = useState(initial.from);
  const [toDate, setToDate] = useState(initial.to);
  const [plazaId, setPlazaId] = useState('ALL');

  const [reportData, setReportData] = useState(null);
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
    const pId = (typeof overridePlaza === 'string' && overridePlaza) ? overridePlaza : plazaId;

    if (!validateDates(fDate, tDate)) return;
    setLoading(true); setErrorMsg('');
    try {
      const data = await PassSummaryService.getReport({ fromDate: fDate, toDate: tDate, plazaId: pId });
      setReportData(data);
      setCurrentPage(1);
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Database error occurred';
      setErrorMsg(`Error: ${msg}`);
      setReportData(null);
      setCurrentPage(1);
    } finally { setLoading(false); }
  }, [fromDate, toDate, plazaId]);

  useEffect(() => { handleSearch(); }, []);

  const handleReset = () => {
    const def = getDefaultDateRange();
    setFromDate(def.from); setToDate(def.to); setPlazaId('ALL'); setErrorMsg('');
    setCurrentPage(1);
    handleSearch(def.from, def.to, 'ALL');
  };

  const handleExportExcel = async () => {
    if (!validateDates(fromDate, toDate)) return;
    setExportingExcel(true);
    try { await PassSummaryService.exportExcel({ fromDate, toDate, plazaId }); }
    catch (err) { alert('Excel export failed. Please try again.'); }
    finally { setExportingExcel(false); }
  };

  const handleExportCsv = async () => {
    if (!validateDates(fromDate, toDate)) return;
    setExportingCsv(true);
    try { await PassSummaryService.exportCsv({ fromDate, toDate, plazaId }); }
    catch (err) { alert('CSV export failed. Please try again.'); }
    finally { setExportingCsv(false); }
  };

  const dateSubtitle = useMemo(() => {
    if (!fromDate || !toDate) return '';
    const f = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    return `Report Period: ${f(fromDate)} — ${f(toDate)}`;
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
    if (reportData && Array.isArray(reportData) && reportData.length > 0) {
      setKnownPlazas((prev) => {
        const map = new Map(prev.map((p) => [p.id, p]));
        reportData.forEach((p) => {
          if (p.plazaId && !map.has(p.plazaId)) {
            map.set(p.plazaId, {
              id: p.plazaId,
              label: p.plazaName ? `${p.plazaId} - ${p.plazaName}` : p.plazaId
            });
          }
        });
        return Array.from(map.values());
      });
    }
  }, [reportData]);

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
          <h1 className="page-title">Pass Summary Report</h1>
          <p className="subtitle">{dateSubtitle}</p>
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
            <select className="filter-select" value={plazaId} onChange={(e) => setPlazaId(e.target.value)}>
              <option value="ALL">All Plazas</option>
              {knownPlazas.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
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
            Report Period: {formatDisplayDate(fromDate)} — {formatDisplayDate(toDate)}
          </div>
          <div className="banner-green-bar" />
        </div>

        <div className="table-responsive">
          <table className="pass-summary-table">
            <thead>
              <tr>
                <th>Plaza ID</th>
                <th>Plaza Name</th>
                <th>Payment Mode</th>
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
                  {paginatedPlazas.map((plaza) => {
                    // Count total rows per plaza: for each mode, rows.length + 1 (subtotal)
                    const totalPlazaRows = (plaza.paymentModes || []).reduce(
                      (sum, mode) => sum + (mode.rows || []).length + 1, 0
                    ) + 1; // +1 for grand total row
                    let plazaFirstRendered = false;

                    return (
                      <React.Fragment key={plaza.plazaId}>
                        {(plaza.paymentModes || []).map((mode) => {
                          let modeFirstRendered = false;
                          const modeRows = mode.rows || [];
                          const modeSpan = modeRows.length + 1; // rows + subtotal

                          return (
                            <React.Fragment key={`${plaza.plazaId}-${mode.paymentMode}`}>
                              {modeRows.map((pt) => {
                                const isPlazaFirst = !plazaFirstRendered && (plazaFirstRendered = true);
                                const isModeFirst = !modeFirstRendered && (modeFirstRendered = true);

                                return (
                                  <tr key={`${plaza.plazaId}-${mode.paymentMode}-${pt.passType}`}>
                                    {isPlazaFirst && (
                                      <td rowSpan={totalPlazaRows} className="merged-cell text-center font-semibold plaza-id-cell">
                                        {plaza.plazaId}
                                      </td>
                                    )}
                                    {isPlazaFirst && (
                                      <td rowSpan={totalPlazaRows} className="merged-cell font-semibold plaza-name-cell">
                                        {plaza.plazaName}
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
                                <td className="subtotal-label-cell">Total</td>
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

                        {/* Grand Total row per plaza */}
                        <tr className="row-grand-total">
                          <td colSpan="3" className="grand-total-label-cell">Grand Total</td>
                          <td className="grand-total-val-cell text-right">
                            {Number(plaza.grandTotalCount || 0).toLocaleString()}
                          </td>
                          <td className="grand-total-val-cell text-right">
                            {Number(plaza.grandTotalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
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
      </div>

      {/* Footer */}
      <div className="report-footer-meta">
        <span className="disclaimer-note">* Pass issuance summary aggregated from Paysonic database.</span>
      </div>
    </div>
  );
};

export default PassSummaryReport;
