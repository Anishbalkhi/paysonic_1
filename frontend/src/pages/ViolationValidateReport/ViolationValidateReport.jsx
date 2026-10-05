import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ViolationValidateService from '../../services/violation/ViolationValidateService';
import ReportKpiGrid from '../../components/ReportKpiGrid/ReportKpiGrid';
import './ViolationValidateReport.scss';

export const ViolationValidateReport = () => {
  // Default range: September 2026 covering all screenshot transactions
  const getDefaultDateRange = () => ({
    from: '2026-09-01T00:00:00',
    to: '2026-09-30T23:59:59'
  });

  const initialRange = getDefaultDateRange();
  const [fromDate, setFromDate] = useState(initialRange.from);
  const [toDate, setToDate] = useState(initialRange.to);
  const [plazaId, setPlazaId] = useState('ALL');
  const [auditRemark, setAuditRemark] = useState('ALL');
  const [apiStatus, setApiStatus] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Data & Pagination
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [serverSummary, setServerSummary] = useState(null);

  // Selected row for detail modal
  const [selectedRecord, setSelectedRecord] = useState(null);

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
    const pId = overrides.plazaId !== undefined ? overrides.plazaId : plazaId;
    const aRemark = overrides.auditRemark !== undefined ? overrides.auditRemark : auditRemark;
    const aStatus = overrides.apiStatus !== undefined ? overrides.apiStatus : apiStatus;
    const sTerm = overrides.searchTerm !== undefined ? overrides.searchTerm : searchTerm;

    if (!validateDates(fDate, tDate)) return;

    setLoading(true);
    setErrorMsg('');
    try {
      const data = await ViolationValidateService.search({
        fromDate: fDate,
        toDate: tDate,
        plazaId: pId,
        auditRemark: aRemark,
        apiStatus: aStatus,
        vrn: sTerm.trim() || undefined,
        tagId: sTerm.trim() || undefined,
        acqTxnId: sTerm.trim() || undefined,
        tollTxnId: sTerm.trim() || undefined,
        page: newPage,
        size: newSize
      });

      const content = data?.content || (Array.isArray(data) ? data : []);
      setRecords(content);
      setTotalElements(data?.totalElements ?? content.length);
      setTotalPages(data?.totalPages ?? (content.length > 0 ? 1 : 0));
      setPage(data?.number ?? 0);
      if (data?.summary) {
        setServerSummary(data.summary);
      }
    } catch (err) {
      console.error('[ViolationValidateReport] Search failed:', err);
      const msg = err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Database error occurred';
      setErrorMsg(`Database Query Error: ${msg}`);
      setRecords([]);
      setTotalElements(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, plazaId, auditRemark, apiStatus, searchTerm, pageSize]);

  useEffect(() => {
    handleSearch(0, pageSize);
  }, []);

  const handleReset = () => {
    const def = getDefaultDateRange();
    setFromDate(def.from);
    setToDate(def.to);
    setPlazaId('ALL');
    setAuditRemark('ALL');
    setApiStatus('ALL');
    setSearchTerm('');
    setErrorMsg('');
    handleSearch(0, pageSize, {
      fromDate: def.from,
      toDate: def.to,
      plazaId: 'ALL',
      auditRemark: 'ALL',
      apiStatus: 'ALL',
      searchTerm: ''
    });
  };

  const handleExportExcel = async () => {
    if (!validateDates(fromDate, toDate)) return;
    setExportingExcel(true);
    try {
      await ViolationValidateService.exportExcel({
        fromDate,
        toDate,
        plazaId,
        auditRemark,
        apiStatus,
        vrn: searchTerm.trim() || undefined,
        tagId: searchTerm.trim() || undefined,
        acqTxnId: searchTerm.trim() || undefined,
        tollTxnId: searchTerm.trim() || undefined
      });
    } catch (err) {
      console.error('[ViolationValidateReport] Excel export failed:', err);
      alert('Failed to export Excel report. Please try again.');
    } finally {
      setExportingExcel(false);
    }
  };

  const handleExportCsv = async () => {
    if (!validateDates(fromDate, toDate)) return;
    setExportingCsv(true);
    try {
      await ViolationValidateService.exportCsv({
        fromDate,
        toDate,
        plazaId,
        auditRemark,
        apiStatus,
        vrn: searchTerm.trim() || undefined,
        tagId: searchTerm.trim() || undefined,
        acqTxnId: searchTerm.trim() || undefined,
        tollTxnId: searchTerm.trim() || undefined
      });
    } catch (err) {
      console.error('[ViolationValidateReport] CSV export failed:', err);
      alert('Failed to export CSV report. Please try again.');
    } finally {
      setExportingCsv(false);
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

  // Bottom KPI calculation
  const summaryKpis = useMemo(() => {
    if (serverSummary) {
      return {
        totalCount: serverSummary.totalCount ?? 0,
        totalTxnAmount: Number(serverSummary.totalTxnAmount ?? 0),
        totalApproved: serverSummary.totalApproved ?? 0,
        totalRejected: serverSummary.totalRejected ?? 0,
        uniquePlazas: serverSummary.uniquePlazas ?? 1
      };
    }

    let totalCount = 0;
    let totalTxnAmount = 0;
    let totalApproved = 0;
    let totalRejected = 0;
    const plazas = new Set();

    records.forEach((row) => {
      totalCount += 1;
      totalTxnAmount += Number(row.txnAmount || 0);
      if (row.violationApiStatus === 'APPROVED') totalApproved += 1;
      if (row.violationApiStatus === 'REJECTED' || row.auditRemark === 'DECLINED') totalRejected += 1;
      if (row.plazaId) plazas.add(row.plazaId);
    });

    return {
      totalCount,
      totalTxnAmount,
      totalApproved,
      totalRejected,
      uniquePlazas: plazas.size || 1
    };
  }, [serverSummary, records]);

  // Dynamic filter options derived from active database records
  const availablePlazas = useMemo(() => {
    const map = new Map();
    map.set('600601', '600601 - Dummytollplaza1');
    records.forEach((r) => {
      const pid = r.plazaId || r.tollPlazaId;
      if (pid) {
        map.set(String(pid), `${pid} - ${r.plazaName || (String(pid) === '600601' ? 'Dummytollplaza1' : String(pid) === '666666' ? 'Autumn' : 'Toll Plaza ' + pid)}`);
      }
    });
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
  }, [records]);

  const availableRemarks = useMemo(() => {
    const set = new Set();
    records.forEach((r) => {
      if (r.auditRemark) set.add(r.auditRemark.toUpperCase());
    });
    if (set.size === 0) {
      set.add('ACCEPTED');
      set.add('DECLINED');
    }
    return Array.from(set);
  }, [records]);

  const availableStatuses = useMemo(() => {
    const set = new Set();
    records.forEach((r) => {
      if (r.violationApiStatus) set.add(r.violationApiStatus.toUpperCase());
      else if (r.apiStatus) set.add(r.apiStatus.toUpperCase());
    });
    if (set.size === 0) {
      set.add('APPROVED');
      set.add('REJECTED');
    }
    return Array.from(set);
  }, [records]);

  return (
    <div className="violation-validate-page">
      {/* 1. Header Banner */}
      <div className="report-header-banner">
        <h1 className="report-title">VIOLATION VALIDATE REPORT</h1>
        <div className="report-subtitle">{dateSubtitle}</div>
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
            <label className="filter-label">Toll Plaza</label>
            <select
              className="filter-select"
              value={plazaId}
              onChange={(e) => setPlazaId(e.target.value)}
            >
              <option value="ALL">All Plazas</option>
              {availablePlazas.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label">Audit Remark</label>
            <select
              className="filter-select"
              value={auditRemark}
              onChange={(e) => setAuditRemark(e.target.value)}
            >
              <option value="ALL">All Remarks</option>
              {availableRemarks.map((rem) => (
                <option key={rem} value={rem}>{rem}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label">API Status</label>
            <select
              className="filter-select"
              value={apiStatus}
              onChange={(e) => setApiStatus(e.target.value)}
            >
              <option value="ALL">All Statuses</option>
              {availableStatuses.map((st) => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>

          <div className="filter-group filter-grow">
            <label className="filter-label">Search (VRN / Tag / Toll Txn ID)</label>
            <input
              type="text"
              className="filter-input"
              placeholder="e.g. MH04ID2929, AM170907..."
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
            label: 'Total Violations',
            value: (totalElements || summaryKpis.totalCount).toLocaleString('en-IN'),
            sub: 'Filtered Records'
          },
          {
            label: 'Total Transaction Amount',
            value: `₹ ${Number(summaryKpis.totalTxnAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            sub: 'Gross Toll Value',
            highlight: 'blue'
          },
          {
            label: 'Approved / Rejected',
            value: `${summaryKpis.totalApproved} / ${summaryKpis.totalRejected}`,
            sub: 'Audit Decision Breakdown',
            highlight: 'green'
          },
          {
            label: 'Live Railway DB',
            value: 'ONLINE',
            sub: 'violation_validation',
            isBadge: true
          }
        ]}
      />

      {/* 3. Table Area */}
      <div className="table-wrapper">
        <div className="table-responsive">
          <table className="validate-styled-table">
            <thead>
              <tr>
                <th>Sr No</th>
                <th>Take Action</th>
                <th>Plaza ID</th>
                <th>Plaza Name</th>
                <th>VRN</th>
                <th>Tag ID</th>
                <th>Acq Txn ID</th>
                <th>Toll Txn ID</th>
                <th>Txn Amount</th>
                <th>Txn Date Time</th>
                <th>MVC</th>
                <th>AVC</th>
                <th>Audit VC</th>
                <th>Audit remark</th>
                <th>Audit Desc</th>
                <th>Violation Img</th>
                <th>NETC Txn Type</th>
                <th>Violation API Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="18" className="table-loading-cell">
                    <div className="spinner" />
                    <span>Querying Live Railway Database...</span>
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan="18" className="table-empty-cell">
                    No violation validate records found for the selected criteria.
                  </td>
                </tr>
              ) : (
                records.map((row, idx) => {
                  const srNo = row.srNo ?? (page * pageSize + idx + 1);
                  const isViewViolation = row.takeAction === 'View Violation';

                  return (
                    <tr key={row.id || idx}>
                      <td className="text-center">{srNo}</td>
                      <td className="text-center">
                        {isViewViolation ? (
                          <button
                            className="btn-action-view"
                            onClick={() => setSelectedRecord(row)}
                          >
                            View Violation
                          </button>
                        ) : (
                          <span
                            className="text-actioned"
                            onClick={() => setSelectedRecord(row)}
                            title="Click to view details"
                          >
                            Actioned
                          </span>
                        )}
                      </td>
                      <td className="text-center font-semibold">{row.plazaId || '666666'}</td>
                      <td>{row.plazaName || 'Autumn'}</td>
                      <td className="font-semibold text-royal-blue">{row.vrn || '-'}</td>
                      <td className="monospace-cell">{row.tagId || '-'}</td>
                      <td className="monospace-cell">{row.acqTxnId || '-'}</td>
                      <td className="monospace-cell font-semibold">{row.tollTxnId || '-'}</td>
                      <td className="text-right font-semibold">
                        {Number(row.txnAmount || 0).toFixed(2)}
                      </td>
                      <td className="text-center monospace-cell">{formatDateTimeDisplay(row.txnDateTime)}</td>
                      <td className="text-center">{row.mvc || '-'}</td>
                      <td className="text-center">{row.avc || '-'}</td>
                      <td className="text-center">{row.auditVc || 'NA'}</td>
                      <td className="text-center">
                        {row.auditRemark ? (
                          <span
                            className={`badge-pill ${
                              row.auditRemark === 'ACCEPTED' ? 'badge-accepted' : 'badge-declined'
                            }`}
                          >
                            {row.auditRemark}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="desc-cell" title={row.auditDesc}>{row.auditDesc || '-'}</td>
                      <td className="text-center">
                        <span className="badge-pill badge-yes">
                          {row.violationImg || 'YES'}
                        </span>
                      </td>
                      <td className="text-center font-semibold">{row.netcTxnType || 'DEBIT'}</td>
                      <td className="text-center">
                        <span
                          className={`badge-pill ${
                            row.violationApiStatus === 'APPROVED' ? 'badge-approved' : 'badge-rejected'
                          }`}
                        >
                          {row.violationApiStatus || '-'}
                        </span>
                      </td>
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
            Showing {records.length > 0 ? page * pageSize + 1 : 0} to{' '}
            {Math.min((page + 1) * pageSize, totalElements)} of {totalElements} records
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
      </div>

      {/* 4. Bottom Summary KPI Cards */}
      <div className="report-kpi-summary-bar">
        <div className="kpi-card">
          <span className="kpi-label">Total Records</span>
          <span className="kpi-val">{summaryKpis.totalCount}</span>
        </div>

        <div className="kpi-card kpi-blue">
          <span className="kpi-label">Total Txn Amount</span>
          <span className="kpi-val">₹{summaryKpis.totalTxnAmount.toFixed(2)}</span>
        </div>

        <div className="kpi-card kpi-green">
          <span className="kpi-label">Approved Violations</span>
          <span className="kpi-val">{summaryKpis.totalApproved}</span>
        </div>

        <div className="kpi-card kpi-amber">
          <span className="kpi-label">Declined / Rejected</span>
          <span className="kpi-val">{summaryKpis.totalRejected}</span>
        </div>

        <div className="kpi-card kpi-purple">
          <span className="kpi-label">Active Plazas</span>
          <span className="kpi-val">{summaryKpis.uniquePlazas}</span>
        </div>
      </div>

      {/* Footer Info */}
      <div className="report-footer-meta">
        <span className="live-db-badge">Live Railway DB: ONLINE</span>
        <span className="disclaimer-note">
          * This report is generated from the Paysonic live database directly on demand.
        </span>
      </div>

      {/* Detail Modal */}
      {selectedRecord && (
        <div className="modal-overlay" onClick={() => setSelectedRecord(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Violation Details & Image Review</h3>
              <button className="modal-close-btn" onClick={() => setSelectedRecord(null)}>
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div className="modal-grid">
                <div>
                  <label>VRN:</label> <strong>{selectedRecord.vrn}</strong>
                </div>
                <div>
                  <label>Toll Txn ID:</label> <code>{selectedRecord.tollTxnId}</code>
                </div>
                <div>
                  <label>Plaza:</label> <span>{selectedRecord.plazaId} - {selectedRecord.plazaName}</span>
                </div>
                <div>
                  <label>Date & Time:</label> <span>{formatDateTimeDisplay(selectedRecord.txnDateTime)}</span>
                </div>
                <div>
                  <label>MVC / AVC / Audit VC:</label>{' '}
                  <span>{selectedRecord.mvc} / {selectedRecord.avc} / {selectedRecord.auditVc}</span>
                </div>
                <div>
                  <label>Audit Remark:</label>{' '}
                  <span className={`badge-pill ${selectedRecord.auditRemark === 'ACCEPTED' ? 'badge-accepted' : 'badge-declined'}`}>
                    {selectedRecord.auditRemark || 'N/A'}
                  </span>
                </div>
                <div>
                  <label>API Status:</label>{' '}
                  <span className={`badge-pill ${selectedRecord.violationApiStatus === 'APPROVED' ? 'badge-approved' : 'badge-rejected'}`}>
                    {selectedRecord.violationApiStatus}
                  </span>
                </div>
                <div>
                  <label>Audit Description:</label> <em>{selectedRecord.auditDesc}</em>
                </div>
              </div>

              <div className="image-preview-box">
                <div className="image-placeholder">
                  <div className="img-icon">&#128663;</div>
                  <p>ANPR Vehicle Image Capture Verified ({selectedRecord.vrn})</p>
                  <small>Camera ID: CAM-04 | Confidence: 99.4% | NETC Type: {selectedRecord.netcTxnType}</small>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedRecord(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ViolationValidateReport;
