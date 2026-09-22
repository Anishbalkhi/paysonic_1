"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Script from "next/script";
import { useNavigate } from "react-router-dom";
import { DataService, IS_DEV_DATA_MODE } from "@/lib/dataService";
import { useAuth } from "../context/AuthContext";
import Counter from "./Counter";
import Sparkline from "./Sparkline";
import Sidebar from "./Sidebar/Sidebar";
import WorkstationTerminal from "./WorkstationTerminal/WorkstationTerminal";
import OperationsModal from "./OperationsModal/OperationsModal";
import { getRoleSlug } from "../config/roleMenus";

function inr(n) {
  return Math.round(n).toLocaleString("en-IN");
}

export default function Dashboard() {
  // ---- auth & role state ----
  const { currentUser } = useAuth();
  const userRole = currentUser?.role || 'Master Admin';
  const roleSlug = getRoleSlug(userRole);

  useEffect(() => {
    document.documentElement.setAttribute('data-role', roleSlug);
  }, [roleSlug]);

  // ---- data state (comes from DataService: dev JSON or prod API) ----
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(null);

  // ---- UI state ----
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const saved = localStorage.getItem('paysonic_auth_session');
      if (saved) {
        const u = JSON.parse(saved);
        if (u.role === 'Bank') return 'disputes';
      }
    } catch {}
    return 'metrics';
  }); // metrics | disputes
  const [chartRange, setChartRange] = useState(7);
  const [sysFilter, setSysFilter] = useState("all");
  const [errOpen, setErrOpen] = useState(false);
  const [plazaQuery, setPlazaQuery] = useState("");
  const [alerts, setAlerts] = useState([]);
  const [activeOp, setActiveOp] = useState(null);

  const chartCanvasRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const gantryCanvasRef = useRef(null);
  const [scriptsReady, setScriptsReady] = useState({ chart: false, three: false });

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (window.Chart) setScriptsReady((s) => ({ ...s, chart: true }));
      if (window.THREE) setScriptsReady((s) => ({ ...s, three: true }));
    }
  }, []);

  // ---- Fetch everything through DataService (dev JSON / prod API) ----
  useEffect(() => {
    let cancelled = false;
    DataService.all()
      .then((all) => {
        if (cancelled) return;
        setData(all);
        setAlerts(all.alerts || []);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Dashboard data load failed:", err);
        setLoadError(err.message || "Failed to load dashboard data");
      });

    // 30-second auto refresh, same as the original polling recommendation
    const interval = setInterval(() => {
      DataService.dashboard()
        .then((d) => setData((prev) => (prev ? { ...prev, dashboard: d } : prev)))
        .catch((err) => console.error("Dashboard refresh failed:", err));
    }, 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  function toggleSidebar() {
    if (typeof window !== "undefined" && window.innerWidth <= 860) {
      setMobileOpen((v) => !v);
    } else {
      setCollapsed((v) => !v);
    }
  }

  // Close sidebar when tapping the dark overlay on mobile
  function handleAppClick(e) {
    if (mobileOpen && e.target === e.currentTarget) {
      setMobileOpen(false);
    }
  }

  const appClass = [
    "app-dashboard",
    collapsed ? "collapsed" : "",
    mobileOpen ? "mobile-open" : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (loadError) {
    return (
      <div className="status-msg">
        Dashboard data load nahi ho paaya: {loadError}
        <br />
        Mode: {IS_DEV_DATA_MODE ? "DEV (JSON)" : "PROD (API)"}
      </div>
    );
  }

  if (!data) {
    return <div className="status-msg">Loading dashboard…</div>;
  }

  const d = data.dashboard;
  const disp = data.disputes;

  // Role banner configuration
  const ROLE_BANNER_INFO = {
    'Master Admin': {
      title: 'Master Governance Clearance Active',
      desc: 'Full administrative access across all 5 toll plazas, user provisioning, NPCI clearing, and system configuration.',
      badge: 'Unrestricted Access',
      badgeColor: '#16a34a',
      bg: '#f0fdf4',
      border: '#bbf7d0',
    },
    'Admin': {
      title: 'Operations Manager Console',
      desc: 'Central monitoring for transactions, dispute resolutions, and lane telemetry across all network plazas.',
      badge: 'Ops Management',
      badgeColor: '#2563eb',
      bg: '#eff6ff',
      border: '#bfdbfe',
    },
    'Bank': {
      title: 'Bank Auditor Mode (HDFC Acquirer)',
      desc: 'Settlement cycle reconciliation active. Focus on TRS reports, cycle-wise clearing, and chargeback disputes.',
      badge: 'Financial Audit',
      badgeColor: '#0d9488',
      bg: '#f0fdfa',
      border: '#99f6e4',
    },
    'Concessionaire': {
      title: 'Highway Concessionaire Corridor Mode',
      desc: `Cluster throughput monitoring for ${currentUser?.assignedPlaza || 'Mumbai-Pune Corridor'}. Real-time toll revenue & traffic analytics.`,
      badge: 'Corridor Analytics',
      badgeColor: '#d97706',
      bg: '#fffbeb',
      border: '#fde68a',
    },
    'Plaza Admin': {
      title: `Plaza Supervisor Mode · ${currentUser?.assignedPlaza || 'Local Plaza'}`,
      desc: 'Supervising local lane staff, pass issuances, lane hardware uptime, and daily shift variance.',
      badge: 'Plaza Supervisor',
      badgeColor: '#0284c7',
      bg: '#f0f9ff',
      border: '#bae6fd',
    },
    'Plaza POS': {
      title: `Lane POS Cashier Terminal · ${currentUser?.assignedPlaza || 'Airoli Lane 04'}`,
      desc: 'Active booth station for FASTag verification, vehicle pass issuance, and lane transaction lookup.',
      badge: 'POS Terminal',
      badgeColor: '#ea580c',
      bg: '#fff7ed',
      border: '#fed7aa',
    },
    'Request Tag Details': {
      title: 'FASTag Inquiry & Clearance Agent',
      desc: 'NPCI National Electronic Toll Collection (NETC) registry clearance. Query tag blacklist and account status.',
      badge: 'Inquiry Agent',
      badgeColor: '#7c3aed',
      bg: '#faf5ff',
      border: '#e9d5ff',
    },
  };

  const currentBanner = ROLE_BANNER_INFO[userRole] || ROLE_BANNER_INFO['Admin'];

  return (
    <div className={appClass} id="app" data-role={roleSlug} onClick={handleAppClick}>
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"
        strategy="afterInteractive"
        onLoad={() => setScriptsReady((s) => ({ ...s, three: true }))}
      />
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"
        strategy="afterInteractive"
        onLoad={() => setScriptsReady((s) => ({ ...s, chart: true }))}
      />

      <Sidebar
        isOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        isCollapsed={collapsed}
        onToggleCollapse={toggleSidebar}
      />

      <main className="main">
        <Topbar />

        {/* Dynamic Role Banner */}
        <div className="clearance-banner" style={{
          margin: '0 0 16px 0',
          padding: '12px 18px',
          background: 'var(--role-soft, #f0fdf4)',
          border: '1px solid var(--role-border, #bbf7d0)',
          boxShadow: '0 2px 10px var(--role-glow, rgba(34, 197, 94, 0.12))',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="clearance-dot" style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: 'var(--role-accent, #22c55e)',
              boxShadow: '0 0 0 3px var(--role-border, #bbf7d0)',
            }} />
            <div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>
                {currentBanner.title}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '1px' }}>
                {currentBanner.desc}
              </div>
            </div>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <span className="clearance-pill" style={{
              padding: '4px 10px',
              background: '#fff',
              border: '1px solid var(--role-border, #bbf7d0)',
              color: 'var(--role-primary, #15803d)',
              borderRadius: '9999px',
              fontSize: '11px',
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}>
              {currentBanner.badge}
            </span>
            {currentUser?.assignedPlaza && (
              <span style={{
                padding: '4px 10px',
                background: 'rgba(255,255,255,0.7)',
                color: '#475569',
                borderRadius: '9999px',
                fontSize: '11px',
                fontWeight: '600',
              }}>
                📍 {currentUser.assignedPlaza}
              </span>
            )}
          </div>
        </div>

        {userRole === 'Plaza POS' || userRole === 'Request Tag Details' ? (
          <WorkstationTerminal
            userRole={userRole}
            currentUser={currentUser}
            onOpenOp={(op) => setActiveOp(op)}
          />
        ) : (
          <>
            <Hero d={d} />

            <div className="section-head">
              <h3>
                <span className="bar"></span>Transaction metrics
              </h3>
              <span className="note">
                Rolling 24-hour window · auto-refresh 30s ·{" "}
                {IS_DEV_DATA_MODE ? "DEV (mock JSON)" : "PROD (live API)"}
              </span>
            </div>

            <div className="seg tm-tabs">
              <button className={activeTab === "metrics" ? "on" : ""} onClick={() => setActiveTab("metrics")}>
                Transaction Metrics
              </button>
              <button className={activeTab === "disputes" ? "on" : ""} onClick={() => setActiveTab("disputes")}>
                Dispute Matrix
              </button>
            </div>

            {activeTab === "metrics" ? <MetricsKpis d={d} /> : <DisputeKpis disp={disp} />}

            <div className="grid-2" style={{ marginTop: 22 }}>
              <TxnAnalyticsPanel
                transactions={data.transactions}
                range={chartRange}
                onRangeChange={setChartRange}
                canvasRef={chartCanvasRef}
                chartInstanceRef={chartInstanceRef}
                chartReady={scriptsReady.chart}
              />
              <GrowthPanel d={d} />
            </div>

            <div className="grid-2" style={{ marginTop: 16, gridTemplateColumns: "1.7fr 1fr" }}>
              <PeakHoursPanel />
              <AlertsPanel alerts={alerts} setAlerts={setAlerts} />
            </div>

            <DeclinesPanel declines={data.declines} errOpen={errOpen} setErrOpen={setErrOpen} />

            <SystemsPanel systems={data.systems} sysFilter={sysFilter} setSysFilter={setSysFilter} />

            <div className="grid-2" style={{ marginTop: 16, gridTemplateColumns: "1fr 1.35fr" }}>
              <SettlementPanel settlement={data.settlement} />
              <PlazaStatusPanel plazas={data.plazas} plazaQuery={plazaQuery} setPlazaQuery={setPlazaQuery} />
            </div>
          </>
        )}

        <div className="foot">
          Paysonic · UAT Operations Console · Mode: {IS_DEV_DATA_MODE ? "DEV" : "PROD"}
        </div>
      </main>

      <OperationsModal operation={activeOp} onClose={() => setActiveOp(null)} />
    </div>
  );
}

function Topbar() {
  const [query, setQuery] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const initials = currentUser?.avatar || currentUser?.name?.slice(0, 2).toUpperCase() || 'OP';
  const roleName = currentUser?.role || 'Admin';

  return (
    <div className="topbar">
      <div className="title">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          Welcome, {currentUser?.name?.split(' ')[0] || 'Admin'}
          <span className="live"><span className="dot"></span>LIVE</span>
          <span style={{
            fontSize: '11px',
            fontWeight: '600',
            padding: '2px 8px',
            borderRadius: '6px',
            background: 'var(--role-surface, #f0fdf4)',
            color: 'var(--role-primary, #15803d)',
            border: '1px solid var(--role-border, #bbf7d0)',
            letterSpacing: '0.02em',
          }}>
            {roleName}
          </span>
        </h1>
        <p>
          {currentUser?.assignedPlaza
            ? `Assigned Scope: ${currentUser.assignedPlaza} · Network health nominal`
            : 'Network health nominal across all lanes'}
        </p>
      </div>
      <div className="spacer"></div>
      <div className="search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          type="text"
          placeholder="Search plaza, tag, txn…"
          aria-label="Search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <button className="icon-btn notif-btn" aria-label="Notifications">
        <span className="badge notif-badge"></span>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      </button>

      {/* User profile with logout menu */}
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => setShowMenu(v => !v)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: '#ffffff',
            border: '1.5px solid #e2e8f0',
            borderRadius: '9999px',
            padding: '3px 10px 3px 3px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          title="User profile & Sign Out"
        >
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #2563eb, #16a34a)',
            color: '#fff',
            display: 'grid',
            placeItems: 'center',
            fontSize: '11px',
            fontWeight: '700',
          }}>
            {initials}
          </div>
          <span style={{ fontSize: '12px', fontWeight: '600', color: '#1e293b' }}>
            {currentUser?.name ? currentUser.name.split(' ')[0] : 'Admin'}
          </span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {showMenu && (
          <div style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
            minWidth: '220px',
            padding: '12px',
            zIndex: 100,
          }}>
            <div style={{ paddingBottom: '10px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ fontWeight: '700', fontSize: '13px', color: '#0f172a' }}>{currentUser?.name || 'Administrator'}</div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{currentUser?.email || ''}</div>
              <div style={{
                display: 'inline-block',
                marginTop: '6px',
                padding: '2px 8px',
                background: '#f0fdf4',
                color: '#16a34a',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: '600'
              }}>
                {currentUser?.role || 'Admin'}
              </div>
            </div>
            <button
              onClick={handleLogout}
              style={{
                width: '100%',
                marginTop: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 10px',
                background: '#fef2f2',
                color: '#dc2626',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Sign Out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Hero({ d }) {
  const canvasRef = useRef(null);
  const [threeReady, setThreeReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.THREE) {
      setThreeReady(true);
      return;
    }
    const timer = setInterval(() => {
      if (window.THREE) {
        setThreeReady(true);
        clearInterval(timer);
      }
    }, 200);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!threeReady || !canvasRef.current || typeof window === "undefined" || !window.THREE) return;
    const THREE = window.THREE;
    const RM = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cv = canvasRef.current;
    const heroEl = cv.closest(".hero");

    const renderer = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xedf3fc, 0.0052);
    const camera = new THREE.PerspectiveCamera(46, 2, 1, 600);
    camera.position.set(-58, 24, 54);
    camera.lookAt(14, 5, 0);
    const clock = new THREE.Clock();

    scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    scene.add(new THREE.HemisphereLight(0xffffff, 0xdbe6f5, 0.85));
    const dir = new THREE.DirectionalLight(0xffffff, 0.75);
    dir.position.set(-24, 60, 42);
    scene.add(dir);
    const pb = new THREE.PointLight(0x2563eb, 0.5, 160);
    pb.position.set(-30, 20, -10);
    scene.add(pb);

    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(260, 64),
      new THREE.MeshStandardMaterial({ color: 0xc7d2e0, roughness: 0.96, metalness: 0.02 })
    );
    road.rotation.x = -Math.PI / 2;
    scene.add(road);

    const LANE_Z = [-16, -8, 0, 8, 16];
    const LANES = LANE_Z.length;
    const GANTRY_X = 18;

    for (let i = 0; i < LANES - 1; i++) {
      const z = (LANE_Z[i] + LANE_Z[i + 1]) / 2;
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(260, 0.05, 0.45),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 })
      );
      strip.position.set(0, 0.04, z);
      scene.add(strip);
    }
    [-30, 30].forEach((z) => {
      const e = new THREE.Mesh(
        new THREE.BoxGeometry(260, 0.12, 0.55),
        new THREE.MeshStandardMaterial({ color: 0x2563eb, emissive: 0x2563eb, emissiveIntensity: 0.35, roughness: 0.5 })
      );
      e.position.set(0, 0.06, z);
      scene.add(e);
    });

    const steel = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.45, metalness: 0.6 });
    const postL = new THREE.Mesh(new THREE.BoxGeometry(2.2, 20, 2.2), steel);
    postL.position.set(GANTRY_X, 10, -26);
    scene.add(postL);
    const postR = postL.clone();
    postR.position.z = 26;
    scene.add(postR);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 54), steel);
    beam.position.set(GANTRY_X, 19, 0);
    scene.add(beam);
    const barMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 1.1, roughness: 0.35 });
    const lightbar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 52), barMat);
    lightbar.position.set(GANTRY_X - 1.4, 17.6, 0);
    scene.add(lightbar);
    LANE_Z.forEach((z) => {
      const pod = new THREE.Mesh(
        new THREE.BoxGeometry(3.4, 2, 3.4),
        new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.4, metalness: 0.5 })
      );
      pod.position.set(GANTRY_X, 16.4, z);
      scene.add(pod);
      const lens = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.9, 0.9),
        new THREE.MeshStandardMaterial({ color: 0x2563eb, emissive: 0x2563eb, emissiveIntensity: 1.6, roughness: 0.2 })
      );
      lens.position.set(GANTRY_X - 1.9, 15.6, z);
      scene.add(lens);
    });

    const V_COL = { ok: 0x16a34a, fail: 0xef4444, pend: 0xf59e0b, idle: 0x9aa6bb };
    let vehicles = [];
    let flashes = [];
    let lastSpawn = 0;

    function spawnVehicle() {
      const lane = Math.floor(Math.random() * LANES);
      const roll = Math.random();
      const type = roll > 0.9 ? "fail" : roll > 0.8 ? "pend" : "ok";
      const len = 5 + Math.random() * 3;
      const tall = 1.8 + Math.random() * 1.4;
      const mat = new THREE.MeshStandardMaterial({ color: V_COL.idle, roughness: 0.45, metalness: 0.35 });
      const m = new THREE.Mesh(new THREE.BoxGeometry(len, tall, 3), mat);
      m.position.set(-120, tall / 2 + 0.2, LANE_Z[lane]);
      m.userData = { type, speed: 14 + Math.random() * 10, cleared: false };
      scene.add(m);
      vehicles.push(m);
    }
    function makeFlash(z, color) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(2, 0.35, 10, 32),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(GANTRY_X, 0.6, z);
      ring.userData = { life: 1 };
      scene.add(ring);
      flashes.push(ring);
    }

    if (RM) {
      for (let i = 0; i < 10; i++) {
        spawnVehicle();
        vehicles[i].position.x = -90 + i * 22;
      }
    }

    function sizeRenderer() {
      if (!heroEl) return;
      const r = heroEl.getBoundingClientRect();
      const w = Math.max(1, r.width);
      const h = Math.max(1, r.height);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    sizeRenderer();
    window.addEventListener("resize", sizeRenderer);

    let raf;
    function loop() {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, clock.getDelta());
      const t = clock.elapsedTime;

      if (!RM) {
        camera.position.x = -58 + Math.sin(t * 0.18) * 9;
        camera.position.z = 54 + Math.cos(t * 0.15) * 6;
        camera.position.y = 24 + Math.sin(t * 0.22) * 2;
        camera.lookAt(14, 5, 0);
        if (t - lastSpawn > 0.5 && vehicles.length < 30) {
          lastSpawn = t;
          spawnVehicle();
        }
      }

      for (const v of vehicles) {
        if (!RM) v.position.x += v.userData.speed * dt;
        if (!v.userData.cleared && v.position.x >= GANTRY_X) {
          v.userData.cleared = true;
          const c = V_COL[v.userData.type];
          v.material.color.setHex(c);
          v.material.emissive.setHex(c);
          v.material.emissiveIntensity = 0.9;
          makeFlash(v.position.z, c);
        }
      }
      vehicles = vehicles.filter((v) => {
        if (v.position.x > 130) {
          scene.remove(v);
          v.geometry.dispose();
          v.material.dispose();
          return false;
        }
        return true;
      });
      flashes = flashes.filter((f) => {
        f.userData.life -= dt * 1.6;
        if (f.userData.life <= 0) {
          scene.remove(f);
          f.geometry.dispose();
          f.material.dispose();
          return false;
        }
        const s = 1 + (1 - f.userData.life) * 4;
        f.scale.set(s, s, s);
        f.material.opacity = f.userData.life * 0.85;
        return true;
      });

      if (+cv.style.opacity < 1) {
        cv.style.transition = "opacity .8s";
        cv.style.opacity = "1";
      }
      renderer.render(scene, camera);
    }
    loop();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", sizeRenderer);
      renderer.dispose();
    };
  }, [threeReady]);

  return (
    <section className="hero">
      <canvas id="gantry" ref={canvasRef}></canvas>
      <div className="hero-scrim"></div>
      <div className="hero-inner">
        <div className="hero-lead">
          <div className="eyebrow">Today's collection · {d.date}</div>
          <h2>Net revenue processed across the network</h2>
          <div className="big">
            <span className="cur">₹</span>
            <Counter to={d.netRevenue} fmt="inr" />
          </div>
          <div className="delta">
            <span className="chip">▲ {d.deltaVsYesterday}%</span>
            <span>vs yesterday</span>
            <small>· {inr(d.successTransactions)} successful passages</small>
          </div>
        </div>
        <div className="hero-stats">
          <div className="hstat">
            <div className="k">
              <i style={{ background: "var(--green-2)" }}></i>Success rate
            </div>
            <div className="v">
              <Counter to={d.successRate} decimals={1} suffix="%" />
            </div>
            <div className="s">
              {inr(d.successTransactions)} / {inr(d.totalTransactions)} txns
            </div>
          </div>
          <div className="hstat">
            <div className="k">
              <i style={{ background: "var(--blue)" }}></i>Throughput
            </div>
            <div className="v">
              <Counter to={d.throughput} suffix="/min" />
            </div>
            <div className="s">Peak lane load</div>
          </div>
          <div className="hstat">
            <div className="k">
              <i style={{ background: "var(--amber)" }}></i>Avg fare
            </div>
            <div className="v">
              ₹<Counter to={d.avgFare} />
            </div>
            <div className="s">Per vehicle</div>
          </div>
        </div>
      </div>
      <div className="hero-hint">Live toll gantry · 3D</div>
    </section>
  );
}

