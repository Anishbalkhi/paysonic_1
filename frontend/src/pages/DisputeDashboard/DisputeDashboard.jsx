import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import DisputeManagementService from '../../services/dispute/DisputeManagementService';
import OnboardingService from '../../services/onboarding/OnboardingService';
import useOnboardedPlazas from '../../hooks/useOnboardedPlazas';
import { filterRecordsByPlazaScope } from '../../utils/plazaScopeUtils';
import { normalizePlaza } from '../../utils/plazaNormalizer';
import { formatFetchTime } from '../../utils/dateUtils';
import './DisputeDashboard.scss';

export const DisputeDashboard = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { plazas: onboardedPlazas, isPlazaLocked, defaultPlazaId, assignedPlaza } = useOnboardedPlazas();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [fetchTime, setFetchTime] = useState('');

  // Scalable TAT Warning Controls
  const [tatSearch, setTatSearch] = useState('');
  const [tatSeverity, setTatSeverity] = useState('ALL'); // 'ALL' | 'OVERDUE' | '1D' | '2D'
  const [tatPage, setTatPage] = useState(1);
  const [tatPageSize, setTatPageSize] = useState(4);
  const [isTatCollapsed, setIsTatCollapsed] = useState(false);

  const plazaId = isPlazaLocked
    ? (assignedPlaza?.id || defaultPlazaId || currentUser?.plazaId)
    : (currentUser?.role === 'Plaza Admin' || currentUser?.role === 'Plaza POS' ? (currentUser?.plazaId || defaultPlazaId) : null);

  const loadData = useCallback(async () => {
    try {
      const data = await DisputeManagementService.getPlazaDashboardStats(plazaId);
      setStats(data);
      setFetchTime(formatFetchTime(new Date()));
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

  // Real at-risk disputes approaching NPCI 7-day TAT SLA
  const atRisk = useMemo(() => {
    const raw = stats?.atRiskDisputes || [];
    return filterRecordsByPlazaScope(raw, onboardedPlazas, currentUser);
  }, [stats, onboardedPlazas, currentUser]);

  // Compute severity breakdown counts
  const severityStats = useMemo(() => {
    let overdue = 0;
    let oneDay = 0;
    let twoDays = 0;
    let totalAmt = 0;

    atRisk.forEach((d) => {
      const days = d.daysLeft;
      const label = (d.tatBadge?.label || '').toLowerCase();
      if (days < 0 || label.includes('overdue')) overdue += 1;
      else if (days === 1 || label.includes('1d')) oneDay += 1;
      else twoDays += 1;
      totalAmt += Number(d.disputeAmount || 0);
    });

    return { overdue, oneDay, twoDays, totalAmt };
  }, [atRisk]);

  // Filter and sort at-risk items with high performance
  const filteredAtRisk = useMemo(() => {
    let list = [...atRisk];

    if (tatSeverity === 'OVERDUE') {
      list = list.filter((d) => d.daysLeft < 0 || (d.tatBadge?.label || '').toLowerCase().includes('overdue'));
    } else if (tatSeverity === '1D') {
      list = list.filter((d) => d.daysLeft === 1 || (d.tatBadge?.label || '').toLowerCase().includes('1d'));
    } else if (tatSeverity === '2D') {
      list = list.filter((d) => d.daysLeft === 2 || (d.tatBadge?.label || '').toLowerCase().includes('2d'));
    }

    if (tatSearch.trim()) {
      const q = tatSearch.toLowerCase().trim();
      list = list.filter((d) =>
        (d.acqTxnId && d.acqTxnId.toLowerCase().includes(q)) ||
        (d.cbReason && d.cbReason.toLowerCase().includes(q)) ||
        (d.plazaId && String(d.plazaId).toLowerCase().includes(q)) ||
        (d.vrn && d.vrn.toLowerCase().includes(q))
      );
    }

    // Sort by critical priority: Overdue first, then 1d, then 2d, then highest disputeAmount
    list.sort((a, b) => {
      const aDays = a.daysLeft ?? 99;
      const bDays = b.daysLeft ?? 99;
      if (aDays !== bDays) return aDays - bDays;
      return Number(b.disputeAmount || 0) - Number(a.disputeAmount || 0);
    });

    return list;
  }, [atRisk, tatSeverity, tatSearch]);

  const totalTatPages = Math.ceil(filteredAtRisk.length / tatPageSize) || 1;
  const paginatedAtRisk = useMemo(() => {
    const from = (tatPage - 1) * tatPageSize;
    return filteredAtRisk.slice(from, from + tatPageSize);
  }, [filteredAtRisk, tatPage, tatPageSize]);

  // Reset page when filter, search, or page size changes
  useEffect(() => {
    setTatPage(1);
  }, [tatSearch, tatSeverity, tatPageSize]);

  if (loading || !stats) {
    return (
      <div className="dispute-dashboard-page">
        <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
          Loading live dispute dashboard...
        </div>
      </div>
    );
  }

  return (
    <div className="dispute-dashboard-page">
      {/* Top Header */}
      <div className="dashboard-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div className="header-left">
          <h1>Dispute Dashboard</h1>
          <p className="subtitle">
            Live view of today's and recent disputes{plazaId ? ` for Plaza ${plazaId}` : ' across all plazas'}, refreshed automatically with TAT risk up front.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div className="live-indicator-badge">
            <span className="live-dot" />
            <span>Live 15s Auto-Refresh</span>
          </div>
        </div>
      </div>

      {/* TAT Warning Banner (Section 12.3 - High Volume Scalable Architecture) */}
      <div className={`tat-banner-box ${atRisk.length > 0 ? 'tat-alert' : 'tat-safe'}`}>
        {atRisk.length > 0 ? (
          <>
            {/* Top Bar: Title, Count, Inline Risk Badge, and Actions */}
            <div className="tat-banner-top-bar">
              <div className="tat-banner-title">
                <span className="tat-alert-icon">⚠️</span>
                <span className="tat-title-text">
                  <strong>{atRisk.length} dispute{atRisk.length > 1 ? 's' : ''}</strong> within 2 days of breaching 7-day TAT{' '}
                  <span className="tat-risk-pill">
                    ₹ {severityStats.totalAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })} at risk
                  </span>{' '}
                  — urgent action required:
                </span>
              </div>
              <div className="tat-banner-actions">
                <button
                  type="button"
                  className="tat-action-btn"
                  onClick={() => navigate('/dispute-handling/validate')}
                  title="Open Dispute Validation to approve, reject, or assign"
                >
                  Take Action in Validation ({atRisk.length}) →
                </button>
                <button
                  type="button"
                  className="tat-collapse-btn"
                  onClick={() => setIsTatCollapsed(!isTatCollapsed)}
                >
                  {isTatCollapsed ? 'Show Items ▼' : 'Minimize ▲'}
                </button>
              </div>
            </div>

            {/* Severity Filter Pills, Search Bar & Page Size Selector */}
            {!isTatCollapsed && (
              <div className="tat-toolbar">
                <div className="tat-chips">
                  <button
                    type="button"
                    className={`tat-chip ${tatSeverity === 'ALL' ? 'active' : ''}`}
                    onClick={() => setTatSeverity('ALL')}
                  >
                    All ({atRisk.length})
                  </button>
                  {severityStats.overdue > 0 && (
                    <button
                      type="button"
                      className={`tat-chip tat-chip--danger ${tatSeverity === 'OVERDUE' ? 'active' : ''}`}
                      onClick={() => setTatSeverity('OVERDUE')}
                    >
                      ● Overdue ({severityStats.overdue})
                    </button>
                  )}
                  {severityStats.oneDay > 0 && (
                    <button
                      type="button"
                      className={`tat-chip tat-chip--orange ${tatSeverity === '1D' ? 'active' : ''}`}
                      onClick={() => setTatSeverity('1D')}
                    >
                      ● 1d Left ({severityStats.oneDay})
                    </button>
                  )}
                  {severityStats.twoDays > 0 && (
                    <button
                      type="button"
                      className={`tat-chip tat-chip--amber ${tatSeverity === '2D' ? 'active' : ''}`}
                      onClick={() => setTatSeverity('2D')}
                    >
                      ● 2d Left ({severityStats.twoDays})
                    </button>
                  )}
                </div>

                <div className="tat-toolbar-right">
                  <div className="tat-search-wrap">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                      type="text"
                      placeholder="Search ID, reason, plaza..."
                      value={tatSearch}
                      onChange={(e) => setTatSearch(e.target.value)}
                    />
                    {tatSearch && (
                      <button type="button" className="tat-clear-search" onClick={() => setTatSearch('')}>
                        ×
                      </button>
                    )}
                  </div>

                  <div className="tat-pagesize-group">
                    <span className="tat-pagesize-label">Show:</span>
                    {[4, 8, 12].map((size) => (
                      <button
                        key={size}
                        type="button"
                        className={`tat-pagesize-btn ${tatPageSize === size ? 'active' : ''}`}
                        onClick={() => setTatPageSize(size)}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Capped At-Risk List (Rendered Page Slice: Constant O(1) DOM Size) */}
            {!isTatCollapsed && (
              <div className="tat-dispute-list">
                {paginatedAtRisk.length === 0 ? (
                  <div className="tat-empty-filtered">
                    No at-risk disputes match the active filter or search query.
                  </div>
                ) : (
                  paginatedAtRisk.map((d) => {
                    const normPlaza = normalizePlaza(d.plazaId, d.plazaName, onboardedPlazas);
                    return (
                      <div key={d.rowId} className="tat-item-row">
                        <div className="tat-item-info">
                          <strong>{d.acqTxnId}</strong> · {d.cbReason} · <span className="tat-amount">₹ {Number(d.disputeAmount || 0).toFixed(2)}</span> · {normPlaza.plazaName} ({normPlaza.plazaId})
                        </div>
                        <div className="tat-item-tail">
                          <span className={`badge ${d.tatBadge?.colorClass || 'badge-amber'}`}>
                            {d.tatBadge?.label}
                          </span>
                          <button
                            type="button"
                            className="tat-row-action-btn"
                            onClick={() => navigate('/dispute-handling/validate')}
                            title="Open in Dispute Validation"
                          >
                            Validate →
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* In-Banner Pagination (Appears when items exceed tatPageSize) */}
            {!isTatCollapsed && filteredAtRisk.length > tatPageSize && (
              <div className="tat-pagination-bar">
                <div className="tat-page-info">
                  Showing <strong>{(tatPage - 1) * tatPageSize + 1}</strong>–<strong>{Math.min(tatPage * tatPageSize, filteredAtRisk.length)}</strong> of <strong>{filteredAtRisk.length}</strong> urgent dispute{filteredAtRisk.length > 1 ? 's' : ''}
                  {atRisk.length !== filteredAtRisk.length && ` (filtered from ${atRisk.length})`}
                </div>
                <div className="tat-page-controls">
                  {totalTatPages > 2 && (
                    <button
                      type="button"
                      className="tat-page-btn"
                      disabled={tatPage <= 1}
                      onClick={() => setTatPage(1)}
                      title="First Page"
                    >
                      « First
                    </button>
                  )}
                  <button
                    type="button"
                    className="tat-page-btn"
                    disabled={tatPage <= 1}
                    onClick={() => setTatPage((p) => Math.max(1, p - 1))}
                  >
                    ← Prev
                  </button>
                  <span className="tat-page-indicator">
                    Page <strong>{tatPage}</strong> of <strong>{totalTatPages}</strong>
                  </span>
                  <button
                    type="button"
                    className="tat-page-btn"
                    disabled={tatPage >= totalTatPages}
                    onClick={() => setTatPage((p) => Math.min(totalTatPages, p + 1))}
                  >
                    Next →
                  </button>
                  {totalTatPages > 2 && (
                    <button
                      type="button"
                      className="tat-page-btn"
                      disabled={tatPage >= totalTatPages}
                      onClick={() => setTatPage(totalTatPages)}
                      title="Last Page"
                    >
                      Last »
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="tat-safe-content">
            <span>✓</span>
            <span>No disputes are close to breaching TAT right now. All open chargebacks are within safe limits.</span>
          </div>
        )}
      </div>

      {/* Spec Count & Amount Tiles */}
      <div className="summary-metrics-grid" style={{ marginBottom: '14px' }}>
        <div className="stat-card clickable-card" onClick={() => navigate('/dispute-handling/dispute-detail-report')} style={{ cursor: 'pointer' }} title="Click to view all assigned disputes">
          <span className="stat-label">Total Assigned</span>
          <span className="stat-value">{stats.totalAssigned || stats.totalDisputes}</span>
          <span className="stat-subtext">₹ {Number(stats.totalDisputedAmount || stats.totalValue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} total value</span>
        </div>
        <div className="stat-card highlight-open clickable-card" onClick={() => navigate('/dispute-handling/validate')} style={{ cursor: 'pointer' }} title="Click to take action on pending disputes">
          <span className="stat-label">Pending Action</span>
          <span className="stat-value" style={{ color: '#d97706' }}>{stats.openDisputes}</span>
          <span className="stat-subtext" style={{ color: '#2563eb', fontWeight: 600 }}>👉 Take Action in Validate</span>
        </div>
        <div className="stat-card clickable-card" onClick={() => navigate('/dispute-handling/dispute-detail-report')} style={{ cursor: 'pointer' }}>
          <span className="stat-label">Accepted</span>
          <span className="stat-value" style={{ color: '#16a34a' }}>{stats.approvedCount}</span>
          <span className="stat-subtext">₹ {Number(stats.acceptedAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="stat-card clickable-card" onClick={() => navigate('/dispute-handling/dispute-detail-report')} style={{ cursor: 'pointer' }}>
          <span className="stat-label">Rejected</span>
          <span className="stat-value" style={{ color: '#dc2626' }}>{stats.rejectedCount}</span>
          <span className="stat-subtext">₹ {Number(stats.rejectedAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="stat-card highlight-closed clickable-card" onClick={() => navigate('/dispute-handling/dispute-detail-report')} style={{ cursor: 'pointer' }}>
          <span className="stat-label">Closed</span>
          <span className="stat-value">{stats.closedCount || stats.closedDisputes}</span>
          <span className="stat-subtext">Reviewed &amp; settled</span>
        </div>
      </div>

      {/* Amount & TAT Split Grid */}
      <div className="summary-metrics-grid" style={{ marginBottom: '20px' }}>
        <div className="stat-card">
          <span className="stat-label">Total Disputed Amount</span>
          <span className="stat-value">₹ {Number(stats.totalDisputedAmount || stats.totalValue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          <span className="stat-subtext">Gross claims filed</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Within TAT</span>
          <span className="stat-value" style={{ color: '#16a34a' }}>{stats.withinTatCount ?? stats.openDisputes}</span>
          <span className="stat-subtext">Inside 8-day SLA window</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">TAT Breached</span>
          <span className="stat-value" style={{ color: (stats.tatBreachedCount || 0) > 0 ? '#dc2626' : '#64748b' }}>
            {stats.tatBreachedCount || 0}
          </span>
          <span className="stat-subtext">Exceeded T+8 SLA</span>
        </div>
        <div className="stat-card highlight-split">
          <span className="stat-label">Approved vs Rejected Ratio</span>
          <span className="stat-value">{stats.approvedVsRejectedRatio}</span>
          <span className="stat-subtext">{stats.approvedCount} accepted / {stats.rejectedCount} rejected</span>
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
