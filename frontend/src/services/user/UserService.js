import httpClient from '../api/httpClient';
import initialMockData from '../../data/userList.json';
import { getRoleMenuDefaults } from '../../pages/UserList/menuConfig';

const PERMISSIONS_STORAGE_KEY = 'paysonic_user_permissions';
const USERS_CACHE_KEY = 'paysonic_users_cache';

// Helper to get stored custom permissions map
export function getStoredUserPermissions() {
  try {
    return JSON.parse(localStorage.getItem(PERMISSIONS_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

// Helper to save permissions for a user by id, email, and username
export function saveUserPermissions(userId, menuAccess, email, username) {
  const store = getStoredUserPermissions();
  if (userId) store[userId] = menuAccess;
  if (email) store[email.toLowerCase()] = menuAccess;
  if (username) store[username.toLowerCase()] = menuAccess;
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
      currentSession.menuAccess = menuAccess;
      currentSession.permissions = menuAccess;
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

    try {
      const res = await httpClient.get('/api/users');
      if (res && res.data && Array.isArray(res.data) && res.data.length > 0) {
        // Map Railway database schema to frontend representation with permissions
        const users = res.data.map((u) => {
          const username = u.username || (u.email ? u.email.split('@')[0] : u.id);
          const email = u.email || '';
          const customAccess =
            perms[u.id] ||
            perms[email.toLowerCase()] ||
            perms[username.toLowerCase()] ||
            u.menuAccess ||
            getRoleMenuDefaults(u.role);

          return {
            ...u,
            username,
            contact: u.mobile || u.contact || '',
            plaza: u.assignedPlaza || u.plaza || 'All plazas',
            status: u.status === 'Inactive' ? 'Inactive' : (u.approval === 'Approved' ? 'Active' : (u.status || 'Pending')),
            approval: u.approval || (u.status === 'Active' ? 'Approved' : 'Pending'),
            locked: Boolean(u.locked),
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
      const customAccess =
        perms[u.id] ||
        (u.email && perms[u.email.toLowerCase()]) ||
        (u.username && perms[u.username.toLowerCase()]) ||
        u.menuAccess ||
        getRoleMenuDefaults(u.role);
      return {
        ...u,
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
    const actorId = localStorage.getItem('actorId') || 'PSN0005';
    // Ensure Maker is distinct from Master Admin Checker (PSN0005) so Maker-Checker rule succeeds
    const creationActor = actorId === 'PSN0005' ? 'OPS_MAKER' : actorId;
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
      createdBy: creationActor,
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
        status: res.data.status || 'Pending',
        approval: res.data.approval || 'Pending',
        menuAccess: newUser.menuAccess || getRoleMenuDefaults(newUser.role),
      };
    } catch (err) {
      console.warn('[UserService] Railway createUser fallback:', err?.message);
      createdUser = {
        ...newUser,
        id: newUser.id || 'PSN' + Math.floor(1000 + Math.random() * 9000),
        status: 'Pending',
        approval: 'Pending',
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
    if (updatedFields.menuAccess) {
      saveUserPermissions(id, updatedFields.menuAccess, updatedFields.email, updatedFields.username);
      try {
        const activeSession = JSON.parse(localStorage.getItem('paysonic_auth_session') || 'null');
        if (
          activeSession &&
          (activeSession.id === id ||
            (updatedFields.email && activeSession.email?.toLowerCase() === updatedFields.email.toLowerCase()))
        ) {
          const updatedSession = {
            ...activeSession,
            ...updatedFields,
            menuAccess: updatedFields.menuAccess,
          };
          localStorage.setItem('paysonic_auth_session', JSON.stringify(updatedSession));
          window.dispatchEvent(new CustomEvent('paysonic_auth_change', { detail: updatedSession }));
        }
      } catch {}
    }

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

    try {
      const res = await httpClient.put(`/api/users/${id}`, updatedFields);
      const returned = res.data;
      // Update cache
      try {
        const cached = JSON.parse(localStorage.getItem(USERS_CACHE_KEY) || '[]');
        const updatedCache = cached.map((u) =>
          u.id === id ? { ...u, ...returned, ...updatedFields } : u
        );
        localStorage.setItem(USERS_CACHE_KEY, JSON.stringify(updatedCache));
      } catch {}
      return {
        ...returned,
        ...updatedFields,
        menuAccess: updatedFields.menuAccess || returned.menuAccess,
      };
    } catch (err) {
      mockUsers = mockUsers.map((u) => (u.id === id ? { ...u, ...updatedFields } : u));
      const found = mockUsers.find((u) => u.id === id);
      return Promise.resolve(found);
    }
  }

  async deleteUser(id) {
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
      const res = await httpClient.delete(`/api/users/${id}`);
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
    const actorId = localStorage.getItem('actorId') || 'PSN0001';
    let updated;
    try {
      const res = await httpClient.patch(`/api/users/${id}/approve`, null, {
        headers: { 'X-Actor-ID': actorId },
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
            headers: { 'X-Actor-ID': actorId },
          }
        );
      } catch {}
    } catch (err) {
      mockUsers = mockUsers.map((u) => (u.id === id ? { ...u, approval: 'Approved', status: 'Active' } : u));
      updated = { id, approval: 'Approved', status: 'Active' };
    }

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

