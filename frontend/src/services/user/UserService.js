import httpClient from '../api/httpClient';
import {
  getRoleMenuDefaults,
  parseUserTypeWithPermissions,
  buildUserTypeWithPermissions,
} from '../../pages/UserList/menuConfig';

const PERMISSIONS_STORAGE_KEY = 'paysonic_user_permissions';
const OVERRIDES_STORAGE_KEY = 'paysonic_user_profile_overrides';

// Helper to get stored custom profile overrides (kept for backward compatibility, returns empty)
export function getStoredProfileOverrides() {
  return {};
}

export function saveUserProfileOverride() {
  // Deprecated: Real database is the single source of truth
}

// Helper to get stored custom permissions map for active session
export function getStoredUserPermissions() {
  try {
    const raw = localStorage.getItem(PERMISSIONS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    return parsed;
  } catch {
    return {};
  }
}

// Helper to save permissions for active session sync
export function saveUserPermissions(userId, menuAccess, email, username) {
  let store = getStoredUserPermissions();
  if (!store || typeof store !== 'object' || Array.isArray(store)) {
    store = {};
  }
  const cleanAccess = Array.isArray(menuAccess) ? menuAccess : [];
  if (userId) store[userId] = cleanAccess;
  if (email) store[email.toLowerCase()] = cleanAccess;
  if (username) store[username.toLowerCase()] = cleanAccess;
  try {
    localStorage.setItem(PERMISSIONS_STORAGE_KEY, JSON.stringify(store));
  } catch {}

  // If the currently logged-in user is this user, update active auth session immediately
  try {
    const currentSession = JSON.parse(localStorage.getItem('paysonic_auth_session') || 'null');
    if (
      currentSession &&
      (currentSession.id === userId ||
        (email && currentSession.email?.toLowerCase() === email.toLowerCase()) ||
        (username && currentSession.username?.toLowerCase() === username.toLowerCase()))
    ) {
      currentSession.menuAccess = cleanAccess;
      currentSession.permissions = cleanAccess;
      localStorage.setItem('paysonic_auth_session', JSON.stringify(currentSession));
      window.dispatchEvent(new CustomEvent('paysonic_auth_change', { detail: currentSession }));
    }
  } catch (err) {
    console.warn('[UserService] Failed to sync auth session permissions:', err);
  }
}

const getActiveActorId = () => {
  try {
    const raw = localStorage.getItem('paysonic_auth_session');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.id) return parsed.id;
      if (parsed?.username) return parsed.username;
    }
  } catch {}
  return localStorage.getItem('actorId') || 'PSN1000';
};

export function sortUsersNewestFirst(users) {
  if (!Array.isArray(users)) return [];
  return [...users].sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (timeA !== timeB) {
      return timeB - timeA; // newest timestamp first
    }
    // Fallback: extract numeric value from ID (e.g. PSN9037 > PSN0001)
    const numA = parseInt(String(a.id || '').replace(/\D/g, ''), 10) || 0;
    const numB = parseInt(String(b.id || '').replace(/\D/g, ''), 10) || 0;
    if (numA !== numB) {
      return numB - numA;
    }
    return String(b.id || '').localeCompare(String(a.id || ''));
  });
}

