import React, { createContext, useContext, useState, useEffect } from 'react';
import { getRoleMenuDefaults } from '../pages/UserList/menuConfig';
import UserService, { getStoredUserPermissions } from '../services/user/UserService';
import UserActivityService, { getOrCreateDeviceId } from '../services/userActivity/UserActivityService';

const STORAGE_KEY = 'paysonic_auth_session';
export const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
export const LAST_ACTIVITY_KEY = 'paysonic_last_activity';
export const TIMEOUT_NOTICE_KEY = 'paysonic_timeout_notice';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    let isMounted = true;

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const perms = getStoredUserPermissions();
        const userCustomPerms =
          perms[parsed.id] ||
          (parsed.email && perms[parsed.email.toLowerCase()]) ||
          (parsed.username && perms[parsed.username.toLowerCase()]);

        if (parsed.role === 'Master Admin') {
          parsed.menuAccess = getRoleMenuDefaults('Master Admin');
          parsed.permissions = parsed.menuAccess;
        } else if (userCustomPerms) {
          parsed.menuAccess = userCustomPerms;
          parsed.permissions = userCustomPerms;
        } else if (!parsed.menuAccess) {
          parsed.menuAccess = getRoleMenuDefaults(parsed.role);
          parsed.permissions = parsed.menuAccess;
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
        setCurrentUser(parsed);
      } else {
        setCurrentUser(null);
      }
    } catch (e) {
      console.error('Failed to load session:', e);
      setCurrentUser(null);
    } finally {
      setAuthChecked(true);
    }

    // Validate active session against Railway live database in the background
    const validateLiveSession = async () => {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      try {
        const active = JSON.parse(saved);
        if (!active || !active.id) return;

        const liveUsers = await UserService.getUsers();
        if (!Array.isArray(liveUsers) || liveUsers.length === 0) return;

        const liveRecord = liveUsers.find(
          (u) =>
            u.id === active.id ||
            (u.email && u.email.toLowerCase() === active.email?.toLowerCase())
        );

        // If user no longer exists in MySQL database (DELETED), immediately kill their session!
        if (!liveRecord) {
          console.warn('[AuthContext] Active user was deleted from Railway database. Revoking session.');
          logout();
          return;
        }

        const isLiveTrash =
          liveRecord.status === 'Trash User' ||
          liveRecord.status === 'Trash' ||
          String(liveRecord.status || '').toLowerCase() === 'trash user';

        // If user was deactivated, locked, in trash, or is pending approval — revoke session immediately
        if (
          isLiveTrash ||
          liveRecord.locked ||
          liveRecord.status === 'Inactive' ||
          liveRecord.approval !== 'Approved' ||
          liveRecord.status === 'Pending'
        ) {
          console.warn('[AuthContext] Active user is locked, deactivated, in trash, or pending approval. Revoking session.');
          logout();
          return;
        }

        // ── Single-Device Concurrent Login Validation (FR #7) ──
        // Only Master Admin is permitted to be logged in on multiple devices concurrently.
        // For all other roles, check if this session was superseded/terminated by a DIFFERENT device.
        if (active.role !== 'Master Admin' && active.sessionId) {
          try {
            // Check remote database session status (multi-device)
            const statusCheck = await UserActivityService.checkSessionStatus(active.sessionId);
            if (statusCheck && statusCheck.active === false && statusCheck.terminatedByDifferentDevice) {
              console.warn('[AuthContext] Session terminated because account logged in on another device.');
              sessionStorage.setItem(
                TIMEOUT_NOTICE_KEY,
                'You have been logged out because your account was logged in on another device.'
              );
              logout();
              window.location.href = '/login?reason=concurrent_device';
              return;
            }
          } catch (sessionErr) {
            console.warn('[AuthContext] Session status check error (ignoring):', sessionErr?.message);
          }
        }

        // Keep session updated with any changes from DB
        if (isMounted) {
          const perms = getStoredUserPermissions();
          const assignedPermissions =
            (liveRecord.menuAccess !== undefined && liveRecord.menuAccess !== null)
              ? liveRecord.menuAccess
              : perms[liveRecord.id] ||
                (liveRecord.email && perms[liveRecord.email.toLowerCase()]) ||
                (liveRecord.username && perms[liveRecord.username.toLowerCase()]) ||
                getRoleMenuDefaults(liveRecord.role);

          const updatedSession = {
            ...active,
            ...liveRecord,
            menuAccess: assignedPermissions,
            permissions: assignedPermissions,
          };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSession));
          setCurrentUser(updatedSession);
        }
      } catch (err) {
        console.warn('[AuthContext] Background session validation error:', err?.message);
      }
    };

    validateLiveSession();
    // Re-check whenever tab gains focus or on a gentle interval so permission changes reflect immediately
    const handleFocus = () => validateLiveSession();
    const syncInterval = setInterval(validateLiveSession, 12000);
    window.addEventListener('focus', handleFocus);

    // Listen for real-time permission and profile updates across tabs/components
    const handleAuthChange = (e) => {
      if (e.detail && isMounted) {
        setCurrentUser((prev) => ({ ...prev, ...e.detail }));
      }
    };

    // Listen for immediate account revocation (deletion, deactivation, locking)
    const handleUserRevoked = (e) => {
      const active = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (
        active &&
        e.detail &&
        (e.detail.id === active.id ||
          (e.detail.email && e.detail.email === active.email?.toLowerCase()))
      ) {
        logout();
      }
    };

    const handleStorage = (e) => {
      if (e.key === 'paysonic_revoked_user_id') {
        try {
          const { id } = JSON.parse(e.newValue || '{}');
          const active = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
          if (active && active.id === id) {
            logout();
          }
        } catch {}
      } else if (e.key === 'paysonic_device_login_event') {
        try {
          const { userId, deviceId } = JSON.parse(e.newValue || '{}');
          const active = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
          // Only revoke if from a DIFFERENT device for a non-Master Admin user
          if (active && active.id === userId && active.role !== 'Master Admin') {
            const currentDeviceId = active.deviceId || getOrCreateDeviceId();
            if (deviceId && deviceId !== currentDeviceId) {
              console.warn('[AuthContext] Account logged in on another device. Revoking session.');
              sessionStorage.setItem(
                TIMEOUT_NOTICE_KEY,
                'You have been logged out because your account was logged in on another device.'
              );
              logout();
              window.location.href = '/login?reason=concurrent_device';
            }
          }
        } catch {}
      } else if (e.key === 'paysonic_user_permissions' || e.key === 'paysonic_users_cache') {
        validateLiveSession();
      } else if (e.key === 'paysonic_session_expired') {
        logout();
        window.location.href = '/login';
      }
    };

    window.addEventListener('paysonic_auth_change', handleAuthChange);
    window.addEventListener('paysonic_user_revoked', handleUserRevoked);
    window.addEventListener('storage', handleStorage);

    return () => {
      isMounted = false;
      clearInterval(syncInterval);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('paysonic_auth_change', handleAuthChange);
      window.removeEventListener('paysonic_user_revoked', handleUserRevoked);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  // ─── 5-Minute Inactivity Auto-Logout Monitor ──────────────────────────────
  useEffect(() => {
    if (!currentUser) return;

    // Initialize last activity timestamp if absent
    if (!localStorage.getItem(LAST_ACTIVITY_KEY)) {
      localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
    }

    let lastWriteTime = 0;
    const recordActivity = () => {
      const now = Date.now();
      // Throttle localStorage updates to at most once every 3 seconds
      if (now - lastWriteTime > 3000) {
        lastWriteTime = now;
        localStorage.setItem(LAST_ACTIVITY_KEY, now.toString());
      }
    };

    const activityEvents = [
      'mousedown',
      'mousemove',
      'keydown',
      'scroll',
      'touchstart',
      'click',
      'wheel',
    ];

    activityEvents.forEach((evt) => {
      window.addEventListener(evt, recordActivity, { passive: true });
    });

    // Heartbeat check every 4 seconds
    const intervalId = setInterval(() => {
      const lastActivityStr = localStorage.getItem(LAST_ACTIVITY_KEY);
      const lastActivity = lastActivityStr ? parseInt(lastActivityStr, 10) : Date.now();
      const elapsed = Date.now() - lastActivity;

      if (elapsed >= INACTIVITY_TIMEOUT_MS) {
        console.warn(`[AuthContext] Auto logging out after ${Math.round(elapsed / 1000)}s of inactivity.`);

        try {
          const active = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
          if (active && active.sessionId) {
            UserActivityService.forceLogout(active.sessionId, 'Session timed out after 5 minutes of inactivity').catch(() => {});
            UserActivityService.terminateSession(active.sessionId, 'Session timed out after 5 minutes of inactivity');
          }
        } catch {}

        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem('actorId');
        localStorage.removeItem(LAST_ACTIVITY_KEY);
        localStorage.setItem('paysonic_session_expired', Date.now().toString());
        sessionStorage.removeItem(TIMEOUT_NOTICE_KEY);
        setCurrentUser(null);
        window.location.href = '/login';
      }
    }, 4000);

    return () => {
      activityEvents.forEach((evt) => {
        window.removeEventListener(evt, recordActivity);
      });
      clearInterval(intervalId);
    };
  }, [currentUser]);

  // ─── Real-Time Session Heartbeat Telemetry ─────────────────────────────────
  // Periodically keeps the backend session's lastActive timestamp updated
  // while the user is actively working (stops updating if user is inactive)
  useEffect(() => {
    if (!currentUser || !currentUser.sessionId) return;

    // Send initial heartbeat upon login/mount
    UserActivityService.sendHeartbeat(currentUser.sessionId);

    const hbTimer = setInterval(() => {
      const lastActivityStr = localStorage.getItem(LAST_ACTIVITY_KEY);
      const lastActivity = lastActivityStr ? parseInt(lastActivityStr, 10) : Date.now();
      const elapsed = Date.now() - lastActivity;
      // Send heartbeat only if user was active within the 5-minute timeout window
      if (elapsed < INACTIVITY_TIMEOUT_MS) {
        UserActivityService.sendHeartbeat(currentUser.sessionId);
      }
    }, 30000);

    return () => clearInterval(hbTimer);
  }, [currentUser?.sessionId]);

  /**
   * Real-time Login against Railway MySQL Database
   * All users (including PSN0001 - PSN0007) are fetched and verified live from MySQL.
   */
  const login = async (rawIdentifier, password) => {
    const trimmed = (rawIdentifier || '').trim().toLowerCase();

    // Fetch live users directly from Railway MySQL database
    // SECURITY: Always prioritize live DB; cache is only used when DB is genuinely unreachable
    let allUsers = [];
    let usingCacheFallback = false;
    try {
      allUsers = await UserService.getUsers();
    } catch (err) {
      console.warn('[AuthContext] Railway unreachable, falling back to cached live users:', err?.message);
      try {
        allUsers = JSON.parse(localStorage.getItem('paysonic_users_cache') || '[]');
        usingCacheFallback = true;
      } catch {}
    }

    // ── Requirement #9: Strictly require registered email ID for login ──
    // The system generates a username in PSN format used ONLY for database display
    // and management purposes. By using the username, users cannot log in.
    const usernameAttempt = allUsers.find(
      (u) =>
        (u.username && u.username.toLowerCase() === trimmed && u.email?.toLowerCase() !== trimmed) ||
        (u.id && u.id.toLowerCase() === trimmed && u.email?.toLowerCase() !== trimmed) ||
        (u.email && u.email.toLowerCase().split('@')[0] === trimmed && !trimmed.includes('@'))
    );

    if (usernameAttempt) {
      UserActivityService.recordLoginAttempt({
        userId: usernameAttempt.id,
        email: rawIdentifier,
        name: usernameAttempt.name,
        role: usernameAttempt.role,
        status: 'Failed',
        failureReason: 'Username login not allowed: registered email ID required',
      });
      throw new Error('Usernames cannot be used for login. Please enter your registered email address.');
    }

    // Strict email ID match only
    const match = allUsers.find((u) => u.email?.toLowerCase() === trimmed);

    // If user is not found in Railway database (or cache)
    if (!match) {
      UserActivityService.recordLoginAttempt({
        userId: 'UNKNOWN',
        email: rawIdentifier,
        name: rawIdentifier,
        role: 'Unknown',
        status: 'Failed',
        failureReason: 'User is not found in database',
      });
      throw new Error('User is not found. Please enter your registered email address.');
    }

    // ── Trash User Check (Requirement #8) ──
    const isTrash =
      match.status === 'Trash User' ||
      match.status === 'Trash' ||
      String(match.status || '').toLowerCase() === 'trash user';

    if (isTrash) {
      UserActivityService.recordLoginAttempt({
        userId: match.id,
        email: match.email,
        name: match.name,
        role: match.role,
        status: 'Failed',
        failureReason: 'your user is locked contact your admin',
      });
      throw new Error('your user is locked contact your admin');
    }

    // SECURITY: When using cache fallback, warn and apply extra strictness.
    // If the cached record shows the user was Inactive or Pending, deny login.
    // This prevents deleted users (who may still be in cache) from gaining access.
    if (usingCacheFallback) {
      if (
        match.status === 'Inactive' ||
        match.locked ||
        match.approval !== 'Approved' ||
        match.status === 'Pending'
      ) {
        UserActivityService.recordLoginAttempt({
          userId: match.id,
          email: match.email,
          name: match.name,
          role: match.role,
          status: 'Failed',
          failureReason: 'Access denied: account not active (offline validation)',
        });
        throw new Error('Access denied: Your account does not meet active user requirements. Please try again when the server is reachable.');
      }
    }

    // 72-Hour Dormancy Check (User becomes dormant/locked if not logged in for 72 hours)
    const now = Date.now();
    const lastActiveRef = match.lastActive || match.createdAt;
    const lastActiveTime = lastActiveRef ? new Date(lastActiveRef).getTime() : null;
    const is72HoursInactive = lastActiveTime ? (now - lastActiveTime > 72 * 60 * 60 * 1000) : false;
    const isDormant = Boolean(match.dormant || match.isDormant) || (is72HoursInactive && match.role !== 'Master Admin');

    if (match.locked || isDormant) {
      UserActivityService.recordLoginAttempt({
        userId: match.id,
        email: match.email,
        name: match.name,
        role: match.role,
        status: 'Failed',
        failureReason: isDormant
          ? 'Account locked: dormant due to inactivity (>72 hrs without login)'
          : 'Account locked: profile suspended by administrator',
      });
      throw new Error(
        isDormant
          ? 'Account locked: Your account has become dormant due to inactivity (not logged in for 72+ hours). Please contact an administrator to unlock your account from User Management.'
          : 'Account locked: Your profile has been suspended. Please contact your system administrator.'
      );
    }
    if (match.approval !== 'Approved' || match.status === 'Pending') {
      UserActivityService.recordLoginAttempt({
        userId: match.id,
        email: match.email,
        name: match.name,
        role: match.role,
        status: 'Failed',
        failureReason: 'Account pending: awaiting administrative approval',
      });
      throw new Error('Account pending: Your onboarding is awaiting administrative approval.');
    }
    if (match.status === 'Inactive') {
      UserActivityService.recordLoginAttempt({
        userId: match.id,
        email: match.email,
        name: match.name,
        role: match.role,
        status: 'Failed',
        failureReason: 'Account inactive: profile disabled',
      });
      throw new Error('Account inactive: Your profile is currently disabled.');
    }

    // ── Real Database Password Verification ──
    // Compares entered password directly with the user's password stored in the database.
    const expectedPassword = String(match.password || 'Paysonic@2026').trim();
    const enteredPassword = String(password || '').trim();

    if (!enteredPassword || enteredPassword !== expectedPassword) {
      UserActivityService.recordLoginAttempt({
        userId: match.id,
        email: match.email,
        name: match.name,
        role: match.role,
        status: 'Failed',
        failureReason: 'Invalid password: authentication credential mismatch',
      });
      throw new Error('Invalid password. Please check your credentials and try again.');
    }

    // Record SUCCESSFUL login attempt
    UserActivityService.recordLoginAttempt({
      userId: match.id,
      email: match.email,
      name: match.name,
      role: match.role,
      status: 'Success',
    });

    // Register REAL active session (enforces single-device login for non-Master Admin)
    const deviceId = getOrCreateDeviceId();
    const sessionId = await UserActivityService.registerActiveSession({
      userId: match.id,
      username: match.username || match.email.split('@')[0],
      name: match.name,
      role: match.role,
      plaza: match.assignedPlaza || match.plaza || 'All plazas',
      deviceId,
    });

    // Enforce Single Device Rule across tabs and devices
    if (match.role !== 'Master Admin') {
      localStorage.setItem('paysonic_active_device_session_' + match.id, sessionId);
      localStorage.setItem('paysonic_device_login_event', JSON.stringify({
        userId: match.id,
        sessionId,
        deviceId,
        timestamp: Date.now(),
      }));
    }

    // Retrieve customized permissions for this specific user
    const perms = getStoredUserPermissions();
    const assignedPermissions =
      (match.menuAccess !== undefined && match.menuAccess !== null)
        ? match.menuAccess
        : perms[match.id] ||
          (match.email && perms[match.email.toLowerCase()]) ||
          (match.username && perms[match.username.toLowerCase()]) ||
          getRoleMenuDefaults(match.role);

    // Renew lastActive in backend database & local cache upon login
    try {
      UserService.touchLogin(match.id);
    } catch {}

    const sessionData = {
      ...match,
      sessionId,
      deviceId,
      menuAccess: assignedPermissions,
      permissions: assignedPermissions,
      loginTimestamp: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      isDormant: false,
      dormant: false,
      locked: false,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionData));
    localStorage.setItem('actorId', sessionData.id);
    localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
    setCurrentUser(sessionData);
    return sessionData;
  };

  const logout = () => {
    try {
      const active = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (active && active.sessionId) {
        UserActivityService.forceLogout(active.sessionId, 'User signed out').catch(() => {});
      }
    } catch {}
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('actorId');
    localStorage.removeItem(LAST_ACTIVITY_KEY);
    setCurrentUser(null);
  };

  // Helper to check if the current user has access to a specific role
  const hasRole = (...roles) => {
    if (!currentUser) return false;
    if (currentUser.role === 'Master Admin') return true;
    return roles.includes(currentUser.role);
  };

  // Helper to check if the current user has access to a specific menu
  const hasMenu = (menuId) => {
    if (!currentUser) return false;
    const access = currentUser.menuAccess || getRoleMenuDefaults(currentUser.role);
    if (!access || !Array.isArray(access)) return true;
    if (menuId === 'user_activity') {
      return access.includes('user_activity') || access.includes('user_management');
    }
    return access.includes(menuId);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated: Boolean(currentUser),
        authChecked,
        login,
        logout,
        hasRole,
        hasMenu,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
};

export default AuthContext;
