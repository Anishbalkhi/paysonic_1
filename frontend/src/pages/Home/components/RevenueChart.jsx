import React, { useState } from 'react';
import { formatCurrency } from '../../../utils/formatters';

export const RevenueChart = ({ data = [] }) => {
  const [activeMetric, setActiveMetric] = useState('revenue');
  const maxVal = Math.max(...data.map((d) => d[activeMetric]), 1);

  return (
    <div className="card revenue-chart">
      <div className="revenue-chart__header">
        <div>
          <h3 className="revenue-chart__title">Performance Overview</h3>
          <p className="revenue-chart__subtitle">Processed volume vs realized net revenue</p>
        </div>
        <div className="revenue-chart__controls">
          <button
            type="button"
            className={`control-btn ${activeMetric === 'revenue' ? 'active' : ''}`}
            onClick={() => setActiveMetric('revenue')}
          >
            Revenue
          </button>
          <button
            type="button"
            className={`control-btn ${activeMetric === 'volume' ? 'active' : ''}`}
            onClick={() => setActiveMetric('volume')}
          >
            Tx Volume
          </button>
        </div>
      </div>

      <div className="revenue-chart__bars">
        {data.map((item, idx) => {
          const heightPercent = Math.round((item[activeMetric] / maxVal) * 100);
          return (
            <div key={idx} className="bar-column" title={`${item.month}: ${formatCurrency(item[activeMetric])}`}>
              <div className="bar-wrapper">
                <div
                  className="bar-fill"
                  style={{ height: `${heightPercent}%` }}
                />
              </div>
              <span className="bar-label">{item.month}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RevenueChart;
