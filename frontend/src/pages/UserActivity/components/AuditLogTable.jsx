import React, { useState, useMemo } from 'react';
import TablePagination from '../../../components/common/TablePagination';
import UserActivityService from '../../../services/userActivity/UserActivityService';
import { referenceFor } from '../../../utils/auditReference';
import { formatAuditTimestamp, parseUtcTimestamp, sortRecordsLatestFirst, getRecordTimestampMs } from '../../../utils/dateUtils';

const MODULE_OPTIONS = [
  'All modules',
  'User Management',
  'Dispute Handling',
  'Recon Management',
  'Violation Management',
  'Transactional Report',
  'Pass Issuance',
  'Tag Details',
  'On Boarding',
];

const DATE_OPTIONS = [
  { label: 'All Dates', value: 'all' },
  { label: 'Today', value: 'today' },
  { label: 'Past 7 Days', value: '7d' },
  { label: 'Past 30 Days', value: '30d' },
  { label: 'Custom Range', value: 'custom' },
];

export const AuditLogTable = ({ auditEvents = [], onSelectEvent, onOpenExport, onExportComplete }) => {
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState(false);
  const [moduleFilter, setModuleFilter] = useState('All modules');
  const [actionFilter, setActionFilter] = useState('All actions');
  const [statusFilter, setStatusFilter] = useState('All statuses');
  const [dateFilter, setDateFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Extract unique action labels for filter dropdown
  const actionOptions = useMemo(() => {
    const list = new Set();
    auditEvents.forEach((ev) => {
      if (ev.actionLabel) list.add(ev.actionLabel);
    });
    return ['All actions', ...Array.from(list).sort()];
  }, [auditEvents]);

  const filteredEvents = useMemo(() => {
    const list = auditEvents.filter((item) => {
      if (moduleFilter !== 'All modules' && item.module !== moduleFilter) return false;
      if (actionFilter !== 'All actions' && item.actionLabel !== actionFilter) return false;
      if (statusFilter !== 'All statuses' && item.status !== statusFilter) return false;

      // Custom date range filter or preset
      if (fromDate || toDate) {
        const itemTime = parseUtcTimestamp(item.timestamp)?.getTime() || getRecordTimestampMs(item) || 0;
        if (fromDate) {
          const [fy, fm, fd] = fromDate.split('-').map(Number);
          const fromMs = new Date(fy, fm - 1, fd, 0, 0, 0, 0).getTime();
          if (itemTime < fromMs) return false;
        }
        if (toDate) {
          const [ty, tm, td] = toDate.split('-').map(Number);
          const toMs = new Date(ty, tm - 1, td, 23, 59, 59, 999).getTime();
          if (itemTime > toMs) return false;
        }
      } else if (dateFilter !== 'all' && dateFilter !== 'custom') {
        const itemTime = parseUtcTimestamp(item.timestamp)?.getTime() || getRecordTimestampMs(item) || 0;
        const now = Date.now();
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const startOfTodayMs = startOfToday.getTime();

        if (dateFilter === 'today' && itemTime < startOfTodayMs) return false;
        if (dateFilter === '7d'  && itemTime < now - 7  * 24 * 60 * 60 * 1000) return false;
        if (dateFilter === '30d' && itemTime < now - 30 * 24 * 60 * 60 * 1000) return false;
      }

      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const ref = referenceFor(item);
        return (
          (item.id && item.id.toLowerCase().includes(q)) ||
          (item.correlationId && item.correlationId.toLowerCase().includes(q)) ||
          (ref.refId && ref.refId.toLowerCase().includes(q)) ||
          (item.target && item.target.toLowerCase().includes(q)) ||
          (item.actionLabel && item.actionLabel.toLowerCase().includes(q)) ||
          (item.action && item.action.toLowerCase().includes(q)) ||
          (item.actor?.name && item.actor.name.toLowerCase().includes(q)) ||
          (item.actor?.role && item.actor.role.toLowerCase().includes(q)) ||
          (item.actor?.ipAddress && item.actor.ipAddress.toLowerCase().includes(q)) ||
          (item.plaza && item.plaza.toLowerCase().includes(q)) ||
          (item.details && item.details.toLowerCase().includes(q))
        );
      }
      return true;
    });
    return sortRecordsLatestFirst(list);
  }, [auditEvents, search, moduleFilter, actionFilter, statusFilter, dateFilter, fromDate, toDate]);

  const paginatedEvents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredEvents.slice(start, start + pageSize);
  }, [filteredEvents, currentPage, pageSize]);

  const handleDatePresetChange = (val) => {
    setDateFilter(val);
    if (val !== 'custom') {
      setFromDate('');
      setToDate('');
    }
    setCurrentPage(1);
  };

  const handleFromDateChange = (val) => {
    setFromDate(val);
    setDateFilter('custom');
    setCurrentPage(1);
  };

  const handleToDateChange = (val) => {
    setToDate(val);
    setDateFilter('custom');
    setCurrentPage(1);
  };

  const handleClearCustomDates = () => {
    setFromDate('');
    setToDate('');
    setDateFilter('all');
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setSearch('');
    setModuleFilter('All modules');
    setActionFilter('All actions');
    setStatusFilter('All statuses');
    setDateFilter('all');
    setFromDate('');
    setToDate('');
    setCurrentPage(1);
  };

  const hasActiveFilters =
    Boolean(search) ||
    moduleFilter !== 'All modules' ||
    actionFilter !== 'All actions' ||
    statusFilter !== 'All statuses' ||
    dateFilter !== 'all' ||
    Boolean(fromDate) ||
    Boolean(toDate);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'SUCCESS':
        return <span className="status-pill status-pill--success">Success</span>;
      case 'WARNING':
        return <span className="status-pill status-pill--warning">Warning</span>;
      case 'FAILURE':
        return <span className="status-pill status-pill--danger">Failure</span>;
      default:
        return <span className="status-pill status-pill--neutral">{status}</span>;
    }
  };

  const handleExportClick = () => {
    const activeFilters = {
      module: moduleFilter !== 'All modules' ? moduleFilter : undefined,
      action: actionFilter !== 'All actions' ? actionFilter : undefined,
      status: statusFilter !== 'All statuses' ? statusFilter : undefined,
      date: dateFilter !== 'all' ? dateFilter : undefined,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
      search: search.trim() || undefined,
    };
    if (onOpenExport) {
      onOpenExport({
        count: filteredEvents.length,
        initialScope: hasActiveFilters ? 'filtered' : 'full',
        title: 'Export Audit',
        filters: activeFilters,
        filteredRecords: filteredEvents,
        allRecords: auditEvents,
      });
    } else {
      handleExportAudit();
    }
  };

  const handleExportAudit = async () => {
    setExporting(true);
    try {
      const activeFilters = {
        module: moduleFilter !== 'All modules' ? moduleFilter : undefined,
        action: actionFilter !== 'All actions' ? actionFilter : undefined,
        status: statusFilter !== 'All statuses' ? statusFilter : undefined,
        date: dateFilter !== 'all' ? dateFilter : undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        search: search.trim() || undefined,
      };
      const result = await UserActivityService.exportAudit(
        activeFilters,
        'excel',
        hasActiveFilters ? 'filter_ledger' : 'audit',
        hasActiveFilters ? filteredEvents : auditEvents
      );
      UserActivityService.downloadFile(result);
      if (onExportComplete) onExportComplete();
    } catch (err) {
      console.error('Failed to export audit log:', err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="audit-log-view">
      <div className="view-head">
        <div>
          <h2>Consolidated Audit Repository</h2>
          <p>Immutable record of state changes, compliance operations, and user actions across modules</p>
        </div>
        <div className="head-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary btn-export-xls"
            onClick={handleExportClick}
            disabled={exporting || (filteredEvents.length === 0 && auditEvents.length === 0)}
            title="Download Audit Log in Excel, CSV, or Structured JSON format"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {exporting ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </div>

      {/* Filter Row: module, action, status, date, search, and reset */}
      <div className="filters-bar">
        <div className="search-box">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#98A2B3" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            type="text"
            placeholder="Search by Reference, Correlation ID, Actor, Action, or Target..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>

        <select
          value={moduleFilter}
          onChange={(e) => {
            setModuleFilter(e.target.value);
            setCurrentPage(1);
          }}
          className="filter-select"
        >
          {MODULE_OPTIONS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>

        <select
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value);
            setCurrentPage(1);
          }}
          className="filter-select"
          style={{ maxWidth: '200px' }}
        >
          {actionOptions.map((act) => (
            <option key={act} value={act}>
              {act}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setCurrentPage(1);
          }}
          className="filter-select"
        >
          <option value="All statuses">All Statuses</option>
          <option value="SUCCESS">Success</option>
          <option value="WARNING">Warning</option>
          <option value="FAILURE">Failure</option>
        </select>

        <select
          value={dateFilter}
          onChange={(e) => handleDatePresetChange(e.target.value)}
          className="filter-select"
        >
          {DATE_OPTIONS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>

        <div className="custom-date-filter-group" title="Custom Date Range Filter">
          <div className="date-input-wrap">
            <span className="date-label">From</span>
            <input
              type="date"
              className="custom-date-input"
              value={fromDate}
              onChange={(e) => handleFromDateChange(e.target.value)}
              title="Select From Date"
              aria-label="From Date"
            />
          </div>
          <span className="date-input-sep">to</span>
          <div className="date-input-wrap">
            <span className="date-label">To</span>
            <input
              type="date"
              className="custom-date-input"
              value={toDate}
              onChange={(e) => handleToDateChange(e.target.value)}
              title="Select To Date"
              aria-label="To Date"
            />
          </div>
          {(fromDate || toDate) && (
            <button
              type="button"
              className="clear-date-btn"
              onClick={handleClearCustomDates}
              title="Clear custom dates"
              aria-label="Clear custom dates"
            >
              ✕
            </button>
          )}
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            className="btn btn-ghost"
            style={{ fontSize: '13px', padding: '8px 12px' }}
            onClick={handleResetFilters}
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="table-card">
        <div className="table-scroll">
          <table className="activity-table">
            <thead>
              <tr>
                <th>Event ID</th>
                <th>Timestamp</th>
                <th>Actor Identity</th>
                <th>Action Performed</th>
                <th>Module</th>
                <th>Reference ID</th>
                <th>Correlation ID</th>
                <th>IP Address</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedEvents.length === 0 ? (
                <tr>
                  <td colSpan="10" style={{ textAlign: 'center', padding: '36px', color: 'var(--muted)' }}>
                    No audit records match the selected filters.
                  </td>
                </tr>
              ) : (
                paginatedEvents.map((item) => {
                  const ref = referenceFor(item);
                  return (
                    <tr
                      key={item.id}
                      className="clickable-row"
                      onClick={() => {
                        if (onSelectEvent) onSelectEvent(item);
                      }}
                    >
                      <td>
                        <span className="event-id-tag">{item.id}</span>
                      </td>
                      <td className="time-cell">
                        {formatAuditTimestamp(item.timestamp)}
                      </td>
                      <td>
                        <div className="actor-cell">
                          <strong>{item.actor.name}</strong>
                          <span>{item.actor.role}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`action-pill ${ref.user?.isDelete ? 'action-pill--danger' : ''}`}>
                          {item.actionLabel}
                        </span>
                      </td>
                      <td>
                        <span className="module-tag">{item.module}</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <span className="ref-tag" title={item.target}>
                            {ref.refId}
                          </span>
                          {ref.user?.name && ref.user.name !== 'User Profile' && (
                            <span
                              style={{
                                fontSize: '11px',
                                color: ref.user.isDelete ? '#B42318' : '#344054',
                                fontWeight: 600,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                maxWidth: '140px',
                              }}
                              title={`${ref.user.name} (${ref.user.role})`}
                            >
                              {ref.user.name}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontSize: '11.5px',
                            color: 'var(--muted)',
                            background: '#F8FAFC',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            border: '1px solid #E2E8F0',
                          }}
                        >
                          {item.correlationId || 'CORR-GEN-001'}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                          {item.actor.ipAddress || '127.0.0.1'}
                        </span>
                      </td>
                      <td>{getStatusBadge(item.status)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="inspect-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onSelectEvent) onSelectEvent(item);
                          }}
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer / Pagination */}
        <TablePagination
          totalItems={filteredEvents.length}
          currentPage={currentPage}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
          pageSizeOptions={[10, 25, 50, 100]}
        />
      </div>
    </div>
  );
};

export default AuditLogTable;
