import React from 'react';

export const KpiGrid = ({ stats }) => {
  if (!stats) return null;

  const cards = [
    {
      label: 'Total Users',
      value: stats.totalUsers ?? 0,
      delta: stats.totalUsersDelta,
      unit: '',
      isPositive: true,
      sub: 'All platform accounts',
      highlightColor: 'var(--brand-blue)',
    },
    {
      label: 'Active / Logged-in Users',
      value: stats.activeUsers ?? 0,
      delta: stats.activeUsersDelta,
      unit: '',
      isPositive: true,
      sub: 'Concurrent live sessions',
      highlightColor: 'var(--brand-green)',
    },
    {
      label: 'Inactive Users',
      value: stats.inactiveUsers ?? 0,
      delta: stats.inactiveUsersDelta,
      unit: '',
      isPositive: false,
      sub: 'Dormant or unverified',
      highlightColor: 'var(--muted)',
    },
    {
      label: 'Locked / Disabled Users',
      value: stats.lockedUsers ?? 0,
      delta: stats.lockedUsersDelta,
      unit: '',
      isPositive: (stats.lockedUsersDelta || 0) <= 0,
      sub: 'Administrative security locks',
      highlightColor: 'var(--danger-text)',
    },
    {
      label: 'Failed Login Attempts (today)',
      value: stats.failedLoginsToday ?? 0,
      delta: stats.failedLoginsDelta,
      unit: '',
      isPositive: (stats.failedLoginsDelta || 0) <= 0,
      sub: 'Rejected authentication events',
      highlightColor: 'var(--danger-text)',
    },
    {
      label: 'Total Activities Today',
      value: stats.totalActivitiesToday ?? 0,
      delta: stats.totalActivitiesDelta,
      unit: '',
      isPositive: true,
      sub: 'Audit operations processed',
      highlightColor: 'var(--brand-blue)',
    },
    {
      label: 'Critical Security Events',
      value: stats.criticalSecurityEvents ?? 0,
      delta: stats.criticalSecurityEventsDelta,
      unit: '',
      isPositive: (stats.criticalSecurityEventsDelta || 0) <= 0,
      sub: 'Flagged for compliance review',
      highlightColor: 'var(--warning-text)',
    },
    {
      label: 'Exports Performed',
      value: stats.exportsPerformed ?? 0,
      delta: stats.exportsPerformedDelta,
      unit: '',
      isPositive: true,
      sub: 'Compliance downloads logged',
      highlightColor: 'var(--brand-blue)',
    },
  ];

  return (
    <div className="activity-kpi-grid">
      {cards.map((card, idx) => (
        <div key={idx} className="kpi-card">
          <div className="kpi-card__top">
            <span className="kpi-card__label">{card.label}</span>
            {card.delta !== undefined && (
              <span className={`kpi-badge ${card.isPositive ? 'positive' : 'negative'}`}>
                {card.delta > 0 ? `+${card.delta}%` : `${card.delta}%`}
              </span>
            )}
          </div>
          <div className="kpi-card__value" style={{ color: card.highlightColor }}>
            {card.value}
            <span className="unit">{card.unit}</span>
          </div>
          <div className="kpi-card__sub">{card.sub}</div>
        </div>
      ))}
    </div>
  );
};

export default KpiGrid;
