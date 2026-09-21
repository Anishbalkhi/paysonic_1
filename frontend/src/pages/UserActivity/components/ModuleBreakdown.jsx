import React from 'react';

const MODULE_COLORS = {
  'User Management': '#3762F2',
  'Dispute Handling': '#EF6820',
  'Recon Management': '#17A34A',
  'Violation Management': '#B42318',
  'Transactional Report': '#6941C6',
  'Pass Issuance': '#0284C7',
  'Tag Details': '#D97706',
  'On Boarding': '#0F172A',
};

export const ModuleBreakdown = ({ breakdown = [] }) => {
  return (
    <div className="module-breakdown-card">
      <div className="module-breakdown-card__header">
        <h3>Audit Activity by Module</h3>
        <p>Proportion of administrative actions recorded across modules</p>
      </div>

      <div className="module-breakdown-list">
        {breakdown.map((item) => {
          const color = MODULE_COLORS[item.name] || '#64748B';
          return (
            <div key={item.name} className="breakdown-row">
              <div className="breakdown-row__info">
                <span className="name">
                  <span className="dot" style={{ background: color }} />
                  {item.name}
                </span>
                <span className="count">
                  {item.count} events <b>({item.percentage}%)</b>
                </span>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{
                    width: `${Math.min(item.percentage, 100)}%`,
                    backgroundColor: color,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ModuleBreakdown;
