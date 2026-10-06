import React, { useState, useEffect, useCallback, useMemo } from 'react';
import NhaiTrafficService from '../../services/summary/NhaiTrafficService';
import DisputeManagementService from '../../services/dispute/DisputeManagementService';
import { DEFAULT_PLAZAS } from '../../config/disputeConstants';
import ReportKpiGrid from '../../components/ReportKpiGrid/ReportKpiGrid';
import './NhaiTrafficReport.scss';

export const NhaiTrafficReport = () => {
  // Default date range: September 2026
  const getDefaultDateRange = () => ({
    from: '2026-09-01',
    to: '2026-09-30'
  });

  const initialRange = getDefaultDateRange();
  const [fromDate, setFromDate] = useState(initialRange.from);
  const [toDate, setToDate] = useState(initialRange.to);
  const [plazaCode, setPlazaCode] = useState('ALL');
  const [plazas, setPlazas] = useState(DEFAULT_PLAZAS);

  useEffect(() => {
    let isMounted = true;
    DisputeManagementService.getRealtimePlazas().then((live) => {
      if (isMounted && Array.isArray(live) && live.length > 0) {
        setPlazas(live);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

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

  const handleSearch = useCallback(async (overrideFrom, overrideTo, overridePlaza) => {
    const fDate = (typeof overrideFrom === 'string' && overrideFrom) ? overrideFrom : fromDate;
    const tDate = (typeof overrideTo === 'string' && overrideTo) ? overrideTo : toDate;
    const pCode = (typeof overridePlaza === 'string' && overridePlaza) ? overridePlaza : plazaCode;

    if (!validateDates(fDate, tDate)) return;

    setLoading(true);
    setErrorMsg('');
    try {
      const data = await NhaiTrafficService.getReport({
        fromDate: fDate,
        toDate: tDate,
        plazaCode: pCode
      });
      setReportData(data);
    } catch (err) {
      console.error('[NhaiTrafficReport] Failed to load data:', err);
      const msg = err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Database error occurred';
      setErrorMsg(`Database Query Error: ${msg}`);
      setReportData(null);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, plazaCode]);

  useEffect(() => {
    handleSearch();
  }, []);

  const handleReset = () => {
    const def = getDefaultDateRange();
    setFromDate(def.from);
    setToDate(def.to);
    setPlazaCode('ALL');
    setErrorMsg('');
    handleSearch(def.from, def.to, 'ALL');
  };

  const handleExportExcel = async () => {
    if (!validateDates(fromDate, toDate)) return;
    setExportingExcel(true);
    try {
      await NhaiTrafficService.exportExcel({
        fromDate,
        toDate,
        plazaCode
      });
    } catch (err) {
      console.error('[NhaiTrafficReport] Excel export failed:', err);
      alert('Failed to export Excel report. Please try again.');
    } finally {
      setExportingExcel(false);
    }
  };

  const handleExportCsv = async () => {
    if (!validateDates(fromDate, toDate)) return;
    setExportingCsv(true);
    try {
      await NhaiTrafficService.exportCsv({
        fromDate,
        toDate,
        plazaCode
      });
    } catch (err) {
      console.error('[NhaiTrafficReport] CSV export failed:', err);
      alert('Failed to export CSV report. Please try again.');
    } finally {
      setExportingCsv(false);
    }
  };

  const dateSubtitle = useMemo(() => {
    return `From Date: ${fromDate}    To Date: ${toDate}`;
  }, [fromDate, toDate]);

  // Overall KPI metrics from Grand & Journey Totals
  const kpiMetrics = useMemo(() => {
    if (!reportData) {
      return {
        totalCount: 0,
        totalAmount: 0,
        singleCount: 0,
        returnCount: 0,
        passCount: 0
      };
    }

    const grand = reportData.grandTotal || {};
    const jTotals = reportData.journeyTotals || [];

    const single = jTotals.find((j) => j.journeyType.includes('Single'))?.transactionCount || 0;
    const ret = jTotals.find((j) => j.journeyType.includes('Return'))?.transactionCount || 0;
    const pass = jTotals.find((j) => j.journeyType.includes('Exempted'))?.transactionCount || 0;

    return {
      totalCount: grand.totalCount || 0,
      totalAmount: Number(grand.totalAmount || 0),
      singleCount: single,
      returnCount: ret,
      passCount: pass
    };
  }, [reportData]);

  // Flattened vehicle classes
  const vehicleClasses = reportData?.vehicleClasses || [];
  const totalRowsInClasses = vehicleClasses.reduce(
    (acc, vc) => acc + (vc.journeys?.length || 0),
    0
  );

  return (
    <div className="nhai-traffic-page">
      {/* 1. Header Banner */}
      <div className="report-header-banner">
        <h1 className="report-title">NHAI Traffic Report</h1>
        <div className="report-subtitle">{dateSubtitle}</div>
        <div className="report-green-accent-bar" />
      </div>

      {/* 2. Filter Controls Card */}
      <div className="filter-card">
        <div className="filter-row">
          <div className="filter-group">
            <label className="filter-label">From Date</label>
            <input
              type="date"
              className="filter-input"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label className="filter-label">To Date</label>
            <input
              type="date"
              className="filter-input"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>

          <div className="filter-group filter-grow">
            <label className="filter-label">Toll Plaza</label>
            <select
              className="filter-select"
              value={plazaCode}
              onChange={(e) => setPlazaCode(e.target.value)}
            >
              <option value="ALL">All Plazas Network</option>
              {plazas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id} - {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-actions">
            <button
              className="btn btn-royal-blue"
              onClick={() => handleSearch()}
              disabled={loading}
            >
              {loading ? 'Generating...' : 'Search'}
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
            label: 'Total Traffic Count',
            value: kpiMetrics.totalCount.toLocaleString('en-IN'),
            sub: 'Filtered Fastag Vehicles'
          },
          {
            label: 'Total Toll Revenue',
            value: `₹ ${kpiMetrics.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            sub: 'Gross NHAI Toll Collection',
            highlight: 'blue'
          },
          {
            label: 'Single / Return / Passes',
            value: `${kpiMetrics.singleCount} / ${kpiMetrics.returnCount} / ${kpiMetrics.passCount}`,
            sub: 'Journey Type Distribution',
            highlight: 'green'
          }
        ]}
      />

      {/* 3. Table Area */}
      <div className="table-wrapper">
        <div className="table-responsive">
          <table className="nhai-styled-table">
            <thead>
              <tr>
                <th>Plaza Code</th>
                <th>Plaza Name</th>
                <th>Vehicle Class</th>
                <th>Journey Type</th>
                <th className="text-right">Toll Fare</th>
                <th className="text-right">Transaction Count</th>
                <th className="text-right">Transaction Amount</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="table-loading-cell">
                    <div className="spinner" />
                    <span>Aggregating NHAI Traffic Data from database...</span>
                  </td>
                </tr>
              ) : !reportData || vehicleClasses.length === 0 ? (
                <tr>
                  <td colSpan="7" className="table-empty-cell">
                    No traffic records found for the selected criteria.
                  </td>
                </tr>
              ) : (
                <>
                  {vehicleClasses.map((vcGroup, vcIdx) => {
                    const journeys = vcGroup.journeys || [];
                    return journeys.map((journey, jIdx) => {
                      const isFirstGlobalRow = vcIdx === 0 && jIdx === 0;
                      const isFirstInClass = jIdx === 0;

                      return (
                        <tr key={`${vcGroup.classCode}-${journey.journeyType}`}>
                          {/* Col 0: Plaza Code (spans all class rows) */}
                          {isFirstGlobalRow && (
                            <td
                              rowSpan={totalRowsInClasses}
                              className="text-center font-semibold border-merged-cell"
                            >
                              {reportData.plazaCode}
                            </td>
                          )}

                          {/* Col 1: Plaza Name (spans all class rows) */}
                          {isFirstGlobalRow && (
                            <td
                              rowSpan={totalRowsInClasses}
                              className="font-semibold border-merged-cell"
                            >
                              {reportData.plazaName}
                            </td>
                          )}

                          {/* Col 2: Vehicle Class (spans 4 rows of the class) */}
                          {isFirstInClass && (
                            <td
                              rowSpan={journeys.length}
                              className="vc-title-cell font-semibold border-merged-cell"
                            >
                              {vcGroup.className}
                            </td>
                          )}

                          {/* Col 3: Journey Type */}
                          <td className="journey-type-cell">
                            {journey.journeyType}
                          </td>

                          {/* Col 4: Toll Fare */}
                          <td className="text-right">
                            {Number(journey.tollFare || 0) > 0
                              ? Number(journey.tollFare).toFixed(2)
                              : '-'}
                          </td>

                          {/* Col 5: Transaction Count */}
                          <td className="text-right font-medium">
                            {Number(journey.transactionCount || 0).toLocaleString()}
                          </td>

                          {/* Col 6: Transaction Amount */}
                          <td className="text-right font-semibold">
                            {Number(journey.transactionAmount || 0).toLocaleString(
                              undefined,
                              { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                            )}
                          </td>
                        </tr>
                      );
                    });
                  })}

                  {/* ── Journey Total Block (Highlighted as in screenshot) ── */}
                  {(reportData.journeyTotals || []).map((jt, idx) => (
                    <tr key={jt.journeyType} className="row-journey-total">
                      {idx === 0 && (
                        <>
                          <td className="empty-cell" />
                          <td className="empty-cell" />
                          <td
                            rowSpan={reportData.journeyTotals.length}
                            className="journey-total-label-cell"
                          >
                            Journey Total
                          </td>
                        </>
                      )}
                      <td className="journey-total-type-cell font-bold">
                        {jt.journeyType}
                      </td>
                      <td className="highlight-cell text-center">-</td>
                      <td className="highlight-cell text-right font-bold">
                        {Number(jt.transactionCount || 0).toLocaleString()}
                      </td>
                      <td className="highlight-cell text-right font-bold">
                        {Number(jt.transactionAmount || 0).toLocaleString(
                          undefined,
                          { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                        )}
                      </td>
                    </tr>
                  ))}

                  {/* ── Grand Total Row ── */}
                  <tr className="row-grand-total">
                    <td className="empty-cell" />
                    <td className="empty-cell" />
                    <td colSpan="3" className="grand-total-label-cell">
                      Grand Total
                    </td>
                    <td className="grand-total-val-cell text-right">
                      Total Count = {Number(reportData.grandTotal?.totalCount || 0).toLocaleString()}
                    </td>
                    <td className="grand-total-val-cell text-right">
                      Total Amount = ₹{Number(reportData.grandTotal?.totalAmount || 0).toLocaleString(
                        undefined,
                        { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                      )}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer Meta */}
      <div className="report-footer-meta">
        <span className="disclaimer-note">
          * Official NHAI Format: Aggregated directly from Paysonic database transactions.
        </span>
      </div>
    </div>
  );
};

export default NhaiTrafficReport;
