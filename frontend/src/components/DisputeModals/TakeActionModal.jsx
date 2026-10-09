import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import DisputeManagementService from '../../services/dispute/DisputeManagementService';
import EvidencePreviewModal from './EvidencePreviewModal';
import EvidenceUploader from './EvidenceUploader';
import './DisputeModals.scss';

export const TakeActionModal = ({ isOpen, onClose, disputeRow, onUpdated }) => {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'Master Admin';

  const [plazaReason, setPlazaReason] = useState('');
  const [plazaEvidence, setPlazaEvidence] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [previewTarget, setPreviewTarget] = useState(null); // { file, source }

  useEffect(() => {
    if (disputeRow) {
      setPlazaReason(disputeRow.plazaReason !== 'NA' ? disputeRow.plazaReason || '' : '');
      setPlazaEvidence(disputeRow.plazaEvidence || []);
      setErrorMsg('');
      setPreviewTarget(null);
    }
  }, [disputeRow]);

  if (!isOpen || !disputeRow) return null;

  const isDecided = disputeRow.disputeStatus !== 'NA';

  const handleDecision = async (decision) => {
    if (!plazaReason.trim()) {
      setErrorMsg('Plaza remarks / justification are mandatory before submitting a decision.');
      return;
    }
    if (decision === 'Rejected' && plazaEvidence.length === 0) {
      setErrorMsg('At least one counter-evidence file is mandatory when rejecting a dispute.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg('');
      const actorName = currentUser?.name || currentUser?.role || 'Plaza User';
      await DisputeManagementService.submitPlazaDecision(
        disputeRow.rowId,
        decision,
        plazaReason.trim(),
        plazaEvidence,
        actorName
      );
      if (onUpdated) onUpdated();
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to submit decision');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderEvidenceChip = (item, index, isPlazaCol = false) => {
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
    const sourceLabel = isPlazaCol ? 'Plaza Evidence' : 'Acquirer Evidence';

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
            {isDecided ? 'Locked' : 'View Only'}
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
              <h2>Take Action — Dispute Verification</h2>
              <div style={{ fontSize: '0.8rem', opacity: 0.9, marginTop: '2px' }}>
                Both Acquirer and Plaza evidence attachments are fully visible and verifiable.
              </div>
            </div>
            <button type="button" className="btn-close-modal" onClick={onClose}>
              ✕
            </button>
          </div>

          <div className="modal-body">
            {errorMsg && (
              <div
                style={{
                  padding: '8px 12px',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '6px',
                  color: '#991b1b',
                  fontSize: '0.85rem',
                }}
              >
                {errorMsg}
              </div>
            )}

            {/* Plaza Meta Header */}
            <div className="plaza-meta-row">
              <div className="meta-box">
                <label>Toll Plaza</label>
                <div className="meta-display">
                  {disputeRow.plazaName} ({disputeRow.plazaId})
                </div>
              </div>
              <div className="meta-box">
                <label>Acq Txn ID (RRN)</label>
                <div
                  className="meta-display"
                  style={{ fontFamily: 'monospace', color: '#2563eb' }}
                >
                  {disputeRow.acqTxnId}
                </div>
              </div>
              <div className="meta-box">
                <label>Settlement Date</label>
                <div className="meta-display">
                  {disputeRow.settlementDate || disputeRow.cbRaisedDate || '—'}
                </div>
              </div>
              <div className="meta-box">
                <label>TAT Due Date (T+8)</label>
                <div className="meta-display" style={{ color: '#0369a1', fontWeight: 600 }}>
                  {disputeRow.tatDueDate || '—'}
                </div>
              </div>
            </div>

            {/* Two Columns: Acquirer (Left) & Plaza (Right) */}
            <div className="two-column-layout">
              {/* Left: Acquirer Reason & Evidence */}
              <div className="evidence-section-card">
                <div className="section-banner admin-banner">
                  Acquirer · Reason &amp; Evidence (View Only)
                </div>
                <div className="section-content">
                  <div className="attachment-section-label">
                    <span>Evidence Attachments ({(disputeRow.adminEvidence || []).length})</span>
                    <span className="sub-tag">Visible to Admin &amp; Plaza</span>
                  </div>

                  <div className="files-container">
                    {(disputeRow.adminEvidence || []).length === 0 ? (
                      <div className="no-evidence-text">No evidence uploaded by acquirer</div>
                    ) : (
                      disputeRow.adminEvidence.map((f, i) =>
                        renderEvidenceChip(f, i, false)
                      )
                    )}
                  </div>

                  <div className="field-block">
                    <label>Reason Given by Acquirer</label>
                    <div className="readonly-value-box">
                      {disputeRow.adminReason || 'Not provided'}
                    </div>
                  </div>

                  <div className="audit-locked-banner">
                    🔒 Read-only — Plaza cannot edit or delete the acquirer's evidence or reason.
                  </div>
                </div>
              </div>

              {/* Right: Plaza's Response & Decision */}
              <div className="evidence-section-card">
                <div className="section-banner plaza-banner">
                  {isAdmin ? 'Plaza · Response & Decision' : 'Your Plaza · Response & Decision'}
                </div>
                <div className="section-content">
                  <div className="field-block">
                    <label htmlFor="plazaReasonInput">
                      Plaza Remarks / Justification <span style={{ color: '#ef4444' }}>* (Mandatory)</span>
                    </label>
                    <textarea
                      id="plazaReasonInput"
                      rows={3}
                      placeholder={
                        isDecided
                          ? 'No reason recorded'
                          : 'Explain your validation decision in detail (mandatory)...'
                      }
                      value={plazaReason}
                      onChange={(e) => setPlazaReason(e.target.value)}
                      disabled={isDecided}
                    />
                  </div>

                  {!isDecided ? (
                    <>
                      <EvidenceUploader
                        files={plazaEvidence}
                        onChange={setPlazaEvidence}
                        disabled={isSubmitting}
                        label="Plaza Counter-Evidence"
                        isMandatory={false}
                        onPreview={(file) => setPreviewTarget({ file, source: 'Plaza Counter-Evidence' })}
                      />

                      <div className="decision-actions-row" style={{ marginTop: '14px', display: 'flex', gap: '10px' }}>
                        <button
                          type="button"
                          className="btn-approve"
                          onClick={() => handleDecision('Approved')}
                          disabled={isSubmitting || !plazaReason.trim()}
                          style={{ flex: 1, padding: '10px 16px', fontWeight: 600 }}
                        >
                          {isSubmitting ? 'Submitting...' : '✓ Accept Dispute'}
                        </button>
                        <button
                          type="button"
                          className="btn-reject"
                          onClick={() => handleDecision('Rejected')}
                          disabled={isSubmitting || !plazaReason.trim()}
                          style={{ flex: 1, padding: '10px 16px', fontWeight: 600 }}
                          title={plazaEvidence.length === 0 ? 'Upload at least 1 counter-evidence file to reject' : 'Reject dispute'}
                        >
                          {isSubmitting ? 'Submitting...' : '✕ Reject Dispute (Requires File)'}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="attachment-section-label" style={{ marginTop: '10px' }}>
                        <span>Plaza Attachments ({plazaEvidence.length})</span>
                      </div>
                      <div className="files-container">
                        {plazaEvidence.length === 0 ? (
                          <div className="no-evidence-text">No counter-evidence attached</div>
                        ) : (
                          plazaEvidence.map((f, i) => renderEvidenceChip(f, i, true))
                        )}
                      </div>

                      <div
                        className="audit-locked-banner"
                        style={{
                          background: '#ecfdf5',
                          borderColor: '#a7f3d0',
                          color: '#065f46',
                          marginTop: '10px',
                        }}
                      >
                        🔒 Decision submitted ({disputeRow.disputeStatus === 'Approved' ? 'Plaza Accepted' : 'Plaza Rejected'})
                        {disputeRow.plazaActionTime ? ` on ${disputeRow.plazaActionTime}` : ''} — Locked for audit.
                      </div>
                    </>
                  )}
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

      {/* Full Evidence Preview Modal */}
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

export default TakeActionModal;

