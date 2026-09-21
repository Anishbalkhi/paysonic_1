import React from 'react';
import { referenceFor } from '../../../utils/auditReference';

export const RecentActivityTable = ({ events = [], onSelectEvent, onViewAll }) => {
  const formatTime = (ts) => {
    if (!ts) return '—';
    const d = new Date(ts);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'SUCCESS':
        return <span className="status-pill status-pill--success">Success</span>;
      case 'WARNING':
        return <span className="status-pill status-pill--warning">Warning</span>;
      case 'FAILURE':
        return <span className="status-pill status-pill--danger">Failure</span>;
      default:
        return <span className="status-pill status-pill--neutral">{status}</span>;
    }
  };

  return (
    <div className="recent-activity-card">
      <div className="recent-activity-card__header">
        <div>
          <h3>Real-Time Audit Trail</h3>
          <p>Chronological feed of administrative and automated actions</p>
        </div>
        {onViewAll && (
          <button type="button" className="view-all-btn" onClick={onViewAll}>
            View Full Audit Log →
          </button>
        )}
      </div>

      <div className="table-scroll">
        <table className="activity-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Module</th>
              <th>Reference Target</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Inspect</th>
            </tr>
          </thead>
          <tbody>
            {events.slice(0, 8).map((evt) => {
              const ref = referenceFor(evt);
              return (
                <tr key={evt.id} onClick={() => { if (onSelectEvent) onSelectEvent(evt); }}>
                  <td className="time-cell">{formatTime(evt.timestamp)}</td>
                  <td>
                    <div className="actor-cell">
                      <strong>{evt.actor.name}</strong>
                      <span>{evt.actor.role}</span>
                    </div>
                  </td>
                  <td>
                    <span className="action-pill">{evt.actionLabel}</span>
                  </td>
                  <td>
                    <span className="module-tag">{evt.module}</span>
                  </td>
                  <td>
                    <span className="ref-tag">{ref.refId}</span>
                  </td>
                  <td>{getStatusBadge(evt.status)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      type="button"
                      className="inspect-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onSelectEvent) onSelectEvent(evt);
                      }}
                      title="Inspect Event Diff & Payload"
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RecentActivityTable;
