import React, { useState, useEffect, useCallback } from 'react';
import DateWiseReconService from '../../services/recon/DateWiseReconService';
import './DateWiseRecon.scss';

export const DateWiseRecon = () => {
  // Default range: 30 days ago to today 23:59:59
  const getDefaultDateRange = () => {
    const now = new Date();
    const past = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000); // 60 days to cover August seed data
    const pad = (n) => String(n).padStart(2, '0');

    const pastStr = `${past.getFullYear()}-${pad(past.getMonth() + 1)}-${pad(past.getDate())}T00:00:01`;
    const nowStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T23:59:59`;
    return { from: pastStr, to: nowStr };
  };

  const defaultRange = getDefaultDateRange();
  const [fromDate, setFromDate] = useState(defaultRange.from);
  const [toDate, setToDate] = useState(defaultRange.to);
  const [plazaId, setPlazaId] = useState('');

  // Data State
  const [records, setRecords] = useState([]);
  const [expandedRows, setExpandedRows] = useState({});
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Validate date range
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

    const dayDiff = (toTime - fromTime) / (1000 * 60 * 60 * 24);
    if (dayDiff > 90) {
      setErrorMsg('Selected date range exceeds maximum allowed limit of 90 days.');
      return false;
    }

    setErrorMsg('');
    return true;
  };

  // Search from real database
  const handleSearch = useCallback(async () => {
    if (!validateDates(fromDate, toDate)) return;

    setLoading(true);
    setErrorMsg('');
    try {
      const data = await DateWiseReconService.searchDateWiseRecon({
        fromDate,
        toDate,
        plazaId
      });

      setRecords(data || []);
      // Expand all by default if there are few records so user sees the drilldown immediately
      if (Array.isArray(data) && data.length <= 10) {
        const initialExpanded = {};
        data.forEach((r) => {
          initialExpanded[r.rowId] = true;
        });
        setExpandedRows(initialExpanded);
      }
    } catch (err) {
      console.error('[DateWiseRecon] Search failed:', err);
      const msg = err?.response?.data?.error || err?.message || 'Failed to query date wise reconciliation';
      setErrorMsg(msg);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, plazaId]);

  // Initial load
  useEffect(() => {
    handleSearch();
  }, [handleSearch]);

  // Toggle row expansion
  const toggleRow = (rowId) => {
    setExpandedRows((prev) => ({
      ...prev,
      [rowId]: !prev[rowId]
    }));
  };

  // Toggle all rows
  const toggleAll = () => {
    const allExpanded = records.length > 0 && records.every((r) => expandedRows[r.rowId]);
    const nextState = {};
    if (!allExpanded) {
      records.forEach((r) => {
        nextState[r.rowId] = true;
      });
    }
    setExpandedRows(nextState);
  };

  // Export Excel directly from server
  const handleExportExcel = async () => {
    if (!validateDates(fromDate, toDate)) return;

    setExporting(true);
    try {
      await DateWiseReconService.exportExcel({
        fromDate,
        toDate,
        plazaId
      });
    } catch (err) {
      console.error('[DateWiseRecon] Export failed:', err);
      setErrorMsg('Export Error: ' + (err?.response?.data?.error || err?.message || 'Failed to export Excel'));
    } finally {
      setExporting(false);
    }
  };

  // Export CSV matching exact records currently displayed on screen (1:1 guaranteed)
  const handleExportCsv = () => {
    if (!records || records.length === 0) return;

    const headers = ['Plaza ID', 'Plaza Name', 'Txn Date', 'Settlement Date', 'Txn Count', 'Settled Amount'];
    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = [];
    records.forEach((r) => {
      if (r.breakdowns && r.breakdowns.length > 0) {
        r.breakdowns.forEach((b) => {
          rows.push([
            r.plazaId || '',
            r.plazaName || '',
            formatDate(r.txnDate),
            formatDate(b.settlementDate),
            b.txnCount || 0,
            (Number(b.settledAmount) || 0).toFixed(2)
          ]);
        });
      } else {
        rows.push([
          r.plazaId || '',
          r.plazaName || '',
          formatDate(r.txnDate),
          '-',
          r.txnCount || 0,
          (Number(r.settledAmount) || 0).toFixed(2)
        ]);
      }
    });

    const fromStr = fromDate ? fromDate.replace('T', ' ') : '01-08-2026 00:00:00';
    const toStr = toDate ? toDate.replace('T', ' ') : '31-10-2026 23:59:59';
    const midIdx = Math.floor(headers.length / 2);
    const titleArr = Array(headers.length).fill('');
    titleArr[midIdx] = 'DATE WISE RECONCILIATION REPORT';
    const subArr = Array(headers.length).fill('');
    subArr[midIdx] = `From Date: ${fromStr}   |   To Date: ${toStr}`;

    const bannerRows = [
      titleArr.join(','),
      subArr.join(','),
      ''
    ];

    // Summary Total Row
    const totalTxnCount = rows.reduce((acc, r) => acc + (Number(r[4]) || 0), 0);
    const totalSettledAmt = rows.reduce((acc, r) => acc + (Number(r[5]) || 0), 0);
    rows.push(['TOTAL', '', '', '', totalTxnCount, totalSettledAmt.toFixed(2)]);

    const csvContent = '\uFEFF' + [
      ...bannerRows,
      headers.map(escapeCsv).join(','),
      ...rows.map((row) => row.map(escapeCsv).join(','))
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Date_Wise_Recon_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Date formatter (DD-MM-YYYY)
  const formatDate = (dateVal) => {
    if (!dateVal) return '';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return dateVal;
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${dd}-${mm}-${yyyy}`;
    } catch {
      return dateVal;
    }
  };

  // Currency formatter
  const formatCurrency = (amt) => {
    if (amt === null || amt === undefined) return '₹0.00';
    const num = Number(amt);
    if (isNaN(num)) return amt;
    return `₹${num.toFixed(2)}`;
  };

  // Calculate grand totals
  const grandTotalCount = records.reduce((acc, curr) => acc + (Number(curr.txnCount) || 0), 0);
  const grandTotalAmount = records.reduce((acc, curr) => acc + (Number(curr.settledAmount) || 0), 0);

  return (
    <div className="date-recon-page">
      <h2 className="page-title">Date Wise Reconciliation Report</h2>

      {/* Filter Card */}
      <div className="filter-box">
        <div className="filter-row">
          <div className="input-group">
            <label htmlFor="dwrFromDate">
              From Date <span className="req">*</span>
            </label>
            <input
              id="dwrFromDate"
              type="datetime-local"
              step="1"
              className="form-input"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>

          <div className="input-group">
            <label htmlFor="dwrToDate">
              To Date <span className="req">*</span>
            </label>
            <input
              id="dwrToDate"
              type="datetime-local"
              step="1"
              className="form-input"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>

          <div className="input-group">
            <label htmlFor="dwrPlaza">Plaza (Optional)</label>
            <input
              id="dwrPlaza"
              type="text"
              placeholder="e.g. 600601, Dummytollplaza1"
              className="form-input"
              value={plazaId}
              onChange={(e) => setPlazaId(e.target.value)}
            />
          </div>

          <div className="btn-group">
            <button
              type="button"
              className="btn-orange"
              onClick={handleExportExcel}
              disabled={exporting || loading || records.length === 0}
              id="dwrExportBtn"
            >
              {exporting ? 'Exporting...' : 'Export Excel'}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleExportCsv}
              disabled={loading || records.length === 0}
              id="dwrExportCsvBtn"
            >
              Export CSV
            </button>

            <button
              type="button"
              className="btn-orange"
              onClick={handleSearch}
              disabled={loading}
              id="dwrSearchBtn"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="error-banner">
            <span>⚠️</span> {errorMsg}
          </div>
        )}
      </div>

      {/* Hierarchical Two-Tier Table */}
      <div className="table-card">
        <div className="table-top-bar">
          <div>
            Showing <strong>{records.length}</strong> date reconciliation groups (Grand Total: <strong>{grandTotalCount}</strong> transactions, <strong>{formatCurrency(grandTotalAmount)}</strong> settled)
          </div>

          {records.length > 0 && (
            <button type="button" className="expand-all-btn" onClick={toggleAll}>
              {records.every((r) => expandedRows[r.rowId]) ? 'Collapse All −' : 'Expand All +'}
            </button>
          )}
        </div>

        <div className="table-scroll">
          {loading ? (
            <div className="loading-msg">
              <div className="spinner"></div>
              <p>Aggregating date reconciliation data from database...</p>
            </div>
          ) : records.length === 0 ? (
            <div className="empty-msg">
              <h4>No Reconciliation Records Found</h4>
              <p>No settled transactions found for the selected date range.</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th className="col-toggle"></th>
                  <th>Plaza ID</th>
                  <th>Plaza Name</th>
                  <th>Txn Date</th>
                  <th className="text-right">Txn Count</th>
                  <th className="text-right">Settled Amount</th>
                </tr>
              </thead>
              <tbody>
                {records.map((summary) => {
                  const isExpanded = Boolean(expandedRows[summary.rowId]);

                  return (
                    <React.Fragment key={summary.rowId}>
                      {/* Parent / Collapsed Summary Row */}
                      <tr className={`parent-row ${isExpanded ? 'is-expanded' : ''}`}>
                        <td className="text-center">
                          <button
                            type="button"
                            className="btn-toggle"
                            onClick={() => toggleRow(summary.rowId)}
                            title={isExpanded ? 'Collapse breakdown' : 'Expand settlement dates'}
                          >
                            {isExpanded ? '−' : '+'}
                          </button>
                        </td>
                        <td>{summary.plazaId}</td>
                        <td style={{ fontWeight: 600 }}>{summary.plazaName}</td>
                        <td>{formatDate(summary.txnDate)}</td>
                        <td className="text-right" style={{ fontWeight: 600 }}>
                          {summary.txnCount}
                        </td>
                        <td className="text-right amt-val">
                          {formatCurrency(summary.settledAmount)}
                        </td>
                      </tr>

                      {/* Expanded Child Breakdown Sub-Table */}
                      {isExpanded && (
                        <tr className="child-container-row">
                          <td colSpan="6">
                            <div className="child-table-wrapper">
                              <table className="child-table">
                                <thead>
                                  <tr>
                                    <th>Plaza ID</th>
                                    <th>Plaza Name</th>
                                    <th>Txn Date</th>
                                    <th>Settlement Date</th>
                                    <th className="text-right">Txn Count</th>
                                    <th className="text-right">Settled Amount</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {summary.breakdowns && summary.breakdowns.length > 0 ? (
                                    summary.breakdowns.map((b, idx) => (
                                      <tr key={idx}>
                                        <td>{summary.plazaId}</td>
                                        <td>{summary.plazaName}</td>
                                        <td>{formatDate(summary.txnDate)}</td>
                                        <td style={{ fontWeight: 600, color: '#c2410c' }}>
                                          {formatDate(b.settlementDate)}
                                        </td>
                                        <td className="text-right">{b.txnCount}</td>
                                        <td className="text-right" style={{ fontWeight: 600 }}>
                                          {formatCurrency(b.settledAmount)}
                                        </td>
                                      </tr>
                                    ))
                                  ) : (
                                    <tr>
                                      <td colSpan="6" style={{ textAlign: 'center', color: '#9ca3af' }}>
                                        No settlement date breakdown available.
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td></td>
                  <td colSpan="3">Total</td>
                  <td className="text-right">{grandTotalCount}</td>
                  <td className="text-right">{formatCurrency(grandTotalAmount)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default DateWiseRecon;
