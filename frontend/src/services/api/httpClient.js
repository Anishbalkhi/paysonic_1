import axios from 'axios';

const apiBaseUrl =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
  (typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_BASE_URL) ||
  'https://paysonic-1.onrender.com';

const httpClient = axios.create({
  baseURL: apiBaseUrl,
  timeout: 30000,
});

httpClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token') || 'mock-admin-token';
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const corrId = `CORR-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(100 + Math.random() * 900)}`;
  if (!config.headers['X-Correlation-ID']) {
    config.headers['X-Correlation-ID'] = corrId;
  }
  if (!config.headers['X-Actor-ID']) {
    config.headers['X-Actor-ID'] = localStorage.getItem('actorId') || 'PSN0005';
  }

  return config;
});

httpClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 429) {
      const retryAfter =
        err.response.headers?.['retry-after'] ||
        err.response.data?.retryAfter ||
        60;
      const message =
        err.response.data?.message ||
        `Rate limit exceeded. Please wait ${retryAfter} seconds before trying again.`;

      try {
        window.dispatchEvent(
          new CustomEvent('paysonic_rate_limit_exceeded', {
            detail: {
              retryAfter: parseInt(retryAfter, 10) || 60,
              message,
              url: err.config?.url,
            },
          })
        );
      } catch {}
    }
    console.warn('[HTTP Client Error]', err?.response?.data || err.message);
    return Promise.reject(err);
  }
);

export default httpClient;
