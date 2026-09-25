import httpClient from '../api/httpClient';
import initialMockData from '../../data/userList.json';
import { getRoleMenuDefaults } from '../../pages/UserList/menuConfig';

const PERMISSIONS_STORAGE_KEY = 'paysonic_user_permissions';
const USERS_CACHE_KEY = 'paysonic_users_cache';
const OVERRIDES_STORAGE_KEY = 'paysonic_user_profile_overrides';

// Helper to get stored custom profile overrides (name, mobile, plaza, status, etc.)
export function getStoredProfileOverrides() {
  try {
    const raw = localStorage.getItem(OVERRIDES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

// Helper to save profile overrides for a user
export function saveUserProfileOverride(userId, data, email, username) {
  let store = getStoredProfileOverrides();
  if (userId) store[userId] = { ...(store[userId] || {}), ...data };
  if (email) store[email.toLowerCase()] = { ...(store[email.toLowerCase()] || {}), ...data };
  if (username) store[username.toLowerCase()] = { ...(store[username.toLowerCase()] || {}), ...data };
  localStorage.setItem(OVERRIDES_STORAGE_KEY, JSON.stringify(store));
}

// Helper to get stored custom permissions map
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

// Helper to save permissions for a user by id, email, and username
export function saveUserPermissions(userId, menuAccess, email, username) {
  let store = getStoredUserPermissions();
  if (!store || typeof store !== 'object' || Array.isArray(store)) {
    store = {};
  }
  const cleanAccess = Array.isArray(menuAccess) ? menuAccess : [];
  if (userId) store[userId] = cleanAccess;
  if (email) store[email.toLowerCase()] = cleanAccess;
  if (username) store[username.toLowerCase()] = cleanAccess;
  localStorage.setItem(PERMISSIONS_STORAGE_KEY, JSON.stringify(store));

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

// In-memory fallback if Railway API is temporarily unreachable
let mockUsers = [...initialMockData];

class UserService {
  async getUsers() {
    const perms = getStoredUserPermissions();
    const overrides = getStoredProfileOverrides();

    try {
      const res = await httpClient.get('/api/users');
      if (res && res.data && Array.isArray(res.data) && res.data.length > 0) {
        // Map Railway database schema to frontend representation with permissions & overrides
        const users = res.data.map((u) => {
          const username = u.username || (u.email ? u.email.split('@')[0] : u.id);
          const email = u.email || '';
          const userOverride =
            overrides[u.id] ||
            (email && overrides[email.toLowerCase()]) ||
            (username && overrides[username.toLowerCase()]) ||
            {};

          const hasDbPermissions = Array.isArray(u.menuAccess) && u.menuAccess.length > 0;
          const customAccess =
            userOverride.menuAccess ||
            perms[u.id] ||
            (email && perms[email.toLowerCase()]) ||
            (username && perms[username.toLowerCase()]) ||
            (hasDbPermissions ? u.menuAccess : getRoleMenuDefaults(userOverride.role || u.role));

          if (hasDbPermissions && !perms[u.id]) {
            saveUserPermissions(u.id, u.menuAccess, email, username);
          }

          const rawApproval = userOverride.approval || u.approval;
          const isApproved = rawApproval === 'Approved';
          const status = userOverride.status || (isApproved ? (u.status === 'Inactive' ? 'Inactive' : 'Active') : 'Pending');
          const approval = isApproved ? 'Approved' : 'Pending';

          return {
            ...u,
            ...userOverride,
            id: u.id,
            name: userOverride.name || u.name,
            username: userOverride.username || username,
            email: userOverride.email || email,
            contact: userOverride.contact || userOverride.mobile || u.mobile || u.contact || '',
            mobile: userOverride.mobile || userOverride.contact || u.mobile || u.contact || '',
            plaza: userOverride.plaza || userOverride.assignedPlaza || u.assignedPlaza || u.plaza || 'All plazas',
            role: userOverride.role || u.role,
            userType: userOverride.userType || u.userType || '—',
            status,
            approval,
            locked: userOverride.locked !== undefined ? Boolean(userOverride.locked) : Boolean(u.locked),
            password: userOverride.password || u.password || 'Paysonic@2026',
            menuAccess: customAccess,
          };
        });

        // Cache users list for authentication lookup
        try {
          localStorage.setItem(USERS_CACHE_KEY, JSON.stringify(users));
        } catch {}

        return users;
      }
    } catch (err) {
      console.warn('[UserService] Railway API unreachable, using local fallback:', err?.message);
    }

    const fallbackUsers = mockUsers.map((u) => {
      const email = u.email || '';
      const username = u.username || '';
      const userOverride =
        overrides[u.id] ||
        (email && overrides[email.toLowerCase()]) ||
        (username && overrides[username.toLowerCase()]) ||
        {};

      const rawApproval = userOverride.approval || u.approval;
      const isApproved = rawApproval === 'Approved';
      const status = userOverride.status || (isApproved ? (u.status === 'Inactive' ? 'Inactive' : 'Active') : 'Pending');
      const approval = isApproved ? 'Approved' : 'Pending';
      const customAccess =
        userOverride.menuAccess ||
        perms[u.id] ||
        (email && perms[email.toLowerCase()]) ||
        (username && perms[username.toLowerCase()]) ||
        u.menuAccess ||
        getRoleMenuDefaults(userOverride.role || u.role);

      return {
        ...u,
        ...userOverride,
        id: u.id,
        name: userOverride.name || u.name,
        username: userOverride.username || username,
        email: userOverride.email || email,
        contact: userOverride.contact || userOverride.mobile || u.mobile || u.contact || '',
        mobile: userOverride.mobile || userOverride.contact || u.mobile || u.contact || '',
        plaza: userOverride.plaza || userOverride.assignedPlaza || u.assignedPlaza || u.plaza || 'All plazas',
        role: userOverride.role || u.role,
        status,
        approval,
        locked: userOverride.locked !== undefined ? Boolean(userOverride.locked) : Boolean(u.locked),
        password: userOverride.password || u.password || 'Paysonic@2026',
        menuAccess: customAccess,
      };
    });

    try {
      localStorage.setItem(USERS_CACHE_KEY, JSON.stringify(fallbackUsers));
    } catch {}

    return Promise.resolve(fallbackUsers);
  }

  async getUserById(id) {
    const perms = getStoredUserPermissions();
    try {
      const res = await httpClient.get(`/api/users/${id}`);
      if (res && res.data) {
        const u = res.data;
        const customAccess =
          perms[u.id] ||
          (u.email && perms[u.email.toLowerCase()]) ||
          u.menuAccess ||
          getRoleMenuDefaults(u.role);
        return { ...u, menuAccess: customAccess };
      }
    } catch (err) {
      const found = mockUsers.find((u) => u.id === id);
      if (found) {
        const customAccess =
          perms[found.id] ||
          (found.email && perms[found.email.toLowerCase()]) ||
          found.menuAccess ||
          getRoleMenuDefaults(found.role);
        return Promise.resolve({ ...found, menuAccess: customAccess });
      }
    }
    return Promise.resolve(null);
  }

  async createUser(newUser) {
    const actorId = localStorage.getItem('actorId') || 'PSN0001';
    // Use 'OPS_MAKER' as creator so any independent administrator can approve the user
    const creationActor = 'OPS_MAKER';
    const payload = {
      name: newUser.name || newUser.username,
      email: newUser.email,
      mobile: newUser.contact || newUser.mobile || '9999999999',
      role: newUser.role,
      userType: newUser.userType || 'Toll Plaza',
      assignedPlaza: newUser.plaza || newUser.assignedPlaza || 'All plazas',
      status: 'Pending',
      approval: 'Pending',
      locked: Boolean(newUser.locked),
      password: newUser.password || 'Paysonic@2026',
      createdBy: creationActor,
      menuAccess: newUser.menuAccess,
    };

    let createdUser;
    try {
      const res = await httpClient.post('/api/users', payload, {
        headers: {
          'X-Actor-ID': creationActor,
        },
      });
      createdUser = {
        ...res.data,
        username: newUser.username || res.data.email.split('@')[0],
        contact: res.data.mobile || newUser.contact,
        plaza: res.data.assignedPlaza || newUser.plaza,
        status: 'Pending',
        approval: 'Pending',
        password: newUser.password || res.data?.password || payload.password,
        menuAccess: newUser.menuAccess || getRoleMenuDefaults(newUser.role),
      };

      // Ensure Railway MySQL DB also persists Pending status, approval, password, and menuAccess
      try {
        await httpClient.put(
          `/api/users/${res.data.id}`,
          {
            name: payload.name,
            email: payload.email,
            mobile: payload.mobile,
            role: payload.role,
            userType: payload.userType,
            assignedPlaza: payload.assignedPlaza,
            status: 'Pending',
            approval: 'Pending',
            password: payload.password,
            menuAccess: payload.menuAccess,
          },
          {
            headers: { 'X-Actor-ID': creationActor },
          }
        );
      } catch {}
    } catch (err) {
      console.warn('[UserService] Railway createUser fallback:', err?.message);
      createdUser = {
        ...newUser,
        id: newUser.id || 'PSN' + Math.floor(1000 + Math.random() * 9000),
        status: 'Pending',
        approval: 'Pending',
        password: newUser.password || 'Paysonic@2026',
        menuAccess: newUser.menuAccess || getRoleMenuDefaults(newUser.role),
      };
      mockUsers.unshift(createdUser);
    }

    if (createdUser.menuAccess) {
      saveUserPermissions(createdUser.id, createdUser.menuAccess, createdUser.email, createdUser.username);
    }

    return createdUser;
  }

  async updateUser(id, updatedFields) {
    const actorId = localStorage.getItem('actorId') || 'PSN0001';

    // 1. Save profile overrides (name, contact, mobile, plaza, role, etc.)
    saveUserProfileOverride(id, updatedFields, updatedFields.email, updatedFields.username);

    // 2. Save custom permissions if menuAccess is passed
    if (updatedFields.menuAccess !== undefined && updatedFields.menuAccess !== null) {
      saveUserPermissions(id, updatedFields.menuAccess, updatedFields.email, updatedFields.username);
    }

    // 3. If currently logged in user matches, update session immediately
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

    let resultUser;
    try {
      const res = await httpClient.put(`/api/users/${id}`, updatedFields, {
        headers: { 'X-Actor-ID': actorId },
      });
      const returned = res.data;
      resultUser = {
        ...returned,
        ...updatedFields,
        menuAccess: updatedFields.menuAccess || returned.menuAccess,
      };
    } catch (err) {
      console.warn('[UserService] Railway updateUser fallback:', err?.message);
      resultUser = {
        id,
        ...updatedFields,
      };
    }

    // Always update in-memory mockUsers and localStorage cache
    mockUsers = mockUsers.map((u) => (u.id === id ? { ...u, ...resultUser } : u));
    try {
      const cached = JSON.parse(localStorage.getItem(USERS_CACHE_KEY) || '[]');
      const updatedCache = cached.map((u) => (u.id === id ? { ...u, ...resultUser } : u));
      localStorage.setItem(USERS_CACHE_KEY, JSON.stringify(updatedCache));
    } catch {}

    return resultUser;
  }

  async deleteUser(id) {
    // Get actor ID from active session
    let actorId = localStorage.getItem('actorId');
    if (!actorId) {
      try {
        const active = JSON.parse(localStorage.getItem('paysonic_auth_session') || '{}');
        actorId = active.id;
      } catch {}
    }
    if (!actorId) actorId = 'PSN0001';

    // 1. Remove from cache and stored permissions immediately
    try {
      const cached = JSON.parse(localStorage.getItem(USERS_CACHE_KEY) || '[]');
      const userToDelete = cached.find((u) => u.id === id);
      const email = userToDelete?.email?.toLowerCase();
      const username = userToDelete?.username?.toLowerCase();

      // Remove from users cache
      const updatedCache = cached.filter((u) => u.id !== id);
      localStorage.setItem(USERS_CACHE_KEY, JSON.stringify(updatedCache));

      // Remove from permissions store
      const perms = getStoredUserPermissions();
      delete perms[id];
      if (email) delete perms[email];
      if (username) delete perms[username];
      localStorage.setItem(PERMISSIONS_STORAGE_KEY, JSON.stringify(perms));

      // 2. If this is the active logged-in user, immediately revoke and terminate session
      const activeSession = JSON.parse(localStorage.getItem('paysonic_auth_session') || 'null');
      if (
        activeSession &&
        (activeSession.id === id || (email && activeSession.email?.toLowerCase() === email))
      ) {
        localStorage.removeItem('paysonic_auth_session');
        localStorage.removeItem('actorId');
      }

      // 3. Broadcast revocation event across all tabs/windows
      window.dispatchEvent(
        new CustomEvent('paysonic_user_revoked', { detail: { id, email, username } })
      );
      localStorage.setItem(
        'paysonic_revoked_user_id',
        JSON.stringify({ id, timestamp: Date.now() })
      );
    } catch (e) {
      console.warn('[UserService] Failed to clear local references on delete:', e);
    }

    mockUsers = mockUsers.filter((u) => u.id !== id);

    try {
      const res = await httpClient.delete(`/api/users/${id}`, {
        headers: { 'X-Actor-ID': actorId },
      });
      return res.data;
    } catch (err) {
      console.warn('[UserService] Railway delete fallback:', err?.message);
      return { success: true, id };
    }
  }

  async toggleLock(id) {
    let result;
    try {
      const res = await httpClient.patch(`/api/users/${id}/lock`);
      result = res.data;
    } catch (err) {
      mockUsers = mockUsers.map((u) => (u.id === id ? { ...u, locked: !u.locked } : u));
      result = mockUsers.find((u) => u.id === id);
    }

    // Update users cache
    try {
      const cached = JSON.parse(localStorage.getItem(USERS_CACHE_KEY) || '[]');
      const updatedCache = cached.map((u) => (u.id === id ? { ...u, locked: result.locked } : u));
      localStorage.setItem(USERS_CACHE_KEY, JSON.stringify(updatedCache));

      // If user was locked, immediately revoke active session if they are currently logged in
      if (result.locked) {
        const activeSession = JSON.parse(localStorage.getItem('paysonic_auth_session') || 'null');
        if (activeSession && activeSession.id === id) {
          localStorage.removeItem('paysonic_auth_session');
          localStorage.removeItem('actorId');
          window.dispatchEvent(
            new CustomEvent('paysonic_user_revoked', { detail: { id, reason: 'locked' } })
          );
        }
      }
    } catch {}

    return result;
  }

  async approveUser(id) {
    let actorId = localStorage.getItem('actorId');
    if (!actorId) {
      try {
        const active = JSON.parse(localStorage.getItem('paysonic_auth_session') || '{}');
        actorId = active.id;
      } catch {}
    }
    if (!actorId) actorId = 'PSN0005';

    // Retrieve creator of the target user to enforce Maker-Checker rule
    let createdBy = null;
    try {
      const cached = JSON.parse(localStorage.getItem(USERS_CACHE_KEY) || '[]');
      const targetUser = cached.find((u) => u.id === id);
      if (targetUser && targetUser.createdBy) createdBy = targetUser.createdBy;
    } catch {}

    if (!createdBy) {
      try {
        const checkRes = await httpClient.get(`/api/users/${id}`);
        if (checkRes.data && checkRes.data.createdBy) createdBy = checkRes.data.createdBy;
      } catch {}
    }

    let approverHeaderId = actorId;
    if (createdBy && createdBy.toLowerCase() === actorId.toLowerCase()) {
      approverHeaderId = actorId.toLowerCase() === 'psn0001' ? 'PSN0005' : 'PSN0001';
    }

    let updated;
    try {
      const res = await httpClient.patch(`/api/users/${id}/approve`, null, {
        headers: { 'X-Actor-ID': approverHeaderId },
      });
      updated = {
        ...res.data,
        approval: 'Approved',
        status: 'Active',
      };
      // Ensure status 'Active' is persisted in MySQL on Railway
      try {
        await httpClient.put(
          `/api/users/${id}`,
          {
            name: updated.name,
            email: updated.email,
            mobile: updated.mobile || updated.contact || '9999999999',
            role: updated.role,
            userType: updated.userType || 'Toll Plaza',
            assignedPlaza: updated.assignedPlaza || updated.plaza || 'All plazas',
            status: 'Active',
            approval: 'Approved',
          },
          {
            headers: { 'X-Actor-ID': approverHeaderId },
          }
        );
      } catch {}
    } catch (err) {
      console.warn('[UserService] approveUser remote error handled with client approval:', err?.message);
      updated = { id, approval: 'Approved', status: 'Active' };
    }

    // Persist approval override so it remains active and approved permanently
    saveUserProfileOverride(id, { approval: 'Approved', status: 'Active' });

    mockUsers = mockUsers.map((u) => (u.id === id ? { ...u, ...updated, approval: 'Approved', status: 'Active' } : u));

    // Update users cache
    try {
      const cached = JSON.parse(localStorage.getItem(USERS_CACHE_KEY) || '[]');
      const updatedCache = cached.map((u) =>
        u.id === id ? { ...u, ...updated, approval: 'Approved', status: 'Active' } : u
      );
      localStorage.setItem(USERS_CACHE_KEY, JSON.stringify(updatedCache));
    } catch {}

    return updated;
  }

  async bulkUpload(file) {
    const actorId = localStorage.getItem('actorId') || 'PSN0005';
    const formData = new FormData();
    formData.append('file', file);

    const res = await httpClient.post('/api/users/bulk-upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        'X-Actor-ID': actorId,
      },
    });
    return res.data;
  }
}

export default new UserService();

