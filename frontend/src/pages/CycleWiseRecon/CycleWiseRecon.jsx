import React, { useState, useEffect, useCallback, useMemo } from 'react';
import CycleWiseReconService from '../../services/recon/CycleWiseReconService';
import './CycleWiseRecon.scss';

export const CycleWiseRecon = () => {
  // Default range: 60 days ago to today
  const getDefaultDateRange = () => {
    const now = new Date();
    const past = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const pad = (n) => String(n).padStart(2, '0');

    const pastStr = `${past.getFullYear()}-${pad(past.getMonth() + 1)}-${pad(past.getDate())}T00:00:01`;
    const nowStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T23:59:59`;
    return { from: pastStr, to: nowStr };
  };

  const defaultRange = getDefaultDateRange();
  const [fromDate, setFromDate] = useState(defaultRange.from);
  const [toDate, setToDate] = useState(defaultRange.to);
  const [plazaId, setPlazaId] = useState('');
  const [cycle, setCycle] = useState('');

  // Data State
  const [records, setRecords] = useState([]);
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
      const data = await CycleWiseReconService.searchCycleWiseRecon({
        fromDate,
        toDate,
        plazaId,
        cycle
      });

      setRecords(data || []);
    } catch (err) {
      console.error('[CycleWiseRecon] Search failed:', err);
      const msg = err?.response?.data?.error || err?.message || 'Failed to query cycle wise reconciliation';
      setErrorMsg(msg);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, plazaId, cycle]);

  // Initial load
  useEffect(() => {
    handleSearch();
  }, [handleSearch]);

  // Reset filters
  const handleReset = () => {
    const range = getDefaultDateRange();
    setFromDate(range.from);
    setToDate(range.to);
    setPlazaId('');
    setCycle('');
  };

  // Export to Excel (Server XLSX)
  const handleExport = async () => {
    if (!validateDates(fromDate, toDate)) return;

    setExporting(true);
    try {
      await CycleWiseReconService.exportExcel({
        fromDate,
        toDate,
        plazaId,
        cycle
      });
    } catch (err) {
      console.error('[CycleWiseRecon] Export failed:', err);
      alert('Failed to export Cycle Wise Report: ' + (err?.message || 'Server error'));
    } finally {
      setExporting(false);
    }
  };

  // Export CSV matching exact records currently displayed on screen (1:1 guaranteed)
  const handleExportCsv = () => {
    if (!records || records.length === 0) return;

    const headers = [
      'Plaza Id', 'Plaza Name', 'Plaza Settlement Date', 'Recon Cycle',
      'Txn Count', 'Txn Amount', 'Dispute Add Count', 'Dispute Add Amount',
      'Dispute Sub Count', 'Dispute Sub Amount', 'Total Amount',
      'Service Fees', 'Service GST', '0.013 GST(1.30%)', 'GST(1.30%)', 'Settled Amount'
    ];

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = records.map((r) => [
      r.plazaId || '',
      r.plazaName || '',
      formatDate(r.plazaSettlementDate),
      r.reconCycle || '',
      r.txnCount || 0,
      Number(r.txnAmount || 0).toFixed(2),
      r.disputeAddCount || 0,
      Number(r.disputeAddAmount || 0).toFixed(2),
      r.disputeSubCount || 0,
      Number(r.disputeSubAmount || 0).toFixed(2),
      Number(r.totalAmount || 0).toFixed(2),
      Number(r.serviceFees || 0).toFixed(2),
      Number(r.serviceGst || 0).toFixed(2),
      Number(r.fee130 || 0).toFixed(2),
      Number(r.gstOnFee130 || 0).toFixed(2),
      Number(r.settledAmount || 0).toFixed(2)
    ]);

    const fromStr = fromDate ? fromDate.replace('T', ' ') : '01-08-2026 00:00:00';
    const toStr = toDate ? toDate.replace('T', ' ') : '31-10-2026 23:59:59';
    const midIdx = Math.floor(headers.length / 2);
    const titleArr = Array(headers.length).fill('');
    titleArr[midIdx] = 'CYCLE WISE RECONCILIATION REPORT';
    const subArr = Array(headers.length).fill('');
    subArr[midIdx] = `From Date: ${fromStr}   |   To Date: ${toStr}`;

    const bannerRows = [
      titleArr.join(','),
      subArr.join(','),
      ''
    ];

    // Summary Total Row
    const totTxnCount = rows.reduce((acc, r) => acc + (Number(r[4]) || 0), 0);
    const totTxnAmt = rows.reduce((acc, r) => acc + (Number(r[5]) || 0), 0);
    const totDisputeAddAmt = rows.reduce((acc, r) => acc + (Number(r[7]) || 0), 0);
    const totDisputeSubAmt = rows.reduce((acc, r) => acc + (Number(r[9]) || 0), 0);
    const totTotalAmt = rows.reduce((acc, r) => acc + (Number(r[10]) || 0), 0);
    const totSettledAmt = rows.reduce((acc, r) => acc + (Number(r[15]) || 0), 0);

    const totalRow = Array(headers.length).fill('');
    totalRow[0] = 'TOTAL';
    totalRow[4] = totTxnCount;
    totalRow[5] = totTxnAmt.toFixed(2);
    totalRow[7] = totDisputeAddAmt.toFixed(2);
    totalRow[9] = totDisputeSubAmt.toFixed(2);
    totalRow[10] = totTotalAmt.toFixed(2);
    totalRow[15] = totSettledAmt.toFixed(2);
    rows.push(totalRow);

    const csvContent = '\uFEFF' + [
      ...bannerRows,
      headers.map(escapeCsv).join(','),
      ...rows.map((row) => row.map(escapeCsv).join(','))
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Cycle_Wise_Report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Format currency with 2 decimals
  const formatAmt = (val) => {
    if (val === null || val === undefined) return '0.00';
    return Number(val).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // Format date dd-mm-yyyy
  const formatDate = (val) => {
    if (!val) return '-';
    try {
      const d = new Date(val);
      const pad = (n) => String(n).padStart(2, '0');
      return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
    } catch {
      return val;
    }
  };

  // KPI Calculations
  const kpis = useMemo(() => {
    let totalTxns = 0;
    let totalGross = 0;
    let totalDisputeAdd = 0;
    let totalDisputeSub = 0;
    let totalNetSettled = 0;
    let totalFees = 0;

    records.forEach((r) => {
      totalTxns += Number(r.txnCount || 0);
      totalGross += Number(r.txnAmount || 0);
      totalDisputeAdd += Number(r.disputeAddAmount || 0);
      totalDisputeSub += Number(r.disputeSubAmount || 0);
      totalNetSettled += Number(r.settledAmount || 0);
      totalFees += (Number(r.serviceFees || 0) + Number(r.serviceGst || 0) + Number(r.fee130 || 0) + Number(r.gstOnFee130 || 0));
    });

    const netDispute = totalDisputeAdd - totalDisputeSub;

    return {
      cyclesCount: records.length,
      totalTxns,
      totalGross,
      netDispute,
      totalFees,
      totalNetSettled
    };
  }, [records]);

  // Compute rowSpan mapping for consecutive rows with the same plazaId
  const rowSpanMap = useMemo(() => {
    const map = {};
    let i = 0;
    while (i < records.length) {
      const pId = records[i].plazaId;
      let span = 1;
      while (i + span < records.length && records[i + span].plazaId === pId) {
        span++;
      }
      map[i] = span;
      i += span;
    }
    return map;
  }, [records]);

  return (
    <div className="cycle-recon-page">
      {/* Top Header */}
      <div className="page-header-row">
        <div className="title-area">
          <h1 className="page-title">
            Cycle Wise Report
            <span className="live-tag">Live Bank Recon</span>
          </h1>
          <p className="page-subtitle">
            NPCI Acquirer Settlement Cycles, Dispute Adjustments & Net Bank Remittance
          </p>
        </div>

      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card primary">
          <span className="kpi-title">Settlement Cycles</span>
          <span className="kpi-value">{kpis.cyclesCount}</span>
          <span className="kpi-sub">Across all plazas</span>
        </div>
        <div className="kpi-card info">
          <span className="kpi-title">Total Txns</span>
          <span className="kpi-value">{kpis.totalTxns.toLocaleString()}</span>
          <span className="kpi-sub">Processed transactions</span>
        </div>
        <div className="kpi-card warning">
          <span className="kpi-title">Gross Txn Amount</span>
          <span className="kpi-value">₹{formatAmt(kpis.totalGross)}</span>
          <span className="kpi-sub">Before fees & disputes</span>
        </div>
        <div className="kpi-card slate">
          <span className="kpi-title">Net Dispute Adj.</span>
          <span className="kpi-value">₹{formatAmt(kpis.netDispute)}</span>
          <span className="kpi-sub">(+Credit / -Debit)</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-title">MDR & NPCI Switch</span>
          <span className="kpi-value">₹{formatAmt(kpis.totalFees)}</span>
          <span className="kpi-sub">Total service fee + GST</span>
        </div>
        <div className="kpi-card success">
          <span className="kpi-title">Net Settled Amount</span>
          <span className="kpi-value">₹{formatAmt(kpis.totalNetSettled)}</span>
          <span className="kpi-sub">Final bank remittance</span>
        </div>
      </div>

      {/* Search & Filter Form */}
      <div className="filter-box">
        <div className="filter-row">
          <div className="input-group">
            <label>
              From Settlement Date <span className="req">*</span>
            </label>
            <input
              type="datetime-local"
              step="1"
              className="form-input"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>

          <div className="input-group">
            <label>
              To Settlement Date <span className="req">*</span>
            </label>
            <input
              type="datetime-local"
              step="1"
              className="form-input"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>

          <div className="input-group">
            <label>Plaza ID / Name</label>
            <input
              type="text"
              placeholder="e.g. 600601 or Dummytoll"
              className="form-input"
              value={plazaId}
              onChange={(e) => setPlazaId(e.target.value)}
            />
          </div>

          <div className="input-group" style={{ maxWidth: '160px' }}>
            <label>Recon Cycle</label>
            <select
              className="form-select"
              value={cycle}
              onChange={(e) => setCycle(e.target.value)}
            >
              <option value="">All Cycles</option>
              <option value="1">Cycle 1</option>
              <option value="2">Cycle 2</option>
              <option value="3">Cycle 3</option>
            </select>
          </div>

          <div className="btn-group">
            <button
              type="button"
              className="btn-orange"
              onClick={handleExport}
              disabled={exporting || loading || records.length === 0}
              id="cwrExportBtn"
            >
              {exporting ? 'Exporting...' : 'Export Excel'}
            </button>
            <button
              type="button"
              className="btn-orange"
              onClick={handleExportCsv}
              disabled={loading || records.length === 0}
              id="cwrExportCsvBtn"
            >
              Export CSV
            </button>
            <button
              type="button"
              className="btn-orange"
              onClick={handleSearch}
              disabled={loading}
              id="cwrSearchBtn"
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

        {errorMsg && (
          <div className="error-banner">
            <span>⚠️</span>
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Results Table Card */}
      <div className="table-card">
        <div className="table-top-bar">
          <div>
            Showing <span className="record-count">{records.length}</span> cycle records
          </div>
          <div className="table-badge">NPCI Standard 16-Column Settlement Format</div>
        </div>

        {loading ? (
          <div className="state-container">
            <div className="spinner"></div>
            <p className="state-title">Aggregating Cycle Settlement Data...</p>
            <p className="state-desc">Querying live database records and calculating MDR & GST</p>
          </div>
        ) : records.length === 0 ? (
          <div className="state-container">
            <span style={{ fontSize: '32px' }}>📂</span>
            <p className="state-title">No cycle reconciliation records found</p>
            <p className="state-desc">Try expanding the date range or clearing the plaza filters.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="cycle-table">
              <thead>
                <tr>
                  <th>Plaza Id</th>
                  <th>Plaza Name</th>
                  <th>Plaza Settlement Date</th>
                  <th>Recon Cycle</th>
                  <th className="num-col">Txn Count</th>
                  <th className="num-col">Txn Amount</th>
                  <th className="num-col">Dispute Add Count</th>
                  <th className="num-col">Dispute Add Amount</th>
                  <th className="num-col">Dispute Sub Count</th>
                  <th className="num-col">Dispute Sub Amount</th>
                  <th className="num-col">Total Amount</th>
                  <th className="num-col">Service Fees</th>
                  <th className="num-col">Service GST</th>
                  <th className="num-col">0.013 GST(1.30%)</th>
                  <th className="num-col">GST(1.30%)</th>
                  <th className="num-col">Settled Amount</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r, idx) => {
                  const isFirstOfGroup = rowSpanMap[idx] !== undefined;
                  const span = rowSpanMap[idx] || 1;

                  return (
                    <tr key={r.rowId || idx}>
                      {/* Merged Plaza ID Cell */}
                      {isFirstOfGroup && (
                        <td rowSpan={span} className="merged-cell">
                          {r.plazaId}
                        </td>
                      )}

                      {/* Merged Plaza Name Cell */}
                      {isFirstOfGroup && (
                        <td rowSpan={span} className="merged-cell plaza-name-cell">
                          {r.plazaName}
                        </td>
                      )}

                      {/* Settlement Date */}
                      <td className="center-cell">{formatDate(r.plazaSettlementDate)}</td>

                      {/* Recon Cycle */}
                      <td className="center-cell">
                        <span className={`cycle-tag c${r.reconCycle}`}>
                          Cycle {r.reconCycle}
                        </span>
                      </td>

                      {/* Txn Count */}
                      <td className="num-cell bold-cell">{r.txnCount}</td>

                      {/* Txn Amount */}
                      <td className="num-cell">{formatAmt(r.txnAmount)}</td>

                      {/* Dispute Add Count */}
                      <td className="num-cell">{r.disputeAddCount}</td>

                      {/* Dispute Add Amount */}
                      <td className="num-cell highlight-cell">{formatAmt(r.disputeAddAmount)}</td>

                      {/* Dispute Sub Count */}
                      <td className="num-cell">{r.disputeSubCount}</td>

                      {/* Dispute Sub Amount */}
                      <td className="num-cell">{formatAmt(r.disputeSubAmount)}</td>

                      {/* Total Amount */}
                      <td className="num-cell bold-cell">{formatAmt(r.totalAmount)}</td>

                      {/* Service Fees (0.60%) */}
                      <td className="num-cell">{formatAmt(r.serviceFees)}</td>

                      {/* Service GST (18%) */}
                      <td className="num-cell">{formatAmt(r.serviceGst)}</td>

                      {/* 0.013 GST (1.30%) */}
                      <td className="num-cell">{formatAmt(r.fee130)}</td>

                      {/* GST (18% on 1.30%) */}
                      <td className="num-cell">{formatAmt(r.gstOnFee130)}</td>

                      {/* Settled Amount */}
                      <td className="num-cell settled-cell">{formatAmt(r.settledAmount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default CycleWiseRecon;
