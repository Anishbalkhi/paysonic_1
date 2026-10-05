import React, { useState, useEffect, useCallback, useMemo } from 'react';
import PassSummaryService from '../../services/summary/PassSummaryService';
import ReportKpiGrid from '../../components/ReportKpiGrid/ReportKpiGrid';
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

  const validateDates = (start, end) => {
    if (!start || !end) { setErrorMsg('Both From Date and To Date are required.'); return false; }
    if (new Date(start) > new Date(end)) { setErrorMsg('From Date cannot be later than To Date.'); return false; }
    setErrorMsg(''); return true;
  };

  const handleSearch = useCallback(async (overrideFrom, overrideTo, overridePlaza) => {
    const fDate = overrideFrom !== undefined ? overrideFrom : fromDate;
    const tDate = overrideTo !== undefined ? overrideTo : toDate;
    const pId = overridePlaza !== undefined ? overridePlaza : plazaId;

    if (!validateDates(fDate, tDate)) return;
    setLoading(true); setErrorMsg('');
    try {
      const data = await PassSummaryService.getReport({ fromDate: fDate, toDate: tDate, plazaId: pId });
      setReportData(data);
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Database error occurred';
      setErrorMsg(`Error: ${msg}`);
      setReportData(null);
    } finally { setLoading(false); }
  }, [fromDate, toDate, plazaId]);

  useEffect(() => { handleSearch(); }, []);

  const handleReset = () => {
    const def = getDefaultDateRange();
    setFromDate(def.from); setToDate(def.to); setPlazaId('ALL'); setErrorMsg('');
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

  return (
    <div className="pass-summary-page">
      {/* Header */}
      <div className="report-header-banner">
        <h1 className="report-title">Pass Summary Report</h1>
        <div className="report-subtitle">{dateSubtitle}</div>
        <div className="report-green-accent-bar" />
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
              <option value="555555">555555 - Plaza1</option>
              <option value="600601">600601 - Dummytollplaza1</option>
              <option value="666666">666666 - Autumn</option>
              <option value="501101">501101 - MUMBAI PLAZA NH-04</option>
              <option value="502202">502202 - PUNE BYPASS PLAZA</option>
            </select>
          </div>
          <div className="filter-actions">
            <button className="btn btn-royal-blue" onClick={handleSearch} disabled={loading}>
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
          },
          {
            label: 'Live Railway DB',
            value: 'ONLINE',
            sub: 'pass_summary',
            isBadge: true
          }
        ]}
      />

      {/* Table */}
      <div className="table-wrapper">
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
                    <span>Aggregating Pass Summary Data from Live Railway Database...</span>
                  </td>
                </tr>
              ) : !hasData ? (
                <tr>
                  <td colSpan="6" className="table-empty-cell">No pass records found for the selected criteria.</td>
                </tr>
              ) : (
                <>
                  {reportData.map((plaza) => {
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
                                      <td rowSpan={modeSpan} className={`merged-cell payment-mode-cell mode-${mode.paymentMode.toLowerCase()}`}>
                                        {mode.paymentMode}
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
      </div>

      {/* Footer */}
      <div className="report-footer-meta">
        <span className="live-db-badge">Live Railway DB: ONLINE</span>
        <span className="disclaimer-note">* Pass issuance summary aggregated from Paysonic live database.</span>
      </div>
    </div>
  );
};

export default PassSummaryReport;
