import React, { useState, useEffect, useCallback, useMemo } from 'react';
import DisputeReportService from '../../services/dispute/DisputeReportService';
import DisputeManagementService from '../../services/dispute/DisputeManagementService';
import { useOnboardedPlazas } from '../../hooks/useOnboardedPlazas';
import { useAuth } from '../../context/AuthContext';
import { filterRecordsByPlazaScope } from '../../utils/plazaScopeUtils';
import { normalizePlazaForRecord } from '../../utils/plazaNormalizer';
import { formatFetchTime } from '../../utils/dateUtils';
import ReportKpiGrid from '../../components/ReportKpiGrid/ReportKpiGrid';
import TablePagination from '../../components/common/TablePagination';
import './DisputeDetailReport.scss';

export const DisputeDetailReport = () => {
  const { currentUser } = useAuth();
  
  // Default date range: Covers September through October 2026
  const getDefaultDateRange = () => {
    return {
      from: '2026-09-01T00:00:00',
      to: '2026-10-31T23:59:59'
    };
  };

  const defaultRange = getDefaultDateRange();
  const { plazas, isPlazaLocked, defaultPlazaId } = useOnboardedPlazas();
  const [fromDate, setFromDate] = useState(defaultRange.from);
  const [toDate, setToDate] = useState(defaultRange.to);
  const [plazaId, setPlazaId] = useState(defaultPlazaId || 'ALL');
  const [functionCode, setFunctionCode] = useState('ALL');
  const [lifecycleStatus, setLifecycleStatus] = useState('ALL');
  const [plazaActionFilter, setPlazaActionFilter] = useState('ALL');

  useEffect(() => {
    if (isPlazaLocked && defaultPlazaId && defaultPlazaId !== 'ALL') {
      setPlazaId(defaultPlazaId);
    }
  }, [isPlazaLocked, defaultPlazaId]);

  // State
  const [records, setRecords] = useState([]);
  const [fetchTime, setFetchTime] = useState('');
  const [downloadTime, setDownloadTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

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

  // Search function from Dispute Management lifecycle store & live DB
  const handleSearch = useCallback(async (overrideFrom, overrideTo, overridePlaza, overrideFunc, overrideStatus, overridePlazaAct) => {
    const fDate = (typeof overrideFrom === 'string' && overrideFrom) ? overrideFrom : fromDate;
    const tDate = (typeof overrideTo === 'string' && overrideTo) ? overrideTo : toDate;
    const pId = (typeof overridePlaza === 'string' && overridePlaza)
      ? overridePlaza
      : (isPlazaLocked && defaultPlazaId !== 'ALL' ? defaultPlazaId : plazaId);
    const fCode = (typeof overrideFunc === 'string' && overrideFunc) ? overrideFunc : functionCode;
    const lStatus = (typeof overrideStatus === 'string' && overrideStatus) ? overrideStatus : lifecycleStatus;
    const pAction = (typeof overridePlazaAct === 'string' && overridePlazaAct) ? overridePlazaAct : plazaActionFilter;

    if (!validateDates(fDate, tDate)) return;

    setLoading(true);
    setErrorMsg('');
    try {
      // 1. Load from DisputeManagementService lifecycle queue
      const lifecycleDisputes = DisputeManagementService.getStoredDisputes();

      // 2. Fetch live database disputes
      let dbDisputes = [];
      try {
        const data = await DisputeReportService.searchDisputes({
          fromDate: fDate,
          toDate: tDate,
          plazaId: pId,
          functionCode: fCode,
          page: 0,
          size: 1000
        });
        dbDisputes = data?.content ? data.content : Array.isArray(data) ? data : [];
      } catch (dbErr) {
        console.warn('[DisputeDetailReport] Database query warning (falling back to lifecycle store):', dbErr?.message);
      }

      // Merge records, giving precedence to lifecycle disputes
      const seenRrn = new Set();
      const combined = [];

      lifecycleDisputes.forEach((r) => {
        const rrn = String(r.acqTxnId || r.rowId || '').trim();
        if (rrn) seenRrn.add(rrn);
        combined.push({
          ...r,
          id: r.rowId || r.disputeId,
          vehicleNo: r.vrn || r.vehicleNo || '—',
          plazaName: r.plazaName || `Plaza ${r.plazaId}`,
          txnDateTime: r.txnDateTime || r.txnDate,
          lifecycleStatus: r.lifecycleStatus || (r.assigned ? 'Assigned to Plaza' : 'Pending Assignment'),
          disputeStatus: r.disputeStatus || 'NA',
          plazaAction: r.plazaAction || (r.disputeStatus === 'Approved' || r.disputeStatus === 'Rejected' ? 'Yes' : 'No'),
          plazaReason: r.plazaReason || '—',
          plazaActionTime: r.plazaActionTime || '—',
          adminReason: r.adminReason || r.adminRemarks || '—',
          closureDate: r.closedAt ? r.closedAt.slice(0, 10) : '—'
        });
      });

      dbDisputes.forEach((d) => {
        const rrn = String(d.acqTxnId || d.id || '').trim();
        if (!seenRrn.has(rrn)) {
          seenRrn.add(rrn);
          combined.push({
            ...d,
            disputeId: `DISP-${d.id}`,
            lifecycleStatus: 'Pending Assignment',
            disputeStatus: 'NA',
            plazaAction: 'No',
            plazaReason: '—',
            plazaActionTime: '—',
            adminReason: '—',
            closureDate: '—'
          });
        }
      });

      // Filter by Plaza, Function Code, Lifecycle Status, and Plaza Action
      let filtered = combined;
      if (pId && pId !== 'ALL') {
        filtered = filtered.filter((r) => String(r.plazaId) === String(pId));
      }
      if (fCode && fCode !== 'ALL') {
        filtered = filtered.filter((r) => String(r.functionCode).includes(fCode) || String(fCode).includes(String(r.functionCode)));
      }
      if (lStatus && lStatus !== 'ALL') {
        filtered = filtered.filter((r) => r.lifecycleStatus === lStatus);
      }
      if (pAction && pAction !== 'ALL') {
        if (pAction === 'Accepted') {
          filtered = filtered.filter((r) => r.disputeStatus === 'Approved');
        } else if (pAction === 'Rejected') {
          filtered = filtered.filter((r) => r.disputeStatus === 'Rejected');
        } else if (pAction === 'Pending') {
          filtered = filtered.filter((r) => r.disputeStatus === 'NA' || !r.disputeStatus);
        }
      }

      // Enforce multi-tenant role scoping
      filtered = filterRecordsByPlazaScope(filtered, plazas, currentUser);

      setRecords(filtered);
      setFetchTime(formatFetchTime(new Date()));
      setCurrentPage(1);
    } catch (err) {
      console.error('[DisputeDetailReport] Search error:', err);
      const msg = err?.response?.data?.error || err?.message || 'Failed to load dispute records.';
      setErrorMsg(msg);
      setRecords([]);
      setCurrentPage(1);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, plazaId, functionCode, lifecycleStatus, plazaActionFilter, isPlazaLocked, defaultPlazaId, plazas, currentUser]);

  useEffect(() => {
    handleSearch();
  }, [handleSearch]);

  // Listen to realtime updates across tabs
  useEffect(() => {
    const handleUpdate = () => handleSearch();
    window.addEventListener('paysonic:disputes_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    let bc;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel('paysonic_disputes_channel');
        bc.onmessage = () => handleSearch();
      } catch {}
    }
    return () => {
      window.removeEventListener('paysonic:disputes_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
      if (bc) bc.close();
    };
  }, [handleSearch]);

  const handleReset = () => {
    const def = getDefaultDateRange();
    const resetPlaza = isPlazaLocked ? defaultPlazaId : 'ALL';
    setFromDate(def.from);
    setToDate(def.to);
    setPlazaId(resetPlaza);
    setFunctionCode('ALL');
    setLifecycleStatus('ALL');
    setPlazaActionFilter('ALL');
    setSearchTerm('');
    setCurrentPage(1);
    handleSearch(def.from, def.to, resetPlaza, 'ALL', 'ALL', 'ALL');
  };

  // Client-side quick filter
  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const q = searchTerm.toLowerCase().trim();
    return records.filter((r) =>
      (r.plazaName && r.plazaName.toLowerCase().includes(q)) ||
      (r.plazaId && String(r.plazaId).toLowerCase().includes(q)) ||
      (r.acqTxnId && String(r.acqTxnId).toLowerCase().includes(q)) ||
      (r.tollTxnId && String(r.tollTxnId).toLowerCase().includes(q)) ||
      (r.vehicleNo && String(r.vehicleNo).toLowerCase().includes(q)) ||
      (r.vrn && String(r.vrn).toLowerCase().includes(q)) ||
      (r.tagId && String(r.tagId).toLowerCase().includes(q)) ||
      (r.disputeId && String(r.disputeId).toLowerCase().includes(q)) ||
      (r.lifecycleStatus && String(r.lifecycleStatus).toLowerCase().includes(q))
    );
  }, [records, searchTerm]);

  // Paginated records for table view
  const paginatedRecords = useMemo(() => {
    const from = (currentPage - 1) * pageSize;
    return filteredRecords.slice(from, from + pageSize);
  }, [filteredRecords, currentPage, pageSize]);

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

  // Client-side Export handlers with full lifecycle data
  const handleExportCsv = () => {
    if (filteredRecords.length === 0) return;
    setExportingCsv(true);
    try {
      const escapeCsv = (val) => {
        if (val === null || val === undefined) return '""';
        return `"${String(val).replace(/"/g, '""')}"`;
      };

      const headers = [
        'Dispute ID',
        'Acq Txn ID',
        'Toll Txn ID',
        'VRN',
        'Tag ID',
        'Plaza Name',
        'Plaza ID',
        'Txn Date Time',
        'Settlement Date',
        'TAT Due Date',
        'Dispute Amount',
        'Function Code',
        'Admin Reason',
        'Assigned Date',
        'Plaza Action',
        'Plaza Action Time',
        'Plaza Remarks',
        'Action By',
        'Status',
        'Closure Date'
      ];

      const csvRows = filteredRecords.map((r) => [
        r.disputeId || '—',
        r.acqTxnId || '—',
        r.tollTxnId || '—',
        r.vehicleNo || r.vrn || '—',
        r.tagId || '—',
        r.plazaName || '—',
        r.plazaId || '—',
        r.txnDateTime || '—',
        r.settlementDate || '—',
        r.tatDueDate || '—',
        Number(r.disputeAmount || 0).toFixed(2),
        r.functionCode || '—',
        r.adminReason || '—',
        r.assignedAt || '—',
        r.disputeStatus === 'Approved' ? 'Accepted' : r.disputeStatus === 'Rejected' ? 'Rejected' : 'Pending',
        r.plazaActionTime || '—',
        r.plazaReason || '—',
        r.plazaActionBy || '—',
        r.lifecycleStatus || 'Pending Assignment',
        r.closureDate || '—'
      ]);

      const csvContent = '\uFEFF' + [headers.map(escapeCsv).join(','), ...csvRows.map((row) => row.map(escapeCsv).join(','))].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Dispute_Detail_Report_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setDownloadTime(formatFetchTime(new Date()));
    } catch (err) {
      console.error('[DisputeDetailReport] CSV export error:', err);
      alert('Failed to export CSV. Please try again.');
    } finally {
      setExportingCsv(false);
    }
  };

  const handleExportExcel = () => {
    handleExportCsv();
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

  return (
    <div className="dispute-report-page">
      {/* Top Banner Header */}
      <header className="page-header">
        <div className="header-titles">
          <h1 className="page-title">Dispute Detailed Report</h1>
          <p className="subtitle">
            Complete lifecycle audit of all disputes assigned across every status
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
            <label htmlFor="plazaSelect">Plaza</label>
            <select
              id="plazaSelect"
              className={isPlazaLocked ? 'disabled-locked' : ''}
              value={plazaId}
              disabled={isPlazaLocked}
              onChange={(e) => setPlazaId(e.target.value)}
            >
              {!isPlazaLocked && (
                <option value="ALL">
                  {currentUser?.role === 'Concessionaire' ? 'All Portfolio Plazas' : 'All Plazas'}
                </option>
              )}
              {plazas.map((p) => (
                <option key={p.id} value={p.id}>
                  {isPlazaLocked ? `🔒 ${p.name} (${p.id}) [Assigned Plaza]` : `${p.name} (${p.id})`}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="statusSelect">Lifecycle Status</label>
            <select
              id="statusSelect"
              value={lifecycleStatus}
              onChange={(e) => setLifecycleStatus(e.target.value)}
            >
              <option value="ALL">All Statuses</option>
              <option value="Pending Assignment">Pending Assignment</option>
              <option value="Assigned to Plaza">Assigned to Plaza</option>
              <option value="Plaza Accepted">Plaza Accepted</option>
              <option value="Plaza Rejected">Plaza Rejected</option>
              <option value="Closed">Closed</option>
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="plazaActionFilterSelect">Plaza Action</label>
            <select
              id="plazaActionFilterSelect"
              value={plazaActionFilter}
              onChange={(e) => setPlazaActionFilter(e.target.value)}
            >
              <option value="ALL">All Actions</option>
              <option value="Accepted">Accepted</option>
              <option value="Rejected">Rejected</option>
              <option value="Pending">Pending at Plaza</option>
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

      {/* Summary KPI Cards */}
      <ReportKpiGrid
        cards={[
          {
            label: 'Total Disputes',
            value: filteredRecords.length,
            sub: 'Filtered Records'
          },
          {
            label: 'Total Dispute Amount',
            value: `₹ ${Number(totalDisputeAmt).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
            sub: 'Cumulative Disputed Value',
            highlight: 'blue'
          },
          {
            label: 'Decided at Plaza',
            value: filteredRecords.filter((r) => r.disputeStatus === 'Approved' || r.disputeStatus === 'Rejected').length,
            sub: `${filteredRecords.filter((r) => r.disputeStatus === 'Approved').length} Accepted / ${filteredRecords.filter((r) => r.disputeStatus === 'Rejected').length} Rejected`,
            highlight: 'green'
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
        <div className="table-top-banner">
          <div className="banner-title">DISPUTE DETAILED REPORT</div>
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
                <th>Dispute ID</th>
                <th>Acq Txn ID</th>
                <th>Toll Txn ID</th>
                <th>VRN</th>
                <th>Tag ID</th>
                <th>Toll Plaza</th>
                <th>Txn Date Time</th>
                <th>Settlement Date</th>
                <th>TAT Due Date</th>
                <th className="num-col">Dispute Amount</th>
                <th>Admin Reason</th>
                <th>Plaza Action</th>
                <th>Plaza Action Date & Time</th>
                <th>Plaza Remarks</th>
                <th>Action By</th>
                <th>Current Status</th>
                <th>Closure Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="18" className="empty-state">
                    <span className="spinner-border table-spinner" />
                    <span>Loading dispute records...</span>
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan="18" className="empty-state">
                    No dispute records found for the selected criteria.
                  </td>
                </tr>
              ) : (
                paginatedRecords.map((item, index) => {
                  const srNo = (currentPage - 1) * pageSize + index + 1;
                  const isAccepted = item.disputeStatus === 'Approved';
                  const isRejected = item.disputeStatus === 'Rejected';
                  const statusBadgeClass =
                    item.lifecycleStatus === 'Closed'
                      ? 'badge-gray'
                      : item.lifecycleStatus === 'Plaza Accepted'
                      ? 'badge-green'
                      : item.lifecycleStatus === 'Plaza Rejected'
                      ? 'badge-red'
                      : item.assigned
                      ? 'tag-assigned'
                      : 'tag-cb-assign';

                  return (
                    <tr key={item.id || index}>
                      <td className="text-center">{srNo}</td>
                      <td className="code-font font-semibold">{item.disputeId || `DISP-${item.id}`}</td>
                      <td className="code-font">{item.acqTxnId}</td>
                      <td className="code-font text-center">{item.tollTxnId}</td>
                      <td className="code-font text-center font-semibold">{item.vehicleNo || item.vrn || '—'}</td>
                      <td className="code-font tag-cell" title={item.tagId}>
                        {item.tagId ? `${item.tagId.slice(0, 10)}…` : '—'}
                      </td>
                      <td className="font-semibold">{item.plazaName} ({item.plazaId})</td>
                      <td className="text-center">{formatDateTime(item.txnDateTime)}</td>
                      <td className="text-center">{item.settlementDate || '—'}</td>
                      <td className="text-center" style={{ fontWeight: 600, color: '#0369a1' }}>
                        {item.tatDueDate || '—'}
                      </td>
                      <td className="num-col font-bold">₹ {Number(item.disputeAmount || 0).toFixed(2)}</td>
                      <td style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis' }} title={item.adminReason}>
                        {item.adminReason || '—'}
                      </td>
                      <td className="text-center">
                        <span className={`badge ${isAccepted ? 'badge-green' : isRejected ? 'badge-red' : 'badge-neutral'}`}>
                          {isAccepted ? 'Accepted' : isRejected ? 'Rejected' : 'Pending'}
                        </span>
                      </td>
                      <td className="text-center" style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                        {item.plazaActionTime || '—'}
                      </td>
                      <td style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis' }} title={item.plazaReason}>
                        {item.plazaReason || '—'}
                      </td>
                      <td className="text-center">{item.plazaActionBy || item.assignedBy || '—'}</td>
                      <td className="text-center">
                        <span className={`badge ${statusBadgeClass}`}>
                          {item.lifecycleStatus || 'Pending Assignment'}
                        </span>
                      </td>
                      <td className="text-center">{item.closureDate || '—'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {filteredRecords.length > 0 && (
              <tfoot>
                <tr className="total-summary-row">
                  <td colSpan="10" className="total-label text-center">
                    TOTAL DISPUTE AMOUNT
                  </td>
                  <td className="num-col total-amount font-bold">
                    ₹ {Number(totalDisputeAmt).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td colSpan="7" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Table Pagination Bar */}
        <TablePagination
          totalItems={filteredRecords.length}
          currentPage={currentPage}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
          pageSizeOptions={[10, 25, 50, 100]}
        />

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
            fontSize: '0.82rem',
            color: '#64748b'
          }}
        >
          <span>📥 Export Download Time: </span>
          <span style={{ fontFamily: 'monospace', color: downloadTime ? '#0369a1' : '#64748b', fontWeight: downloadTime ? 600 : 400 }}>
            {downloadTime || 'Not exported yet'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default DisputeDetailReport;
