import React from 'react';
import { formatCurrency, formatNumber, getStatusBadgeClass } from '../../../utils/formatters';

export const ProductOverview = ({ product }) => {
  return (
    <div className="card product-overview mb-6">
      <div className="flex-between mb-4 flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="product-title">{product.name}</h2>
            <span className={`badge ${getStatusBadgeClass(product.status)}`}>
              {product.status.toUpperCase()}
            </span>
            <span className="badge badge--neutral">{product.version}</span>
          </div>
          <p className="product-tagline">{product.tagline}</p>
        </div>
      </div>

      <div className="product-stats-grid">
        <div className="stat-box">
          <span className="stat-label">Active Deployments</span>
          <span className="stat-value">{formatNumber(product.metrics?.activeMerchants)}</span>
        </div>
        <div className="stat-box">
          <span className="stat-label">Monthly Volume</span>
          <span className="stat-value">{formatCurrency(product.metrics?.monthlyVolumeUSD)}</span>
        </div>
        <div className="stat-box">
          <span className="stat-label">Avg P99 Latency</span>
          <span className="stat-value">{product.metrics?.avgLatency}</span>
        </div>
        <div className="stat-box">
          <span className="stat-label">High-Availability SLA</span>
          <span className="stat-value text-success">{product.metrics?.uptimeSLA}</span>
        </div>
      </div>
    </div>
  );
};

export default ProductOverview;
