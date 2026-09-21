/**
 * Environment configuration
 *
 * VITE_APP_MODE=dev   → uses local mock JSON files (no backend needed)
 * VITE_APP_MODE=prod  → calls live Spring Boot API
 *
 * In production builds (npm run build), Vite sets MODE='production'
 * which auto-sets IS_DEV_MODE=false so the backend is always called.
 */
const viteMode = import.meta.env.VITE_APP_MODE;
const isViteProd = import.meta.env.PROD; // true when built with `npm run build`

export const IS_DEV_MODE = viteMode === 'dev' || (!viteMode && !isViteProd);

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

export default { IS_DEV_MODE, API_BASE_URL };
