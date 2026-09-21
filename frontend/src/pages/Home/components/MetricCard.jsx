import React from 'react';

export const MetricCard = ({ title, value, change, isPositive = true, prefix = '', suffix = '' }) => {
  return (
    <div className="card metric-card">
      <div className="metric-card__header">
        <span className="metric-card__title">{title}</span>
        {change !== undefined && (
          <span className={`badge ${isPositive ? 'badge--success' : 'badge--danger'}`}>
            {isPositive ? '↑ +' : '↓ -'}{Math.abs(change)}%
          </span>
        )}
      </div>
      <div className="metric-card__body">
        <h2 className="metric-card__value">
          {prefix}{value}{suffix}
        </h2>
      </div>
    </div>
  );
};

export default MetricCard;
