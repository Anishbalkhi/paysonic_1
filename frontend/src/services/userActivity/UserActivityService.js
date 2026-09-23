import httpClient from '../api/httpClient';
import UserService from '../user/UserService';
import initialAuditLog from '../../data/auditLog.json';
import initialActiveUsers from '../../data/activeUsers.json';
import initialLoginHistory from '../../data/loginHistory.json';

const LOGIN_HISTORY_STORAGE_KEY = 'paysonic_login_history';
const ACTIVE_SESSIONS_STORAGE_KEY = 'paysonic_active_sessions';
const AUDIT_LOG_STORAGE_KEY = 'paysonic_audit_log';

// Persistent local telemetry helpers
const getStoredLoginHistory = () => {
  try {
    const raw = localStorage.getItem(LOGIN_HISTORY_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [...initialLoginHistory];
};

const saveStoredLoginHistory = (history) => {
  try {
    localStorage.setItem(LOGIN_HISTORY_STORAGE_KEY, JSON.stringify(history));
  } catch {}
};

const getStoredActiveSessions = () => {
  try {
    const raw = localStorage.getItem(ACTIVE_SESSIONS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [...initialActiveUsers];
};

const saveStoredActiveSessions = (sessions) => {
  try {
    localStorage.setItem(ACTIVE_SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
  } catch {}
};

const getStoredAuditLog = () => {
  try {
    const raw = localStorage.getItem(AUDIT_LOG_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [...initialAuditLog];
};

const saveStoredAuditLog = (log) => {
  try {
    localStorage.setItem(AUDIT_LOG_STORAGE_KEY, JSON.stringify(log));
  } catch {}
};

class UserActivityService {
  /**
   * Record real-time login attempt (Success or Failed)
   */
  recordLoginAttempt({ userId, name, role, email, status, failureReason, ipAddress, device }) {
    const history = getStoredLoginHistory();
    const newEntry = {
      id: `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      userId: userId || 'UNKNOWN',
      name: name || email || 'Unauthenticated User',
      role: role || 'Unknown Role',
      ipAddress: ipAddress || '127.0.0.1',
      device:
        device ||
        (typeof navigator !== 'undefined'
          ? `${navigator.userAgent.includes('Windows') ? 'Windows 11' : navigator.userAgent.includes('Mac') ? 'macOS' : 'Linux'} · Chrome`
          : 'Desktop Browser'),
      status: status, // 'Success' | 'Failed'
      failureReason: failureReason || null,
      timestamp: new Date().toISOString(),
    };
    history.unshift(newEntry);
    saveStoredLoginHistory(history);
    return newEntry;
  }

  /**
   * Register a live active session on login
   */
  registerActiveSession({ userId, username, name, role, plaza, ipAddress, device }) {
    const sessions = getStoredActiveSessions();
    // Mark prior active sessions for this user as Terminated
    const updated = sessions.map((s) =>
      s.userId === userId && s.status === 'Active'
        ? { ...s, status: 'Terminated', lastActive: 'Closed' }
        : s
    );

    const sessionId = `SES-${Date.now().toString().slice(-6)}`;
    const newSession = {
      sessionId,
      userId,
      username: username || (userId || '').toLowerCase(),
      name,
      role,
      department:
        role === 'Master Admin'
          ? 'Security & Access Control'
          : role === 'Bank'
          ? 'Financial Audit'
          : role === 'Concessionaire'
          ? 'Highway Operations'
          : 'Toll Plaza Operations',
      plaza: plaza || 'All plazas',
      ipAddress: ipAddress || '127.0.0.1',
      location: 'Local Console Node',
      device:
        device ||
        (typeof navigator !== 'undefined'
          ? `${navigator.userAgent.includes('Windows') ? 'Windows 11' : navigator.userAgent.includes('Mac') ? 'macOS' : 'Linux'} · Chrome`
          : 'Desktop Browser'),
      loginTime: new Date().toISOString(),
      lastActive: 'Just now',
      sessionDuration: 'Active now',
      status: 'Active',
    };
    updated.unshift(newSession);
    saveStoredActiveSessions(updated);
    return sessionId;
  }

  /**
   * Terminate active session
   */
  terminateSession(sessionId, reason = 'Administrative revocation') {
    const sessions = getStoredActiveSessions();
    const targetSession = sessions.find((s) => s.sessionId === sessionId);
    const updated = sessions.map((s) => {
      if (s.sessionId === sessionId) {
        return { ...s, status: 'Terminated', lastActive: 'Terminated', sessionDuration: 'Closed' };
      }
      return s;
    });
    saveStoredActiveSessions(updated);

    // Record audit event
    let actor = { id: 'PSN0001', name: 'Sanjay Kulkarni', role: 'Master Admin' };
    try {
      const activeUser = JSON.parse(localStorage.getItem('paysonic_auth_session') || '{}');
      if (activeUser.name) actor = activeUser;
    } catch {}

    this.recordAuditEvent({
      module: 'Session Security',
      action: 'TERMINATE_SESSION',
      actionLabel: 'Terminated Active Session',
      status: 'SUCCESS',
      target: targetSession ? `${targetSession.name} (${targetSession.sessionId})` : sessionId,
      details: `Session terminated: ${reason}`,
      actor: {
        id: actor.id,
        name: actor.name,
        role: actor.role,
        ipAddress: '127.0.0.1',
      },
    });
  }

  /**
   * Record real-time audit ledger entry
   */
  recordAuditEvent({
    module,
    action,
    actionLabel,
    status = 'SUCCESS',
    target,
    details,
    actor,
    plaza,
    before,
    after,
  }) {
    const logs = getStoredAuditLog();
    const newAudit = {
      id: `AUD-${Date.now().toString().slice(-6)}`,
      timestamp: new Date().toISOString(),
      module: module || 'User Management',
      action: action || 'AUDIT_ACTION',
      actionLabel: actionLabel || 'Audit Event Logged',
      status: status || 'SUCCESS',
      plaza: plaza || 'All plazas',
      target: target || 'User Profile',
      referenceId: `REF-${Date.now().toString().slice(-4)}`,
      correlationId: `CORR-${Date.now().toString().slice(-6)}`,
      details: details || '',
      actor: actor || {
        id: 'PSN0001',
        name: 'Sanjay Kulkarni',
        role: 'Master Admin',
        ipAddress: '127.0.0.1',
      },
      before: before || null,
      after: after || null,
    };
    logs.unshift(newAudit);
    saveStoredAuditLog(logs);
    return newAudit;
  }

  /**
   * Calculate 100% Real KPI Dashboard Statistics
   */
  async getDashboardStats() {
    let users = [];
    try {
      users = await UserService.getUsers();
    } catch {
      users = JSON.parse(localStorage.getItem('paysonic_users_cache') || '[]');
    }

    const activeSessions = getStoredActiveSessions();
    const loginHistory = getStoredLoginHistory();
    const auditLogs = getStoredAuditLog();

    const totalUsers = users.length;
    const activeUsersCount = activeSessions.filter((s) => s.status === 'Active').length;
    const inactiveUsersCount = users.filter((u) => u.status === 'Inactive').length;
    const lockedUsersCount = users.filter((u) => u.locked).length;

    // Filter events for today (local calendar date)
    const now = new Date();
    const todayYear = now.getFullYear();
    const todayMonth = now.getMonth();
    const todayDate = now.getDate();

    const isToday = (ts) => {
      if (!ts) return false;
      const d = new Date(ts);
      return (
        d.getFullYear() === todayYear &&
        d.getMonth() === todayMonth &&
        d.getDate() === todayDate
      );
    };

    const failedLoginsToday = loginHistory.filter(
      (l) => isToday(l.timestamp) && l.status === 'Failed'
    ).length;

    const totalActivitiesToday = auditLogs.filter((a) => isToday(a.timestamp)).length;

    const criticalSecurityEvents = auditLogs.filter(
      (a) => a.status === 'WARNING' || a.status === 'FAILURE'
    ).length;

    const exportsPerformed = auditLogs.filter(
      (a) => a.action === 'EXPORT_AUDIT_LOG' || a.module === 'Transactional Report'
    ).length;

    return {
      totalUsers,
      totalUsersDelta: 0,
      activeUsers: activeUsersCount,
      activeUsersDelta: 0,
      inactiveUsers: inactiveUsersCount,
      inactiveUsersDelta: 0,
      lockedUsers: lockedUsersCount,
      lockedUsersDelta: 0,
      failedLoginsToday,
      failedLoginsDelta: 0,
      totalActivitiesToday,
      totalActivitiesDelta: 0,
      criticalSecurityEvents,
      criticalSecurityEventsDelta: 0,
      exportsPerformed,
      exportsPerformedDelta: 0,
    };
  }

  /**
   * Real Date-Aggregated Login Trend (Counts real successes and failures grouped by day)
   */
  async getLoginTrend(days = 7) {
    const dayCount = parseInt(days, 10) || 7;
    const labels = [];
    const successful = [];
    const failed = [];

    const history = getStoredLoginHistory();
    const now = new Date();

    for (let i = dayCount - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const targetYear = d.getFullYear();
      const targetMonth = d.getMonth();
      const targetDay = d.getDate();

      const label = d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
      labels.push(label);

      const matchesDay = (ts) => {
        if (!ts) return false;
        const entryDate = new Date(ts);
        return (
          entryDate.getFullYear() === targetYear &&
          entryDate.getMonth() === targetMonth &&
          entryDate.getDate() === targetDay
        );
      };

      const successCount = history.filter((h) => matchesDay(h.timestamp) && h.status === 'Success').length;
      const failCount = history.filter((h) => matchesDay(h.timestamp) && h.status === 'Failed').length;

      successful.push(successCount);
      failed.push(failCount);
    }

    return {
      days: dayCount,
      labels,
      datasets: {
        successful,
        failed,
      },
    };
  }

  /**
   * Module percentage breakdown dynamically computed from real audit records
   */
  async getModuleBreakdown() {
    const auditLogs = getStoredAuditLog();
    const counts = {};
    auditLogs.forEach((evt) => {
      const mod = evt.module || 'General';
      counts[mod] = (counts[mod] || 0) + 1;
    });

    const total = auditLogs.length || 1;
    return Object.entries(counts)
      .map(([name, count]) => ({
        name,
        count,
        percentage: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Filtered real audit log queries
   */
  async getAuditLog(filters = {}) {
    let filtered = getStoredAuditLog();
    if (filters.search && filters.search.trim()) {
      const q = filters.search.toLowerCase().trim();
      filtered = filtered.filter(
        (item) =>
          item.id?.toLowerCase().includes(q) ||
          item.target?.toLowerCase().includes(q) ||
          item.actionLabel?.toLowerCase().includes(q) ||
          item.actor?.name?.toLowerCase().includes(q) ||
          item.actor?.role?.toLowerCase().includes(q) ||
          item.details?.toLowerCase().includes(q)
      );
    }
    if (filters.module && filters.module !== 'All modules') {
      filtered = filtered.filter((item) => item.module === filters.module);
    }
    if (filters.status && filters.status !== 'All statuses') {
      filtered = filtered.filter((item) => item.status === filters.status);
    }
    if (filters.plaza && filters.plaza !== 'All plazas') {
      filtered = filtered.filter((item) => item.plaza === filters.plaza);
    }
    return filtered;
  }

  async getRecentActivity(limit = 10) {
    const logs = getStoredAuditLog();
    return logs.slice(0, limit);
  }

  async getActiveUsers() {
    return getStoredActiveSessions();
  }

  async forceLogout(sessionId, reason = 'Administrative revocation') {
    this.terminateSession(sessionId, reason);
    return { success: true, sessionId };
  }

  async getLoginHistory(filters = {}) {
    let result = getStoredLoginHistory();
    if (filters.status && filters.status !== 'All') {
      result = result.filter((l) => l.status === filters.status);
    }
    return result;
  }

  async exportAudit(filters = {}, format = 'csv') {
    const records = await this.getAuditLog(filters);

    let actor = { id: 'PSN0001', name: 'Sanjay Kulkarni', role: 'Master Admin' };
    try {
      const activeUser = JSON.parse(localStorage.getItem('paysonic_auth_session') || '{}');
      if (activeUser.name) actor = activeUser;
    } catch {}

    const exportEvent = {
      module: 'Transactional Report',
      action: 'EXPORT_AUDIT_LOG',
      actionLabel: 'Exported Audit Ledger',
      status: 'SUCCESS',
      actor: {
        id: actor.id,
        name: actor.name,
        role: actor.role,
        ipAddress: '127.0.0.1',
      },
      plaza: 'All plazas',
      target: `Audit Export (${records.length} records, ${format.toUpperCase()})`,
      details: `Compliance export compiled for ${records.length} records in ${format.toUpperCase()} format`,
    };
    this.recordAuditEvent(exportEvent);

    if (format === 'csv') {
      const headers = [
        'Event ID',
        'Timestamp',
        'Actor Name',
        'Actor Role',
        'Module',
        'Action',
        'Reference ID',
        'Correlation ID',
        'Target',
        'Plaza Scope',
        'Outcome',
        'IP Address',
      ];
      const rows = records.map((r) => [
        r.id,
        r.timestamp,
        `"${(r.actor && r.actor.name) || ''}"`,
        `"${(r.actor && r.actor.role) || ''}"`,
        `"${r.module || ''}"`,
        `"${r.actionLabel || r.action || ''}"`,
        `"${r.referenceId || ''}"`,
        `"${r.correlationId || ''}"`,
        `"${r.target || ''}"`,
        `"${r.plaza || ''}"`,
        r.status || 'SUCCESS',
        (r.actor && r.actor.ipAddress) || '127.0.0.1',
      ]);
      const csvContent = [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
      return {
        data: csvContent,
        filename: `paysonic_audit_export_${new Date().toISOString().slice(0, 10)}.csv`,
        mimeType: 'text/csv',
        recordCount: records.length,
      };
    }

    return {
      data: JSON.stringify(records, null, 2),
      filename: `paysonic_audit_export_${new Date().toISOString().slice(0, 10)}.json`,
      mimeType: 'application/json',
      recordCount: records.length,
    };
  }
}

export default new UserActivityService();
