import React, { useState, useEffect, useCallback, useMemo } from 'react';
import NhaiTrafficService from '../../services/summary/NhaiTrafficService';
import useOnboardedPlazas from '../../hooks/useOnboardedPlazas';
import { useAuth } from '../../context/AuthContext';
import { normalizePlaza } from '../../utils/plazaNormalizer';
import { formatFetchTime } from '../../utils/dateUtils';
import ReportKpiGrid from '../../components/ReportKpiGrid/ReportKpiGrid';
import './NhaiTrafficReport.scss';

export const NhaiTrafficReport = () => {
  const { currentUser } = useAuth();
  // Default date range: September 2026
  const getDefaultDateRange = () => ({
    from: '2026-09-01',
    to: '2026-09-30'
  });

  const initialRange = getDefaultDateRange();
  const { plazas, isPlazaLocked, defaultPlazaId } = useOnboardedPlazas();
  const [fromDate, setFromDate] = useState(initialRange.from);
  const [toDate, setToDate] = useState(initialRange.to);
  const [plazaCode, setPlazaCode] = useState(defaultPlazaId || 'ALL');

  useEffect(() => {
    if (isPlazaLocked && defaultPlazaId && defaultPlazaId !== 'ALL') {
      setPlazaCode(defaultPlazaId);
    }
  }, [isPlazaLocked, defaultPlazaId]);

  const [reportData, setReportData] = useState(null);
  const [fetchTime, setFetchTime] = useState('');
  const [downloadTime, setDownloadTime] = useState('');
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
    const pCode = (typeof overridePlaza === 'string' && overridePlaza)
      ? overridePlaza
      : (isPlazaLocked && defaultPlazaId !== 'ALL' ? defaultPlazaId : plazaCode);

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
      setFetchTime(formatFetchTime(new Date()));
    } catch (err) {
      console.error('[NhaiTrafficReport] Failed to load data:', err);
      const msg = err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Database error occurred';
      setErrorMsg(`Database Query Error: ${msg}`);
      setReportData(null);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, plazaCode, isPlazaLocked, defaultPlazaId]);

  useEffect(() => {
    handleSearch(fromDate, toDate, isPlazaLocked ? defaultPlazaId : plazaCode);
  }, [isPlazaLocked, defaultPlazaId]);

  const handleReset = () => {
    const def = getDefaultDateRange();
    const resetPlaza = isPlazaLocked ? defaultPlazaId : 'ALL';
    setFromDate(def.from);
    setToDate(def.to);
    setPlazaCode(resetPlaza);
    setErrorMsg('');
    handleSearch(def.from, def.to, resetPlaza);
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
      setDownloadTime(formatFetchTime(new Date()));
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
      setDownloadTime(formatFetchTime(new Date()));
    } catch (err) {
      console.error('[NhaiTrafficReport] CSV export failed:', err);
      alert('Failed to export CSV report. Please try again.');
    } finally {
      setExportingCsv(false);
    }
  };

  const dateSubtitle = useMemo(() => {
    if (!fromDate || !toDate) return '';
    const f = (d) => {
      try {
        const dt = new Date(d);
        if (isNaN(dt.getTime())) return d;
        return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      } catch {
        return d;
      }
    };
    return `Report Period: ${f(fromDate)} — ${f(toDate)}`;
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

  const journeyTotals = useMemo(() => {
    const list = reportData?.journeyTotals || [];
    const findItem = (pattern, fallbackType) => {
      const found = list.find((j) => (j.journeyType || '').toLowerCase().includes(pattern.toLowerCase()));
      return found || { journeyType: fallbackType, transactionCount: 0, transactionAmount: 0 };
    };
    return {
      single: findItem('single', 'Total Single Journey'),
      ret: findItem('return', 'Total Return Journey'),
      discount: findItem('discount', 'Total DiscountDC'),
      exempt: findItem('exempt', 'Total Exempted/ Pass vehicles'),
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
      {/* Top Header */}
      {/* 1. Header Banner */}
      <header className="page-header">
        <div className="header-titles">
          <h1 className="page-title">NHAI Traffic Report</h1>
          <p className="subtitle">
            FASTag Traffic Analysis &amp; Journey Revenue Collection
          </p>
        </div>
      </header>

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
              className={`filter-select ${isPlazaLocked ? 'disabled-locked' : ''}`}
              value={plazaCode}
              disabled={isPlazaLocked}
              onChange={(e) => setPlazaCode(e.target.value)}
            >
              {!isPlazaLocked && (
                <option value="ALL">
                  {currentUser?.role === 'Concessionaire' ? 'All Portfolio Plazas' : 'All Plazas Network'}
                </option>
              )}
              {plazas.map((p) => (
                <option key={p.id} value={p.id}>
                  {isPlazaLocked ? `🔒 ${p.id} - ${p.name} (Assigned Plaza)` : `${p.id} - ${p.name}`}
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
        {/* Centered Table Banner matching other reports */}
        <div className="table-top-banner">
          <div className="banner-title">NHAI TRAFFIC REPORT</div>
          <div className="banner-subtitle">
            From Date: {fromDate} &nbsp; | &nbsp; To Date: {toDate}
          </div>
          <div className="banner-green-bar" />
        </div>

        <div className="table-responsive">
          <table className="nhai-styled-table">
            <thead>
              <tr>
                <th className="text-center">PLAZA CODE</th>
                <th>PLAZA NAME</th>
                <th>VEHICLE CLASS</th>
                <th>JOURNEY TYPE</th>
                <th className="text-right">TOLL FARE</th>
                <th className="text-right">TRANSACTION COUNT</th>
                <th className="text-right">TRANSACTION AMOUNT</th>
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
                          {isFirstGlobalRow && (() => {
                            const normPlaza = normalizePlaza(reportData.plazaCode, reportData.plazaName, plazas);
                            return (
                              <>
                                <td
                                  rowSpan={totalRowsInClasses}
                                  className="text-center font-bold border-merged-cell plaza-code-cell"
                                >
                                  {normPlaza.plazaId}
                                </td>
                                <td
                                  rowSpan={totalRowsInClasses}
                                  className="font-semibold border-merged-cell plaza-name-cell"
                                >
                                  {normPlaza.plazaName}
                                </td>
                              </>
                            );
                          })()}

                          {/* Col 2: Vehicle Class (spans 4 rows of the class) */}
                          {isFirstInClass && (
                            <td
                              rowSpan={journeys.length}
                              className="vc-title-cell font-bold border-merged-cell"
                            >
                              {vcGroup.className}
                            </td>
                          )}

                          {/* Col 3: Journey Type */}
                          <td className="journey-type-cell">
                            {journey.journeyType}
                          </td>

                          {/* Col 4: Toll Fare */}
                          <td className="text-right num-cell">
                            {Number(journey.tollFare || 0) > 0
                              ? Number(journey.tollFare).toFixed(2)
                              : '-'}
                          </td>

                          {/* Col 5: Transaction Count */}
                          <td className="text-right num-cell font-medium">
                            {Number(journey.transactionCount || 0).toLocaleString()}
                          </td>

                          {/* Col 6: Transaction Amount */}
                          <td className="text-right num-cell font-semibold">
                            {Number(journey.transactionAmount || 0).toLocaleString(
                              undefined,
                              { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                            )}
                          </td>
                        </tr>
                      );
                    });
                  })}

                  {/* ── Journey Total & Summary Block ── */}
                  {/* Row 1: Total Single Journey */}
                  <tr className="row-single-total">
                    <td rowSpan={4} className="summary-empty-cell" />
                    <td rowSpan={4} className="summary-empty-cell" />
                    <td rowSpan={4} className="summary-journey-center-cell font-bold text-center">
                      Journey Total
                    </td>
                    <td className="summary-yellow-cell font-bold">
                      {journeyTotals.single.journeyType}
                    </td>
                    <td className="summary-yellow-cell text-center font-bold">-</td>
                    <td className="summary-yellow-cell text-right font-bold">
                      {Number(journeyTotals.single.transactionCount || 0).toLocaleString()}
                    </td>
                    <td className="summary-yellow-cell text-right font-bold">
                      {Number(journeyTotals.single.transactionAmount || 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  </tr>

                  {/* Row 2: Total Return Journey */}
                  <tr className="row-journey-return">
                    <td className="summary-yellow-cell font-bold">
                      {journeyTotals.ret.journeyType}
                    </td>
                    <td className="summary-yellow-cell text-center font-bold">-</td>
                    <td className="summary-yellow-cell text-right font-bold">
                      {Number(journeyTotals.ret.transactionCount || 0).toLocaleString()}
                    </td>
                    <td className="summary-yellow-cell text-right font-bold">
                      {Number(journeyTotals.ret.transactionAmount || 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  </tr>

                  {/* Row 3: Total DiscountDC */}
                  <tr className="row-journey-discount">
                    <td className="summary-yellow-cell font-bold">
                      {journeyTotals.discount.journeyType}
                    </td>
                    <td className="summary-yellow-cell text-center font-bold">-</td>
                    <td className="summary-yellow-cell text-right font-bold">
                      {Number(journeyTotals.discount.transactionCount || 0).toLocaleString()}
                    </td>
                    <td className="summary-yellow-cell text-right font-bold">
                      {Number(journeyTotals.discount.transactionAmount || 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  </tr>

                  {/* Row 4: Total Exempted/ Pass vehicles */}
                  <tr className="row-journey-exempt">
                    <td className="summary-yellow-cell font-bold">
                      {journeyTotals.exempt.journeyType}
                    </td>
                    <td className="summary-yellow-cell text-center font-bold">-</td>
                    <td className="summary-yellow-cell text-right font-bold">
                      {Number(journeyTotals.exempt.transactionCount || 0).toLocaleString()}
                    </td>
                    <td className="summary-yellow-cell text-right font-bold">
                      {Number(journeyTotals.exempt.transactionAmount || 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  </tr>

                  {/* Row 5: GRAND TOTAL */}
                  <tr className="row-grand-total">
                    <td colSpan={5} className="grand-total-label-cell">
                      GRAND TOTAL
                    </td>
                    <td className="grand-total-val-cell text-center">
                      Total Count = {Number(reportData.grandTotal?.totalCount || 0).toLocaleString()}
                    </td>
                    <td className="grand-total-val-cell text-center">
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
