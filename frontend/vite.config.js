import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  // Support both VITE_ prefix (standard) and legacy REACT_APP_ prefix
  const appMode =
    env.VITE_APP_MODE ||
    env.REACT_APP_MODE ||
    env.NEXT_PUBLIC_APP_MODE ||
    (mode === 'production' ? 'prod' : 'dev');

  const apiBaseUrl =
    env.VITE_API_BASE_URL ||
    env.REACT_APP_API_BASE_URL ||
    env.NEXT_PUBLIC_API_BASE_URL ||
    (mode === 'production' ? '' : 'http://localhost:8080');

  return {
    plugins: [react()],

    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        'next/script': path.resolve(__dirname, './src/shims/next-script.jsx'),
      },
    },

    // In production on same-domain Nginx, apiBaseUrl is empty — relative paths used
    define: {
      'process.env.REACT_APP_MODE': JSON.stringify(appMode),
      'process.env.REACT_APP_API_BASE_URL': JSON.stringify(apiBaseUrl),
      'process.env.NEXT_PUBLIC_APP_MODE': JSON.stringify(appMode),
      'process.env.NEXT_PUBLIC_API_BASE_URL': JSON.stringify(apiBaseUrl),
      'process.env': {
        REACT_APP_MODE: appMode,
        REACT_APP_API_BASE_URL: apiBaseUrl,
        NEXT_PUBLIC_APP_MODE: appMode,
        NEXT_PUBLIC_API_BASE_URL: apiBaseUrl,
      },
    },

    // Dev server proxy — avoids CORS when running locally
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: env.VITE_API_BASE_URL || 'https://paysonic1-production.up.railway.app',
          changeOrigin: true,
          secure: false,
        },
      },
    },

    build: {
      outDir: 'dist',
      sourcemap: false,
      rollupOptions: {
        output: {
          // Split vendor code for better caching
      manualChunks(id) {
            if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router')) {
              return 'vendor';
            }
            if (id.includes('node_modules/recharts')) {
              return 'charts';
            }
            if (id.includes('node_modules/axios')) {
              return 'http';
            }
          },
        },
      },
    },

    css: {
      preprocessorOptions: {
        scss: {
          api: 'modern-compiler',
          silenceDeprecations: ['import'],
        },
      },
    },
  };
});