class UserService {
  _mapUsers(rawList) {
    if (!Array.isArray(rawList)) return [];

    const mapped = rawList.map((u) => {
      const username = u.username || u.id || (u.email ? u.email.split('@')[0] : 'PSN0000');
      const email = u.email || '';
      const parsedUserType = parseUserTypeWithPermissions(u.userType);
      const cleanUserType = parsedUserType.cleanUserType || u.userType || '—';

      const customAccess = Array.isArray(u.menuAccess) && u.menuAccess.length > 0
        ? u.menuAccess
        : Array.isArray(parsedUserType.menuAccess) && parsedUserType.menuAccess.length > 0
        ? parsedUserType.menuAccess
        : getRoleMenuDefaults(u.role);

      const isTrash = u.status === 'Trash User' || u.status === 'Trash' || String(u.status || '').toLowerCase() === 'trash user';
      const isApproved = u.approval === 'Approved';
      const status = isTrash ? 'Trash User' : (isApproved ? (u.status === 'Inactive' ? 'Inactive' : 'Active') : 'Pending');
      const approval = isTrash ? 'Locked (Trash)' : (isApproved ? 'Approved' : 'Pending');

      // 72-Hour Dormancy Check (User becomes dormant/locked if not logged in for 72 hours)
      const lastActiveRef = u.lastActive || u.createdAt;
      const lastActiveTime = lastActiveRef ? new Date(lastActiveRef).getTime() : null;
      const is72HoursInactive = lastActiveTime ? (Date.now() - lastActiveTime > 72 * 60 * 60 * 1000) : false;
      const isDormant = !isTrash && (Boolean(u.dormant) || (is72HoursInactive && u.role !== 'Master Admin'));
      const isLocked = isTrash || Boolean(u.locked) || isDormant;

      return {
        ...u,
        id: u.id,
        name: u.name || username,
        username,
        email,
        contact: u.mobile || u.contact || '',
        mobile: u.mobile || u.contact || '',
        plaza: u.assignedPlaza || u.plaza || 'All plazas',
        assignedPlaza: u.assignedPlaza || u.plaza || 'All plazas',
        plazas: Array.isArray(u.plazas) && u.plazas.length > 0
          ? u.plazas
          : (u.assignedPlaza ? u.assignedPlaza.split(',').map((s) => s.trim()) : ['All plazas']),
        role: u.role,
        userType: cleanUserType,
        status,
        approval,
        locked: isLocked,
        isDormant,
        dormant: isDormant,
        lastActive: u.lastActive || null,
        password: u.password || 'Paysonic@2026',
        menuAccess: customAccess,
        createdBy: u.createdBy || '',
        approvedBy: u.approvedBy || '',
        createdAt: u.createdAt || null,
      };
    });

    return sortUsersNewestFirst(mapped);
  }

  async getUsers() {
    const res = await httpClient.get('/api/users');
    if (res && res.data && Array.isArray(res.data)) {
      const mapped = this._mapUsers(res.data);
      try {
        localStorage.setItem('paysonic_users_cache', JSON.stringify(mapped));
      } catch {}
      return mapped;
    }
    return [];
  }

  async getPagedUsers({ page = 0, size = 10, search = '', role = '', status = '', plaza = '' } = {}) {
    const cappedSize = Math.min(Math.max(size, 1), 10);
    const params = { page, size: cappedSize };
    if (search) params.search = search;
    if (role && role !== 'All roles') params.role = role;
    if (status && status !== 'All statuses') params.status = status;
    if (plaza && plaza !== 'All plazas') params.plaza = plaza;

    const res = await httpClient.get('/api/users', { params });
    if (res && res.data && res.data.content) {
      const users = this._mapUsers(res.data.content);
      return {
        users,
        totalElements: res.data.totalElements ?? users.length,
        totalPages: res.data.totalPages ?? 1,
        currentPage: res.data.currentPage ?? page,
        pageSize: cappedSize,
      };
    }

    const allUsers = await this.getUsers();
    const from = page * cappedSize;
    const pagedSlice = allUsers.slice(from, from + cappedSize);
    return {
      users: pagedSlice,
      totalElements: allUsers.length,
      totalPages: Math.max(1, Math.ceil(allUsers.length / cappedSize)),
      currentPage: page,
      pageSize: cappedSize,
    };
  }

  async getUserById(id) {
    const res = await httpClient.get(`/api/users/${id}`);
    if (res && res.data) {
      return this._mapUsers([res.data])[0];
    }
    return null;
  }

  async createUser(newUser) {
    const actorId = newUser.createdBy || getActiveActorId();
    const cleanUserType = newUser.userType
      ? parseUserTypeWithPermissions(newUser.userType).cleanUserType
      : 'Toll Plaza';
    const userTypeToSend = buildUserTypeWithPermissions(cleanUserType, newUser.menuAccess);

    const payload = {
      name: newUser.name || newUser.username,
      email: newUser.email,
      mobile: newUser.contact || newUser.mobile || '9999999999',
      role: newUser.role,
      userType: userTypeToSend,
      assignedPlaza: newUser.plaza || newUser.assignedPlaza || 'All plazas',
      status: newUser.status || 'Pending',
      approval: newUser.approval || 'Pending',
      locked: Boolean(newUser.locked),
      password: newUser.password || 'Paysonic@2026',
      createdBy: actorId,
      menuAccess: newUser.menuAccess,
    };

    const res = await httpClient.post('/api/users', payload, {
      headers: {
        'X-Actor-ID': actorId,
      },
    });

    const createdUser = this._mapUsers([res.data])[0];

    if (createdUser && createdUser.menuAccess) {
      saveUserPermissions(createdUser.id, createdUser.menuAccess, createdUser.email, createdUser.username);
    }

    return createdUser;
  }

