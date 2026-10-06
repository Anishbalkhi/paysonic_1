import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import DisputeManagementService from '../../services/dispute/DisputeManagementService';
import './DisputeDashboard.scss';

export const DisputeDashboard = () => {
  const { currentUser } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const plazaId = currentUser?.role === 'Plaza Admin' || currentUser?.role === 'Plaza POS'
    ? currentUser?.plazaId || '600601'
    : null;

  const loadData = useCallback(async () => {
    try {
      const data = await DisputeManagementService.getPlazaDashboardStats(plazaId);
      setStats(data);
    } catch (e) {
      console.error('[DisputeDashboard] Load error:', e);
    } finally {
      setLoading(false);
    }
  }, [plazaId]);

  useEffect(() => {
    loadData();
    // 15-second live refresh interval as specified in Section 12.1
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, [loadData]);

  if (loading || !stats) {
    return (
      <div className="dispute-dashboard-page">
        <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
          Loading live dispute dashboard...
        </div>
      </div>
    );
  }

  const atRisk = stats.atRiskDisputes || [];

  return (
    <div className="dispute-dashboard-page">
      {/* Top Header */}
      <div className="dashboard-header">
        <div className="header-left">
          <h1>Dispute Dashboard</h1>
          <p className="subtitle">
            Live view of today's and recent disputes{plazaId ? ` for Plaza ${plazaId}` : ' across all plazas'}, refreshed automatically with TAT risk up front.
          </p>
        </div>
        <div className="live-indicator-badge">
          <span className="live-dot" />
          <span>Live 15s Auto-Refresh</span>
        </div>
      </div>

      {/* TAT Warning Banner (Section 12.3) */}
      <div className={`tat-banner-box ${atRisk.length > 0 ? 'tat-alert' : 'tat-safe'}`}>
        {atRisk.length > 0 ? (
          <>
            <div className="tat-banner-title">
              <span>⚠️</span>
              <span>
                {atRisk.length} dispute(s) are within 2 days of breaching the 7-day TAT — action needed now:
              </span>
            </div>
            <div className="tat-dispute-list">
              {atRisk.map((d) => (
                <div key={d.rowId} className="tat-item-row">
                  <div className="tat-item-info">
                    <strong>{d.acqTxnId}</strong> · {d.cbReason} · ₹ {Number(d.disputeAmount || 0).toFixed(2)} · Plaza {d.plazaId}
                  </div>
                  <span className={`badge ${d.tatBadge?.colorClass || 'badge-amber'}`}>
                    {d.tatBadge?.label}
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="tat-safe-content">
            <span>✓</span>
            <span>No disputes are close to breaching TAT right now. All open chargebacks are within safe limits.</span>
          </div>
        )}
      </div>

      {/* Open vs Closed Summary Cards (Section 12.4) */}
      <div className="summary-metrics-grid">
        <div className="stat-card">
          <span className="stat-label">Total Disputes</span>
          <span className="stat-value">{stats.totalDisputes}</span>
          <span className="stat-subtext">₹ {Number(stats.totalValue || 0).toFixed(2)} total value</span>
        </div>
        <div className="stat-card highlight-open">
          <span className="stat-label">Open Disputes</span>
          <span className="stat-value">{stats.openDisputes}</span>
          <span className="stat-subtext">₹ {Number(stats.openValue || 0).toFixed(2)} at risk</span>
        </div>
        <div className="stat-card highlight-closed">
          <span className="stat-label">Closed Disputes</span>
          <span className="stat-value">{stats.closedDisputes}</span>
          <span className="stat-subtext">₹ {Number(stats.closedValue || 0).toFixed(2)} settled</span>
        </div>
        <div className="stat-card highlight-split">
          <span className="stat-label">Approved vs Rejected</span>
          <span className="stat-value">{stats.approvedVsRejectedRatio}</span>
          <span className="stat-subtext">{stats.approvedCount} approved / {stats.rejectedCount} rejected</span>
        </div>
      </div>

      {/* Day-Wise Cards (Section 12.2) */}
      <div>
        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-soft, #64748b)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
          Day-Wise Performance (Last 5 Days)
        </div>
        <div className="day-cards-scroll-container">
          {(stats.dayCards || []).map((card, i) => (
            <div key={card.date || i} className="daycard">
              <div className="daycard-header">
                <span>📅</span>
                <span>{card.date}</span>
              </div>
              <table>
                <thead>
                  <tr>
                    <th className="col-metric">Metric</th>
                    <th className="col-count">Count</th>
                    <th className="col-amount">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="col-metric">Total Disputes</td>
                    <td className="val-count col-count">{card.totalCount}</td>
                    <td className="val-amount col-amount">₹{Number(card.totalAmount || 0).toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td className="col-metric">Approved</td>
                    <td className="val-count col-count text-success">{card.approvedCount}</td>
                    <td className="val-amount col-amount">₹{Number(card.approvedAmount || 0).toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td className="col-metric">Rejected</td>
                    <td className="val-count col-count text-danger">{card.rejectedCount}</td>
                    <td className="val-amount col-amount">₹{Number(card.rejectedAmount || 0).toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </div>

      {/* Manual Search Dispute Dashboard (Section 12.1) */}
      <div className="search-dashboard-card">
        <div className="card-title">Search Dispute Dashboard Window</div>
        <div className="filter-fields-row">
          <div className="field-box">
            <label htmlFor="dashFromDate">From Date</label>
            <input
              id="dashFromDate"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>
          <div className="field-box">
            <label htmlFor="dashToDate">To Date</label>
            <input
              id="dashToDate"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="btn btn-primary"
            style={{ height: '38px', padding: '0 20px' }}
            onClick={loadData}
          >
            Apply Scope
          </button>
        </div>
      </div>
    </div>
  );
};

export default DisputeDashboard;
