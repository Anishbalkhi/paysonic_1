import React, { useState, useEffect } from 'react';
import UserActivityService from '../../services/userActivity/UserActivityService';
import KpiGrid from './components/KpiGrid';
import LoginTrendChart from './components/LoginTrendChart';
import ModuleBreakdown from './components/ModuleBreakdown';
import RecentActivityTable from './components/RecentActivityTable';
import ActiveUsersTable from './components/ActiveUsersTable';
import LoginHistoryTable from './components/LoginHistoryTable';
import AuditLogTable from './components/AuditLogTable';
import AuditDetailDrawer from './components/AuditDetailDrawer';
import ExportConfirmModal from './components/ExportConfirmModal';
import Loader from '../../components/Loader/Loader';
import './UserActivity.scss';

export const UserActivity = () => {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'audit' | 'sessions' | 'logins'
  const [stats, setStats] = useState(null);
  const [breakdown, setBreakdown] = useState([]);
  const [auditEvents, setAuditEvents] = useState([]);
  const [activeUsers, setActiveUsers] = useState([]);
  const [loginHistory, setLoginHistory] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [exportContext, setExportContext] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [s, b, a, u, l] = await Promise.all([
        UserActivityService.getDashboardStats(),
        UserActivityService.getModuleBreakdown(),
        UserActivityService.getAuditLog(),
        UserActivityService.getActiveUsers(),
        UserActivityService.getLoginHistory(),
      ]);
      setStats(s);
      setBreakdown(b);
      setAuditEvents(a);
      setActiveUsers(u);
      setLoginHistory(l);
    } catch (err) {
      console.error('Failed to load activity telemetry:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenExport = (ctx) => {
    setExportContext(ctx || { count: auditEvents.length, filters: {} });
    setIsExportOpen(true);
  };

  const handleExportComplete = async () => {
    // Refresh audit events and stats so the logged export event appears immediately
    const [a, s] = await Promise.all([
      UserActivityService.getAuditLog(),
      UserActivityService.getDashboardStats(),
    ]);
    setAuditEvents(a);
    setStats(s);
  };

  const handleForceLogout = async (sessionId, reason) => {
    await UserActivityService.forceLogout(sessionId, reason);
    const [u, a, s] = await Promise.all([
      UserActivityService.getActiveUsers(),
      UserActivityService.getAuditLog(),
      UserActivityService.getDashboardStats(),
    ]);
    setActiveUsers(u);
    setAuditEvents(a);
    setStats(s);
  };

  if (loading) {
    return <Loader message="Compiling real-time activity and audit feeds..." />;
  }

  return (
    <div className="user-activity-page">
      {/* Page Header */}
      <div className="activity-page-head">
        <div className="head-left">
          <h1>User Activity &amp; Audit Trail</h1>
          <p>
            Real-time session monitoring, authentication history, and immutable administrative audit records
          </p>
        </div>

        <div className="head-right">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setIsExportOpen(true)}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#344054" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export Audit
          </button>
          <button type="button" className="btn btn-primary" onClick={loadData}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2">
              <path d="M23 4v6h-6" />
              <path d="M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            Refresh Feeds
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="activity-tabs-bar">
        <button
          type="button"
          className={`tab-item ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="3" y="3" width="7" height="9" rx="1.5" />
            <rect x="14" y="3" width="7" height="5" rx="1.5" />
            <rect x="14" y="12" width="7" height="9" rx="1.5" />
            <rect x="3" y="16" width="7" height="5" rx="1.5" />
          </svg>
          Overview &amp; Telemetry
        </button>

        <button
          type="button"
          className={`tab-item ${activeTab === 'audit' ? 'active' : ''}`}
          onClick={() => setActiveTab('audit')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          Audit Log
          <span className="tab-pill">{auditEvents.length}</span>
        </button>

        <button
          type="button"
          className={`tab-item ${activeTab === 'sessions' ? 'active' : ''}`}
          onClick={() => setActiveTab('sessions')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          Active Sessions
          <span className="tab-pill tab-pill--live">{activeUsers.length}</span>
        </button>

        <button
          type="button"
          className={`tab-item ${activeTab === 'logins' ? 'active' : ''}`}
          onClick={() => setActiveTab('logins')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          Login History
        </button>
      </div>

      {/* Main Tab Content */}
      <div className="activity-tab-content">
        {activeTab === 'overview' && (
          <div className="overview-view">
            {/* 8 KPI Cards */}
            <KpiGrid stats={stats} />

            {/* Middle Grid: Trend Chart + Module Breakdown */}
            <div className="overview-middle-grid">
              <LoginTrendChart />
              <ModuleBreakdown breakdown={breakdown} />
            </div>

            {/* Bottom: Recent Activity Stream */}
            <RecentActivityTable
              events={auditEvents}
              onSelectEvent={setSelectedEvent}
              onViewAll={() => setActiveTab('audit')}
            />
          </div>
        )}

        {activeTab === 'audit' && (
          <AuditLogTable
            auditEvents={auditEvents}
            onSelectEvent={setSelectedEvent}
            onOpenExport={handleOpenExport}
          />
        )}

        {activeTab === 'sessions' && (
          <ActiveUsersTable
            activeUsers={activeUsers}
            onForceLogout={handleForceLogout}
          />
        )}

        {activeTab === 'logins' && (
          <LoginHistoryTable history={loginHistory} />
        )}
      </div>

      {/* Audit Detail Drawer */}
      <AuditDetailDrawer
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />

      {/* Export Confirmation Modal */}
      <ExportConfirmModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        totalRecords={auditEvents.length}
        exportContext={exportContext}
        onExportComplete={handleExportComplete}
      />
    </div>
  );
};

export default UserActivity;