  async updateUser(id, updatedFields) {
    const actorId = getActiveActorId();

    // If currently logged in user matches, update session immediately
    try {
      const activeSession = JSON.parse(localStorage.getItem('paysonic_auth_session') || 'null');
      if (
        activeSession &&
        (activeSession.id === id ||
          (updatedFields.email && activeSession.email?.toLowerCase() === updatedFields.email.toLowerCase()) ||
          (updatedFields.username && activeSession.username?.toLowerCase() === updatedFields.username.toLowerCase()))
      ) {
        const updatedSession = {
          ...activeSession,
          ...updatedFields,
          name: updatedFields.name || activeSession.name,
          contact: updatedFields.contact || updatedFields.mobile || activeSession.contact,
          mobile: updatedFields.mobile || updatedFields.contact || activeSession.mobile,
          role: updatedFields.role || activeSession.role,
          plaza: updatedFields.plaza || updatedFields.assignedPlaza || activeSession.plaza,
          menuAccess: updatedFields.menuAccess !== undefined ? updatedFields.menuAccess : activeSession.menuAccess,
          permissions: updatedFields.menuAccess !== undefined ? updatedFields.menuAccess : activeSession.permissions,
        };
        localStorage.setItem('paysonic_auth_session', JSON.stringify(updatedSession));
        window.dispatchEvent(new CustomEvent('paysonic_auth_change', { detail: updatedSession }));
      }
    } catch {}

    // If user is deactivated, revoke active session immediately
    if (updatedFields.status === 'Inactive') {
      try {
        const activeSession = JSON.parse(localStorage.getItem('paysonic_auth_session') || 'null');
        if (activeSession && activeSession.id === id) {
          localStorage.removeItem('paysonic_auth_session');
          localStorage.removeItem('actorId');
          window.dispatchEvent(
            new CustomEvent('paysonic_user_revoked', { detail: { id, reason: 'deactivated' } })
          );
        }
      } catch {}
    }

    const cleanUserType = updatedFields.userType !== undefined
      ? parseUserTypeWithPermissions(updatedFields.userType).cleanUserType
      : undefined;
    const userTypeToSend = updatedFields.menuAccess !== undefined
      ? buildUserTypeWithPermissions(cleanUserType || updatedFields.userType, updatedFields.menuAccess)
      : (cleanUserType !== undefined ? cleanUserType : updatedFields.userType);

    const payloadToSend = {
      ...updatedFields,
      ...(userTypeToSend !== undefined ? { userType: userTypeToSend } : {}),
    };

    const res = await httpClient.put(`/api/users/${id}`, payloadToSend, {
      headers: { 'X-Actor-ID': actorId },
    });

    const resultUser = this._mapUsers([res.data])[0];

    if (resultUser && resultUser.menuAccess) {
      saveUserPermissions(resultUser.id, resultUser.menuAccess, resultUser.email, resultUser.username);
    }

    return resultUser;
  }

  async deleteUser(id) {
    const actorId = getActiveActorId();

    try {
      const activeSession = JSON.parse(localStorage.getItem('paysonic_auth_session') || 'null');
      if (activeSession && activeSession.id === id) {
        localStorage.removeItem('paysonic_auth_session');
        localStorage.removeItem('actorId');
        window.dispatchEvent(
          new CustomEvent('paysonic_user_revoked', { detail: { id, reason: 'deleted' } })
        );
      }
    } catch {}

    const res = await httpClient.delete(`/api/users/${id}`, {
      headers: { 'X-Actor-ID': actorId },
    });
    try {
      const cached = JSON.parse(localStorage.getItem('paysonic_users_cache') || '[]');
      const updated = cached.map((u) => (u.id === id ? { ...u, status: 'Trash User', locked: true } : u));
      localStorage.setItem('paysonic_users_cache', JSON.stringify(updated));
    } catch {}
    return res.data;
  }

