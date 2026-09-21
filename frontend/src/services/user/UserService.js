import httpClient from '../api/httpClient';
import { IS_DEV_MODE } from '../config/env';
import initialMockData from '../../data/userList.json';

// In-memory store for active session mutations
let mockUsers = [...initialMockData];

class UserService {
  async getUsers() {
    if (IS_DEV_MODE) {
      return Promise.resolve([...mockUsers]);
    }
    const res = await httpClient.get('/api/users');
    return res.data;
  }

  async getUserById(id) {
    if (IS_DEV_MODE) {
      return Promise.resolve(mockUsers.find((u) => u.id === id));
    }
    const res = await httpClient.get(`/api/users/${id}`);
    return res.data;
  }

  async createUser(newUser) {
    if (IS_DEV_MODE) {
      mockUsers.unshift(newUser);
      return Promise.resolve(newUser);
    }
    const res = await httpClient.post('/api/users', newUser);
    return res.data;
  }

  async updateUser(id, updatedFields) {
    if (IS_DEV_MODE) {
      mockUsers = mockUsers.map((u) => (u.id === id ? { ...u, ...updatedFields } : u));
      return Promise.resolve(mockUsers.find((u) => u.id === id));
    }
    const res = await httpClient.put(`/api/users/${id}`, updatedFields);
    return res.data;
  }

  async deleteUser(id) {
    if (IS_DEV_MODE) {
      mockUsers = mockUsers.filter((u) => u.id !== id);
      return Promise.resolve({ success: true, id });
    }
    const res = await httpClient.delete(`/api/users/${id}`);
    return res.data;
  }

  async toggleLock(id) {
    if (IS_DEV_MODE) {
      mockUsers = mockUsers.map((u) => (u.id === id ? { ...u, locked: !u.locked } : u));
      return Promise.resolve(mockUsers.find((u) => u.id === id));
    }
    const res = await httpClient.patch(`/api/users/${id}/lock`);
    return res.data;
  }

  async approveUser(id) {
    if (IS_DEV_MODE) {
      mockUsers = mockUsers.map((u) => (u.id === id ? { ...u, approval: 'Approved' } : u));
      return Promise.resolve(mockUsers.find((u) => u.id === id));
    }
    const res = await httpClient.patch(`/api/users/${id}/approve`);
    return res.data;
  }
}

export default new UserService();
