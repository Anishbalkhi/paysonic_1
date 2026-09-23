import axios from 'axios';

const apiBaseUrl =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
  (typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_BASE_URL) ||
  'https://paysonic1-production.up.railway.app';

const httpClient = axios.create({
  baseURL: apiBaseUrl,
  timeout: 15000,
});

httpClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token') || 'mock-admin-token';
  if (token) config.headers.Authorization = `Bearer ${token}`;

  const corrId = `CORR-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(100 + Math.random() * 900)}`;
  config.headers['X-Correlation-ID'] = corrId;
  config.headers['X-Actor-ID'] = localStorage.getItem('actorId') || 'PSN0005';

  return config;
});

httpClient.interceptors.response.use(
  (res) => res,
  (err) => {
    console.warn('[HTTP Client Error]', err?.response?.data || err.message);
    return Promise.reject(err);
  }
);

export default httpClient;