function TiltCard({ children }) {
  const ref = useRef(null);
  function onMove(e) {
    const card = ref.current;
    if (!card) return;
    const r = card.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    card.style.transform = `perspective(900px) rotateX(${(py - 0.5) * -6}deg) rotateY(${(px - 0.5) * 8}deg) translateY(-2px)`;
    card.style.setProperty("--mx", px * 100 + "%");
    card.style.setProperty("--my", py * 100 + "%");
  }
  function onLeave() {
    if (ref.current) ref.current.style.transform = "";
  }
  return (
    <div className="card tilt" ref={ref} onMouseMove={onMove} onMouseLeave={onLeave}>
      {children}
    </div>
  );
}

function MetricsKpis({ d }) {
  const cards = [
    {
      icon: <path d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6" />,
      cls: "i-blue",
      trend: d.trends.activePlazas,
      label: "Active Toll Plazas",
      value: <Counter to={d.activeTollPlazas} />,
      unit: ` / ${d.totalTollPlazas}`,
      spark: d.sparklines.activePlazas,
    },
    {
      icon: <><path d="M3 3v18h18" /><path d="M7 15l3-4 3 2 4-6" /></>,
      cls: "i-blue",
      trend: d.trends.totalTxn,
      label: "Total TXN Count",
      value: <Counter to={d.totalTransactions} />,
      spark: d.sparklines.totalTxn,
    },
    {
      icon: <path d="M20 6 9 17l-5-5" />,
      cls: "i-green",
      trend: d.trends.successTxn,
      label: "Success TXN Count",
      value: <Counter to={d.successTransactions} />,
      spark: d.sparklines.successTxn,
    },
    {
      icon: <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />,
      cls: "i-green",
      trend: d.trends.successAmount,
      label: "Success TXN Amount",
      value: (
        <>
          ₹<Counter to={d.successAmount} fmt="inr" />
        </>
      ),
      spark: d.sparklines.successAmount,
    },
    {
      icon: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
      cls: "i-amber",
      trend: d.trends.pendingTxn,
      label: "Pending TXN Count",
      value: <Counter to={d.pendingTransactions} />,
      spark: d.sparklines.pendingTxn,
    },
    {
      icon: <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />,
      cls: "i-amber",
      trend: d.trends.pendingAmount,
      label: "Pending Txn Amount",
      value: (
        <>
          ₹<Counter to={d.pendingAmount} fmt="inr" />
        </>
      ),
      spark: d.sparklines.pendingAmount,
    },
    {
      icon: <><circle cx="12" cy="12" r="9" /><path d="m15 9-6 6M9 9l6 6" /></>,
      cls: "i-red",
      trend: d.trends.failedTxn,
      label: "Fail TXN Count",
      value: <Counter to={d.failedTransactions} />,
      spark: d.sparklines.failedTxn,
    },
    {
      icon: <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />,
      cls: "i-red",
      trend: d.trends.failedAmount,
      label: "Fail TXN Amount",
      value: (
        <>
          ₹<Counter to={d.failedAmount} fmt="inr" />
        </>
      ),
      spark: d.sparklines.failedAmount,
    },
  ];

  return (
    <section className="kpis">
      {cards.map((c, i) => (
        <TiltCard key={i}>
          <div className="row1">
            <div className={`ic ${c.cls}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                {c.icon}
              </svg>
            </div>
            <span className={`trend ${c.trend >= 0 ? "up" : "down"}`}>
              {c.trend >= 0 ? "▲" : "▼"} {Math.abs(c.trend).toFixed(1)}%
            </span>
          </div>
          <div className="lbl">{c.label}</div>
          <div className="val">
            {c.value}
            {c.unit && <span className="u">{c.unit}</span>}
          </div>
          <Sparkline points={c.spark} />
        </TiltCard>
      ))}
    </section>
  );
}

function DisputeKpis({ disp }) {
  return (
    <>
      <section className="kpis">
        <div className="card tilt">
          <div className="row1">
            <div className="ic i-blue">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="4" y="3" width="16" height="18" rx="2" />
                <path d="M9 8h6M9 12h6M9 16h4" />
              </svg>
            </div>
          </div>
          <div className="lbl">Total Dispute</div>
          <div className="val"><Counter to={disp.total} /></div>
        </div>
        <div className="card tilt">
          <div className="row1">
            <div className="ic i-amber">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
            </div>
          </div>
          <div className="lbl">Open Dispute</div>
          <div className="val"><Counter to={disp.open} /></div>
        </div>
        <div className="card tilt">
          <div className="row1">
            <div className="ic i-green">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
          </div>
          <div className="lbl">Accepted Dispute</div>
          <div className="val"><Counter to={disp.accepted} /></div>
        </div>
        <div className="card tilt">
          <div className="row1">
            <div className="ic i-green">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
          </div>
          <div className="lbl">Accepted Dispute Amount</div>
          <div className="val">
            ₹<Counter to={disp.acceptedAmount} fmt="inr" />
          </div>
        </div>
        <div className="card tilt">
          <div className="row1">
            <div className="ic i-red">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="12" r="9" />
                <path d="m15 9-6 6M9 9l6 6" />
              </svg>
            </div>
          </div>
          <div className="lbl">Rejected Dispute</div>
          <div className="val"><Counter to={disp.rejected} /></div>
        </div>
      </section>
      <div className="panel dispute-open-panel">
        <div className="panel-head">
          <div>
            <h4>Open Dispute breakdown</h4>
            <p>Disputes to be closed today · action to be taken</p>
          </div>
        </div>
        <div className="stat3">
          <div className="s3">
            <div className="k">Within TAT</div>
            <div className="v">{disp.breakdown.withinTAT}</div>
          </div>
          <div className="s3 warn">
            <div className="k">Due &lt; 24 h</div>
            <div className="v">{disp.breakdown.due24h}</div>
          </div>
          <div className="s3 crit">
            <div className="k">Breached</div>
            <div className="v">{disp.breakdown.breached}</div>
          </div>
        </div>
      </div>
    </>
  );
}

function TxnAnalyticsPanel({ transactions, range, onRangeChange, canvasRef, chartInstanceRef, chartReady }) {
  useEffect(() => {
    if (!chartReady || !canvasRef.current || typeof window === "undefined" || !window.Chart) return;
    const Chart = window.Chart;
    const RM = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const d = transactions[String(range)];
    if (!d) return;
    const grouped = range <= 14;

    const cfg = {
      type: "bar",
      data: {
        labels: d.labels,
        datasets: [
          { label: "Success", data: d.success, backgroundColor: "#22C55E", borderRadius: { topLeft: 5, topRight: 5 }, borderSkipped: false, maxBarThickness: grouped ? 14 : 9, categoryPercentage: 0.68, barPercentage: 0.9, stack: grouped ? undefined : "s" },
          { label: "Pending", data: d.pending, backgroundColor: "#F5B948", borderRadius: { topLeft: 5, topRight: 5 }, borderSkipped: false, maxBarThickness: grouped ? 14 : 9, categoryPercentage: 0.68, barPercentage: 0.9, stack: grouped ? undefined : "s" },
          { label: "Failed", data: d.failed, backgroundColor: "#F87171", borderRadius: { topLeft: 5, topRight: 5 }, borderSkipped: false, maxBarThickness: grouped ? 14 : 9, categoryPercentage: 0.68, barPercentage: 0.9, stack: grouped ? undefined : "s" },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: RM ? false : { duration: 750, easing: "easeOutCubic" },
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "#FFFFFF", borderColor: "#E7ECF3", borderWidth: 1, padding: 12,
            titleColor: "#0F172A", bodyColor: "#5B6678",
            titleFont: { family: "Space Grotesk", weight: "600", size: 13 },
            bodyFont: { family: "JetBrains Mono", size: 12 },
            cornerRadius: 10, boxPadding: 5, usePointStyle: true,
            callbacks: { label: (c) => " " + c.dataset.label + ":  " + c.raw.toLocaleString("en-IN") },
          },
        },
        scales: {
          x: { stacked: !grouped, grid: { display: false }, border: { display: false }, ticks: { color: "#94A3B8", font: { family: "Inter", size: 11 }, maxRotation: 0, autoSkip: true } },
          y: { stacked: !grouped, grid: { color: "#EEF2F7" }, border: { display: false }, beginAtZero: true, ticks: { color: "#94A3B8", font: { family: "JetBrains Mono", size: 11 }, padding: 8 } },
        },
      },
    };

    if (chartInstanceRef.current) chartInstanceRef.current.destroy();
    chartInstanceRef.current = new Chart(canvasRef.current.getContext("2d"), cfg);

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [chartReady, range, transactions, canvasRef, chartInstanceRef]);

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <h4>Transaction Analytics</h4>
          <p>Passage volume by outcome · per day</p>
        </div>
        <div className="seg">
          {[7, 14, 30].map((r) => (
            <button key={r} className={range === r ? "on" : ""} onClick={() => onRangeChange(r)}>
              {r}D
            </button>
          ))}
        </div>
      </div>
      <div className="legend">
        <span><i style={{ background: "var(--green-2)" }}></i>Success</span>
        <span><i style={{ background: "var(--amber)" }}></i>Pending</span>
        <span><i style={{ background: "var(--red)" }}></i>Failed</span>
      </div>
      <div className="chart-wrap">
        <canvas ref={canvasRef}></canvas>
      </div>
    </div>
  );
}

function GrowthPanel({ d }) {
  const arcRef = useRef(null);
  useEffect(() => {
    const RM = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const arc = arcRef.current;
    if (!arc) return;
    const C = 2 * Math.PI * 78;
    const target = (d.growth || 0) / 100;
    if (RM) {
      arc.style.strokeDashoffset = String(C * (1 - target));
      return;
    }
    let raf;
    let t0 = null;
    function step(t) {
      if (!t0) t0 = t;
      const p = Math.min(1, (t - t0) / 1400);
      const e = 1 - Math.pow(1 - p, 3);
      arc.style.strokeDashoffset = String(C * (1 - target * e));
      if (p < 1) raf = requestAnimationFrame(step);
    }
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [d.growth]);

  return (
    <div className="panel gauge-panel">
      <div className="panel-head">
        <div>
          <h4>Growth</h4>
          <p>vs yesterday</p>
        </div>
      </div>
      <div className="gauge">
        <svg width="186" height="186" viewBox="0 0 186 186">
          <circle cx="93" cy="93" r="78" fill="none" stroke="#EDF1F7" strokeWidth="14" />
          <circle
            ref={arcRef}
            cx="93" cy="93" r="78" fill="none" stroke="url(#gg)" strokeWidth="14"
            strokeLinecap="round" strokeDasharray="490.09" strokeDashoffset="490.09"
          />
          <defs>
            <linearGradient id="gg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#22C55E" />
              <stop offset="1" stopColor="#2563EB" />
            </linearGradient>
          </defs>
        </svg>
        <div className="center">
          <div className="p"><Counter to={d.growth} suffix="%" /></div>
          <div className="c">Growth</div>
        </div>
      </div>
      <div className="mini-rows">
        <div className="mini">
          <div className="mi i-blue">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M3 3v18h18" /><path d="M7 14l3-3 3 2 4-5" />
            </svg>
          </div>
          <div className="mtxt">
            <b>Yesterday TXN Count</b>
            <span><Counter to={d.yesterdayTransactions} /></span>
          </div>
          <span className="arrow">▲ 9%</span>
        </div>
        <div className="mini">
          <div className="mi i-green">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          <div className="mtxt">
            <b>Yesterday Revenue</b>
            <span>₹<Counter to={d.yesterdayRevenue} fmt="inr" /></span>
          </div>
          <span className="arrow">▲ 12%</span>
        </div>
      </div>
    </div>
  );
}

function PeakHoursPanel() {
  const [ready, setReady] = useState(false);
  const cellsRef = useRef(null);

  const grid = useMemo(() => {
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    function traffic(day, hour) {
      const morn = Math.exp(-Math.pow(hour - 9, 2) / 6);
      const eve = Math.exp(-Math.pow(hour - 18.5, 2) / 7);
      let base = 0.12 + morn * 0.9 + eve * 1.0;
      if (hour >= 0 && hour < 5) base *= 0.25;
      if (day >= 5) {
        base *= 0.85;
        base += Math.exp(-Math.pow(hour - 13, 2) / 10) * 0.4;
      }
      return base * (0.9 + Math.random() * 0.2);
    }
    const cells = [];
    let maxV = 0;
    let peak = { v: 0, d: 0, h: 0 };
    for (let dIdx = 0; dIdx < 7; dIdx++) {
      for (let h = 0; h < 24; h++) {
        const v = traffic(dIdx, h);
        cells.push({ d: dIdx, h, v });
        if (v > maxV) maxV = v;
        if (v > peak.v) peak = { v, d: dIdx, h };
      }
    }
    return { days, cells, maxV, peak };
  }, []);

  useEffect(() => setReady(true), []);

  function lerp(a, b, t) {
    return Math.round(a + (b - a) * t);
  }
  function color(t) {
    if (t < 0.04) return "#EEF2F7";
    return `rgb(${lerp(224, 21, t)},${lerp(240, 128, t)},${lerp(230, 61, t)})`;
  }

  if (!ready) return <div className="panel"><div className="panel-head"><div><h4>Peak Traffic Hours</h4></div></div></div>;

  const { days, cells, maxV, peak } = grid;

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <h4>Peak Traffic Hours</h4>
          <p>Passages by hour &amp; day · last 7 days</p>
        </div>
      </div>
      <div className="hm-scroll">
        <div className="hm-grid" ref={cellsRef}>
          <div className="hm-corner"></div>
          {Array.from({ length: 24 }, (_, h) => (
            <div className="hm-hlabel" key={"hl" + h}>{h % 3 === 0 ? h + "h" : ""}</div>
          ))}
          {days.map((day, dIdx) => (
            <FragmentRow key={day} day={day} dIdx={dIdx} cells={cells} maxV={maxV} color={color} />
          ))}
        </div>
      </div>
      <div className="hm-foot">
        <div className="hm-peak">Busiest: <b>{days[peak.d]} · {peak.h}:00–{peak.h + 1}:00</b></div>
        <div className="hm-legend">
          <span>Low</span>
          <div className="hm-scale">
            {[0.05, 0.3, 0.55, 0.8, 1].map((t) => (
              <i key={t} style={{ background: color(t) }}></i>
            ))}
          </div>
          <span>High</span>
        </div>
      </div>
    </div>
  );
}

function FragmentRow({ day, dIdx, cells, maxV, color }) {
  return (
    <>
      <div className="hm-rlabel">{day}</div>
      {Array.from({ length: 24 }, (_, h) => {
        const c = cells[dIdx * 24 + h];
        const t = c.v / maxV;
        const cnt = Math.round(c.v * 90);
        return (
          <div
            key={h}
            className="hm-cell"
            style={{ background: color(t) }}
            title={`${day} · ${h}:00 — ${cnt} passages`}
          ></div>
        );
      })}
    </>
  );
}

const ALERT_ICONS = {
  off: <path d="M18.4 18.4A9 9 0 0 0 5.6 5.6m12.8 12.8A9 9 0 0 1 5.6 5.6m12.8 12.8L5.6 5.6" />,
  recon: <path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v4h-4" />,
  lane: <><path d="M12 3 3 7v5c0 5 3.8 8.4 9 9.5 5.2-1.1 9-4.5 9-9.5V7l-9-4Z" /><path d="M12 8v4" /></>,
  dispute: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h4" /></>,
  batch: <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />,
};

function AlertsPanel({ alerts, setAlerts }) {
  function dismiss(id) {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }
  return (
    <div className="panel">
      <div className="panel-head">
        <div className="alerts-head">
          <h4>Alerts &amp; Actions</h4>
          {alerts.length > 0 && <span className="alerts-count">{alerts.length}</span>}
        </div>
      </div>
      <div className="alerts-list">
        {alerts.length === 0 ? (
          <div className="alerts-empty">
            <div className="ok">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <b>All clear</b>
            <span>No actions need your attention.</span>
          </div>
        ) : (
          alerts.map((a) => (
            <div className={`alert ${a.sev}`} key={a.id}>
              <div className={`ai ${a.sev}`}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  {ALERT_ICONS[a.icon]}
                </svg>
              </div>
              <div className="ac">
                <div className="at">{a.title}</div>
                <div className="am">{a.msg}</div>
                <div className="atime">{a.time}</div>
              </div>
              <button className="aact" onClick={() => dismiss(a.id)}>{a.act}</button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function DeclinesPanel({ declines, errOpen, setErrOpen }) {
  const cats = declines.categories;
  const errCodes = [...declines.errorCodes].sort((a, b) => b.count - a.count);
  const total = cats.reduce((s, c) => s + c.count, 0);
  const max = Math.max(...cats.map((c) => c.count));

  return (
    <div className="panel" style={{ marginTop: 16 }}>
      <div className="rank-head">
        <b>Declined Transactions</b>
        <span>{total} declined today</span>
      </div>
      <div className="rank-list">
        {cats.map((c) => (
          <div
            key={c.name}
            className={`rank-row${c.clickable ? " clickable" : ""}`}
            onClick={c.clickable ? () => setErrOpen((v) => !v) : undefined}
          >
            <div className="rank-label">{c.name}</div>
            <div className="rank-track">
              <div className="rank-fill" style={{ width: `${((c.count / max) * 100).toFixed(0)}%` }}></div>
            </div>
            <div className="rank-count">{c.count}</div>
          </div>
        ))}
      </div>
      <div className={`err-detail${errOpen ? " open" : ""}`}>
        <table>
          <thead>
            <tr>
              <th>Error Code</th>
              <th>Description</th>
              <th className="r">Declines</th>
            </tr>
          </thead>
          <tbody>
            {errCodes.map((e) => (
              <tr key={e.code}>
                <td className="code">{e.code}</td>
                <td>{e.desc}</td>
                <td className="r">{e.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="rank-sub">
        Click "Error Codes Declined" to see the breakdown by code, sorted by decline count.
      </div>
    </div>
  );
}

function SystemsPanel({ systems, sysFilter, setSysFilter }) {
  const stName = { ok: "Live", warn: "Degraded", off: "Offline" };
  const rows = systems.filter((s) => sysFilter === "all" || s.status === sysFilter);
  function statusClass(v, okVal, offVal) {
    if (v === okVal) return "ok";
    if (v === offVal) return "off";
    return "warn";
  }

  return (
    <div className="panel" style={{ marginTop: 16 }}>
      <div className="panel-head">
        <div>
          <h4>Alert / API Status</h4>
          <p>System &amp; monitoring health across all plazas</p>
        </div>
        <div className="sys-chips">
          {["all", "ok", "warn", "off"].map((f) => (
            <button key={f} className={sysFilter === f ? "on" : ""} onClick={() => setSysFilter(f)}>
              {f === "all" ? "All" : f === "ok" ? "Live" : f === "warn" ? "Degraded" : "Offline"}
            </button>
          ))}
        </div>
      </div>
      <div className="sys-scroll">
        <table className="sys-table">
          <thead>
            <tr>
              <th>Plaza / System</th>
              <th>Status</th>
              <th>Exception List</th>
              <th>Heartbeat</th>
              <th>Sync Time</th>
              <th>Request Tag</th>
              <th>Request Pay</th>
              <th>Violation API</th>
              <th>Lane Status</th>
              <th>Failed Rate</th>
              <th>BLT Status (2.4 – SFTP)</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={11} style={{ textAlign: "center", color: "var(--faint)", padding: 20 }}>
                  No systems match this filter.
                </td>
              </tr>
            ) : (
              rows.map((s) => (
                <tr key={s.id}>
                  <td>
                    <span className="sysname">{s.name}</span>
                    <br />
                    <span className="sysid">{s.id}</span>
                  </td>
                  <td className={s.status}>{stName[s.status]}</td>
                  <td>{s.exception}</td>
                  <td>{s.heartbeat}</td>
                  <td>{s.sync}</td>
                  <td className={statusClass(s.requestTag, "OK", "Timeout")}>{s.requestTag}</td>
                  <td className={statusClass(s.requestPay, "OK", "Timeout")}>{s.requestPay}</td>
                  <td className={statusClass(s.violationApi, "OK", "Timeout")}>{s.violationApi}</td>
                  <td>{s.lane}</td>
                  <td>{s.failedRate}</td>
                  <td className={statusClass(s.blt, "Connected", "Disconnected")}>{s.blt}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SettlementPanel({ settlement }) {
  return (
    <div className="panel settle">
      <div className="panel-head" style={{ marginBottom: 14 }}>
        <div>
          <h4>Settlement Summary</h4>
          <p>As on {settlement.asOn}</p>
        </div>
      </div>
      <div className="srow head">
        <span>Category</span>
        <span className="scount">Count</span>
        <span className="samt">Amount</span>
      </div>
      {settlement.rows.map((r) => (
        <div className="srow" key={r.label}>
          <div className="sname">
            <span className="sdot" style={{ background: r.color }}></span>
            {r.label}
          </div>
          <span className="scount">{inr(r.count)}</span>
          <span className="samt">₹{inr(r.amount)}</span>
        </div>
      ))}
    </div>
  );
}

function PlazaStatusPanel({ plazas, plazaQuery, setPlazaQuery }) {
  const { currentUser } = useAuth();
  const q = plazaQuery.trim().toLowerCase();
  const userPlazaText = (currentUser?.assignedPlaza || '').toLowerCase();
  const userRole = currentUser?.role || 'Admin';

  const isUserPlaza = (p) => {
    if (!userPlazaText || userPlazaText.includes('all plazas') || userPlazaText.includes('bank level')) return false;
    const nameLower = p.name.toLowerCase();
    const descLower = p.desc.toLowerCase();
    return userPlazaText.includes(nameLower) || nameLower.includes(userPlazaText.split('(')[0].trim()) || userPlazaText.includes(descLower);
  };

  const isCorridorPlaza = (p) => {
    if (userRole !== 'Concessionaire') return false;
    const n = p.name.toLowerCase();
    return n.includes('vashi') || n.includes('airoli') || n.includes('khed') || n.includes('mumbai') || n.includes('pune');
  };

  const [corridorOnly, setCorridorOnly] = useState(userRole === 'Concessionaire');

  const filtered = plazas.filter((p) => {
    if (userRole === 'Concessionaire' && corridorOnly && !isCorridorPlaza(p)) {
      return false;
    }
    return !q || `${p.id} ${p.name} ${p.desc}`.toLowerCase().includes(q);
  });
  const statusLabel = { ok: "Live", warn: "Degraded", off: "Offline" };

  return (
    <div className="panel tbl-panel">
      <div className="panel-head">
        <div>
          <h4>Plaza Status</h4>
          <p>
            {userRole === 'Concessionaire'
              ? 'Mumbai-Pune Highway Corridor throughput (Selected Plazas)'
              : currentUser?.assignedPlaza && !userPlazaText.includes('all plazas')
              ? `Live connectivity · Jurisdiction: ${currentUser.assignedPlaza}`
              : 'Live lane connectivity across all network plazas'}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {userRole === 'Concessionaire' && (
            <button
              type="button"
              onClick={() => setCorridorOnly((v) => !v)}
              style={{
                padding: '5px 12px',
                fontSize: '12px',
                fontWeight: '600',
                borderRadius: '8px',
                border: '1px solid #d97706',
                background: corridorOnly ? '#fffbeb' : '#ffffff',
                color: '#d97706',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
              title="Toggle between corridor plazas and all network plazas"
            >
              {corridorOnly ? '✓ Corridor Plazas (3)' : 'Show All Plazas (5)'}
            </button>
          )}
          <div className="tbl-search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="text"
              placeholder="Search plaza…"
              aria-label="Search plaza"
              value={plazaQuery}
              onChange={(e) => setPlazaQuery(e.target.value)}
            />
          </div>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Plaza ID</th>
            <th>Plaza Name</th>
            <th>Description</th>
            <th className="r">Status</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((p) => {
            const isAssigned = isUserPlaza(p);
            const isCorr = isCorridorPlaza(p);
            return (
              <tr key={p.id} style={isAssigned ? { background: '#f0f9ff' } : isCorr ? { background: '#fffbeb' } : undefined}>
                <td className="pid">{p.id}</td>
                <td className="pname">
                  {p.name}
                  {isAssigned && (
                    <span style={{
                      marginLeft: '6px',
                      fontSize: '10px',
                      fontWeight: '700',
                      padding: '2px 6px',
                      background: '#0284c7',
                      color: '#ffffff',
                      borderRadius: '4px',
                      textTransform: 'uppercase',
                    }}>
                      Your Plaza
                    </span>
                  )}
                  {isCorr && !isAssigned && (
                    <span style={{
                      marginLeft: '6px',
                      fontSize: '10px',
                      fontWeight: '700',
                      padding: '2px 6px',
                      background: '#d97706',
                      color: '#ffffff',
                      borderRadius: '4px',
                      textTransform: 'uppercase',
                    }}>
                      Corridor
                    </span>
                  )}
                </td>
                <td className="pdesc">{p.desc}</td>
                <td className="st-cell">
                  <span className={`st ${p.status}`}>
                    <i></i>
                    {statusLabel[p.status]}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {filtered.length === 0 && <div className="no-res">No plaza matches your search.</div>}
    </div>
  );
}
