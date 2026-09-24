import React, { useState } from 'react';
import { buildDiff } from '../../../utils/auditDiff';
import { referenceFor } from '../../../utils/auditReference';

// Helper to mask sensitive tokens and session references
const maskSensitive = (val) => {
  if (typeof val !== 'string') return val;
  if (/^SES-([A-Za-z0-9]+)$/i.test(val)) {
    return val.replace(/^SES-(.*)(.{3})$/, 'SES-***$2');
  }
  if (/bearer\s+[A-Za-z0-9._-]+/i.test(val) || /tok_[A-Za-z0-9]+/i.test(val)) {
    return '••••••••••••';
  }
  return val;
};

export const AuditDetailDrawer = ({ event, onClose }) => {
  const [showRaw, setShowRaw] = useState(false);

  if (!event) return null;

  const diffs = buildDiff(event.before, event.after);
  const ref = referenceFor(event);

  const displayOrNotCaptured = (val) => {
    if (val === undefined || val === null || val === '') return 'Not captured';
    return val;
  };

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <aside className="audit-drawer">
        <div className="drawer-header">
          <div className="drawer-header__top">
            <span className="event-tag">{event.id}</span>
            <button type="button" className="close-btn" onClick={onClose} aria-label="Close drawer">
              ✕
            </button>
          </div>
          <h2>{event.actionLabel || displayOrNotCaptured(event.action)}</h2>
          <span className="timestamp">
            Logged on{' '}
            {new Date(event.timestamp).toLocaleString('en-US', {
              dateStyle: 'full',
              timeStyle: 'medium',
            })}
          </span>
        </div>

        <div className="drawer-body">
          {/* Prominent Reference Banner (UAM-FR-011, UAM-FR-015) */}
          <div
            style={{
              background: 'linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)',
              border: '1px solid #C7D2FE',
              borderRadius: '10px',
              padding: '14px 16px',
              marginBottom: '20px',
            }}
          >
            <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, color: '#4338CA', letterSpacing: '0.04em' }}>
              Target Entity Reference ({ref.label || 'Entity'})
            </div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#1E1B4B', marginTop: '4px', fontFamily: 'monospace' }}>
              {maskSensitive(ref.refId)}
            </div>
            <div style={{ fontSize: '12.5px', color: '#4338CA', marginTop: '2px' }}>
              {displayOrNotCaptured(event.target)}
            </div>
          </div>

          {/* Metadata Section */}
          <div className="drawer-section">
            <h4>Execution Context &amp; Telemetry</h4>
            <div className="meta-grid">
              <div className="meta-item">
                <span className="label">Actor Identity</span>
                <span className="value font-semibold">{event.actor?.name || 'Not captured'}</span>
                <span className="sub">{event.actor?.role || 'Not captured'}</span>
              </div>
              <div className="meta-item">
                <span className="label">Correlation ID</span>
                <span className="value font-mono" style={{ color: 'var(--brand-blue)' }}>
                  {displayOrNotCaptured(event.correlationId)}
                </span>
                <span className="sub">End-to-End Tracing Key</span>
              </div>
              <div className="meta-item">
                <span className="label">Origin IP Address</span>
                <span className="value font-mono">{event.actor?.ipAddress || 'Not captured'}</span>
                <span className="sub">Direct / Gateway Hop</span>
              </div>
              <div className="meta-item">
                <span className="label">Client / Device</span>
                <span className="value" style={{ fontFamily: 'monospace', fontSize: '12.5px' }}>
                  {event.device || event.actor?.device || (
                    event.actor?.ipAddress
                      ? `Origin: ${event.actor.ipAddress}`
                      : 'Not captured'
                  )}
                </span>
                <span className="sub">
                  {event.device || event.actor?.device
                    ? 'Reported browser/OS'
                    : 'Device telemetry not stored at audit level'}
                </span>
              </div>
              <div className="meta-item">
                <span className="label">Module</span>
                <span className="value font-semibold">{displayOrNotCaptured(event.module)}</span>
              </div>
              <div className="meta-item">
                <span className="label">Execution Status</span>
                <span className="value">
                  <span
                    className={`status-pill ${
                      event.status === 'SUCCESS'
                        ? 'status-pill--success'
                        : event.status === 'WARNING'
                        ? 'status-pill--warning'
                        : 'status-pill--danger'
                    }`}
                  >
                    {event.status}
                  </span>
                </span>
              </div>
              <div className="meta-item full">
                <span className="label">Plaza Jurisdiction</span>
                <span className="value">{displayOrNotCaptured(event.plaza)}</span>
              </div>
            </div>
          </div>

          {/* Description & Remarks */}
          <div className="drawer-section">
            <h4>System Notes &amp; Audit Remarks</h4>
            <div className="details-box">
              {event.details ? event.details : <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>Not captured</span>}
            </div>
          </div>

          {/* Diff View */}
          <div className="drawer-section">
            <div className="flex-between mb-3">
              <h4>State Delta &amp; Changes</h4>
              <button
                type="button"
                className="toggle-raw-btn"
                onClick={() => setShowRaw(!showRaw)}
              >
                {showRaw ? 'Show Formatted Diff' : 'View Raw Payload'}
              </button>
            </div>

            {showRaw ? (
              <pre className="raw-json-box">
                {JSON.stringify(
                  {
                    before: event.before,
                    after: event.after,
                  },
                  null,
                  2
                )}
              </pre>
            ) : diffs.length > 0 ? (
              <div className="diff-table-wrap">
                <table className="diff-table">
                  <thead>
                    <tr>
                      <th>Property</th>
                      <th>Previous Value</th>
                      <th>New Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diffs.map((d, i) => (
                      <tr key={i} className={`diff-row diff-row--${d.type}`}>
                        <td className="field-cell font-semibold">{d.field}</td>
                        <td className="val-cell before-val">
                          {d.before !== null ? (
                            <span className="diff-pill removed">{maskSensitive(d.before)}</span>
                          ) : (
                            <span className="text-muted">Not captured</span>
                          )}
                        </td>
                        <td className="val-cell after-val">
                          {d.after !== null ? (
                            <span className="diff-pill added">{maskSensitive(d.after)}</span>
                          ) : (
                            <span className="text-muted">Not captured</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="no-diff-box">
                No state change delta recorded for this read / query event.
              </div>
            )}
          </div>
        </div>

        <div className="drawer-foot">
          <button type="button" className="btn btn-secondary w-full" onClick={onClose}>
            Close Inspector
          </button>
        </div>
      </aside>
    </>
  );
};

export default AuditDetailDrawer;
