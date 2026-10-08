import httpClient from '../api/httpClient';
import UserService from '../user/UserService';
import { parseUtcTimestamp, calculateSessionDuration, formatRelativeTime } from '../../utils/dateUtils';

const LOGIN_HISTORY_STORAGE_KEY = 'paysonic_login_history';
const ACTIVE_SESSIONS_STORAGE_KEY = 'paysonic_active_sessions';
const AUDIT_LOG_STORAGE_KEY = 'paysonic_audit_log';
const LOGOUT_HISTORY_KEY = 'paysonic_logout_history';
const IP_LOCATION_CACHE_KEY = 'paysonic_ip_location_cache';

// ─── Logout timestamp helpers ─────────────────────────────────────────────────
// Maps userId → ISO timestamp of their most recent logout / session termination.

const getLogoutTimestamp = (userId) => {
  try {
    const log = JSON.parse(localStorage.getItem(LOGOUT_HISTORY_KEY) || '{}');
    return log[userId] || null;
  } catch { return null; }
};

const saveLogoutTimestamp = (userId) => {
  if (!userId) return;
  try {
    const log = JSON.parse(localStorage.getItem(LOGOUT_HISTORY_KEY) || '{}');
    log[userId] = new Date().toISOString();
    localStorage.setItem(LOGOUT_HISTORY_KEY, JSON.stringify(log));
  } catch {}
};

// ─── IP geolocation cache helpers ────────────────────────────────────────────
// Caches resolved city/country strings per IP so each IP is only looked up once.

const getCachedIpLocation = (ip) => {
  try {
    const cache = JSON.parse(localStorage.getItem(IP_LOCATION_CACHE_KEY) || '{}');
    return cache[ip] || null;
  } catch { return null; }
};

// ─── Device ID Helper ────────────────────────────────────────────────────────
// Generates or retrieves a persistent client device identifier for this browser/PC
export const getOrCreateDeviceId = () => {
  if (typeof window === 'undefined') return 'DEV-SERVER';
  try {
    let deviceId = localStorage.getItem('paysonic_device_id');
    if (!deviceId) {
      deviceId = 'DEV-' + Math.random().toString(36).substring(2, 9).toUpperCase() + '-' + Date.now().toString(36).toUpperCase();
      localStorage.setItem('paysonic_device_id', deviceId);
    }
    return deviceId;
  } catch {
    return 'DEV-DEFAULT';
  }
};


const saveIpLocationCache = (ip, location) => {
  try {
    const cache = JSON.parse(localStorage.getItem(IP_LOCATION_CACHE_KEY) || '{}');
    cache[ip] = location;
    localStorage.setItem(IP_LOCATION_CACHE_KEY, JSON.stringify(cache));
  } catch {}
};

// ─── Local-only telemetry helpers (used for write-side only) ────────────────
// These store events recorded in the current browser session (login attempts,
// sessions the user started, etc.) and serve as fallback if Railway is down.

const getStoredLoginHistory = () => {
  try {
    const raw = localStorage.getItem(LOGIN_HISTORY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((e) => e && e.isLocalSessionEvent);
      }
    }
  } catch {}
  return [];
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
  return [];
};

const saveStoredActiveSessions = (sessions) => {
  try {
    localStorage.setItem(ACTIVE_SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
  } catch {}
};

const getStoredAuditLog = () => {
  try {
    const raw = localStorage.getItem(AUDIT_LOG_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((e) => e && e.isLocalSessionEvent);
      }
    }
  } catch {}
  return [];
};

const saveStoredAuditLog = (log) => {
  try {
    localStorage.setItem(AUDIT_LOG_STORAGE_KEY, JSON.stringify(log));
  } catch {}
};

class UserActivityService {
  // ─── Write-side: local session & audit recording ──────────────────────────

