import React, { useState, useMemo } from 'react';
import { referenceFor } from '../../../utils/auditReference';

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
];

export const AuditLogTable = ({ auditEvents = [], onSelectEvent, onOpenExport }) => {
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('All modules');
  const [actionFilter, setActionFilter] = useState('All actions');
  const [statusFilter, setStatusFilter] = useState('All statuses');
  const [dateFilter, setDateFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  // Extract unique action labels for filter dropdown
  const actionOptions = useMemo(() => {
    const list = new Set();
    auditEvents.forEach((ev) => {
      if (ev.actionLabel) list.add(ev.actionLabel);
    });
    return ['All actions', ...Array.from(list).sort()];
  }, [auditEvents]);

  const filteredEvents = useMemo(() => {
    return auditEvents.filter((item) => {
      if (moduleFilter !== 'All modules' && item.module !== moduleFilter) return false;
      if (actionFilter !== 'All actions' && item.actionLabel !== actionFilter) return false;
      if (statusFilter !== 'All statuses' && item.status !== statusFilter) return false;

      if (dateFilter !== 'all') {
        const itemTime = new Date(item.timestamp).getTime();
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
  }, [auditEvents, search, moduleFilter, actionFilter, statusFilter, dateFilter]);

  const totalPages = Math.ceil(filteredEvents.length / pageSize) || 1;
  const paginatedEvents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredEvents.slice(start, start + pageSize);
  }, [filteredEvents, currentPage]);

  const handleResetFilters = () => {
    setSearch('');
    setModuleFilter('All modules');
    setActionFilter('All actions');
    setStatusFilter('All statuses');
    setDateFilter('all');
    setCurrentPage(1);
  };

  const hasActiveFilters =
    Boolean(search) ||
    moduleFilter !== 'All modules' ||
    actionFilter !== 'All actions' ||
    statusFilter !== 'All statuses' ||
    dateFilter !== 'all';

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

  return (
    <div className="audit-log-view">
      <div className="view-head">
        <div>
          <h2>Consolidated Audit Repository</h2>
          <p>Immutable record of state changes, compliance operations, and user actions across modules</p>
        </div>
        <div className="head-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onOpenExport({
              count: filteredEvents.length,
              filters: {
                module: moduleFilter,
                action: actionFilter,
                status: statusFilter,
                date: dateFilter,
                search,
              },
            })}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#344054" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export Filtered Ledger ({filteredEvents.length})
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
          onChange={(e) => {
            setDateFilter(e.target.value);
            setCurrentPage(1);
          }}
          className="filter-select"
        >
          {DATE_OPTIONS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>

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
                        {new Date(item.timestamp).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true,
                        })}
                      </td>
                      <td>
                        <div className="actor-cell">
                          <strong>{item.actor.name}</strong>
                          <span>{item.actor.role}</span>
                        </div>
                      </td>
                      <td>
                        <span className="action-pill">{item.actionLabel}</span>
                      </td>
                      <td>
                        <span className="module-tag">{item.module}</span>
                      </td>
                      <td>
                        <span className="ref-tag" title={item.target}>
                          {ref.refId}
                        </span>
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
        <div className="table-foot">
          <span className="foot-count">
            Showing {paginatedEvents.length ? (currentPage - 1) * pageSize + 1 : 0} to{' '}
            {Math.min(currentPage * pageSize, filteredEvents.length)} of {filteredEvents.length} entries
          </span>
          <div className="pager">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
            >
              ‹
            </button>
            <span className="current-page-indicator">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
            >
              ›
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuditLogTable;
