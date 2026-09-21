import httpClient from '../api/httpClient';
import { IS_DEV_MODE } from '../config/env';
import initialAuditLog from '../../data/auditLog.json';
import initialActiveUsers from '../../data/activeUsers.json';
import initialLoginHistory from '../../data/loginHistory.json';

// In-memory state for active session mutations during dev mode
let auditStore = [...initialAuditLog];
let activeUsersStore = [...initialActiveUsers];
let loginHistoryStore = [...initialLoginHistory];

class UserActivityService {
  async getDashboardStats() {
    if (IS_DEV_MODE) {
      const activeCount = activeUsersStore.filter((u) => u.status === 'Active').length;
      const criticalCount = auditStore.filter((a) => a.status === 'WARNING' || a.status === 'FAILURE').length;
      const failedLoginsToday = loginHistoryStore.filter((l) => l.status === 'Failed').length;

      return Promise.resolve({
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
        totalActivitiesToday: auditStore.length || 152,
        totalActivitiesDelta: +18.4,
        criticalSecurityEvents: criticalCount || 14,
        criticalSecurityEventsDelta: -8.5,
        exportsPerformed: 6,
        exportsPerformedDelta: +20.0,
      });
    }

    const res = await httpClient.get('/api/activity/stats');
    return res.data;
  }

  async getLoginTrend(days = 7) {
    if (IS_DEV_MODE) {
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

        // Deterministic realistic numbers based on day
        const seed = (d.getDate() * 17 + i * 23) % 50;
        successful.push(110 + seed + (i % 3 === 0 ? 30 : 0));
        failed.push(3 + (seed % 10));
      }

      return Promise.resolve({
        days: dayCount,
        labels,
        datasets: {
          successful,
          failed,
        },
      });
    }

    const res = await httpClient.get(`/api/activity/login-trend?days=${days}`);
    return res.data;
  }

  async getModuleBreakdown() {
    if (IS_DEV_MODE) {
      const counts = {};
      auditStore.forEach((evt) => {
        counts[evt.module] = (counts[evt.module] || 0) + 1;
      });

      const total = auditStore.length || 1;
      const breakdown = Object.entries(counts)
        .map(([name, count]) => ({
          name,
          count,
          percentage: Math.round((count / total) * 100),
        }))
        .sort((a, b) => b.count - a.count);

      return Promise.resolve(breakdown);
    }

    const res = await httpClient.get('/api/activity/module-breakdown');
    return res.data;
  }

  async getAuditLog(filters = {}) {
    if (IS_DEV_MODE) {
      let filtered = [...auditStore];

      if (filters.search && filters.search.trim()) {
        const q = filters.search.toLowerCase().trim();
        filtered = filtered.filter(
          (item) =>
            item.id.toLowerCase().includes(q) ||
            item.target.toLowerCase().includes(q) ||
            item.actionLabel.toLowerCase().includes(q) ||
            item.actor.name.toLowerCase().includes(q) ||
            item.actor.role.toLowerCase().includes(q) ||
            item.details.toLowerCase().includes(q)
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

      return Promise.resolve(filtered);
    }

    const res = await httpClient.get('/api/activity/audit-log', { params: filters });
    return res.data;
  }

  async getRecentActivity(limit = 10) {
    if (IS_DEV_MODE) {
      return Promise.resolve(auditStore.slice(0, limit));
    }

    const res = await httpClient.get(`/api/activity/recent?limit=${limit}`);
    return res.data;
  }

  async getActiveUsers() {
    if (IS_DEV_MODE) {
      return Promise.resolve([...activeUsersStore]);
    }

    const res = await httpClient.get('/api/activity/active-users');
    return res.data;
  }

  async forceLogout(sessionId, reason = 'Administrative revocation') {
    if (IS_DEV_MODE) {
      const targetUser = activeUsersStore.find((u) => u.sessionId === sessionId);
      activeUsersStore = activeUsersStore.filter((u) => u.sessionId !== sessionId);

      // Record this revocation in the audit log
      if (targetUser) {
        const auditEvent = {
          id: `AUD-${String(Date.now()).slice(-4)}`,
          timestamp: new Date().toISOString(),
          module: 'User Management',
          action: 'FORCE_LOGOUT',
          actionLabel: 'Terminated Active Session',
          status: 'WARNING',
          actor: {
            id: 'PSN0005',
            name: 'Sanjay Kulkarni',
            role: 'Master Admin',
            ipAddress: '103.21.58.44',
          },
          plaza: targetUser.plaza || 'All plazas',
          target: `${targetUser.name} (${targetUser.userId})`,
          referenceId: sessionId,
          details: `Session forcefully terminated. Reason: ${reason}`,
          before: { sessionActive: true, sessionId },
          after: { sessionActive: false, reason },
        };
        auditStore.unshift(auditEvent);
      }

      return Promise.resolve({ success: true, sessionId });
    }

    const res = await httpClient.post(`/api/activity/sessions/${sessionId}/terminate`, { reason });
    return res.data;
  }

  async getLoginHistory(filters = {}) {
    if (IS_DEV_MODE) {
      let result = [...loginHistoryStore];
      if (filters.status && filters.status !== 'All') {
        result = result.filter((l) => l.status === filters.status);
      }
      return Promise.resolve(result);
    }

    const res = await httpClient.get('/api/activity/login-history', { params: filters });
    return res.data;
  }

  async exportAudit(filters = {}, format = 'csv') {
    if (IS_DEV_MODE) {
      const records = await this.getAuditLog(filters);

      // Log the export event itself into the audit ledger (UAM-FR-014)
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
      auditStore.unshift(exportEvent);

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
        return Promise.resolve({
          data: csvContent,
          filename: `paysonic_audit_export_${new Date().toISOString().slice(0, 10)}.csv`,
          mimeType: 'text/csv',
          recordCount: records.length,
        });
      }
      return Promise.resolve({
        data: JSON.stringify(records, null, 2),
        filename: `paysonic_audit_export_${new Date().toISOString().slice(0, 10)}.json`,
        mimeType: 'application/json',
        recordCount: records.length,
      });
    }

    const res = await httpClient.get('/api/activity/export', { params: { ...filters, format } });
    return res.data;
  }
}

export default new UserActivityService();
