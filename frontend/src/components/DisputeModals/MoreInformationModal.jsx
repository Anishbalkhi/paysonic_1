import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import DisputeManagementService from '../../services/dispute/DisputeManagementService';
import { formatDateTime, formatDateOnly } from '../../utils/dateUtils';
import {
  downloadSingleEvidence,
  downloadAllEvidenceAsZip,
  getEvidenceDownloadName,
} from '../../utils/evidenceDownloader';
import EvidencePreviewModal from './EvidencePreviewModal';
import EvidenceUploader from './EvidenceUploader';
import './DisputeModals.scss';

export const MoreInformationModal = ({ isOpen, onClose, disputeRow, onUpdated }) => {
  const { currentUser } = useAuth();
  const [adminReason, setAdminReason] = useState('');
  const [adminEvidence, setAdminEvidence] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [previewTarget, setPreviewTarget] = useState(null);
  const [copiedPlazaRemark, setCopiedPlazaRemark] = useState(false);
  const [isZippingPlaza, setIsZippingPlaza] = useState(false);
  const [isZippingAdmin, setIsZippingAdmin] = useState(false);

  const handleCopyPlazaRemarks = async () => {
    const textToCopy = (disputeRow?.plazaReason || disputeRow?.plazaRemarks || 'NA').trim();
    if (!textToCopy) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        const ta = document.createElement('textarea');
        ta.value = textToCopy;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopiedPlazaRemark(true);
      setTimeout(() => setCopiedPlazaRemark(false), 2000);
    } catch (err) {
      console.error('Failed to copy plaza remark:', err);
    }
  };

  const handleDownloadSingle = async (item, index, list) => {
    try {
      await downloadSingleEvidence(item, index, list.length, disputeRow);
    } catch (err) {
      alert('Failed to download evidence file: ' + err.message);
    }
  };

  const handleDownloadPlazaZip = async () => {
    const list = disputeRow?.plazaEvidence || [];
    if (list.length === 0) return;
    try {
      setIsZippingPlaza(true);
      await downloadAllEvidenceAsZip(list, disputeRow);
    } catch (err) {
      alert('Failed to download Plaza Evidence ZIP: ' + err.message);
    } finally {
      setIsZippingPlaza(false);
    }
  };

  const handleDownloadAdminZip = async () => {
    const list = adminEvidence || [];
    if (list.length === 0) return;
    try {
      setIsZippingAdmin(true);
      await downloadAllEvidenceAsZip(list, disputeRow);
    } catch (err) {
      alert('Failed to download Admin Evidence ZIP: ' + err.message);
    } finally {
      setIsZippingAdmin(false);
    }
  };

  useEffect(() => {
    if (disputeRow) {
      // Pick reason directly from dispute file (Member Message Text / CB Reason)
      const fileReason = (disputeRow.memberMessageText || disputeRow.cbReason || '').trim();
      const existingAdminReason = (disputeRow.adminReason || disputeRow.adminRemarks || '').trim();
      const initialReason = (!existingAdminReason || existingAdminReason === 'Bulk-assigned for plaza review') && fileReason
        ? fileReason
        : (existingAdminReason || fileReason);

      setAdminReason(initialReason);
      setAdminEvidence(disputeRow.adminEvidence || []);
      setErrorMsg('');
      setPreviewTarget(null);
    }
  }, [disputeRow]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.key === 'Escape' || e.key === 'Esc') && isOpen) {
        if (previewTarget) {
          setPreviewTarget(null);
        } else {
          onClose();
        }
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, previewTarget, onClose]);

  if (!isOpen || !disputeRow) return null;

  const isAssigned = Boolean(disputeRow.assigned);

  const assignedAtDisplay = (() => {
    if (disputeRow.assignedAt) {
      const f = formatDateTime(disputeRow.assignedAt);
      if (f && f !== '—') return f;
    }
    if (disputeRow.adminRemarksAt) {
      const f = formatDateTime(disputeRow.adminRemarksAt);
      if (f && f !== '—') return f;
    }
    if (isAssigned) {
      const fallback = disputeRow.updatedAt || disputeRow.plazaActionTime || disputeRow.createdAt;
      if (fallback && fallback !== 'Pending Plaza Decision') {
        const f = formatDateTime(fallback);
        if (f && f !== '—') return f;
      }
    }
    return '—';
  })();

  const handleAssignToPlaza = async () => {
    if (!adminReason.trim()) {
      setErrorMsg('Reason / remarks explaining the dispute is mandatory.');
      return;
    }

    try {
      setIsSubmitting(true);
      const actorName = currentUser?.name || currentUser?.role || 'Master Admin';
      const rowIdentifier = disputeRow.rowId || disputeRow.disputeId;
      await DisputeManagementService.assignRow(
        rowIdentifier,
        adminReason.trim(),
        adminEvidence,
        actorName,
        disputeRow.plazaId
      );
      if (onUpdated) onUpdated();
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to assign dispute to plaza');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderEvidenceChip = (item, index, isAdminCol = false) => {
    const fileName = typeof item === 'string' ? item : item.name || 'attachment';
    const lowerName = fileName.toLowerCase();
    const isImg =
      lowerName.endsWith('.jpg') ||
      lowerName.endsWith('.jpeg') ||
      lowerName.endsWith('.png') ||
      lowerName.endsWith('.webp');
    const isPdf = lowerName.endsWith('.pdf');
    const isLog = lowerName.endsWith('.txt') || lowerName.endsWith('.log');
    const icon = isImg ? '📷' : isPdf ? '📄' : isLog ? '📝' : '📎';
    const sourceLabel = isAdminCol ? 'Acquirer Evidence' : 'Plaza Evidence';

    const fileListForSource = isAdminCol ? (adminEvidence || []) : (disputeRow.plazaEvidence || []);

    return (
      <div key={index} className="evidence-chip rich-evidence-card">
        <div
          className="file-meta clickable-meta"
          onClick={() => setPreviewTarget({ file: item, source: sourceLabel, fileList: fileListForSource })}
          title={`Click to view ${fileName}`}
        >
          <span className="file-type-icon">{icon}</span>
          <div className="file-text-col">
            <span className="file-name-text">{fileName}</span>
            <span className="file-hint-text">
              {isImg ? 'Image · Click to view photo' : isPdf ? 'PDF · Click to view document' : 'Evidence File'}
            </span>
          </div>
        </div>

        <div className="chip-actions-group">
          <button
            type="button"
            className="btn-preview-evidence"
            onClick={() => setPreviewTarget({ file: item, source: sourceLabel, fileList: fileListForSource })}
            title="View Attachment"
          >
            👁️ View
          </button>
          <button
            type="button"
            className="btn-download-evidence"
            onClick={() => handleDownloadSingle(item, index, fileListForSource)}
            title="Download Evidence File (Named by RRN)"
          >
            ⬇️ Download
          </button>
          <span className="locked-tag">
            {isAdminCol ? (isAssigned ? 'Locked' : 'Attached') : 'View Only'}
          </span>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="dispute-modal-overlay" onClick={onClose}>
        <div
          className="dispute-modal size-lg"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          <div className="modal-header-banner">
            <div>
              <h2>More Information — Chargeback Assignment</h2>
              <div style={{ fontSize: '0.8rem', opacity: 0.9, marginTop: '2px' }}>
                Acquirer and Plaza evidence attachments are visible to both parties for audit compliance.
              </div>
            </div>
            <button type="button" className="btn-close-modal" onClick={onClose}>
              ✕
            </button>
          </div>

          <div className="modal-body">
            {errorMsg && (
              <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#991b1b', fontSize: '0.85rem' }}>
                {errorMsg}
              </div>
            )}

            {/* Plaza Meta Header */}
            <div className="plaza-meta-row">
              <div className="meta-box">
                <label>Plaza Name</label>
                <div className="meta-display">{disputeRow.plazaName}</div>
              </div>
              <div className="meta-box">
                <label>Plaza ID</label>
                <div className="meta-display">{disputeRow.plazaId}</div>
              </div>
              <div className="meta-box">
                <label>Dispute Raise Date</label>
                <div className="meta-display">{formatDateOnly(disputeRow.settlementDate || disputeRow.cbRaisedDate) || '—'}</div>
              </div>
              <div className="meta-box">
                <label>TAT Due Date</label>
                <div className="meta-display" style={{ color: '#0369a1', fontWeight: 600 }}>
                  {formatDateOnly(disputeRow.tatDueDate) || disputeRow.tatDueDate || '—'}
                </div>
              </div>
              <div className="meta-box">
                <label>Assigned Date &amp; Time</label>
                <div className="meta-display">{assignedAtDisplay}</div>
              </div>
              <div className="meta-box">
                <label>Plaza Action Date &amp; Time</label>
                <div className="meta-display" style={{ fontWeight: 600 }}>
                  {disputeRow.plazaActionTime ? (disputeRow.plazaActionTime === 'Pending Plaza Decision' ? '—' : formatDateTime(disputeRow.plazaActionTime)) : '—'}
                </div>
              </div>
            </div>

            {/* Two Independent Columns: Admin (Left) & Plaza (Right) */}
            <div className="two-column-layout">
              {/* Left: Admin's Reason & Proof */}
              <div className="evidence-section-card">
                <div className="section-banner admin-banner">
                  Admin · User's Reasons and Proof
                </div>
                <div className="section-content">
                  <div className="field-block">
                    <label htmlFor="adminReasonInput">
                      Reason / Explanation <span style={{ color: '#ef4444' }}>* (Mandatory)</span>
                    </label>
                    <textarea
                      id="adminReasonInput"
                      rows={3}
                      placeholder="Enter mandatory reason explaining the chargeback assignment..."
                      value={adminReason}
                      onChange={(e) => setAdminReason(e.target.value)}
                      disabled={isAssigned}
                    />
                  </div>

                  {!isAssigned ? (
                    <>
                      <EvidenceUploader
                        files={adminEvidence}
                        onChange={setAdminEvidence}
                        disabled={isSubmitting}
                        label="Acquirer Evidence Attachments"
                        isMandatory={false}
                        onPreview={(file) => setPreviewTarget({ file, source: 'Acquirer Evidence', fileList: adminEvidence })}
                      />

                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleAssignToPlaza}
                        disabled={isSubmitting || !adminReason.trim()}
                        style={{ width: '100%', marginTop: '10px' }}
                      >
                        {isSubmitting ? 'Assigning...' : 'Assign to Plaza'}
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="attachment-section-label" style={{ marginTop: '10px' }}>
                        <span>Admin Attachments ({adminEvidence.length})</span>
                        <span className="sub-tag">Visible to Admin &amp; Plaza</span>
                      </div>
                      <div className="files-container">
                        {adminEvidence.length === 0 ? (
                          <div className="no-evidence-text">No evidence uploaded</div>
                        ) : (
                          adminEvidence.map((f, i) => renderEvidenceChip(f, i, true))
                        )}
                      </div>
                      <div className="audit-locked-banner" style={{ marginTop: '10px' }}>
                        🔒 Assigned by {disputeRow.assignedBy || 'Admin'} on{' '}
                        {assignedAtDisplay !== '—' ? assignedAtDisplay : '—'} — Locked for audit.
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Right: Plaza's Uploaded Evidence (Read-Only to Admin) */}
              <div className="evidence-section-card">
                <div className="section-banner plaza-banner">
                  Plaza · Evidence &amp; Decision from Plaza
                </div>
                <div className="section-content">
                  {/* Plaza Reason / Remarks directly in front of Admin Reason */}
                  <div className="field-block">
                    <div className="field-label-row">
                      <label>Plaza Reason / Remarks</label>
                      <button
                        type="button"
                        className={`btn-copy-tag ${copiedPlazaRemark ? 'copied' : ''}`}
                        onClick={handleCopyPlazaRemarks}
                        title="Copy Plaza remarks to clipboard"
                        id="copyPlazaRemarkBtn"
                      >
                        {copiedPlazaRemark ? '✓ Copied' : '📋 Copy'}
                      </button>
                    </div>
                    <div
                      className="readonly-value-box"
                      style={{
                        minHeight: '84px',
                        wordBreak: 'break-word',
                        whiteSpace: 'pre-wrap',
                        lineHeight: '1.45',
                      }}
                    >
                      {disputeRow.plazaReason || disputeRow.plazaRemarks || 'NA'}
                    </div>
                  </div>

                  {/* Plaza Attachments directly in front of Admin Attachments */}
                  <div className="attachment-section-label" style={{ marginTop: '10px' }}>
                    <span>Plaza Attachments ({(disputeRow.plazaEvidence || []).length})</span>
                    <span className="sub-tag">Visible to Admin &amp; Plaza</span>
                  </div>

                  <div className="files-container">
                    {(disputeRow.plazaEvidence || []).length === 0 ? (
                      <div className="no-evidence-text">No counter-evidence uploaded</div>
                    ) : (
                      disputeRow.plazaEvidence.map((f, i) =>
                        renderEvidenceChip(f, i, false)
                      )
                    )}
                  </div>

                  <div className="field-block">
                    <label>Plaza Action Date &amp; Time (IST)</label>
                    <div className="readonly-value-box" style={{ fontWeight: 600, color: '#0369a1' }}>
                      {disputeRow.plazaActionTime ? (disputeRow.plazaActionTime === 'Pending Plaza Decision' ? 'Pending Plaza Decision' : formatDateTime(disputeRow.plazaActionTime)) : 'Pending Plaza Decision'}
                    </div>
                  </div>

                  <div className="field-block">
                    <label>Plaza Decision</label>
                    <div>
                      {disputeRow.disputeStatus === 'Approved' ? (
                        <span className="badge badge-green">Plaza Accepted</span>
                      ) : disputeRow.disputeStatus === 'Rejected' ? (
                        <span className="badge badge-red">Plaza Rejected</span>
                      ) : (
                        <span className="badge badge-gray">Pending Plaza Decision</span>
                      )}
                    </div>
                  </div>

                  <div className="audit-locked-banner">
                    👁️ Read-only — Admin cannot edit, override or delete what the plaza has submitted.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>

      <EvidencePreviewModal
        isOpen={Boolean(previewTarget)}
        onClose={() => setPreviewTarget(null)}
        file={previewTarget?.file}
        fileList={previewTarget?.fileList || []}
        source={previewTarget?.source || 'Evidence'}
        disputeRow={disputeRow}
      />
    </>
  );
};

export default MoreInformationModal;

