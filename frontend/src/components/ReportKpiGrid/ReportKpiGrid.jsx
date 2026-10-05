import React from 'react';
import './ReportKpiGrid.scss';

/**
 * Reusable Small Dashboard KPI Grid for Report Pages.
 * 
 * @param {Array} cards - Array of card objects:
 *   - label: string (e.g. "TOTAL TRANSACTIONS")
 *   - value: string | number (e.g. "12", "₹ 300.00", "ONLINE")
 *   - sub: string (e.g. "Filtered Records")
 *   - highlight: 'blue' | 'purple' | 'green' | 'amber' | 'red' (optional)
 *   - isBadge: boolean (optional, styles value as green badge like "ONLINE")
 *   - className: string (optional extra classes)
 */
export const ReportKpiGrid = ({ cards = [], className = '' }) => {
  if (!cards || cards.length === 0) return null;

  return (
    <div className={`report-kpi-grid ${className}`}>
      {cards.map((card, idx) => (
        <div
          key={idx}
          className={`report-kpi-card ${card.highlight ? `highlight-${card.highlight}` : ''} ${card.className || ''}`}
        >
          <div className="report-kpi-label">{card.label}</div>
          <div className={`report-kpi-value ${card.isBadge ? 'live-badge' : ''}`}>
            {card.value}
          </div>
          {card.sub && <div className="report-kpi-sub">{card.sub}</div>}
        </div>
      ))}
    </div>
  );
};

export default ReportKpiGrid;