  async activateUser(id) {
    const actorId = getActiveActorId();
    const res = await httpClient.patch(`/api/users/${id}/activate`, null, {
      headers: { 'X-Actor-ID': actorId },
    });
    const resultUser = this._mapUsers([res.data])[0];
    try {
      const cached = JSON.parse(localStorage.getItem('paysonic_users_cache') || '[]');
      const updated = cached.map((u) => (u.id === id ? { ...u, status: 'Active', locked: false, approval: 'Approved' } : u));
      localStorage.setItem('paysonic_users_cache', JSON.stringify(updated));
    } catch {}
    return resultUser;
  }

  async toggleLock(id) {
    const actorId = getActiveActorId();
    let resData;
    try {
      const res = await httpClient.patch(`/api/users/${id}/lock`, null, {
        headers: { 'X-Actor-ID': actorId },
      });
      resData = res.data;
    } catch (err) {
      console.warn('[UserService] toggleLock API error, applying local toggle fallback:', err?.message);
      const cached = JSON.parse(localStorage.getItem('paysonic_users_cache') || '[]');
      const target = cached.find((u) => u.id === id);
      if (target) {
        target.locked = !target.locked;
        if (!target.locked) {
          target.lastActive = new Date().toISOString();
          target.isDormant = false;
          target.dormant = false;
        }
        resData = target;
      } else {
        throw err;
      }
    }

    const result = this._mapUsers([resData])[0];

    // If account was unlocked, guarantee that lastActive is renewed so dormancy doesn't re-trigger
    if (result && !result.locked) {
      result.isDormant = false;
      result.dormant = false;
      result.lastActive = result.lastActive || new Date().toISOString();
    }

    // Keep paysonic_users_cache updated
    try {
      const cached = JSON.parse(localStorage.getItem('paysonic_users_cache') || '[]');
      const idx = cached.findIndex((u) => u.id === id);
      if (idx !== -1) {
        cached[idx] = { ...cached[idx], ...result };
        localStorage.setItem('paysonic_users_cache', JSON.stringify(cached));
      }
    } catch {}

    if (result && result.locked) {
      try {
        const activeSession = JSON.parse(localStorage.getItem('paysonic_auth_session') || 'null');
        if (activeSession && activeSession.id === id) {
          localStorage.removeItem('paysonic_auth_session');
          localStorage.removeItem('actorId');
          window.dispatchEvent(
            new CustomEvent('paysonic_user_revoked', { detail: { id, reason: 'locked' } })
          );
        }
      } catch {}
    }

    return result;
  }

  async touchLogin(id) {
    try {
      await httpClient.patch(`/api/users/${id}/touch-activity`);
    } catch (e) {
      console.warn('[UserService] touch-activity error (ignoring):', e?.message);
    }
    try {
      const cached = JSON.parse(localStorage.getItem('paysonic_users_cache') || '[]');
      const target = cached.find((u) => u.id === id);
      if (target) {
        target.lastActive = new Date().toISOString();
        target.isDormant = false;
        target.dormant = false;
        localStorage.setItem('paysonic_users_cache', JSON.stringify(cached));
      }
    } catch {}
  }

  async approveUser(id) {
    const actorId = getActiveActorId();
    if (!actorId) {
      throw new Error('Authentication required: please log in to perform approvals.');
    }

    const res = await httpClient.patch(`/api/users/${id}/approve`, null, {
      headers: { 'X-Actor-ID': actorId },
    });

    return this._mapUsers([res.data])[0];
  }

  async bulkUpload(file) {
    const actorId = getActiveActorId();
    const formData = new FormData();
    formData.append('file', file);

    const res = await httpClient.post('/api/users/bulk-upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        'X-Actor-ID': actorId,
      },
    });
    return this._mapUsers(res.data);
  }

  async changePassword(id, currentPassword, newPassword) {
    const actorId = getActiveActorId();
    try {
      const res = await httpClient.patch(
        `/api/users/${id}/change-password`,
        { currentPassword, newPassword },
        { headers: { 'X-Actor-ID': actorId } }
      );
      // Keep cache updated
      try {
        const cached = JSON.parse(localStorage.getItem('paysonic_users_cache') || '[]');
        const idx = cached.findIndex((u) => u.id === id);
        if (idx !== -1) {
          cached[idx].password = newPassword;
          localStorage.setItem('paysonic_users_cache', JSON.stringify(cached));
        }
      } catch {}
      return res.data;
    } catch (err) {
      console.warn('[UserService] change-password endpoint error, falling back to updateUser:', err?.message);
      return await this.updateUser(id, { password: newPassword });
    }
  }
}

export default new UserService();