  /**
   * Record a login attempt locally (Success or Failed).
   * Called immediately on login so the event is captured even offline.
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
      status,
      failureReason: failureReason || null,
      timestamp: new Date().toISOString(),
      isLocalSessionEvent: true,
    };
    history.unshift(newEntry);
    saveStoredLoginHistory(history);

    // Broadcast live event for 0ms reactivity
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('paysonic_login_updated', { detail: newEntry }));
      try {
        localStorage.setItem('paysonic_login_event_broadcast', JSON.stringify({ id: newEntry.id, timestamp: Date.now() }));
      } catch {}
    }

    // Persist to Railway database in real-time
    try {
      httpClient.post('/api/activity/login-history', {
        userId: newEntry.userId,
        name: newEntry.name,
        role: newEntry.role,
        ipAddress: newEntry.ipAddress,
        device: newEntry.device,
        status: newEntry.status,
        failureReason: newEntry.failureReason,
        timestamp: newEntry.timestamp,
      }).catch(() => {});
    } catch {}

    return newEntry;
  }

  /**
   * Register a live active session on login.
   * Single device login rule (FR #7):
   * - Only Master Admin can be logged in on multiple devices concurrently.
   * - For all other roles, logging in on a DIFFERENT device terminates any prior device's session.
   * - Multiple tabs/windows on the SAME device remain connected and share active status.
   */
  async registerActiveSession({ userId, username, name, role, plaza, ipAddress, device, deviceId }) {
    const isMasterAdmin = role === 'Master Admin';
    const currentDeviceId = deviceId || getOrCreateDeviceId();
    const sessions = getStoredActiveSessions();

    // Mark prior active sessions for this user as Terminated ONLY if not Master Admin
    // and ONLY if originating from a DIFFERENT device
    const updated = sessions.map((s) => {
      if (!isMasterAdmin && s.userId === userId && s.status === 'Active') {
        const isDifferentDevice = s.deviceId && s.deviceId !== currentDeviceId;
        if (isDifferentDevice) {
          return {
            ...s,
            status: 'Terminated',
            reason: 'Account was logged in on another device',
            terminatedByDifferentDevice: true,
            lastActive: 'Closed (Another device login)'
          };
        }
      }
      return s;
    });

    const sessionId = `SES-${Date.now().toString().slice(-6)}`;
    const newSession = {
      sessionId,
      userId,
      deviceId: currentDeviceId,
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
      ipAddress: ipAddress || '103.21.58.44',
      location: 'Local Console Node',
      device:
        device ||
        (typeof navigator !== 'undefined'
          ? `${navigator.userAgent.includes('Windows') ? 'Windows 11' : navigator.userAgent.includes('Mac') ? 'macOS' : 'Linux'} · Chrome`
          : 'Desktop Browser'),
      loginTime: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      sessionDuration: 'Active now',
      status: 'Active',
    };
    updated.unshift(newSession);
    saveStoredActiveSessions(updated);

    // Broadcast live event for 0ms reactivity
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('paysonic_sessions_updated', { detail: newSession }));
      try {
        localStorage.setItem('paysonic_sessions_broadcast', JSON.stringify({ id: newSession.sessionId, timestamp: Date.now() }));
      } catch {}
    }

    // Sync session to backend / Railway MySQL database
    try {
      const backendPayload = {
        sessionId,
        userId,
        name,
        role,
        plaza: plaza || 'All plazas',
        ipAddress: ipAddress || '103.21.58.44',
        device:
          device ||
          (typeof navigator !== 'undefined'
            ? `${navigator.userAgent.includes('Windows') ? 'Windows 11' : navigator.userAgent.includes('Mac') ? 'macOS' : 'Linux'} · Chrome`
            : 'Desktop Browser'),
        deviceId: currentDeviceId,
        status: 'Active',
      };
      await httpClient.post('/api/activity/sessions', backendPayload);
    } catch (err) {
      console.warn('[UserActivityService] Session sync to backend error:', err?.message);
    }

    return sessionId;
  }

  /**
   * Verify if a session is still active or has been superseded/terminated by another device.
   */
  async checkSessionStatus(sessionId) {
    if (!sessionId) return { active: false, status: 'Terminated', terminatedByDifferentDevice: false };
    try {
      const res = await httpClient.get(`/api/activity/sessions/${sessionId}/status`);
      if (res && res.data) {
        return res.data;
      }
    } catch (err) {
      // Fallback to local active sessions cache if network is temporarily unreachable
      const local = getStoredActiveSessions().find((s) => s.sessionId === sessionId);
      if (local) {
        return {
          active: local.status === 'Active',
          status: local.status,
          terminatedByDifferentDevice: !!local.terminatedByDifferentDevice,
          reason: local.reason || ''
        };
      }
    }
    return { active: true, status: 'Active', terminatedByDifferentDevice: false };
  }

  /**
   * Terminate a session in localStorage (called alongside the Railway API call).
   */
  terminateSession(sessionId, reason = 'Administrative revocation') {
    const sessions = getStoredActiveSessions();
    const targetSession = sessions.find((s) => s.sessionId === sessionId);
    const updated = sessions.map((s) =>
      s.sessionId === sessionId
        ? { ...s, status: 'Terminated', lastActive: 'Terminated', sessionDuration: 'Closed' }
        : s
    );
    saveStoredActiveSessions(updated);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('paysonic_sessions_updated'));
      try {
        localStorage.setItem('paysonic_sessions_broadcast', JSON.stringify({ id: sessionId, timestamp: Date.now() }));
      } catch {}
    }

    // Save logout timestamp for this user so Login History can display it
    if (targetSession && targetSession.userId) {
      saveLogoutTimestamp(targetSession.userId);
    }

    // Also write a local audit entry so it shows up immediately in the UI
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
   * Append an audit entry to localStorage (used for locally-triggered events).
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
      isLocalSessionEvent: true,
    };
    logs.unshift(newAudit);
    saveStoredAuditLog(logs);

    // Broadcast live event for 0ms reactivity across components and tabs
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('paysonic_audit_updated', { detail: newAudit }));
      try {
        localStorage.setItem('paysonic_audit_event_broadcast', JSON.stringify({ id: newAudit.id, timestamp: Date.now() }));
      } catch {}
    }

    // Persist to Railway database in real-time
    try {
      httpClient.post('/api/activity/audit-log', {
        id: newAudit.id,
        timestamp: newAudit.timestamp,
        module: newAudit.module,
        action: newAudit.action,
        actionLabel: newAudit.actionLabel,
        status: newAudit.status,
        plaza: newAudit.plaza,
        target: newAudit.target,
        referenceId: newAudit.referenceId,
        correlationId: newAudit.correlationId,
        details: newAudit.details,
        actorId: newAudit.actor?.id || 'PSN0005',
        actorName: newAudit.actor?.name || 'Administrator',
        actorRole: newAudit.actor?.role || 'Admin',
        actorIp: newAudit.actor?.ipAddress || '127.0.0.1',
        before: newAudit.before,
        after: newAudit.after,
      }).catch((err) => {
        console.warn('[UserActivityService] Async audit sync error:', err?.message);
      });
    } catch {}

    return newAudit;
  }

  // ─── Read-side: Railway backend → localStorage fallback ───────────────────

  /**
   * KPI dashboard statistics — fetched from Railway /api/activity/stats.
   * Falls back to computing from localStorage + UserService if Railway is down.
   */
  // ─── Snapshot-based delta helpers ──────────────────────────────────────────────
  // Persists the previous stats snapshot in localStorage so we can compute
  // real percentage deltas on the next fetch.
  _getPriorSnapshot() {
    try {
      return JSON.parse(localStorage.getItem('paysonic_stats_snapshot') || 'null');
    } catch { return null; }
  }

  _savePriorSnapshot(stats) {
    try {
      localStorage.setItem('paysonic_stats_snapshot', JSON.stringify(stats));
    } catch {}
  }

  // Compute % change between current and prior value, rounded to 1 decimal.
  // Returns 0 if either value is missing or prior was 0.
  _pct(current, prior) {
    if (!prior || prior === 0) return 0;
    return Math.round(((current - prior) / prior) * 1000) / 10;
  }

  /**
   * KPI dashboard statistics — fetched from Railway /api/activity/stats.
   * Computes real week-over-week delta % by comparing against a cached prior
   * snapshot stored in localStorage.
   * Falls back to computing from localStorage + UserService if Railway is down.
   */
  async getDashboardStats() {
    const prior = this._getPriorSnapshot();
    try {
      const res = await httpClient.get('/api/activity/stats');
      if (res && res.data) {
        const s = res.data;
        // Compute real deltas vs. prior snapshot
        const enriched = {
          ...s,
          totalUsersDelta:             this._pct(s.totalUsers,             prior?.totalUsers),
          activeUsersDelta:            this._pct(s.activeUsers,            prior?.activeUsers),
          inactiveUsersDelta:          this._pct(s.inactiveUsers,          prior?.inactiveUsers),
          lockedUsersDelta:            this._pct(s.lockedUsers,            prior?.lockedUsers),
          failedLoginsDelta:           this._pct(s.failedLoginsToday,      prior?.failedLoginsToday),
          totalActivitiesDelta:        this._pct(s.totalActivitiesToday,   prior?.totalActivitiesToday),
          criticalSecurityEventsDelta: this._pct(s.criticalSecurityEvents, prior?.criticalSecurityEvents),
          exportsPerformedDelta:       this._pct(s.exportsPerformed,       prior?.exportsPerformed),
        };
        // Persist current as the next comparison baseline
        this._savePriorSnapshot(s);
        return enriched;
      }
    } catch (err) {
      console.warn('[UserActivityService] Railway stats unreachable, computing locally:', err?.message);
    }

    // ── Local fallback ──
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
    const nowTime = Date.now();
    const TIMEOUT_MS = 5 * 60 * 1000 + 30000;
    const activeUsersCount = activeSessions.filter((s) => {
      if (s.status !== 'Active') return false;
      const ts = parseUtcTimestamp(s.lastActive || s.loginTime);
      return ts && (nowTime - ts.getTime()) <= TIMEOUT_MS;
    }).length;
    const inactiveUsersCount = users.filter((u) => u.status === 'Inactive').length;
    const lockedUsersCount = users.filter((u) => u.locked).length;

    const now = new Date();
    const todayYear = now.getFullYear();
    const todayMonth = now.getMonth();
    const todayDate = now.getDate();

    const isToday = (ts) => {
      if (!ts) return false;
      const d = parseUtcTimestamp(ts);
      if (!d) return false;
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
   * Login trend chart data — fetched from Railway /api/activity/login-trend.
   * Falls back to computing from localStorage login history if Railway is down.
   */
  async getLoginTrend(days = 7) {
    const dayCount = parseInt(days, 10) || 7;
    try {
      const res = await httpClient.get('/api/activity/login-trend', { params: { days: dayCount } });
      if (res && res.data) {
        return res.data;
      }
    } catch (err) {
      console.warn('[UserActivityService] Railway login-trend unreachable, computing locally:', err?.message);
    }

    // ── Local fallback: compute from localStorage ──
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

      labels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));

      const matchesDay = (ts) => {
        if (!ts) return false;
        const e = parseUtcTimestamp(ts);
        if (!e) return false;
        return (
          e.getFullYear() === targetYear &&
          e.getMonth() === targetMonth &&
          e.getDate() === targetDay
        );
      };

      successful.push(history.filter((h) => matchesDay(h.timestamp) && h.status === 'Success').length);
      failed.push(history.filter((h) => matchesDay(h.timestamp) && h.status === 'Failed').length);
    }

    return { days: dayCount, labels, datasets: { successful, failed } };
  }

  /**
   * Module breakdown — fetched from Railway /api/activity/module-breakdown.
   * Falls back to computing from localStorage audit log if Railway is down.
   */
  async getModuleBreakdown() {
    try {
      const res = await httpClient.get('/api/activity/module-breakdown');
      if (res && res.data && Array.isArray(res.data)) {
        return res.data;
      }
    } catch (err) {
      console.warn('[UserActivityService] Railway module-breakdown unreachable, computing locally:', err?.message);
    }

    // ── Local fallback ──
    const auditLogs = getStoredAuditLog();
    const counts = {};
    auditLogs.forEach((evt) => {
      const mod = evt.module || 'General';
      counts[mod] = (counts[mod] || 0) + 1;
    });
    const total = auditLogs.length || 1;
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count, percentage: Math.round((count / total) * 100) }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Audit log — fetched from Railway /api/activity/audit-log with optional filters.
   * Merges any locally-recorded events (recorded in this browser session) at the
   * top so they appear immediately without waiting for a Railway sync.
   * Falls back to localStorage entirely if Railway is unreachable.
   */
  async getAuditLog(filters = {}) {
    try {
      const params = {};
      if (filters.search && filters.search.trim()) params.search = filters.search.trim();
      if (filters.module && filters.module !== 'All modules') params.module = filters.module;
      if (filters.status && filters.status !== 'All statuses') params.status = filters.status;
      if (filters.plaza && filters.plaza !== 'All plazas') params.plaza = filters.plaza;
      if (filters.actorId) params.actorId = filters.actorId;
      if (filters.dateRange) params.dateRange = filters.dateRange;

      const res = await httpClient.get('/api/activity/audit-log', { params });
      if (res && res.data && Array.isArray(res.data)) {
        // Prepend any local events recorded after the last Railway sync
        const localLogs = getStoredAuditLog();
        const railwayIds = new Set(res.data.map((e) => e.id));
        const localOnly = localLogs.filter((e) => !railwayIds.has(e.id));

        // If no filters are active, prepend local-only events
        const hasFilters = Object.keys(params).length > 0;
        const merged = hasFilters ? res.data : [...localOnly, ...res.data];
        return merged;
      }
    } catch (err) {
      console.warn('[UserActivityService] Railway audit-log unreachable, using localStorage:', err?.message);
    }

    // ── Local fallback ──
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

  /**
   * Recent activity stream — the first N records from the audit log.
   * Fetched from Railway /api/activity/recent.
   */
  async getRecentActivity(limit = 10) {
    try {
      const res = await httpClient.get('/api/activity/recent', { params: { limit } });
      if (res && res.data && Array.isArray(res.data)) {
        return res.data;
      }
    } catch (err) {
      console.warn('[UserActivityService] Railway recent-activity unreachable, using localStorage:', err?.message);
    }
    return getStoredAuditLog().slice(0, limit);
  }

  /**
   * Helper to enrich raw backend UserSession entity with UI metadata
   */
  enrichSession(s) {
    if (!s) return s;
    const duration = calculateSessionDuration(s.loginTime);

    const department = s.department || (
      s.role === 'Master Admin' ? 'Security & Access Control' :
      s.role === 'Bank' ? 'Financial Audit' :
      s.role === 'Concessionaire' ? 'Highway Operations' :
      s.role === 'Admin' ? 'System Administration' :
      s.role === 'Plaza Admin' ? 'Toll Operations' :
      s.role === 'Auditor' ? 'Compliance & Audit' :
      s.role === 'Support Operator' ? 'Technical Support' :
      s.role === 'Plaza POS' ? 'Lane Point of Sale' :
      'Operations'
    );

    const location = s.location || (
      s.plaza && s.plaza !== 'All plazas' && s.plaza !== 'Not applicable' ? s.plaza :
      s.ipAddress?.startsWith('103.') ? 'Pune / Mumbai, MH' :
      s.ipAddress?.startsWith('49.') ? 'Navi Mumbai, MH' :
      s.ipAddress?.startsWith('115.') ? 'Pune, MH' :
      s.ipAddress?.startsWith('157.') ? 'Solapur, MH' :
      s.ipAddress?.startsWith('117.') ? 'Kolhapur, MH' :
      s.ipAddress?.startsWith('182.') ? 'BKC Mumbai, MH' :
      'Local Console Node'
    );

    return {
      ...s,
      department,
      location,
      sessionDuration: s.sessionDuration || duration,
      lastActive: formatRelativeTime(s.lastActive),
      username: s.username || (s.name ? s.name.toLowerCase().replace(/\s+/g, '.') : s.userId),
    };
  }

  /**
   * Sends a lightweight session heartbeat to update lastActive on the backend
   */
  async sendHeartbeat(sessionId) {
    if (!sessionId) return null;
    try {
      const res = await httpClient.post(`/api/activity/sessions/${sessionId}/heartbeat`);
      return res.data;
    } catch {
      return null;
    }
  }

  /**
   * Active sessions — fetched directly from Railway MySQL database via /api/activity/active-users.
   * Real-time telemetry: filters strictly by active status and 5-minute inactivity window.
   */
  async getActiveUsers() {
    const now = Date.now();
    const TIMEOUT_MS = 5 * 60 * 1000 + 30000; // 5 minutes + 30 seconds network buffer

    const isSessionActive = (s) => {
      if (!s || s.status !== 'Active') return false;
      const ts = parseUtcTimestamp(s.lastActive || s.loginTime);
      if (!ts) return false;
      return (now - ts.getTime()) <= TIMEOUT_MS;
    };

    try {
      const res = await httpClient.get('/api/activity/active-users');
      if (res && res.data && Array.isArray(res.data)) {
        const localSessions = getStoredActiveSessions();
        const localTerminatedIds = new Set(
          localSessions.filter((s) => s.status !== 'Active').map((s) => s.sessionId)
        );
        const railwayIds = new Set(res.data.map((s) => s.sessionId));
        const localActiveOnly = localSessions.filter(
          (s) => s.status === 'Active' && !railwayIds.has(s.sessionId)
        );

        const combined = [
          ...localActiveOnly,
          ...res.data.filter((s) => !localTerminatedIds.has(s.sessionId)),
        ];

        return combined
          .filter(isSessionActive)
          .map((s) => this.enrichSession(s));
      }
    } catch (err) {
      console.warn('[UserActivityService] Railway active-users unreachable, using localStorage:', err?.message);
    }
    return getStoredActiveSessions()
      .filter(isSessionActive)
      .map((s) => this.enrichSession(s));
  }

  /**
   * Force logout — calls Railway /api/activity/sessions/:id/terminate,
   * and mirrors the termination locally for immediate UI feedback.
   */
  async forceLogout(sessionId, reason = 'Administrative revocation') {
    // Mirror locally so the UI updates instantly
    this.terminateSession(sessionId, reason);

    try {
      const actorId = localStorage.getItem('actorId') || 'PSN0005';
      const res = await httpClient.post(
        `/api/activity/sessions/${sessionId}/terminate`,
        { reason },
        { headers: { 'X-Actor-ID': actorId } }
      );
      return res.data;
    } catch (err) {
      console.warn('[UserActivityService] Railway force-logout failed, local mirror applied:', err?.message);
      return { success: true, sessionId };
    }
  }

  /**
   * Login history — fetched from Railway /api/activity/login-history.
   *
   * Raw data from Railway is one row per login attempt. This method aggregates
   * those rows into one summary entry per user, computing:
   *   - loginCount       : total successful logins
   *   - failedLoginCount : total failed login attempts
   *   - timestamp        : most recent attempt timestamp (used as "Last Login")
   *   - ipAddress        : IP of the most recent attempt
   *   - device           : device of the most recent attempt
   *   - accountStatus    : derived from the live user cache ('Active'/'Locked'/'Inactive')
   *
   * Locally-recorded attempts from this browser session are merged before
   * aggregating so they appear immediately without a Railway sync delay.
   * Falls back to localStorage entirely if Railway is unreachable.
   */
  async getLoginHistory(filters = {}) {
    let rawRows = [];
    let usedFallback = false;

    try {
      // Fetch all raw rows (no status filter — we need all rows to compute counts)
      const res = await httpClient.get('/api/activity/login-history');
      if (res && res.data && Array.isArray(res.data)) {
        // Only include genuinely recorded local sessions from this browser session, NOT initial fallback mock json
        const localHistory = [];
        try {
          const raw = localStorage.getItem(LOGIN_HISTORY_STORAGE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              localHistory.push(...parsed);
            }
          }
        } catch {}
        const railwayIds = new Set(res.data.map((e) => String(e.id)));
        const localOnly = localHistory.filter((e) => !railwayIds.has(String(e.id)));
        rawRows = [...localOnly, ...res.data];
      }
    } catch (err) {
      console.warn('[UserActivityService] Railway login-history unreachable, using localStorage:', err?.message);
      rawRows = getStoredLoginHistory();
      usedFallback = true;
    }

    // ── Pull user cache for accountStatus lookup ──
    let userCache = [];
    try {
      userCache = JSON.parse(localStorage.getItem('paysonic_users_cache') || '[]');
    } catch {}
    const userStatusMap = {};
    userCache.forEach((u) => {
      const statusLabel = u.locked ? 'Locked' : u.status === 'Inactive' ? 'Inactive' : 'Active';
      userStatusMap[u.id] = statusLabel;
      if (u.email) userStatusMap[u.email.toLowerCase()] = statusLabel;
    });

    // ── Aggregate raw rows → one summary entry per userId ──
    const byUser = {};
    rawRows.forEach((row) => {
      const key = row.userId || row.name || 'UNKNOWN';
      const rowTimestamp = row.timestamp || row.lastLogin || row.createdAt || null;
      const rowIp = row.ipAddress || row.lastIp || null;

      if (!byUser[key]) {
        byUser[key] = {
          // Keep the raw id of the most-recent entry for React keying
          id: String(row.id),
          userId: row.userId,
          name: row.name,
          role: row.role,
          // Most recent attempt (first in array since sorted DESC)
          timestamp: rowTimestamp,
          lastLogin: rowTimestamp,
          ipAddress: rowIp,
          device: row.device,
          loginCount: 0,
          failedLoginCount: 0,
          // status of the most-recent attempt for "Attempt Result" column
          status: row.status,
          failureReason: row.failureReason || null,
          accountStatus:
            userStatusMap[row.userId] ||
            userStatusMap[(row.email || '').toLowerCase()] ||
            'Active',
          // lastLogout is not stored in Railway — show placeholder
          lastLogout: null,
          location: row.location || null,
        };
      }

      // If this row has a more recent timestamp, update the latest attempt details
      if (rowTimestamp && (!byUser[key].timestamp || new Date(rowTimestamp) > new Date(byUser[key].timestamp))) {
        byUser[key].timestamp = rowTimestamp;
        byUser[key].lastLogin = rowTimestamp;
        if (rowIp) byUser[key].ipAddress = rowIp;
        if (row.device) byUser[key].device = row.device;
        if (row.status) byUser[key].status = row.status;
        if (row.failureReason) byUser[key].failureReason = row.failureReason;
      }

      // Accumulate counts across all attempts for this user
      if (row.status === 'Success') {
        byUser[key].loginCount += (row.loginCount || 1);
      } else if (row.status === 'Failed') {
        byUser[key].failedLoginCount += (row.failedLoginCount || 1);
      }
    });

    // Convert map to array sorted by most-recent timestamp descending
    let aggregated = Object.values(byUser).sort(
      (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
    );

    // ── Attach lastLogout from local logout history map ──
    aggregated = aggregated.map((r) => ({
      ...r,
      lastLogout: getLogoutTimestamp(r.userId) || null,
    }));

    // ── Resolve IPs → City, Country in parallel (cached) ──
    const uniqueIps = [...new Set(aggregated.map((r) => r.ipAddress).filter(Boolean))];
    const locationResults = await Promise.allSettled(
      uniqueIps.map((ip) => this.resolveIpLocation(ip))
    );
    const ipLocationMap = {};
    uniqueIps.forEach((ip, i) => {
      ipLocationMap[ip] =
        locationResults[i].status === 'fulfilled'
          ? locationResults[i].value
          : 'Unknown Location';
    });
    aggregated = aggregated.map((r) => ({
      ...r,
      location: r.location || (r.ipAddress ? ipLocationMap[r.ipAddress] : null) || 'Unknown Location',
    }));

    // ── Apply status filter AFTER aggregation (filter on most-recent attempt status) ──
    if (filters.status && filters.status !== 'All') {
      aggregated = aggregated.filter((r) => r.status === filters.status);
    }

    return aggregated;
  }

  /**
   * Resolve an IP address to a human-readable "City, Country" string.
   * Uses the free ipapi.co API (HTTPS, no key, 1000 req/day).
   * Results are cached in localStorage so each IP is only fetched once.
   * Private/loopback IPs resolve immediately to 'Local Network'.
   */
  async resolveIpLocation(ip) {
    if (
      !ip ||
      ip === '127.0.0.1' ||
      ip === 'localhost' ||
      ip.startsWith('192.168.') ||
      ip.startsWith('10.') ||
      ip.startsWith('172.16.') ||
      ip.startsWith('::1')
    ) {
      return 'Local Network';
    }

    // Return cached result if available
    const cached = getCachedIpLocation(ip);
    if (cached) return cached;

    try {
      const res = await fetch(`https://ipapi.co/${ip}/json/`, {
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        const data = await res.json();
        // ipapi.co returns { error: true } for invalid/reserved IPs
        if (!data.error && data.city && data.country_name) {
          const location = `${data.city}, ${data.country_name}`;
          saveIpLocationCache(ip, location);
          return location;
        }
        if (!data.error && data.country_name) {
          saveIpLocationCache(ip, data.country_name);
          return data.country_name;
        }
      }
    } catch {
      // Network error or timeout — fall through
    }

    const fallback = 'Unknown Location';
    saveIpLocationCache(ip, fallback);
    return fallback;
  }

  /**
   * Export audit — calls Railway /api/activity/export, then generates the
   * downloadable file client-side from the returned records.
   * Falls back to local getAuditLog() if Railway is unreachable.
   */
  async exportAudit(filters = {}, format = 'csv', exportType = 'audit') {
    let records = [];

    // Try Railway export endpoint first
    try {
      const actorId = localStorage.getItem('actorId') || 'PSN0005';
      const params = { format };
      if (filters.search && filters.search.trim()) params.search = filters.search.trim();
      if (filters.module && filters.module !== 'All modules') params.module = filters.module;
      if (filters.status && filters.status !== 'All statuses') params.status = filters.status;
      if (filters.plaza && filters.plaza !== 'All plazas') params.plaza = filters.plaza;

      const res = await httpClient.get('/api/activity/export', {
        params,
        headers: { 'X-Actor-ID': actorId },
      });

      // If Railway returned the compiled export directly, use it
      if (res && res.data && res.data.data) {
        return res.data;
      }

      // If Railway returned raw records array instead of compiled export
      if (res && res.data && Array.isArray(res.data)) {
        records = res.data;
      }
    } catch (err) {
      console.warn('[UserActivityService] Railway export unreachable, building locally:', err?.message);
      records = await this.getAuditLog(filters);
    }

    // If no records yet (e.g. Railway returned empty), fall back to local
    if (!records.length) {
      records = await this.getAuditLog(filters);
    }

    // Record the export event locally so it shows up in the audit trail
    let actor = { id: 'PSN0001', name: 'Sanjay Kulkarni', role: 'Master Admin' };
    try {
      const activeUser = JSON.parse(localStorage.getItem('paysonic_auth_session') || '{}');
      if (activeUser.name) actor = activeUser;
    } catch {}

    const isFilterLedger = exportType === 'filter_ledger';
    const reportTitle = isFilterLedger ? 'PAYSONIC AUDIT TRAIL - FILTER LEDGER EXPORT' : 'PAYSONIC AUDIT TRAIL & COMPLIANCE LEDGER';
    const filenamePrefix = isFilterLedger ? 'paysonic_filter_ledger_export' : 'paysonic_audit_export';

    this.recordAuditEvent({
      module: 'Transactional Report',
      action: 'EXPORT_AUDIT_LOG',
      actionLabel: isFilterLedger ? 'Exported Filter Ledger' : 'Exported Audit Ledger',
      status: 'SUCCESS',
      actor: { id: actor.id, name: actor.name, role: actor.role, ipAddress: '127.0.0.1' },
      plaza: 'All plazas',
      target: `${isFilterLedger ? 'Filter Ledger Export' : 'Audit Export'} (${records.length} records, ${format.toUpperCase()})`,
      details: `Compliance export compiled for ${records.length} records in ${format.toUpperCase()} format`,
    });

    // Sort records in proper sequence (newest first by timestamp)
    const sortedRecords = [...records].sort((a, b) => {
      const timeA = new Date(a.timestamp || 0).getTime();
      const timeB = new Date(b.timestamp || 0).getTime();
      return timeB - timeA;
    });

    const pad = (n) => String(n).padStart(2, '0');
    const now = new Date();
    const fetchTimeStr = `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    // Helper for XML escaping
    const escapeXml = (unsafe) => {
      if (unsafe === null || unsafe === undefined) return '';
      return String(unsafe)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    };

    if (format === 'excel' || format === 'xlsx' || format === 'xls') {
      const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#1E293B"/>
  </Style>
  <Style ss:ID="sTitle">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="15" ss:Color="#0F2F6B" ss:Bold="1"/>
  </Style>
  <Style ss:ID="sSubtitle">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#475569"/>
  </Style>
  <Style ss:ID="sGreenBar">
   <Interior ss:Color="#10B981" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="sHeader">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="10.5" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#0F2F6B" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="sDataCenter">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
  <Style ss:ID="sDataText">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
  <Style ss:ID="sSuccess">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#047857" ss:Bold="1"/>
   <Interior ss:Color="#D1FAE5" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="sFailure">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#B91C1C" ss:Bold="1"/>
   <Interior ss:Color="#FEE2E2" ss:Pattern="Solid"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Audit Ledger">
  <Table ss:DefaultRowHeight="20">
   <Column ss:Width="45"/>
   <Column ss:Width="110"/>
   <Column ss:Width="135"/>
   <Column ss:Width="120"/>
   <Column ss:Width="100"/>
   <Column ss:Width="130"/>
   <Column ss:Width="150"/>
   <Column ss:Width="120"/>
   <Column ss:Width="120"/>
   <Column ss:Width="150"/>
   <Column ss:Width="110"/>
   <Column ss:Width="80"/>
   <Column ss:Width="100"/>
   <Column ss:Width="220"/>
   <Row ss:Height="28">
    <Cell ss:MergeAcross="13" ss:StyleID="sTitle"><Data ss:Type="String">${escapeXml(reportTitle)}</Data></Cell>
   </Row>
   <Row ss:Height="18">
    <Cell ss:MergeAcross="13" ss:StyleID="sSubtitle"><Data ss:Type="String">Total Events: ${sortedRecords.length}   |   Report Fetch Time: ${escapeXml(fetchTimeStr)}</Data></Cell>
   </Row>
   <Row ss:Height="4">
    ${Array(14).fill('<Cell ss:StyleID="sGreenBar"/>').join('')}
   </Row>
   <Row ss:Height="24">
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Sr No</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Event ID</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Timestamp</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Actor Name</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Actor Role</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Module</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Action</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Reference ID</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Correlation ID</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Target</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Plaza Scope</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Outcome</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">IP Address</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Details</Data></Cell>
   </Row>
   ${sortedRecords.map((r, idx) => `
   <Row ss:Height="19">
    <Cell ss:StyleID="sDataCenter"><Data ss:Type="Number">${idx + 1}</Data></Cell>
    <Cell ss:StyleID="sDataCenter"><Data ss:Type="String">${escapeXml(r.id || '')}</Data></Cell>
    <Cell ss:StyleID="sDataCenter"><Data ss:Type="String">${escapeXml(r.timestamp || '')}</Data></Cell>
    <Cell ss:StyleID="sDataText"><Data ss:Type="String">${escapeXml((r.actor && r.actor.name) || '')}</Data></Cell>
    <Cell ss:StyleID="sDataCenter"><Data ss:Type="String">${escapeXml((r.actor && r.actor.role) || '')}</Data></Cell>
    <Cell ss:StyleID="sDataText"><Data ss:Type="String">${escapeXml(r.module || '')}</Data></Cell>
    <Cell ss:StyleID="sDataText"><Data ss:Type="String">${escapeXml(r.actionLabel || r.action || '')}</Data></Cell>
    <Cell ss:StyleID="sDataCenter"><Data ss:Type="String">${escapeXml(r.referenceId || '')}</Data></Cell>
    <Cell ss:StyleID="sDataCenter"><Data ss:Type="String">${escapeXml(r.correlationId || '')}</Data></Cell>
    <Cell ss:StyleID="sDataText"><Data ss:Type="String">${escapeXml(r.target || '')}</Data></Cell>
    <Cell ss:StyleID="sDataText"><Data ss:Type="String">${escapeXml(r.plaza || '')}</Data></Cell>
    <Cell ss:StyleID="${r.status === 'FAILURE' ? 'sFailure' : 'sSuccess'}"><Data ss:Type="String">${escapeXml(r.status || 'SUCCESS')}</Data></Cell>
    <Cell ss:StyleID="sDataCenter"><Data ss:Type="String">${escapeXml((r.actor && r.actor.ipAddress) || '127.0.0.1')}</Data></Cell>
    <Cell ss:StyleID="sDataText"><Data ss:Type="String">${escapeXml(r.details || '')}</Data></Cell>
   </Row>`).join('')}
  </Table>
 </Worksheet>
</Workbook>`;

      return {
        data: xml,
        filename: `${filenamePrefix}_${new Date().toISOString().slice(0, 10)}.xls`,
        mimeType: 'application/vnd.ms-excel',
        recordCount: sortedRecords.length,
      };
    }

    // Build CSV payload client-side in proper sequence
    if (format === 'csv') {
      const headers = [
        'Sr No',
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
        'Details'
      ];
      const rows = sortedRecords.map((r, idx) => [
        idx + 1,
        `"${r.id || ''}"`,
        `"${r.timestamp || ''}"`,
        `"${(r.actor && r.actor.name) || ''}"`,
        `"${(r.actor && r.actor.role) || ''}"`,
        `"${r.module || ''}"`,
        `"${r.actionLabel || r.action || ''}"`,
        `"${r.referenceId || ''}"`,
        `"${r.correlationId || ''}"`,
        `"${r.target || ''}"`,
        `"${r.plaza || ''}"`,
        `"${r.status || 'SUCCESS'}"`,
        `"${(r.actor && r.actor.ipAddress) || '127.0.0.1'}"`,
        `"${(r.details || '').replace(/"/g, '""')}"`
      ]);
      const csvContent = '\uFEFF' + [
        `# ${reportTitle}`,
        `# Total Events: ${sortedRecords.length} | Report Fetch Time: ${fetchTimeStr}`,
        headers.join(','),
        ...rows.map((e) => e.join(','))
      ].join('\n');

      return {
        data: csvContent,
        filename: `${filenamePrefix}_${new Date().toISOString().slice(0, 10)}.csv`,
        mimeType: 'text/csv',
        recordCount: sortedRecords.length,
      };
    }

    return {
      data: JSON.stringify(sortedRecords, null, 2),
      filename: `${filenamePrefix}_${new Date().toISOString().slice(0, 10)}.json`,
      mimeType: 'application/json',
      recordCount: sortedRecords.length,
    };
  }
}

export default new UserActivityService();
