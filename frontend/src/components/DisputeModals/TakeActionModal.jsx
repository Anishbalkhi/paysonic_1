import React, { useState, useEffect } from 'react';
import DisputeManagementService from '../../services/dispute/DisputeManagementService';
import './DisputeModals.scss';

export const TakeActionModal = ({ isOpen, onClose, disputeRow, onUpdated }) => {
  const [plazaReason, setPlazaReason] = useState('');
  const [plazaEvidence, setPlazaEvidence] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (disputeRow) {
      setPlazaReason(disputeRow.plazaReason !== 'NA' ? disputeRow.plazaReason || '' : '');
      setPlazaEvidence(disputeRow.plazaEvidence || []);
      setErrorMsg('');
    }
  }, [disputeRow]);

  if (!isOpen || !disputeRow) return null;

  const isDecided = disputeRow.disputeStatus !== 'NA';

  const handleUploadFile = (e) => {
    if (isDecided) return;
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const fileName = file.name;
    setPlazaEvidence((prev) => [...prev, fileName]);
    e.target.value = '';
  };

  const handleRemoveFile = (index) => {
    if (isDecided) return;
    setPlazaEvidence((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDecision = async (decision) => {
    if (!plazaReason.trim()) {
      setErrorMsg('Please enter your reason before submitting a decision.');
      return;
    }
    if (plazaEvidence.length === 0) {
      setErrorMsg('Please upload at least one evidence file before submitting.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg('');
      await DisputeManagementService.submitPlazaDecision(
        disputeRow.rowId,
        decision,
        plazaReason.trim(),
        plazaEvidence
      );
      if (onUpdated) onUpdated();
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to submit decision');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="dispute-modal-overlay" onClick={onClose}>
      <div
        className="dispute-modal size-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-header-banner">
          <h2>Take Action — Dispute Verification</h2>
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
              <label>Toll Plaza</label>
              <div className="meta-display">{disputeRow.plazaName} ({disputeRow.plazaId})</div>
            </div>
            <div className="meta-box">
              <label>Acq Txn ID (RRN)</label>
              <div className="meta-display" style={{ fontFamily: 'monospace', color: '#2563eb' }}>
                {disputeRow.acqTxnId}
              </div>
            </div>
          </div>

          {/* Two Columns: Acquirer (Left - Read Only) & Plaza (Right - Interactive) */}
          <div className="two-column-layout">
            {/* Left: Acquirer Reason & Evidence (Always Read-Only) */}
            <div className="evidence-section-card">
              <div className="section-banner admin-banner">
                Acquirer · Reason &amp; Evidence (View Only)
              </div>
              <div className="section-content">
                <div className="files-container">
                  {(disputeRow.adminEvidence || []).length === 0 ? (
                    <div className="no-evidence-text">No evidence uploaded yet</div>
                  ) : (
                    disputeRow.adminEvidence.map((f, i) => (
                      <div key={i} className="evidence-chip">
                        <span className="file-meta">📎 {f}</span>
                        <span className="locked-tag">View Only</span>
                      </div>
                    ))
                  )}
                </div>

                <div className="field-block">
                  <label>Reason Given by Acquirer</label>
                  <div className="readonly-value-box">
                    {disputeRow.adminReason || 'Not provided yet'}
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
                Your Plaza · Response &amp; Decision
              </div>
              <div className="section-content">
                <div className="files-container">
                  {plazaEvidence.length === 0 ? (
                    <div className="no-evidence-text">No evidence uploaded yet</div>
                  ) : (
                    plazaEvidence.map((f, i) => (
                      <div key={i} className="evidence-chip">
                        <span className="file-meta">📎 {f}</span>
                        {!isDecided ? (
                          <button
                            type="button"
                            className="btn-remove-file"
                            onClick={() => handleRemoveFile(i)}
                          >
                            Remove
                          </button>
                        ) : (
                          <span className="locked-tag">Locked</span>
                        )}
                      </div>
                    ))
                  )}
                </div>

                <div className="field-block">
                  <label htmlFor="plazaReasonInput">Plaza Reason</label>
                  <textarea
                    id="plazaReasonInput"
                    rows={3}
                    placeholder="Explain your decision (required)..."
                    value={plazaReason}
                    onChange={(e) => setPlazaReason(e.target.value)}
                    disabled={isDecided}
                  />
                </div>

                {!isDecided ? (
                  <>
                    <div className="file-upload-dropzone">
                      <input
                        type="file"
                        id="plazaFileUpload"
                        onChange={handleUploadFile}
                      />
                    </div>

                    <div className="decision-actions-row">
                      <button
                        type="button"
                        className="btn-approve"
                        onClick={() => handleDecision('Approved')}
                        disabled={isSubmitting || !plazaReason.trim() || plazaEvidence.length === 0}
                      >
                        {isSubmitting ? 'Submitting...' : '✓ Approve'}
                      </button>
                      <button
                        type="button"
                        className="btn-reject"
                        onClick={() => handleDecision('Rejected')}
                        disabled={isSubmitting || !plazaReason.trim() || plazaEvidence.length === 0}
                      >
                        {isSubmitting ? 'Submitting...' : '✕ Reject'}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="audit-locked-banner" style={{ background: '#ecfdf5', borderColor: '#a7f3d0', color: '#065f46' }}>
                    🔒 Decision submitted ({disputeRow.disputeStatus}) — Locked for audit.
                  </div>
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
  );
};

export default TakeActionModal;
