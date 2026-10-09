import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import DisputeManagementService from '../../services/dispute/DisputeManagementService';
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

  useEffect(() => {
    if (disputeRow) {
      setAdminReason(disputeRow.adminReason || '');
      setAdminEvidence(disputeRow.adminEvidence || []);
      setErrorMsg('');
      setPreviewTarget(null);
    }
  }, [disputeRow]);

  if (!isOpen || !disputeRow) return null;

  const isAssigned = Boolean(disputeRow.assigned);

  const handleAssignToPlaza = async () => {
    if (!adminReason.trim()) {
      setErrorMsg('Reason / remarks explaining the dispute is mandatory.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg('');
      const actorName = currentUser?.name || currentUser?.role || 'Master Admin';
      await DisputeManagementService.assignRow(
        disputeRow.rowId,
        adminReason.trim(),
        adminEvidence,
        actorName
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

    return (
      <div key={index} className="evidence-chip rich-evidence-card">
        <div
          className="file-meta clickable-meta"
          onClick={() => setPreviewTarget({ file: item, source: sourceLabel })}
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
            onClick={() => setPreviewTarget({ file: item, source: sourceLabel })}
            title="View Attachment"
          >
            👁️ View
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
                <label>Settlement Date</label>
                <div className="meta-display">{disputeRow.settlementDate || disputeRow.cbRaisedDate || '—'}</div>
              </div>
              <div className="meta-box">
                <label>TAT Due Date</label>
                <div className="meta-display" style={{ color: '#0369a1', fontWeight: 600 }}>
                  {disputeRow.tatDueDate || '—'}
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
                        onPreview={(file) => setPreviewTarget({ file, source: 'Acquirer Evidence' })}
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
                        {disputeRow.assignedAt ? new Date(disputeRow.assignedAt).toLocaleString('en-GB') : '—'} — Locked for audit.
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
                  <div className="attachment-section-label">
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
                    <label>Plaza Reason / Remarks</label>
                    <div className="readonly-value-box">
                      {disputeRow.plazaReason || 'NA'}
                    </div>
                  </div>

                  <div className="field-block">
                    <label>Plaza Action Date &amp; Time (IST)</label>
                    <div className="readonly-value-box" style={{ fontWeight: 600, color: '#0369a1' }}>
                      {disputeRow.plazaActionTime || 'Pending Plaza Decision'}
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
        source={previewTarget?.source || 'Evidence'}
        disputeRow={disputeRow}
      />
    </>
  );
};

export default MoreInformationModal;

