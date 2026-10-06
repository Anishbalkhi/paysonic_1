import React, { useState, useEffect, useCallback, useMemo } from 'react';
import DisputeReportService from '../../services/dispute/DisputeReportService';
import ReportKpiGrid from '../../components/ReportKpiGrid/ReportKpiGrid';
import './DisputeDetailReport.scss';

export const DisputeDetailReport = () => {
  // Default date range: September 2026 (matching reference data)
  const getDefaultDateRange = () => {
    const fromStr = '2026-09-01T00:00:00';
    const toStr = '2026-09-30T23:59:59';
    return { from: fromStr, to: toStr };
  };

  const defaultRange = getDefaultDateRange();
  const [fromDate, setFromDate] = useState(defaultRange.from);
  const [toDate, setToDate] = useState(defaultRange.to);
  const [plazaId, setPlazaId] = useState('ALL');
  const [functionCode, setFunctionCode] = useState('ALL');

  // State
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Validate dates
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

  // Search function from live Railway DB
  const handleSearch = useCallback(async (overrideFrom, overrideTo, overridePlaza, overrideFunc) => {
    const fDate = (typeof overrideFrom === 'string' && overrideFrom) ? overrideFrom : fromDate;
    const tDate = (typeof overrideTo === 'string' && overrideTo) ? overrideTo : toDate;
    const pId = (typeof overridePlaza === 'string' && overridePlaza) ? overridePlaza : plazaId;
    const fCode = (typeof overrideFunc === 'string' && overrideFunc) ? overrideFunc : functionCode;

    if (!validateDates(fDate, tDate)) return;

    setLoading(true);
    setErrorMsg('');
    try {
      const data = await DisputeReportService.searchDisputes({
        fromDate: fDate,
        toDate: tDate,
        plazaId: pId,
        functionCode: fCode,
        page: 0,
        size: 100
      });

      const content = data?.content ? data.content : Array.isArray(data) ? data : [];
      setRecords(content);
    } catch (err) {
      console.error('[DisputeDetailReport] Search error:', err);
      const msg = err?.response?.data?.error || err?.message || 'Failed to load dispute records from database.';
      setErrorMsg(msg);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, plazaId, functionCode]);

  useEffect(() => {
    handleSearch();
  }, [handleSearch]);

  const handleReset = () => {
    const def = getDefaultDateRange();
    setFromDate(def.from);
    setToDate(def.to);
    setPlazaId('ALL');
    setFunctionCode('ALL');
    setSearchTerm('');
    handleSearch(def.from, def.to, 'ALL', 'ALL');
  };

  // Client-side quick filter
  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const q = searchTerm.toLowerCase().trim();
    return records.filter((r) =>
      (r.plazaName && r.plazaName.toLowerCase().includes(q)) ||
      (r.plazaId && r.plazaId.toLowerCase().includes(q)) ||
      (r.acqTxnId && r.acqTxnId.toLowerCase().includes(q)) ||
      (r.tollTxnId && r.tollTxnId.toLowerCase().includes(q)) ||
      (r.vehicleNo && r.vehicleNo.toLowerCase().includes(q)) ||
      (r.tagId && r.tagId.toLowerCase().includes(q)) ||
      (r.tid && r.tid.toLowerCase().includes(q)) ||
      (r.functionCode && r.functionCode.toLowerCase().includes(q))
    );
  }, [records, searchTerm]);

  // Totals
  const { totalTxnAmt, totalDisputeAmt } = useMemo(() => {
    let tAmt = 0;
    let dAmt = 0;
    filteredRecords.forEach((r) => {
      tAmt += Number(r.txnAmount || 0);
      dAmt += Number(r.disputeAmount || 0);
    });
    return {
      totalTxnAmt: tAmt.toFixed(2),
      totalDisputeAmt: dAmt.toFixed(2)
    };
  }, [filteredRecords]);

  // Export handlers
  const handleExportExcel = async () => {
    if (exportingExcel || exportingCsv) return;
    setExportingExcel(true);
    try {
      await DisputeReportService.exportExcel({
        fromDate,
        toDate,
        plazaId,
        functionCode
      });
    } catch (err) {
      console.error('[DisputeDetailReport] Excel export error:', err);
      alert('Failed to export Excel. Please try again.');
    } finally {
      setExportingExcel(false);
    }
  };

  const handleExportCsv = async () => {
    if (exportingExcel || exportingCsv) return;
    setExportingCsv(true);
    try {
      await DisputeReportService.exportCsv({
        fromDate,
        toDate,
        plazaId,
        functionCode
      });
    } catch (err) {
      console.error('[DisputeDetailReport] CSV export error:', err);
      alert('Failed to export CSV. Please try again.');
    } finally {
      setExportingCsv(false);
    }
  };

  const formatDateTime = (val) => {
    if (!val) return '--';
    try {
      const d = new Date(val);
      if (isNaN(d.getTime())) return val;
      const pad = (n) => String(n).padStart(2, '0');
      return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    } catch {
      return val;
    }
  };

  const formatDate = (val) => {
    if (!val) return '--';
    try {
      const d = new Date(val);
      if (isNaN(d.getTime())) return val;
      const pad = (n) => String(n).padStart(2, '0');
      return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
    } catch {
      return val;
    }
  };

  return (
    <div className="dispute-report-page">
      {/* Top Banner Header */}
      <header className="page-header">
        <div className="header-titles">
          <h1 className="page-title">Dispute Detail Report</h1>
          <p className="subtitle">
            Audited Toll Dispute Adjustments &amp; Chargebacks
          </p>
        </div>
      </header>

      {/* Filter Card */}
      <div className="filter-card">
        <div className="filter-row">
          <div className="filter-group">
            <label htmlFor="fromDate">From Date *</label>
            <input
              id="fromDate"
              type="datetime-local"
              step="1"
              value={fromDate.slice(0, 19)}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label htmlFor="toDate">To Date *</label>
            <input
              id="toDate"
              type="datetime-local"
              step="1"
              value={toDate.slice(0, 19)}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label htmlFor="plazaSelect">Plaza (Optional)</label>
            <select
              id="plazaSelect"
              value={plazaId}
              onChange={(e) => setPlazaId(e.target.value)}
            >
              <option value="ALL">All Plazas</option>
              <option value="600601">Dummytollplaza1 (600601)</option>
              <option value="600602">Dummytollplaza2 (600602)</option>
              <option value="778999">Gluten (778999)</option>
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="functionCodeSelect">Function Code</label>
            <select
              id="functionCodeSelect"
              value={functionCode}
              onChange={(e) => setFunctionCode(e.target.value)}
            >
              <option value="ALL">All Codes</option>
              <option value="753: Debit Adjustment">753: Debit Adjustment</option>
              <option value="762: Credit Adjustment">762: Credit Adjustment</option>
            </select>
          </div>

          <div className="btn-group">
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
              onClick={() => handleSearch()}
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
            >
              Reset
            </button>
          </div>
        </div>

        {errorMsg && <div className="error-alert">{errorMsg}</div>}
      </div>

      {/* Summary KPI Cards / Small Dashboard */}
      <ReportKpiGrid
        cards={[
          {
            label: 'Total Disputes',
            value: filteredRecords.length,
            sub: 'Filtered Transactions'
          },
          {
            label: 'Total Transaction Amount',
            value: `₹ ${Number(totalTxnAmt).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
            sub: 'Gross Toll Amount',
            highlight: 'blue'
          },
          {
            label: 'Total Dispute Amount',
            value: `₹ ${Number(totalDisputeAmt).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
            sub: 'Adjusted / Chargebacked',
            highlight: 'amber'
          }
        ]}
      />

      {/* Search Bar for Quick Filtering */}
      <div className="table-controls-bar">
        <div className="table-info">
          Showing <strong>{filteredRecords.length}</strong> dispute record{filteredRecords.length !== 1 ? 's' : ''}
        </div>
        <div className="quick-search">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Quick search vehicle, tag, plaza, ID..."
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
      <div className="table-wrapper">
        {/* Centered Table Banner matching Image 2 reference */}
        <div className="table-top-banner">
          <div className="banner-title">DISPUTE DETAIL REPORT</div>
          <div className="banner-subtitle">
            From Date: {formatDateTime(fromDate)} &nbsp; | &nbsp; To Date: {formatDateTime(toDate)}
          </div>
          <div className="banner-green-bar" />
        </div>

        <div className="table-responsive">
          <table className="dispute-table">
            <thead>
              <tr>
                <th>Sr No</th>
                <th>Plaza Name</th>
                <th>Plaza ID</th>
                <th>Acq Txn ID</th>
                <th>Toll Txn ID</th>
                <th>Txn Date Time</th>
                <th className="num-col">Txn Amount</th>
                <th className="num-col">Dispute Amount</th>
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
              {loading ? (
                <tr>
                  <td colSpan="18" className="empty-state">
                    <span className="spinner-border table-spinner" />
                    <span>Querying Railway MySQL Database...</span>
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan="18" className="empty-state">
                    No dispute records found for the selected criteria.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((item, index) => {
                  const ind = (item.settlementIndicator || '').trim();
                  const isDr = ind.toLowerCase() === 'dr';
                  const isCr = ind.toLowerCase() === 'cr';

                  return (
                    <tr key={item.id || index}>
                      <td className="text-center">{index + 1}</td>
                      <td className="font-semibold">{item.plazaName}</td>
                      <td className="text-center code-font">{item.plazaId}</td>
                      <td className="code-font">{item.acqTxnId}</td>
                      <td className="code-font text-center">{item.tollTxnId}</td>
                      <td className="text-center">{formatDateTime(item.txnDateTime)}</td>
                      <td className="num-col">₹ {Number(item.txnAmount || 0).toFixed(2)}</td>
                      <td className="num-col font-bold">₹ {Number(item.disputeAmount || 0).toFixed(2)}</td>
                      <td className="code-font text-center">{item.vehicleNo}</td>
                      <td className="code-font tag-cell" title={item.tagId}>{item.tagId}</td>
                      <td className="code-font tid-cell" title={item.tid}>{item.tid}</td>
                      <td className="text-center code-font">{item.issuerId}</td>
                      <td className="text-center">{item.intTrackingNo || 'NA'}</td>
                      <td>
                        <span className="func-code-badge">{item.functionCode}</span>
                      </td>
                      <td className="text-center">
                        <span
                          className={`settle-badge ${
                            isDr ? 'badge-dr' : isCr ? 'badge-cr' : 'badge-neutral'
                          }`}
                        >
                          {ind || '--'}
                        </span>
                      </td>
                      <td className="text-center">{item.messageReasonCode || '--'}</td>
                      <td className="msg-cell" title={item.memberMessageText}>
                        {item.memberMessageText || '--'}
                      </td>
                      <td className="text-center">{formatDate(item.npciSettlementDate)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {filteredRecords.length > 0 && (
              <tfoot>
                <tr className="total-summary-row">
                  <td colSpan="6" className="total-label text-center">
                    TOTAL
                  </td>
                  <td className="num-col total-amount">
                    ₹ {Number(totalTxnAmt).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="num-col total-amount">
                    ₹ {Number(totalDisputeAmt).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td colSpan="10" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};

export default DisputeDetailReport;
