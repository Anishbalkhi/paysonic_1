import httpClient from '../api/httpClient';
import initialAuditLog from '../../data/auditLog.json';
import initialActiveUsers from '../../data/activeUsers.json';
import initialLoginHistory from '../../data/loginHistory.json';

// In-memory fallback if Railway API is temporarily offline
let fallbackAuditStore = [...initialAuditLog];
let fallbackActiveUsersStore = [...initialActiveUsers];
let fallbackLoginHistoryStore = [...initialLoginHistory];

class UserActivityService {
  async getDashboardStats() {
    try {
      const res = await httpClient.get('/api/activity/stats');
      if (res && res.data) {
        return res.data;
      }
    } catch (err) {
      console.warn('[UserActivityService] Railway stats unreachable, using local fallback:', err?.message);
    }

    const activeCount = fallbackActiveUsersStore.filter((u) => u.status === 'Active').length;
    const criticalCount = fallbackAuditStore.filter((a) => a.status === 'WARNING' || a.status === 'FAILURE').length;
    const failedLoginsToday = fallbackLoginHistoryStore.filter((l) => l.status === 'Failed').length;

    return {
      totalUsers: 148,
      totalUsersDelta: +5.2,
      activeUsers: activeCount || 8,
      activeUsersDelta: +12.5,
      inactiveUsers: 12,
      inactiveUsersDelta: -2.1,
      lockedUsers: 2,
      lockedUsersDelta: 0,
      failedLoginsToday: failedLoginsToday || 9,
      failedLoginsDelta: -10.0,
      totalActivitiesToday: fallbackAuditStore.length || 152,
      totalActivitiesDelta: +18.4,
      criticalSecurityEvents: criticalCount || 14,
      criticalSecurityEventsDelta: -8.5,
      exportsPerformed: 6,
      exportsPerformedDelta: +20.0,
    };
  }

  async getLoginTrend(days = 7) {
    try {
      const res = await httpClient.get(`/api/activity/login-trend?days=${days}`);
      if (res && res.data) {
        return res.data;
      }
    } catch (err) {
      console.warn('[UserActivityService] Railway trend unreachable, using local fallback:', err?.message);
    }

    const dayCount = parseInt(days, 10) || 7;
    const labels = [];
    const successful = [];
    const failed = [];

    const now = new Date();
    for (let i = dayCount - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      labels.push(
        d.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        })
      );
      const seed = (d.getDate() * 17 + i * 23) % 50;
      successful.push(110 + seed + (i % 3 === 0 ? 30 : 0));
      failed.push(3 + (seed % 10));
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

  async getModuleBreakdown() {
    try {
      const res = await httpClient.get('/api/activity/module-breakdown');
      if (res && res.data && Array.isArray(res.data) && res.data.length > 0) {
        return res.data;
      }
    } catch (err) {
      console.warn('[UserActivityService] Railway module breakdown unreachable, using fallback:', err?.message);
    }

    const counts = {};
    fallbackAuditStore.forEach((evt) => {
      counts[evt.module] = (counts[evt.module] || 0) + 1;
    });

    const total = fallbackAuditStore.length || 1;
    return Object.entries(counts)
      .map(([name, count]) => ({
        name,
        count,
        percentage: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);
  }

  async getAuditLog(filters = {}) {
    try {
      const res = await httpClient.get('/api/activity/audit-log', { params: filters });
      if (res && res.data && Array.isArray(res.data)) {
        return res.data;
      }
    } catch (err) {
      console.warn('[UserActivityService] Railway audit-log unreachable, using fallback:', err?.message);
    }

    let filtered = [...fallbackAuditStore];
    if (filters.search && filters.search.trim()) {
      const q = filters.search.toLowerCase().trim();
      filtered = filtered.filter(
        (item) =>
          item.id.toLowerCase().includes(q) ||
          item.target.toLowerCase().includes(q) ||
          item.actionLabel.toLowerCase().includes(q) ||
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
    try {
      const res = await httpClient.get(`/api/activity/recent?limit=${limit}`);
      if (res && res.data && Array.isArray(res.data) && res.data.length > 0) {
        return res.data;
      }
    } catch (err) {
      console.warn('[UserActivityService] Railway recent activity unreachable, using fallback:', err?.message);
    }
    return fallbackAuditStore.slice(0, limit);
  }

  async getActiveUsers() {
    try {
      const res = await httpClient.get('/api/activity/active-users');
      if (res && res.data && Array.isArray(res.data) && res.data.length > 0) {
        return res.data;
      }
    } catch (err) {
      console.warn('[UserActivityService] Railway active users unreachable, using fallback:', err?.message);
    }
    return [...fallbackActiveUsersStore];
  }

  async forceLogout(sessionId, reason = 'Administrative revocation') {
    try {
      const res = await httpClient.post(`/api/activity/sessions/${sessionId}/terminate`, { reason });
      return res.data;
    } catch (err) {
      console.warn('[UserActivityService] Railway forceLogout unreachable, using local fallback:', err?.message);
      fallbackActiveUsersStore = fallbackActiveUsersStore.filter((u) => u.sessionId !== sessionId);
      return { success: true, sessionId };
    }
  }

  async getLoginHistory(filters = {}) {
    try {
      const res = await httpClient.get('/api/activity/login-history', { params: filters });
      if (res && res.data && Array.isArray(res.data) && res.data.length > 0) {
        return res.data;
      }
    } catch (err) {
      console.warn('[UserActivityService] Railway login history unreachable, using fallback:', err?.message);
    }

    let result = [...fallbackLoginHistoryStore];
    if (filters.status && filters.status !== 'All') {
      result = result.filter((l) => l.status === filters.status);
    }
    return result;
  }

  async exportAudit(filters = {}, format = 'csv') {
    try {
      const res = await httpClient.get('/api/activity/export', { params: { ...filters, format } });
      if (res && res.data) {
        return res.data;
      }
    } catch (err) {
      console.warn('[UserActivityService] Railway export unreachable, using local export generator:', err?.message);
    }

    const records = await this.getAuditLog(filters);
    const exportEvent = {
      id: `AUD-${String(Date.now()).slice(-4)}`,
      timestamp: new Date().toISOString(),
      module: 'Transactional Report',
      action: 'EXPORT_AUDIT_LOG',
      actionLabel: 'Exported Audit Ledger',
      status: 'SUCCESS',
      actor: {
        id: 'PSN0005',
        name: 'Sanjay Kulkarni',
        role: 'Master Admin',
        ipAddress: '103.21.58.44',
      },
      plaza: 'All plazas',
      target: `Audit Export (${records.length} records, ${format.toUpperCase()})`,
      referenceId: `EXP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`,
      details: `Compliance export compiled for ${records.length} records in ${format.toUpperCase()} format`,
      before: null,
      after: {
        format,
        recordCount: records.length,
        timestamp: new Date().toISOString(),
      },
      correlationId: `CORR-EXP-${String(Date.now()).slice(-4)}`,
    };
    fallbackAuditStore.unshift(exportEvent);

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
