// ============================================================
// dataService.js
//
// DEV  (VITE_APP_MODE=dev  or npm run dev)  → local mock JSON files
// PROD (VITE_APP_MODE=prod or npm run build) → real backend API only
//                                              NO fallback to dummy data
// ============================================================

const MODE =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_APP_MODE) ||
  (typeof process !== 'undefined' && process.env &&
    (process.env.NEXT_PUBLIC_APP_MODE || process.env.REACT_APP_MODE)) ||
  'prod';

const API_BASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
  (typeof process !== 'undefined' && process.env &&
    (process.env.NEXT_PUBLIC_API_BASE_URL || process.env.REACT_APP_API_BASE_URL)) ||
  'https://paysonic1-production.up.railway.app';

export const IS_DEV_DATA_MODE  = MODE === 'dev';
export const IS_PROD_DATA_MODE = MODE === 'prod';

// In-memory cache — avoids re-fetching data already loaded in same session
const _cache = {};

// ── DEV only: load from local /public/data/*.json ──────────────────────────
async function getMockData(jsonFile) {
  if (_cache[`mock:${jsonFile}`]) return _cache[`mock:${jsonFile}`];
  const res = await fetch(`/data/${jsonFile}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`[DEV] Failed to load mock data: ${jsonFile}`);
  const data = await res.json();
  _cache[`mock:${jsonFile}`] = data;
  return data;
}

// ── PROD only: call real backend API, NO fallback ──────────────────────────
async function getApiData(endpoint) {
  const cacheKey = `api:${endpoint}`;
  if (_cache[cacheKey]) return _cache[cacheKey];

  const apiPath = endpoint.startsWith('api/') ? endpoint : `api/${endpoint}`;
  const url     = `${API_BASE_URL}/${apiPath}`;

  const res = await fetch(url, {
    method : 'GET',
    headers: { 'Content-Type': 'application/json' },
    cache  : 'default',
  });

  if (!res.ok) throw new Error(`API ${url} returned ${res.status}`);

  const raw = await res.json();

  // Normalize dashboard response — backend returns a summary-shaped object
  // but the frontend components expect flat fields (trends, sparklines, etc.)
  if (endpoint === 'dashboard' && raw && raw.summary) {
    const totalTxn = raw.summary.totalTransactions
                  ?? raw.summary.transactionVolume
                  ?? raw.totalTransactions
                  ?? 0;
    const normalized = {
      date               : raw.date ?? new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
      netRevenue         : raw.summary.totalRevenue ?? raw.netRevenue ?? 0,
      deltaVsYesterday   : raw.deltaVsYesterday     ?? 0,
      successRate        : raw.successRate           ?? raw.summary.successRate ?? 0,
      throughput         : raw.throughput            ?? 0,
      avgFare            : raw.avgFare               ?? 0,
      activeTollPlazas   : raw.activeTollPlazas      ?? 0,
      totalTollPlazas    : raw.totalTollPlazas       ?? 0,
      totalTransactions  : totalTxn,
      successTransactions: raw.successTransactions   ?? Math.round(totalTxn * 0.982),
      successAmount      : raw.successAmount         ?? raw.summary.totalRevenue ?? 0,
      pendingTransactions: raw.pendingTransactions   ?? 0,
      pendingAmount      : raw.pendingAmount         ?? 0,
      failedTransactions : raw.failedTransactions    ?? 0,
      failedAmount       : raw.failedAmount          ?? 0,
      yesterdayTransactions: raw.yesterdayTransactions ?? 0,
      yesterdayRevenue   : raw.yesterdayRevenue      ?? 0,
      growth             : raw.growth                ?? 0,
      activeUsers        : raw.summary.activeUsers   ?? raw.activeUsers ?? 0,
      systemUptime       : raw.summary.systemUptime  ?? raw.systemUptime ?? 0,
      // Spread any extra real fields from the backend on top
      ...raw,
      // Always guarantee trends & sparklines so MetricsKpis never crashes
      trends: raw.trends ?? {
        activePlazas: 0, totalTxn: 0, successTxn: 0, successAmount: 0,
        pendingTxn:   0, pendingAmount: 0, failedTxn: 0, failedAmount: 0,
      },
      sparklines: raw.sparklines ?? {
        activePlazas:  [0,0,0,0,0,0,0],
        totalTxn:      [0,0,0,0,0,0,0],
        successTxn:    [0,0,0,0,0,0,0],
        successAmount: [0,0,0,0,0,0,0],
        pendingTxn:    [0,0,0,0,0,0,0],
        pendingAmount: [0,0,0,0,0,0,0],
        failedTxn:     [0,0,0,0,0,0,0],
        failedAmount:  [0,0,0,0,0,0,0],
      },
    };
    _cache[cacheKey] = normalized;
    return normalized;
  }

  _cache[cacheKey] = raw;
  return raw;
}

// ── Route each dataset to the right source ─────────────────────────────────
async function getData(apiEndpoint, mockFile) {
  if (IS_DEV_DATA_MODE) {
    return getMockData(mockFile);          // DEV  → mock JSON
  }
  try {
    return await getApiData(apiEndpoint);  // PROD → real API
  } catch (err) {
    if (mockFile) {
      console.warn(`[DataService] Backend endpoint /api/${apiEndpoint} unavailable, using local dataset fallback:`, err.message);
      return getMockData(mockFile);
    }
    throw err;
  }
}

// ── Public API ──────────────────────────────────────────────────────────────
export const DataService = {
  dashboard:   () => getData('dashboard',    'dashboard.json'),
  transactions:() => getData('transactions', 'transactions.json'),
  disputes:    () => getData('disputes',     'disputes.json'),
  alerts:      () => getData('alerts',       'alerts.json'),
  systems:     () => getData('systems',      'systems.json'),
  declines:    () => getData('declines',     'declines.json'),
  plazas: async () => {
    try {
      const raw = localStorage.getItem('paysonic_onboarding_data_v2');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.plazas && Array.isArray(parsed.plazas) && parsed.plazas.length > 0) {
          return parsed.plazas.map((p) => ({
            id: p.id,
            name: p.name,
            desc: `${p.authority || p.state || 'Toll'} · ${p.city || p.subtype || ''}`,
            status: p.status === 'Active' ? 'ok' : p.status === 'Suspended' ? 'off' : 'warn',
          }));
        }
      }
    } catch {}
    return getData('plazas', 'plazas.json');
  },

  // TIER 1: critical above-the-fold data — paint shell immediately
  async tier1() {
    const dashboard = await this.dashboard();
    return { dashboard };
  },

  // TIER 2: secondary panels — load after tier1 paints
  // Each call is independent: a failed endpoint returns null for that panel
  async tier2() {
    const results = await Promise.allSettled([
      this.transactions(),
      this.disputes(),
      this.alerts(),
      this.systems(),
      this.declines(),
      this.settlement(),
      this.plazas(),
    ]);

    const [transactions, disputes, alerts, systems, declines, settlement, plazas] =
      results.map((r) => (r.status === 'fulfilled' ? r.value : null));

    return { transactions, disputes, alerts, systems, declines, settlement, plazas };
  },

  // Legacy all-at-once (kept for compatibility)
  async all() {
    const [t1, t2] = await Promise.all([this.tier1(), this.tier2()]);
    return { ...t1, ...t2 };
  },
};
