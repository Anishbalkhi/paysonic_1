import React, { useState, useEffect, useCallback, useMemo } from 'react';
import TransactionSummaryService from '../../services/summary/TransactionSummaryService';
import './TransactionSummaryReport.scss';

export const TransactionSummaryReport = () => {
  const getDefaultDateRange = () => ({ from: '2026-09-01', to: '2026-09-30' });

  const initial = getDefaultDateRange();
  const [fromDate, setFromDate] = useState(initial.from);
  const [toDate, setToDate] = useState(initial.to);
  const [plazaId, setPlazaId] = useState('ALL');

  const [reportData, setReportData] = useState([]);
  const [grandTotal, setGrandTotal] = useState(null);
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
    const fDate = (typeof overrideFrom === 'string' && overrideFrom) ? overrideFrom : fromDate;
    const tDate = (typeof overrideTo === 'string' && overrideTo) ? overrideTo : toDate;
    const pId = (typeof overridePlaza === 'string' && overridePlaza) ? overridePlaza : plazaId;

    if (!validateDates(fDate, tDate)) return;
    setLoading(true); setErrorMsg('');
    try {
      const data = await TransactionSummaryService.getReport({ fromDate: fDate, toDate: tDate, plazaId: pId });
      const plazas = data?.plazas || (Array.isArray(data) ? data : []);
      setReportData(plazas);
      if (data?.grandTotal) {
        setGrandTotal(data.grandTotal);
      }
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Database error occurred';
      setErrorMsg(`Error: ${msg}`);
      setReportData([]);
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
    try { await TransactionSummaryService.exportExcel({ fromDate, toDate, plazaId }); }
    catch (err) { alert('Excel export failed. Please try again.'); }
    finally { setExportingExcel(false); }
  };

  const handleExportCsv = async () => {
    if (!validateDates(fromDate, toDate)) return;
    setExportingCsv(true);
    try { await TransactionSummaryService.exportCsv({ fromDate, toDate, plazaId }); }
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
    if (grandTotal && grandTotal.totalCount !== undefined) {
      return {
        totalCount: grandTotal.totalCount || 0,
        totalAmount: grandTotal.totalAmount || 0,
        acceptedCount: grandTotal.acceptedCount || 0,
        declinedCount: grandTotal.declinedCount || 0,
        npciCount: 0
      };
    }
    if (!reportData || !Array.isArray(reportData) || reportData.length === 0) {
      return { totalCount: 0, totalAmount: 0, acceptedCount: 0, declinedCount: 0, npciCount: 0 };
    }
    let totalCount = 0, totalAmount = 0, acceptedCount = 0, declinedCount = 0, npciCount = 0;
    for (const plaza of reportData) {
      for (const statusGroup of (plaza.statusGroups || [])) {
        for (const row of (statusGroup.rows || [])) {
          totalCount += Number(row.transactionCount || 0);
          totalAmount += Number(row.transactionAmount || 0);
          if (statusGroup.transactionStatus === 'Accepted') acceptedCount += Number(row.transactionCount || 0);
          else if (statusGroup.transactionStatus === 'Declined') declinedCount += Number(row.transactionCount || 0);
          else if (statusGroup.transactionStatus === 'NPCIDecline') npciCount += Number(row.transactionCount || 0);
        }
      }
    }
    return { totalCount, totalAmount, acceptedCount, declinedCount, npciCount };
  }, [reportData, grandTotal]);

  const hasData = reportData && Array.isArray(reportData) && reportData.length > 0;

  return (
    <div className="txn-summary-page">
      {/* Header */}
      <div className="report-header-banner">
        <h1 className="report-title">Transaction Summary Report</h1>
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
            <select
              className="filter-select"
              value={plazaId}
              onChange={(e) => {
                const val = e.target.value;
                setPlazaId(val);
                handleSearch(fromDate, toDate, val);
              }}
            >
              <option value="ALL">All Plazas</option>
              <option value="600601">600601 - Dummytollplaza1</option>
              <option value="666666">666666 - Autumn</option>
              <option value="501101">501101 - MUMBAI PLAZA NH-04</option>
              <option value="502202">502202 - PUNE BYPASS PLAZA</option>
              <option value="Plaza 1">Plaza 1</option>
              <option value="Plaza 2">Plaza 2</option>
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

      {/* Table */}
      <div className="table-wrapper">
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
                    <span>Aggregating Transaction Summary Data from Live Railway Database...</span>
                  </td>
                </tr>
              ) : !hasData ? (
                <tr>
                  <td colSpan="6" className="table-empty-cell">No records found for the selected criteria.</td>
                </tr>
              ) : (
                <>
                  {reportData.map((plaza, pIdx) => {
                    const plazaTotalRows = (plaza.statusGroups || []).reduce((sum, sg) => sum + (sg.rows || []).length, 0);
                    let plazaFirstRendered = false;

                    return (plaza.statusGroups || []).map((statusGroup, sgIdx) => {
                      const sgRows = statusGroup.rows || [];
                      let sgFirstRendered = false;

                      return sgRows.map((row, rIdx) => {
                        const isPlazaFirst = !plazaFirstRendered && (plazaFirstRendered = true);
                        const isStatusFirst = !sgFirstRendered && (sgFirstRendered = true);

                        return (
                          <tr key={`${plaza.plazaId}-${statusGroup.transactionStatus}-${row.responseCode}`}>
                            {isPlazaFirst && (
                              <td rowSpan={plazaTotalRows} className="merged-cell text-center font-semibold">
                                {plaza.plazaId}
                              </td>
                            )}
                            {isPlazaFirst && (
                              <td rowSpan={plazaTotalRows} className="merged-cell font-semibold">
                                {plaza.plazaName}
                              </td>
                            )}
                            {isStatusFirst && (
                              <td rowSpan={sgRows.length} className={`merged-cell status-cell status-${statusGroup.transactionStatus.toLowerCase().replace('npci','npci-')}`}>
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
                    });
                  })}

                  {/* Grand Total Row */}
                  <tr className="row-grand-total">
                    <td colSpan="4" className="grand-total-label-cell">Grand Total</td>
                    <td className="grand-total-val-cell text-right">
                      {kpiMetrics.totalCount.toLocaleString()}
                    </td>
                    <td className="grand-total-val-cell text-right">
                      {kpiMetrics.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="report-kpi-summary-bar">
        <div className="kpi-card kpi-blue">
          <span className="kpi-label">Total Transactions</span>
          <span className="kpi-val">{kpiMetrics.totalCount.toLocaleString()}</span>
        </div>
        <div className="kpi-card kpi-green">
          <span className="kpi-label">Accepted</span>
          <span className="kpi-val">{kpiMetrics.acceptedCount.toLocaleString()}</span>
        </div>
        <div className="kpi-card kpi-red">
          <span className="kpi-label">Declined</span>
          <span className="kpi-val">{kpiMetrics.declinedCount.toLocaleString()}</span>
        </div>
        <div className="kpi-card kpi-amber">
          <span className="kpi-label">NPCI Decline</span>
          <span className="kpi-val">{kpiMetrics.npciCount.toLocaleString()}</span>
        </div>
        <div className="kpi-card kpi-purple">
          <span className="kpi-label">Total Revenue (₹)</span>
          <span className="kpi-val">₹{kpiMetrics.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
      </div>

      {/* Footer */}
      <div className="report-footer-meta">
        <span className="live-db-badge">Live Railway DB: ONLINE</span>
        <span className="disclaimer-note">* Aggregated transaction data from Paysonic live database.</span>
      </div>
    </div>
  );
};

export default TransactionSummaryReport;
