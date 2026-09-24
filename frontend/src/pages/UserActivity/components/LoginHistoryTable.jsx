import React, { useState, useMemo } from 'react';

const DATE_RANGE_OPTIONS = [
  { label: 'All Time', value: 'all' },
  { label: 'Today', value: 'today' },
  { label: 'Past 7 Days', value: '7d' },
  { label: 'Past 30 Days', value: '30d' },
];

// Railway returns timestamps without a timezone designator, e.g. '2026-09-21T13:30:00'
// Some browsers treat these as local time and others as invalid. Normalise by
// appending 'Z' (UTC) when no offset is present so parsing is always consistent.
const parseTs = (ts) => {
  if (!ts) return null;
  if (ts instanceof Date) return ts;
  if (typeof ts === 'number') return new Date(ts);
  const s = String(ts).trim();
  const direct = new Date(s);
  if (!isNaN(direct.getTime())) return direct;
  if (!/[Z+]/.test(s.slice(10))) {
    const withZ = new Date(s.replace(' ', 'T') + 'Z');
    if (!isNaN(withZ.getTime())) return withZ;
  }
  return null;
};

const formatDate = (ts) => {
  const d = parseTs(ts);
  if (!d || isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

export const LoginHistoryTable = ({ history = [] }) => {
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const now = Date.now(); // Always relative to real current time

    return history.filter((item) => {
      if (statusFilter !== 'All' && item.status !== statusFilter) return false;

      if (dateFilter !== 'all') {
        const itemTime = (parseTs(item.lastLogin || item.timestamp) || new Date(0)).getTime();
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const startOfTodayMs = startOfToday.getTime();
        if (dateFilter === 'today' && itemTime < startOfTodayMs) return false;
        if (dateFilter === '7d'  && itemTime < now - 7  * 24 * 60 * 60 * 1000) return false;
        if (dateFilter === '30d' && itemTime < now - 30 * 24 * 60 * 60 * 1000) return false;
      }

      if (search.trim()) {
        const q = search.toLowerCase().trim();
        return (
          (item.name && item.name.toLowerCase().includes(q)) ||
          (item.username && item.username.toLowerCase().includes(q)) ||
          (item.userId && item.userId.toLowerCase().includes(q)) ||
          (item.lastIp && item.lastIp.toLowerCase().includes(q)) ||
          (item.ipAddress && item.ipAddress.toLowerCase().includes(q)) ||
          (item.location && item.location.toLowerCase().includes(q)) ||
          (item.device && item.device.toLowerCase().includes(q)) ||
          (item.accountStatus && item.accountStatus.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [history, statusFilter, dateFilter, search]);

  const handleResetFilters = () => {
    setStatusFilter('All');
    setDateFilter('all');
    setSearch('');
  };

  const getAccountStatusBadge = (accStatus) => {
    const status = accStatus || 'Active';
    switch (status) {
      case 'Active':
        return <span className="status-pill status-pill--success">Active</span>;
      case 'Locked':
        return <span className="status-pill status-pill--danger">Locked</span>;
      case 'Suspended':
        return <span className="status-pill status-pill--warning">Suspended</span>;
      default:
        return <span className="status-pill status-pill--neutral">{status}</span>;
    }
  };

  return (
    <div className="login-history-view">
      <div className="view-head">
        <div>
          <h2>Authentication Audit &amp; History</h2>
          <p>Complete historical log of authorized and rejected login attempts per user account</p>
        </div>
        <div className="active-counter-pill" style={{ background: '#F8FAFC', color: 'var(--ink)', borderColor: '#E2E8F0' }}>
          {filtered.length} of {history.length} Records
        </div>
      </div>

      {/* Filters Bar */}
      <div className="filters-bar">
        <div className="search-box">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#98A2B3" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            type="text"
            placeholder="Search by user, IP, location, or status..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="filter-select"
        >
          <option value="All">All Statuses</option>
          <option value="Success">Success Only</option>
          <option value="Failed">Failed Attempts</option>
        </select>

        <select
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="filter-select"
        >
          {DATE_RANGE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {(statusFilter !== 'All' || dateFilter !== 'all' || search) && (
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

      <div className="table-card">
        <div className="table-scroll">
          <table className="activity-table">
            <thead>
              <tr>
                <th>Last Login</th>
                <th>Identity &amp; Role</th>
                <th>Login Count</th>
                <th>Failed Count</th>
                <th>Last Logout</th>
                <th>Last IP &amp; Geolocation</th>
                <th>Device</th>
                <th>Account Status</th>
                <th>Attempt Result</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '36px', color: 'var(--muted)' }}>
                    No authentication records found matching the specified filters.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id}>
                    <td className="time-cell">
                      {formatDate(item.lastLogin || item.timestamp)}
                    </td>
                    <td>
                      <div className="user-info-cell">
                        <strong>{item.name}</strong>
                        <span>
                          {item.userId} · {item.role}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
                        {item.loginCount ?? 1}
                      </span>
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: '13px',
                          fontWeight: 600,
                          color: (item.failedLoginCount ?? 0) > 0 ? 'var(--danger-text)' : 'var(--muted)',
                        }}
                      >
                        {item.failedLoginCount ?? 0}
                      </span>
                    </td>
                    <td className="time-cell">
                      {item.lastLogout ? formatDate(item.lastLogout) : 'Active session'}
                    </td>
                    <td>
                      <div className="network-cell">
                        <span className="ip">{item.lastIp || item.ipAddress}</span>
                        <span className="loc">{item.location}</span>
                      </div>
                    </td>
                    <td>
                      <span className="device-text">{item.device}</span>
                    </td>
                    <td>{getAccountStatusBadge(item.accountStatus)}</td>
                    <td>
                      {item.status === 'Success' ? (
                        <span className="status-pill status-pill--success">Success</span>
                      ) : (
                        <div className="failed-wrap">
                          <span className="status-pill status-pill--danger">Failed</span>
                          {item.reason && <span className="reason-hint">{item.reason}</span>}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default LoginHistoryTable;
