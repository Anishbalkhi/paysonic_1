/**
 * Environment configuration
 *
 * Connects directly to Railway Spring Boot Production Backend
 * Live DB: MySQL / H2 on Railway
 */
export const IS_DEV_MODE =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_APP_MODE === 'dev') ||
  false;

export const API_BASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
  'https://paysonic1-production.up.railway.app';

export default { IS_DEV_MODE, API_BASE_URL };
