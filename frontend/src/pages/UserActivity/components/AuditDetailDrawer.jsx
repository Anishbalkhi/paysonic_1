import React, { useState } from 'react';
import { buildDiff } from '../../../utils/auditDiff';
import { referenceFor } from '../../../utils/auditReference';
import { formatFullTimestamp } from '../../../utils/dateUtils';
import { resolveTargetUser, getEventNarrative } from '../../../utils/auditEntityResolver';

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
  const targetUser = resolveTargetUser(event);

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
            Logged on {formatFullTimestamp(event.timestamp)}
          </span>
        </div>

        <div className="drawer-body">
          {/* Prominent Target Entity Reference Banner */}
          <div className="audit-ref-banner">
            <div className="audit-ref-label">
              Target Entity Reference ({targetUser ? 'User Profile' : (ref.label || 'Entity')})
            </div>
            <div className="audit-ref-id" style={{ color: '#155EEF', fontWeight: 800 }}>
              {targetUser ? targetUser.id : maskSensitive(ref.refId)}
            </div>
            <div className="audit-ref-target" style={{ fontWeight: 600, marginTop: '2px' }}>
              {targetUser
                ? `${targetUser.name} · ${targetUser.role}${targetUser.email ? ` (${targetUser.email})` : ''}`
                : displayOrNotCaptured(event.target)}
            </div>
          </div>

          {/* Target User Details Card (Whenever user management action is selected) */}
          {targetUser && (
            <div className="drawer-section" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', borderBottom: '1px solid #EDF2F7', paddingBottom: '8px' }}>
                <h4 style={{ margin: 0, fontSize: '13.5px', color: '#1E293B', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#155EEF" strokeWidth="2.2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  Target User Details
                </h4>
                <span
                  className={`status-pill ${
                    targetUser.isDelete ? 'status-pill--danger' : 'status-pill--success'
                  }`}
                  style={{ fontSize: '11.5px', padding: '3px 8px' }}
                >
                  {targetUser.status}
                </span>
              </div>

              <div className="meta-grid">
                <div className="meta-item">
                  <span className="label">User System ID</span>
                  <span className="value font-mono font-semibold" style={{ color: '#155EEF' }}>
                    {targetUser.id}
                  </span>
                </div>
                <div className="meta-item">
                  <span className="label">Full Name</span>
                  <span className="value font-semibold" style={{ color: '#0F172A' }}>
                    {targetUser.name}
                  </span>
                </div>
                <div className="meta-item">
                  <span className="label">Assigned Role</span>
                  <span className="value font-medium">
                    {targetUser.role}
                  </span>
                </div>
                <div className="meta-item">
                  <span className="label">Email Address</span>
                  <span className="value font-mono" style={{ fontSize: '12.5px' }}>
                    {targetUser.email || 'Not captured'}
                  </span>
                </div>
                <div className="meta-item">
                  <span className="label">Assigned Plaza</span>
                  <span className="value font-medium">
                    {targetUser.plaza || 'All plazas'}
                  </span>
                </div>
                <div className="meta-item">
                  <span className="label">Mobile Number</span>
                  <span className="value">
                    {targetUser.mobile || 'Not captured'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* System Notes & Audit Remarks (Human-Readable Narrative) */}
          <div className="drawer-section">
            <h4>System Notes &amp; Audit Remarks</h4>
            <div className="details-box" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '14px', borderRadius: '8px', lineHeight: 1.6 }}>
              <p style={{ margin: 0, fontSize: '13.5px', color: '#1E293B', fontWeight: 500 }}>
                {getEventNarrative(event, targetUser)}
              </p>
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
