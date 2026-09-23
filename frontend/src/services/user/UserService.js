import httpClient from '../api/httpClient';
import initialMockData from '../../data/userList.json';

// In-memory fallback if Railway API is temporarily unreachable
let mockUsers = [...initialMockData];

class UserService {
  async getUsers() {
    try {
      const res = await httpClient.get('/api/users');
      if (res && res.data && Array.isArray(res.data) && res.data.length > 0) {
        // Map Railway database schema to frontend representation
        return res.data.map((u) => ({
          ...u,
          username: u.username || (u.email ? u.email.split('@')[0] : u.id),
          contact: u.mobile || u.contact || '',
          plaza: u.assignedPlaza || u.plaza || 'All plazas',
          status: u.status || 'Active',
          approval: u.approval || 'Approved',
          locked: Boolean(u.locked),
        }));
      }
    } catch (err) {
      console.warn('[UserService] Railway API unreachable, using local fallback:', err?.message);
    }
    return Promise.resolve([...mockUsers]);
  }

  async getUserById(id) {
    try {
      const res = await httpClient.get(`/api/users/${id}`);
      return res.data;
    } catch (err) {
      return Promise.resolve(mockUsers.find((u) => u.id === id));
    }
  }

  async createUser(newUser) {
    const actorId = localStorage.getItem('actorId') || 'PSN0005';
    const payload = {
      name: newUser.name || newUser.username,
      email: newUser.email,
      mobile: newUser.contact || newUser.mobile || '9999999999',
      role: newUser.role,
      userType: newUser.userType || 'Toll Plaza',
      assignedPlaza: newUser.plaza || newUser.assignedPlaza || 'All plazas',
      status: newUser.status || 'Active',
      approval: newUser.approval || 'Pending',
      locked: Boolean(newUser.locked),
      createdBy: actorId,
    };

    try {
      const res = await httpClient.post('/api/users', payload, {
        headers: {
          'X-Actor-ID': actorId,
        },
      });
      return {
        ...res.data,
        username: newUser.username || res.data.email.split('@')[0],
        contact: res.data.mobile || newUser.contact,
        plaza: res.data.assignedPlaza || newUser.plaza,
      };
    } catch (err) {
      console.warn('[UserService] Railway createUser fallback:', err?.message);
      const fallbackUser = {
        ...newUser,
        id: newUser.id || 'PSN' + Math.floor(1000 + Math.random() * 9000),
      };
      mockUsers.unshift(fallbackUser);
      return fallbackUser;
    }
  }

  async updateUser(id, updatedFields) {
    try {
      const res = await httpClient.put(`/api/users/${id}`, updatedFields);
      return res.data;
    } catch (err) {
      mockUsers = mockUsers.map((u) => (u.id === id ? { ...u, ...updatedFields } : u));
      return Promise.resolve(mockUsers.find((u) => u.id === id));
    }
  }

  async deleteUser(id) {
    try {
      const res = await httpClient.delete(`/api/users/${id}`);
      return res.data;
    } catch (err) {
      mockUsers = mockUsers.filter((u) => u.id !== id);
      return Promise.resolve({ success: true, id });
    }
  }

  async toggleLock(id) {
    try {
      const res = await httpClient.patch(`/api/users/${id}/lock`);
      return res.data;
    } catch (err) {
      mockUsers = mockUsers.map((u) => (u.id === id ? { ...u, locked: !u.locked } : u));
      return Promise.resolve(mockUsers.find((u) => u.id === id));
    }
  }

  async approveUser(id) {
    const actorId = localStorage.getItem('actorId') || 'PSN0005';
    try {
      const res = await httpClient.patch(`/api/users/${id}/approve`, null, {
        headers: { 'X-Actor-ID': actorId },
      });
      return res.data;
    } catch (err) {
      mockUsers = mockUsers.map((u) => (u.id === id ? { ...u, approval: 'Approved' } : u));
      return Promise.resolve(mockUsers.find((u) => u.id === id));
    }
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
