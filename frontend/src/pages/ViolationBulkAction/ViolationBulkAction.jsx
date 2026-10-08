import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ViolationBulkActionService from '../../services/violation/ViolationBulkActionService';
import useOnboardedPlazas from '../../hooks/useOnboardedPlazas';
import { useAuth } from '../../context/AuthContext';
import { filterRecordsByPlazaScope } from '../../utils/plazaScopeUtils';
import ReportKpiGrid from '../../components/ReportKpiGrid/ReportKpiGrid';
import './ViolationBulkAction.scss';

export const ViolationBulkAction = () => {
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

  // Selection & Bulk Action
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkActionType, setBulkActionType] = useState('APPROVE');
  const [bulkRemarks, setBulkRemarks] = useState('');
  const [applyingBulk, setApplyingBulk] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState('');

  // Server-computed summary or fallback
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
    const aStatus = overrides.apiStatus !== undefined ? overrides.apiStatus : apiStatus;
    const sTerm = overrides.searchTerm !== undefined ? overrides.searchTerm : searchTerm;

    if (!validateDates(fDate, tDate)) return;

    setLoading(true);
    setErrorMsg('');
    setActionSuccessMsg('');
    try {
      const data = await ViolationBulkActionService.search({
        fromDate: fDate,
        toDate: tDate,
        plazaId: pId,
        apiStatus: aStatus,
        vrn: sTerm.trim() || undefined,
        tagId: sTerm.trim() || undefined,
        acqTxnId: sTerm.trim() || undefined,
        page: newPage,
        size: newSize
      });

      let content = data?.content || (Array.isArray(data) ? data : []);
      content = filterRecordsByPlazaScope(content, onboardedPlazas, currentUser);
      setRecords(content);
      setTotalElements(data?.totalElements ?? content.length);
      setTotalPages(data?.totalPages ?? (content.length > 0 ? 1 : 0));
      setPage(data?.number ?? 0);
      if (data?.summary) {
        setServerSummary(data.summary);
      }
      setSelectedIds(new Set());
    } catch (err) {
      console.error('[ViolationBulkAction] Query failed:', err);
      const msg = err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Database error occurred';
      setErrorMsg(`Database Query Error: ${msg}`);
      setRecords([]);
      setTotalElements(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, plazaId, apiStatus, searchTerm, pageSize, isPlazaLocked, defaultPlazaId]);

  useEffect(() => {
    handleSearch(0, pageSize);
  }, [handleSearch]);

  const handleReset = () => {
    const def = getDefaultDateRange();
    const targetPlaza = isPlazaLocked ? (defaultPlazaId || 'ALL') : 'ALL';
    setFromDate(def.from);
    setToDate(def.to);
    setPlazaId(targetPlaza);
    setApiStatus('ALL');
    setSearchTerm('');
    setSelectedIds(new Set());
    setErrorMsg('');
    setActionSuccessMsg('');
    handleSearch(0, pageSize, {
      fromDate: def.from,
      toDate: def.to,
      plazaId: targetPlaza,
      apiStatus: 'ALL',
      searchTerm: ''
    });
  };

  // Selection handlers
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const allIds = new Set(filteredRecords.map(r => r.id));
      setSelectedIds(allIds);
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleToggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Execute bulk action
  const handleExecuteBulkAction = async () => {
    if (selectedIds.size === 0) {
      alert('Please select at least one violation transaction.');
      return;
    }

    const confirmMsg = `Are you sure you want to apply '${bulkActionType}' to ${selectedIds.size} selected violation record(s)?`;
    if (!window.confirm(confirmMsg)) return;

    setApplyingBulk(true);
    setActionSuccessMsg('');
    setErrorMsg('');
    try {
      const res = await ViolationBulkActionService.applyBulkAction({
        ids: Array.from(selectedIds),
        action: bulkActionType,
        remarks: bulkRemarks || `Action executed via Bulk Action`
      });

      setActionSuccessMsg(res.message || `Successfully updated ${selectedIds.size} violation record(s).`);
      setSelectedIds(new Set());
      setBulkRemarks('');
      // Refresh list to show updated DB data
      handleSearch(page, pageSize);
    } catch (err) {
      console.error('[ViolationBulkAction] Bulk update failed:', err);
      setErrorMsg(err?.response?.data?.error || err?.message || 'Failed to apply bulk action');
    } finally {
      setApplyingBulk(false);
    }
  };

  const handleExportExcel = async () => {
    if (!validateDates(fromDate, toDate)) return;
    setExportingExcel(true);
    try {
      await ViolationBulkActionService.exportExcel({
        fromDate,
        toDate,
        plazaId,
        apiStatus,
        vrn: searchTerm.trim() || undefined,
        tagId: searchTerm.trim() || undefined,
        acqTxnId: searchTerm.trim() || undefined
      });
    } catch (err) {
      console.error('[ViolationBulkAction] Excel export failed:', err);
      alert('Failed to export Excel report. Please try again.');
    } finally {
      setExportingExcel(false);
    }
  };

  const handleExportCsv = async () => {
    if (!validateDates(fromDate, toDate)) return;
    setExportingCsv(true);
    try {
      await ViolationBulkActionService.exportCsv({
        fromDate,
        toDate,
        plazaId,
        apiStatus,
        vrn: searchTerm.trim() || undefined,
        tagId: searchTerm.trim() || undefined,
        acqTxnId: searchTerm.trim() || undefined
      });
    } catch (err) {
      console.error('[ViolationBulkAction] CSV export failed:', err);
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
      if (r.plazaId && !map.has(r.plazaId)) {
        map.set(r.plazaId, `${r.plazaId} - ${r.plazaName || 'MUMBAI PLAZA NH-04'}`);
      }
    });
    if (map.size === 0) {
      map.set('501101', '501101 - MUMBAI PLAZA NH-04');
    }
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
  }, [onboardedPlazas, records]);

  const availableStatuses = useMemo(() => {
    const set = new Set();
    set.add('ACCEPTED');
    set.add('DECLINED');
    records.forEach((r) => {
      if (r.violationApiStatus) set.add(r.violationApiStatus.toUpperCase());
    });
    return Array.from(set);
  }, [records]);

  // Live client-side instant filtering across all relevant fields
  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const q = searchTerm.toLowerCase().trim();
    return records.filter((r) => {
      const vrnMatch = r.vrn && r.vrn.toLowerCase().includes(q);
      const tagMatch = r.tagId && r.tagId.toLowerCase().includes(q);
      const acqMatch = r.acqTxnId && String(r.acqTxnId).toLowerCase().includes(q);
      const tollTxnMatch = r.tollTxnId && String(r.tollTxnId).toLowerCase().includes(q);
      return vrnMatch || tagMatch || acqMatch || tollTxnMatch;
    });
  }, [records, searchTerm]);

  // Bottom KPI calculation based on filtered records
  const summaryKpis = useMemo(() => {
    if (serverSummary && !searchTerm.trim()) {
      return {
        totalCount: serverSummary.totalCount ?? 0,
        totalAmount: Number(serverSummary.totalAmount ?? 0),
        acceptedCount: serverSummary.acceptedCount ?? 0,
        declinedCount: serverSummary.declinedCount ?? 0
      };
    }

    let totalCount = 0;
    let totalAmount = 0;
    let acceptedCount = 0;
    let declinedCount = 0;

    filteredRecords.forEach((row) => {
      totalCount += 1;
      const amt = Number(row.txnAmount || 0);
      totalAmount += amt;
      const st = (row.violationApiStatus || '').trim().toUpperCase();
      if (st === 'ACCEPTED') acceptedCount += 1;
      else if (st === 'DECLINED') declinedCount += 1;
    });

    return { totalCount, totalAmount, acceptedCount, declinedCount };
  }, [serverSummary, records, filteredRecords, searchTerm]);

  const allSelected = filteredRecords.length > 0 && filteredRecords.every(r => selectedIds.has(r.id));
  const someSelected = filteredRecords.some(r => selectedIds.has(r.id)) && !allSelected;

  return (
    <div className="violation-bulk-action-page">
      {/* 1. Centered Header Banner */}
      <div className="report-header-banner">
        <h1 className="report-title">VIOLATION BULK ACTION</h1>
        <div className="report-subtitle">{dateSubtitle}</div>
        <div className="report-green-accent-bar" />
      </div>

      {/* 2. Filter & Bulk Action Toolbar Card */}
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
            <label className="filter-label">Plaza</label>
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
            <label className="filter-label">Violation API Status</label>
            <select
              className="filter-select"
              value={apiStatus}
              onChange={(e) => {
                const val = e.target.value;
                setApiStatus(val);
                handleSearch(0, pageSize, { apiStatus: val });
              }}
            >
              <option value="ALL">All Statuses</option>
              {availableStatuses.map((st) => (
                <option key={st} value={st}>{st}</option>
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

        {/* Bulk Action Controls Bar */}
        <div className="bulk-action-bar">
          <div className="bulk-selection-info">
            <span className="selected-count-badge">
              {selectedIds.size} Selected
            </span>
            <span className="bulk-hint">
              Select records below to perform batch actions directly on the database
            </span>
          </div>

          <div className="bulk-controls">
            <select
              className="bulk-select"
              value={bulkActionType}
              onChange={(e) => setBulkActionType(e.target.value)}
            >
              <option value="APPROVE">Approve Violation</option>
              <option value="REJECT">Decline / Reject Violation</option>
            </select>

            <input
              type="text"
              className="bulk-remarks-input"
              placeholder="Audit remarks / comments..."
              value={bulkRemarks}
              onChange={(e) => setBulkRemarks(e.target.value)}
            />

            <button
              className="btn btn-bulk-apply"
              disabled={selectedIds.size === 0 || applyingBulk}
              onClick={handleExecuteBulkAction}
            >
              {applyingBulk ? 'Processing...' : `Apply Action (${selectedIds.size})`}
            </button>
          </div>
        </div>

        {errorMsg && <div className="filter-error-msg">{errorMsg}</div>}
        {actionSuccessMsg && <div className="filter-success-msg">{actionSuccessMsg}</div>}
      </div>

      {/* Summary KPI Cards / Mini Dashboard */}
      <ReportKpiGrid
        cards={[
          {
            label: 'Total Violations in Scope',
            value: (totalElements || summaryKpis.totalCount).toLocaleString('en-IN'),
            sub: 'Filtered Records'
          },
          {
            label: 'Total Violation Amount',
            value: `₹ ${Number(summaryKpis.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            sub: 'Gross Penalty Amount',
            highlight: 'blue'
          },
          {
            label: 'Selected for Action',
            value: `${selectedIds.size} / ${filteredRecords.length}`,
            sub: 'Pending Batch Execution',
            highlight: selectedIds.size > 0 ? 'green' : 'amber'
          }
        ]}
      />

      {/* 3. Table Area */}
      <div className="table-wrapper">
        <div className="table-responsive">
          <table className="violation-styled-table">
            <thead>
              <tr>
                <th className="select-col-th">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={el => { if (el) el.indeterminate = someSelected; }}
                    onChange={handleSelectAll}
                  />
                </th>
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
                  <td colSpan="17" className="table-loading-cell">
                    <div className="spinner" />
                    <span>Querying database records...</span>
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan="17" className="table-empty-cell">
                    No violation records found for the selected criteria.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((row) => {
                  const isSelected = selectedIds.has(row.id);
                  const apiSt = (row.violationApiStatus || '').trim().toUpperCase();
                  const isAccepted = apiSt === 'ACCEPTED';
                  const isDeclined = apiSt === 'DECLINED';

                  return (
                    <tr
                      key={row.id}
                      className={isSelected ? 'row-selected' : ''}
                      onClick={() => handleToggleSelect(row.id)}
                    >
                      <td className="text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(row.id)}
                        />
                      </td>
                      <td className="text-center">{row.plazaId || '-'}</td>
                      <td>{row.plazaName || '-'}</td>
                      <td className="text-center font-semibold">{row.vrn || '-'}</td>
                      <td className="monospace-cell">{row.tagId || '-'}</td>
                      <td className="monospace-cell">{row.acqTxnId || '-'}</td>
                      <td className="text-center font-semibold">{row.tollTxnId || '-'}</td>
                      <td className="text-right font-semibold">
                        {Number(row.txnAmount || 0).toFixed(0)}
                      </td>
                      <td className="text-center">{formatDateTimeDisplay(row.txnDateTime)}</td>
                      <td className="text-center">{row.mvc || '-'}</td>
                      <td className="text-center">{row.avc || '-'}</td>
                      <td className="text-center">{row.auditVc || 'NA'}</td>
                      <td className="text-center">{row.auditRemark || '-'}</td>
                      <td>{row.auditDesc || '-'}</td>
                      <td className="text-center">
                        <span className="violation-img-badge">
                          {row.violationImg || 'YES'}
                        </span>
                      </td>
                      <td className="text-center">{row.netcTxnType || 'DEBIT'}</td>
                      <td className="text-center">
                        <span className={`status-pill ${isAccepted ? 'badge-accepted' : isDeclined ? 'badge-declined' : 'badge-other'}`}>
                          {apiSt}
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
      </div>

      {/* 4. Bottom Summary KPI Bar */}
      <div className="report-kpi-summary-bar">
        <div className="kpi-card">
          <span className="kpi-label">Total Violations</span>
          <span className="kpi-val">{summaryKpis.totalCount}</span>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">Total Txn Amount</span>
          <span className="kpi-val">₹{summaryKpis.totalAmount.toFixed(2)}</span>
        </div>

        <div className="kpi-card kpi-success">
          <span className="kpi-label">Accepted API</span>
          <span className="kpi-val">{summaryKpis.acceptedCount}</span>
        </div>

        <div className="kpi-card kpi-danger">
          <span className="kpi-label">Declined API</span>
          <span className="kpi-val">{summaryKpis.declinedCount}</span>
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

export default ViolationBulkAction;
