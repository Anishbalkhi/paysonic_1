import React from 'react';
import { formatCurrency, formatDate, getStatusBadgeClass } from '../../../utils/formatters';

export const TransactionTable = ({ transactions = [], onViewDetail }) => {
  return (
    <div className="card transaction-section">
      <div className="flex-between mb-4">
        <div>
          <h3 className="section-title">Live Transactions Feed</h3>
          <p className="text-muted text-sm">Real-time settlement activity across merchant gateways</p>
        </div>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Txn ID</th>
              <th>Customer / Account</th>
              <th>Method</th>
              <th>Amount</th>
              <th>Timestamp</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => (
              <tr key={tx.id}>
                <td>
                  <span className="font-semibold text-primary">{tx.id}</span>
                </td>
                <td>
                  <div className="flex-col">
                    <span className="font-medium">{tx.customer}</span>
                    <span className="text-muted text-xs">{tx.email}</span>
                  </div>
                </td>
                <td>
                  <span className="badge badge--neutral">{tx.method}</span>
                </td>
                <td>
                  <span className="font-semibold">{formatCurrency(tx.amount, tx.currency)}</span>
                </td>
                <td>
                  <span className="text-muted">{formatDate(tx.date, true)}</span>
                </td>
                <td>
                  <span className={`badge ${getStatusBadgeClass(tx.status)}`}>
                    {tx.status}
                  </span>
                </td>
                <td>
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    onClick={() => onViewDetail && onViewDetail(tx)}
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TransactionTable;
