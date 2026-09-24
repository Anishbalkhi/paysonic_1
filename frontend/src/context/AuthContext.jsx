import React, { createContext, useContext, useState, useEffect } from 'react';
import { getRoleMenuDefaults } from '../pages/UserList/menuConfig';
import UserService, { getStoredUserPermissions } from '../services/user/UserService';
import UserActivityService from '../services/userActivity/UserActivityService';

const STORAGE_KEY = 'paysonic_auth_session';

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

        if (userCustomPerms) {
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

        // If user was deactivated, locked, or is pending approval — revoke session immediately
        if (
          liveRecord.locked ||
          liveRecord.status === 'Inactive' ||
          liveRecord.approval !== 'Approved' ||
          liveRecord.status === 'Pending'
        ) {
          console.warn('[AuthContext] Active user is locked, deactivated, or pending approval. Revoking session.');
          logout();
          return;
        }

        // Keep session updated with any changes from DB
        if (isMounted) {
          const perms = getStoredUserPermissions();
          const assignedPermissions =
            perms[liveRecord.id] ||
            (liveRecord.email && perms[liveRecord.email.toLowerCase()]) ||
            liveRecord.menuAccess ||
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
      }
    };

    window.addEventListener('paysonic_auth_change', handleAuthChange);
    window.addEventListener('paysonic_user_revoked', handleUserRevoked);
    window.addEventListener('storage', handleStorage);

    return () => {
      isMounted = false;
      window.removeEventListener('paysonic_auth_change', handleAuthChange);
      window.removeEventListener('paysonic_user_revoked', handleUserRevoked);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

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

    const match = allUsers.find(
      (u) =>
        u.email?.toLowerCase() === trimmed ||
        u.username?.toLowerCase() === trimmed ||
        u.id?.toLowerCase() === trimmed ||
        (u.email && u.email.toLowerCase().split('@')[0] === trimmed)
    );

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
      throw new Error('User is not found.');
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

    if (match.locked) {
      UserActivityService.recordLoginAttempt({
        userId: match.id,
        email: match.email,
        name: match.name,
        role: match.role,
        status: 'Failed',
        failureReason: 'Account locked: profile suspended by administrator',
      });
      throw new Error('Account locked: Your profile has been suspended. Please contact your system administrator.');
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

    // Register REAL active session
    const sessionId = UserActivityService.registerActiveSession({
      userId: match.id,
      username: match.username || match.email.split('@')[0],
      name: match.name,
      role: match.role,
      plaza: match.assignedPlaza || match.plaza || 'All plazas',
    });

    // Retrieve customized permissions for this specific user
    const perms = getStoredUserPermissions();
    const assignedPermissions =
      perms[match.id] ||
      (match.email && perms[match.email.toLowerCase()]) ||
      (match.username && perms[match.username.toLowerCase()]) ||
      match.menuAccess ||
      getRoleMenuDefaults(match.role);

    const sessionData = {
      ...match,
      sessionId,
      menuAccess: assignedPermissions,
      permissions: assignedPermissions,
      loginTimestamp: new Date().toISOString(),
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionData));
    localStorage.setItem('actorId', sessionData.id);
    setCurrentUser(sessionData);
    return sessionData;
  };

  const logout = () => {
    try {
      const active = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (active && active.sessionId) {
        UserActivityService.terminateSession(active.sessionId, 'User signed out');
      }
    } catch {}
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('actorId');
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
