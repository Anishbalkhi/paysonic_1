import React, { useState, useMemo, useEffect } from 'react';
import TablePagination from '../../../components/common/TablePagination';
import { parseUtcTimestamp, calculateSessionDuration, formatRelativeTime } from '../../../utils/dateUtils';

const ROLE_OPTIONS = [
  'All Roles',
  'Master Admin',
  'Admin',
  'Plaza Admin',
  'Concessionaire',
  'Auditor',
  'Support Operator',
  'Plaza POS',
  'Bank',
];

export const ActiveUsersTable = ({ activeUsers = [], onForceLogout }) => {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All Roles');
  const [selectedSession, setSelectedSession] = useState(null);
  const [logoutReason, setLogoutReason] = useState('Administrative revocation');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredUsers = useMemo(() => {
    return activeUsers.filter((u) => {
      if (roleFilter !== 'All Roles' && u.role !== roleFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        return (
          (u.name && u.name.toLowerCase().includes(q)) ||
          (u.userId && u.userId.toLowerCase().includes(q)) ||
          (u.username && u.username.toLowerCase().includes(q)) ||
          (u.department && u.department.toLowerCase().includes(q)) ||
          (u.ipAddress && u.ipAddress.toLowerCase().includes(q)) ||
          (u.location && u.location.toLowerCase().includes(q)) ||
          (u.device && u.device.toLowerCase().includes(q)) ||
          (u.plaza && u.plaza.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [activeUsers, search, roleFilter]);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, roleFilter]);

  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, currentPage, pageSize]);

  const handleOpenModal = (user) => {
    setSelectedSession(user);
    setLogoutReason('Administrative revocation');
  };

  const handleCloseModal = () => {
    setSelectedSession(null);
  };

  const handleConfirmLogout = async () => {
    if (!selectedSession) return;
    setIsSubmitting(true);
    try {
      if (onForceLogout) {
        await onForceLogout(selectedSession.sessionId, logoutReason);
      }
      setSelectedSession(null);
    } catch (err) {
      console.error('Failed to terminate session:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="active-users-view">
      <div className="view-head">
        <div>
          <h2>Active Sessions &amp; Live Connections</h2>
          <p>Real-time telemetry of authenticated personnel across plaza points and console</p>
        </div>
        <div className="active-counter-pill">
          <span className="pulse-dot" />
          {filteredUsers.length} of {activeUsers.length} Live Sessions
        </div>
      </div>

      {/* Search & Role Filter Bar */}
      <div className="filters-bar">
        <div className="search-box">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#98A2B3" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            type="text"
            placeholder="Search by user, department, IP, or device..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="filter-select"
        >
          {ROLE_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>

        {(search || roleFilter !== 'All Roles') && (
          <button
            type="button"
            className="btn btn-ghost"
            style={{ fontSize: '13px', padding: '8px 12px' }}
            onClick={() => {
              setSearch('');
              setRoleFilter('All Roles');
            }}
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
                <th style={{ minWidth: '220px' }}>User / Account</th>
                <th style={{ minWidth: '120px' }}>Role</th>
                <th style={{ minWidth: '180px' }}>Plaza &amp; Department</th>
                <th style={{ minWidth: '180px' }}>Network &amp; Device</th>
                <th style={{ minWidth: '150px' }}>Session Timeline</th>
                <th style={{ minWidth: '90px' }}>Status</th>
                <th style={{ minWidth: '140px', textAlign: 'right' }}>Security Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '36px', color: 'var(--muted)' }}>
                    No active sessions found matching current filters.
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((u) => {
                  const loginTimeParsed = parseUtcTimestamp(u.loginTime);
                  const connectedSince = loginTimeParsed
                    ? loginTimeParsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : '—';
                  const duration = u.sessionDuration || calculateSessionDuration(u.loginTime);

                  return (
                    <tr key={u.sessionId}>
                      <td>
                        <div className="user-info-cell">
                          <div className="avatar-sm">{u.name?.slice(0, 2).toUpperCase()}</div>
                          <div>
                            <strong>{u.name}</strong>
                            <span>
                              {u.userId} · {u.username || u.userId}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="role-tag">{u.role}</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span className="plaza-text" style={{ fontWeight: 600 }}>{u.plaza || 'All plazas'}</span>
                          <span style={{ fontSize: '11.5px', color: 'var(--muted)' }}>
                            {u.department || 'Operations'}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="network-cell">
                          <span className="ip">{u.ipAddress || '103.21.58.44'} <span className="loc" style={{ display: 'inline' }}>· {u.location || 'Local Console'}</span></span>
                          <span className="device-text" style={{ fontSize: '11.5px', color: 'var(--muted)', marginTop: '2px' }}>{u.device || 'Browser'}</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span className="time-text" style={{ fontWeight: 600, color: 'var(--ink)' }}>
                            {connectedSince}
                          </span>
                          <span style={{ fontSize: '11.5px', color: 'var(--muted)' }}>
                            {duration}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className={`live-badge ${u.status === 'Active' ? 'active' : 'idle'}`}>
                          <span className="dot" />
                          {u.status || 'Active'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {onForceLogout ? (
                          <button
                            type="button"
                            className="force-logout-btn"
                            onClick={() => handleOpenModal(u)}
                            title={`Forcibly terminate session ${u.sessionId}`}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M18.36 6.64a9 9 0 1 1-12.73 0M12 2v10" />
                            </svg>
                            Force Logout
                          </button>
                        ) : (
                          <span style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>
                            🔒 Admin only
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <TablePagination
          totalItems={filteredUsers.length}
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

      {/* Force Logout Modal */}
      {selectedSession && (
        <div className="overlay open center">
          <div className="modal modal-sm">
            <div className="modal-head">
              <div>
                <h2 style={{ color: 'var(--danger-text)' }}>Terminate Active Session</h2>
                <span>Immediate security revocation for {selectedSession.name}</span>
              </div>
              <button type="button" className="close-btn" onClick={handleCloseModal} aria-label="Close">
                ✕
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '13.5px', color: 'var(--body-text)', margin: 0, lineHeight: 1.5 }}>
                Are you sure you want to forcibly terminate the session for{' '}
                <strong>{selectedSession.name}</strong> (<code>{selectedSession.sessionId}</code>)?
                The user will be disconnected immediately and their access token will be invalidated.
              </p>

              <div className="callout" style={{ background: '#FEF3F2', color: '#B42318' }}>
                IP: <strong>{selectedSession.ipAddress}</strong> · Location: {selectedSession.location}
              </div>

              <div className="field">
                <label style={{ fontSize: '13px', fontWeight: 600 }}>Termination Reason</label>
                <select
                  value={logoutReason}
                  onChange={(e) => setLogoutReason(e.target.value)}
                  style={{
                    border: '1px solid #D0D5DD',
                    borderRadius: '8px',
                    padding: '9px 12px',
                    fontSize: '13.5px',
                  }}
                >
                  <option>Administrative revocation</option>
                  <option>Suspicious geolocation change</option>
                  <option>Multiple concurrent logins detected</option>
                  <option>Routine shift rotation</option>
                  <option>Emergency lock protocol</option>
                </select>
              </div>
            </div>
            <div className="modal-foot">
              <button type="button" className="btn btn-ghost" onClick={handleCloseModal} disabled={isSubmitting}>
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                style={{ background: '#B42318', color: '#fff' }}
                onClick={handleConfirmLogout}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Terminating...' : 'Confirm Disconnect'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActiveUsersTable;
