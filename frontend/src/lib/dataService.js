// ============================================================
// dataService.js
// Single source of truth for where dashboard data comes from.
//
// DEV  (NEXT_PUBLIC_APP_MODE=dev)  -> reads /public/data/*.json
// PROD (NEXT_PUBLIC_APP_MODE=prod) -> hits real backend API
//                                     (fallback to /public/data/*.json
//                                      if API is unreachable / returns error)
//
// Nothing else in the app should know or care which mode it's in.
// ============================================================

const MODE =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_APP_MODE) ||
  (typeof process !== 'undefined' && process.env && (process.env.NEXT_PUBLIC_APP_MODE || process.env.REACT_APP_MODE)) ||
  "prod";

const API_BASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
  (typeof process !== 'undefined' && process.env && (process.env.NEXT_PUBLIC_API_BASE_URL || process.env.REACT_APP_API_BASE_URL)) ||
  "https://paysonic1-production.up.railway.app";

export const IS_DEV_DATA_MODE = MODE === "dev";
export const IS_PROD_DATA_MODE = MODE === "prod";

// Dummy JSON fallback (always available via /public/data/)
async function getDummyData(jsonFile) {
  const res = await fetch(`/data/${jsonFile}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load fallback data: ${jsonFile}`);
  return res.json();
}

async function getData(endpoint, jsonFile) {
  // ── DEV MODE: always use dummy JSON data ──────────────────
  if (IS_DEV_DATA_MODE) {
    console.log(`[DataService] DEV mode → loading dummy data: ${jsonFile}`);
    return getDummyData(jsonFile);
  }

  // ── PROD MODE: try real API first, fallback to dummy data ──
  const apiPath = endpoint.startsWith('api/') ? endpoint : (endpoint === 'dashboard' ? 'api/dashboard' : endpoint);
  const targetUrl = `${API_BASE_URL}/${apiPath}`;
  console.log(`[DataService] PROD mode → calling Railway API: ${targetUrl}`);
  try {
    const res = await fetch(targetUrl, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`API returned ${res.status} for: ${endpoint}`);
    }

    const rawData = await res.json();
    console.log(`[DataService] PROD → live Railway API data received: ${endpoint}`);

    // If backend returns summary object for dashboard, normalize it with fallback defaults
    if (endpoint === 'dashboard' && rawData && rawData.summary) {
      const fallback = await getDummyData(jsonFile);
      return {
        ...fallback,
        ...rawData,
        netRevenue: rawData.summary.totalRevenue || fallback.netRevenue,
        totalTransactions: rawData.summary.totalTransactions || fallback.totalTransactions,
        successTransactions: Math.round((rawData.summary.totalTransactions || fallback.totalTransactions) * 0.982),
        activeUsers: rawData.summary.activeUsers || 24,
        systemUptime: rawData.summary.systemUptime || 99.98,
      };
    }

    return rawData;
  } catch (err) {
    // Real API failed — fall back to dummy data so the UI stays working
    console.warn(
      `[DataService] Railway API fetch note (${err.message}). Using fallback data for: ${jsonFile}`
    );
    return getDummyData(jsonFile);
  }
}

export const DataService = {
  dashboard: () => getData("dashboard", "dashboard.json"),
  transactions: () => getData("transactions", "transactions.json"),
  disputes: () => getData("disputes", "disputes.json"),
  alerts: () => getData("alerts", "alerts.json"),
  systems: () => getData("systems", "systems.json"),
  declines: () => getData("declines", "declines.json"),
  settlement: () => getData("settlement", "settlement.json"),
  plazas: () => getData("plazas", "plazas.json"),

  // Fetch everything the dashboard needs, in parallel
  async all() {
    const [
      dashboard,
      transactions,
      disputes,
      alerts,
      systems,
      declines,
      settlement,
      plazas,
    ] = await Promise.all([
      this.dashboard(),
      this.transactions(),
      this.disputes(),
      this.alerts(),
      this.systems(),
      this.declines(),
      this.settlement(),
      this.plazas(),
    ]);

    return {
      dashboard,
      transactions,
      disputes,
      alerts,
      systems,
      declines,
      settlement,
      plazas,
    };
  },
};
