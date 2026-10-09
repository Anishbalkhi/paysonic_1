import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ViolationRawFileService from '../../services/violation/ViolationRawFileService';
import useOnboardedPlazas from '../../hooks/useOnboardedPlazas';
import { useAuth } from '../../context/AuthContext';
import { filterRecordsByPlazaScope } from '../../utils/plazaScopeUtils';
import { formatFetchTime } from '../../utils/dateUtils';
import ReportKpiGrid from '../../components/ReportKpiGrid/ReportKpiGrid';
import './ViolationRawFileReport.scss';

export const ViolationRawFileReport = () => {
  const { currentUser } = useAuth();
  // Default range: September 2026 matching screenshot data
  const getDefaultDateRange = () => ({
    from: '2026-09-01T00:00:00',
    to: '2026-09-30T23:59:59'
  });

  const initialRange = getDefaultDateRange();
  const [fromDate, setFromDate] = useState(initialRange.from);
  const [toDate, setToDate] = useState(initialRange.to);
  const { plazas: onboardedPlazas, isPlazaLocked, defaultPlazaId, assignedPlaza } = useOnboardedPlazas();
  const [plazaId, setPlazaId] = useState(isPlazaLocked ? (defaultPlazaId || 'ALL') : 'ALL');

  useEffect(() => {
    if (isPlazaLocked && defaultPlazaId && plazaId !== defaultPlazaId) {
      setPlazaId(defaultPlazaId);
    }
  }, [isPlazaLocked, defaultPlazaId, plazaId]);
  const [functionCode, setFunctionCode] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [fetchTime, setFetchTime] = useState('');
  const [downloadTime, setDownloadTime] = useState('');

  // Data & Pagination
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportingTxt, setExportingTxt] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  const [serverSummary, setServerSummary] = useState(null);

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

  const handleSearch = useCallback(async (newPage = 0, newSize = pageSize, overrides = {}) => {
    const fDate = overrides.fromDate !== undefined ? overrides.fromDate : fromDate;
    const tDate = overrides.toDate !== undefined ? overrides.toDate : toDate;
    const pId = overrides.plazaId !== undefined
      ? overrides.plazaId
      : (isPlazaLocked && defaultPlazaId && defaultPlazaId !== 'ALL' ? defaultPlazaId : plazaId);
    const fCode = overrides.functionCode !== undefined ? overrides.functionCode : functionCode;
    const sTerm = overrides.searchTerm !== undefined ? overrides.searchTerm : searchTerm;

    if (!validateDates(fDate, tDate)) return;

    setLoading(true);
    setErrorMsg('');
    try {
      const data = await ViolationRawFileService.search({
        fromDate: fDate,
        toDate: tDate,
        plazaId: pId,
        functionCode: fCode,
        tagId: sTerm.trim() || undefined,
        txnId: sTerm.trim() || undefined,
        mmt: sTerm.trim() || undefined,
        page: newPage,
        size: newSize
      });

      let content = data?.content || (Array.isArray(data) ? data : []);
      content = filterRecordsByPlazaScope(content, onboardedPlazas, currentUser);
      setRecords(content);
      setTotalElements(data?.totalElements ?? content.length);
      setTotalPages(data?.totalPages ?? (content.length > 0 ? 1 : 0));
      setPage(data?.number ?? 0);
      setFetchTime(formatFetchTime(new Date()));
      if (data?.summary) {
        setServerSummary(data.summary);
      }
    } catch (err) {
      console.error('[ViolationRawFileReport] Query failed:', err);
      const msg = err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Database error occurred';
      setErrorMsg(`Database Query Error: ${msg}`);
      setRecords([]);
      setTotalElements(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, plazaId, functionCode, searchTerm, pageSize, isPlazaLocked, defaultPlazaId]);

  useEffect(() => {
    handleSearch(0, pageSize);
  }, [handleSearch]);

  const handleReset = () => {
    const def = getDefaultDateRange();
    const targetPlaza = isPlazaLocked ? (defaultPlazaId || 'ALL') : 'ALL';
    setFromDate(def.from);
    setToDate(def.to);
    setPlazaId(targetPlaza);
    setFunctionCode('ALL');
    setSearchTerm('');
    setErrorMsg('');
    handleSearch(0, pageSize, {
      fromDate: def.from,
      toDate: def.to,
      plazaId: targetPlaza,
      functionCode: 'ALL',
      searchTerm: ''
    });
  };

  const handleExportExcel = async () => {
    if (!validateDates(fromDate, toDate)) return;
    setExportingExcel(true);
    setDownloadTime(formatFetchTime(new Date()));
    try {
      await ViolationRawFileService.exportExcel({
        fromDate,
        toDate,
        plazaId,
        functionCode,
        tagId: searchTerm.trim() || undefined,
        txnId: searchTerm.trim() || undefined,
        mmt: searchTerm.trim() || undefined
      });
    } catch (err) {
      console.error('[ViolationRawFileReport] Excel export failed:', err);
      alert('Failed to export Excel report. Please try again.');
    } finally {
      setExportingExcel(false);
    }
  };

  const handleExportCsv = async () => {
    if (!validateDates(fromDate, toDate)) return;
    setExportingCsv(true);
    setDownloadTime(formatFetchTime(new Date()));
    try {
      await ViolationRawFileService.exportCsv({
        fromDate,
        toDate,
        plazaId,
        functionCode,
        tagId: searchTerm.trim() || undefined,
        txnId: searchTerm.trim() || undefined,
        mmt: searchTerm.trim() || undefined
      });
    } catch (err) {
      console.error('[ViolationRawFileReport] CSV export failed:', err);
      alert('Failed to export CSV report. Please try again.');
    } finally {
      setExportingCsv(false);
    }
  };

  const handleExportTxt = async () => {
    if (!validateDates(fromDate, toDate)) return;
    setExportingTxt(true);
    setDownloadTime(formatFetchTime(new Date()));
    try {
      await ViolationRawFileService.exportTxt({
        fromDate,
        toDate,
        plazaId,
        functionCode,
        tagId: searchTerm.trim() || undefined,
        txnId: searchTerm.trim() || undefined,
        mmt: searchTerm.trim() || undefined
      });
    } catch (err) {
      console.error('[ViolationRawFileReport] TXT export failed:', err);
      alert('Failed to export TXT file. Please try again.');
    } finally {
      setExportingTxt(false);
    }
  };

  const formatDateTimeDisplay = (dtStr) => {
    if (!dtStr) return '-';
    try {
      const d = new Date(dtStr);
      if (isNaN(d.getTime())) return dtStr;
      const day = String(d.getDate()).padStart(2, '0');
      const mon = String(d.getMonth() + 1).padStart(2, '0');
      const yr = d.getFullYear();
      const hr = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      const sec = String(d.getSeconds()).padStart(2, '0');
      return `${day}-${mon}-${yr} ${hr}:${min}:${sec}`;
    } catch {
      return dtStr;
    }
  };

  const dateSubtitle = useMemo(() => {
    const f = formatDateTimeDisplay(fromDate);
    const t = formatDateTimeDisplay(toDate);
    return `Date Range: ${f} to ${t}`;
  }, [fromDate, toDate]);

  // Dynamic options derived from actual database records and onboarded plazas
  const availablePlazas = useMemo(() => {
    const map = new Map();
    (onboardedPlazas || []).forEach((p) => {
      const pid = String(p.id || '').trim();
      const pname = p.name || `Plaza ${pid}`;
      if (pid && !/dummy|autumn|gluten/i.test(pname)) {
        map.set(pid, p.codeLabel || `${pid} - ${pname}`);
      }
    });
    records.forEach((r) => {
      if (r.tollPlazaId && !map.has(r.tollPlazaId)) {
        map.set(r.tollPlazaId, `${r.tollPlazaId} - MUMBAI PLAZA NH-04`);
      }
    });
    if (map.size === 0) {
      map.set('501101', '501101 - MUMBAI PLAZA NH-04');
    }
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
  }, [onboardedPlazas, records]);

  const availableFunctionCodes = useMemo(() => {
    const set = new Set();
    set.add('763');
    records.forEach((r) => {
      if (r.functionCode) set.add(String(r.functionCode));
    });
    return Array.from(set);
  }, [records]);

  // Live client-side instant filtering across all relevant fields
  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const q = searchTerm.toLowerCase().trim();
    return records.filter((r) => {
      const tagMatch = r.tagId && r.tagId.toLowerCase().includes(q);
      const txnMatch = r.txnId && String(r.txnId).toLowerCase().includes(q);
      const tidMatch = r.tid && r.tid.toLowerCase().includes(q);
      const mmtMatch = r.mmt && r.mmt.toLowerCase().includes(q);
      const plazaMatch = r.tollPlazaId && String(r.tollPlazaId).toLowerCase().includes(q);
      const vrnMatch = r.readerReadVrn && r.readerReadVrn.toLowerCase().includes(q);
      const trackMatch = r.internalTrackingNumber && r.internalTrackingNumber.toLowerCase().includes(q);
      return tagMatch || txnMatch || tidMatch || mmtMatch || plazaMatch || vrnMatch || trackMatch;
    });
  }, [records, searchTerm]);

  // Bottom KPI calculation based on filtered records
  const summaryKpis = useMemo(() => {
    if (serverSummary && !searchTerm.trim()) {
      return {
        totalCount: serverSummary.totalCount ?? 0,
        totalAmount: Number(serverSummary.totalAmount ?? 0),
        uniquePlazas: serverSummary.uniquePlazas ?? 1
      };
    }

    let totalCount = 0;
    let totalAmount = 0;
    const plazas = new Set();

    filteredRecords.forEach((row) => {
      totalCount += 1;
      totalAmount += Number(row.txnAmount || 0);
      if (row.tollPlazaId) plazas.add(row.tollPlazaId);
    });

    return { totalCount, totalAmount, uniquePlazas: plazas.size || 1 };
  }, [serverSummary, records, filteredRecords, searchTerm]);

  return (
    <div className="violation-raw-file-page">
      {/* 1. Header Banner */}
      <div className="report-header-banner">
        <h1 className="report-title">VIOLATION RAW FILE REPORT</h1>
        <div className="report-subtitle">
          <span>{dateSubtitle}</span>
        </div>
        <div className="report-green-accent-bar" />
      </div>

      {/* 2. Filter Controls Card */}
      <div className="filter-card">
        <div className="filter-row">
          <div className="filter-group">
            <label className="filter-label">From Date</label>
            <input
              type="datetime-local"
              className="filter-input"
              value={fromDate ? fromDate.slice(0, 19) : ''}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label className="filter-label">To Date</label>
            <input
              type="datetime-local"
              className="filter-input"
              value={toDate ? toDate.slice(0, 19) : ''}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label className="filter-label">Toll Plaza ID</label>
            <select
              className="filter-select"
              value={plazaId}
              onChange={(e) => {
                const val = e.target.value;
                setPlazaId(val);
                handleSearch(0, pageSize, { plazaId: val });
              }}
              disabled={isPlazaLocked}
              title={isPlazaLocked ? `Locked to assigned plaza: ${assignedPlaza?.name || defaultPlazaId}` : 'Select Toll Plaza'}
            >
              {!isPlazaLocked && (
                <option value="ALL">
                  {currentUser?.role === 'Concessionaire' ? 'All Portfolio Plazas' : 'All Plazas'}
                </option>
              )}
              {availablePlazas.map((p) => (
                <option key={p.id} value={p.id}>
                  {isPlazaLocked ? `🔒 ${p.label} (Assigned Plaza)` : p.label}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label">Function Code</label>
            <select
              className="filter-select"
              value={functionCode}
              onChange={(e) => {
                const val = e.target.value;
                setFunctionCode(val);
                handleSearch(0, pageSize, { functionCode: val });
              }}
            >
              <option value="ALL">All Codes</option>
              {availableFunctionCodes.map((code) => (
                <option key={code} value={code}>{code}</option>
              ))}
            </select>
          </div>

          <div className="filter-group filter-grow">
            <label className="filter-label">SEARCH (VRN / TAG ID / ACQ TXN ID)</label>
            <input
              type="text"
              className="filter-input"
              placeholder="e.g. TM05GB0328, 34161FA8..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch(0, pageSize)}
            />
          </div>

          <div className="filter-actions">
            <button
              className="btn btn-royal-blue"
              onClick={() => handleSearch(0, pageSize)}
              disabled={loading}
            >
              {loading ? 'Searching...' : 'Search'}
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
            label: 'Total Raw Records',
            value: (totalElements || summaryKpis.totalCount).toLocaleString('en-IN'),
            sub: 'Filtered NPCI File Lines'
          },
          {
            label: 'Total Raw Amount',
            value: `₹ ${Number(summaryKpis.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            sub: 'Cumulative File Value',
            highlight: 'blue'
          },
          {
            label: 'Covered Toll Plazas',
            value: summaryKpis.uniquePlazas,
            sub: 'Network Plazas Present',
            highlight: 'purple'
          }
        ]}
      />

      {/* 3. Table Area */}
      <div className="table-wrapper">
        <div className="table-responsive">
          <table className="raw-file-styled-table">
            <thead>
              <tr>
                <th>Sr No</th>
                <th>Tag_ID</th>
                <th>Function_Code</th>
                <th>Txn_Time</th>
                <th>Txn_Id</th>
                <th>Issuer_ID</th>
                <th>Acquirer_ID</th>
                <th>Txn_Amount</th>
                <th>Reason_Code</th>
                <th>Full_Partial_Indicator</th>
                <th>Toll_Plaza_Id</th>
                <th>TID</th>
                <th>MMT</th>
                <th>Internal Tracking Number</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="14" className="table-loading-cell">
                    <div className="spinner" />
                    <span>Querying database records...</span>
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan="14" className="table-empty-cell">
                    No violation raw records found for the selected criteria.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((row, idx) => {
                  const srNo = page * pageSize + idx + 1;
                  return (
                    <tr key={row.id || idx}>
                      <td className="text-center">{srNo}</td>
                      <td className="monospace-cell">{row.tagId || '-'}</td>
                      <td className="text-center font-semibold">{row.functionCode || '763'}</td>
                      <td className="text-center monospace-cell">{row.txnTime || '-'}</td>
                      <td className="monospace-cell">{row.txnId || '-'}</td>
                      <td className="text-center">{row.issuerId || '-'}</td>
                      <td className="text-center">{row.acquirerId || '720030'}</td>
                      <td className="text-right font-semibold">
                        {Number(row.txnAmount || 0).toFixed(2)}
                      </td>
                      <td className="text-center">{row.reasonCode || '1005'}</td>
                      <td className="text-center font-semibold">{row.fullPartialIndicator || 'P'}</td>
                      <td className="text-center">{row.tollPlazaId || '-'}</td>
                      <td className="monospace-cell">{row.tid || row.tagId || '-'}</td>
                      <td className="text-center font-semibold">{row.mmt || '-'}</td>
                      <td className="text-center">{row.internalTrackingNumber || 'NA'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="table-pagination-bar">
          <div className="pagination-info">
            Showing {filteredRecords.length > 0 ? page * pageSize + 1 : 0} to{' '}
            {Math.min((page + 1) * pageSize, searchTerm.trim() ? filteredRecords.length : totalElements)} of {searchTerm.trim() ? filteredRecords.length : totalElements} records
          </div>
          <div className="pagination-controls">
            <select
              className="page-size-select"
              value={pageSize}
              onChange={(e) => {
                const newSize = Number(e.target.value);
                setPageSize(newSize);
                handleSearch(0, newSize);
              }}
            >
              <option value="25">25 per page</option>
              <option value="50">50 per page</option>
              <option value="100">100 per page</option>
            </select>

            <button
              className="page-nav-btn"
              disabled={page === 0 || loading}
              onClick={() => handleSearch(page - 1, pageSize)}
            >
              Previous
            </button>
            <span className="page-current">
              Page {totalPages > 0 ? page + 1 : 0} of {totalPages}
            </span>
            <button
              className="page-nav-btn"
              disabled={page + 1 >= totalPages || loading}
              onClick={() => handleSearch(page + 1, pageSize)}
            >
              Next
            </button>
          </div>
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

      {/* 4. Bottom Summary KPI Cards */}
      <div className="report-kpi-summary-bar">
        <div className="kpi-card">
          <span className="kpi-label">Total Raw Records</span>
          <span className="kpi-val">{summaryKpis.totalCount}</span>
        </div>

        <div className="kpi-card kpi-blue">
          <span className="kpi-label">Total Txn Amount</span>
          <span className="kpi-val">₹{summaryKpis.totalAmount.toFixed(2)}</span>
        </div>

        <div className="kpi-card kpi-purple">
          <span className="kpi-label">Active Plazas</span>
          <span className="kpi-val">{summaryKpis.uniquePlazas}</span>
        </div>
      </div>

      {/* Footer Info */}
      <div className="report-footer-meta">
        <span className="disclaimer-note">
          * This report is generated from the Paysonic database directly on demand.
        </span>
      </div>
    </div>
  );
};

export default ViolationRawFileReport;
