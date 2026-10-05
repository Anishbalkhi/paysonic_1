import React, { useState, useEffect } from 'react';
import DisputeManagementService from '../../services/dispute/DisputeManagementService';
import './DisputeModals.scss';

export const MoreInformationModal = ({ isOpen, onClose, disputeRow, onUpdated }) => {
  const [adminReason, setAdminReason] = useState('');
  const [adminEvidence, setAdminEvidence] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (disputeRow) {
      setAdminReason(disputeRow.adminReason || '');
      setAdminEvidence(disputeRow.adminEvidence || []);
      setErrorMsg('');
    }
  }, [disputeRow]);

  if (!isOpen || !disputeRow) return null;

  const isAssigned = Boolean(disputeRow.assigned);

  const handleUploadFile = (e) => {
    if (isAssigned) return;
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const fileName = file.name;
    setAdminEvidence((prev) => [...prev, fileName]);
    e.target.value = '';
  };

  const handleRemoveFile = (index) => {
    if (isAssigned) return;
    setAdminEvidence((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAssignToPlaza = async () => {
    if (!adminReason.trim()) {
      setErrorMsg('Please enter a reason before assigning to the plaza.');
      return;
    }
    if (adminEvidence.length === 0) {
      setErrorMsg('Please upload at least one evidence file before assigning.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg('');
      await DisputeManagementService.assignRow(
        disputeRow.rowId,
        adminReason.trim(),
        adminEvidence
      );
      if (onUpdated) onUpdated();
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to assign dispute to plaza');
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
          <h2>More Information</h2>
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
          </div>

          {/* Two Independent Columns: Admin (Left) & Plaza (Right) */}
          <div className="two-column-layout">
            {/* Left: Admin's Reason & Proof */}
            <div className="evidence-section-card">
              <div className="section-banner admin-banner">
                Admin · User's Reasons and Proof
              </div>
              <div className="section-content">
                <div className="files-container">
                  {adminEvidence.length === 0 ? (
                    <div className="no-evidence-text">No evidence uploaded yet</div>
                  ) : (
                    adminEvidence.map((f, i) => (
                      <div key={i} className="evidence-chip">
                        <span className="file-meta">📎 {f}</span>
                        {!isAssigned ? (
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
                  <label htmlFor="adminReasonInput">Reason</label>
                  <textarea
                    id="adminReasonInput"
                    rows={3}
                    placeholder="Enter reason for chargeback assignment..."
                    value={adminReason}
                    onChange={(e) => setAdminReason(e.target.value)}
                    disabled={isAssigned}
                  />
                </div>

                {!isAssigned ? (
                  <>
                    <div className="file-upload-dropzone">
                      <input
                        type="file"
                        id="adminFileUpload"
                        onChange={handleUploadFile}
                      />
                    </div>

                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleAssignToPlaza}
                      disabled={isSubmitting || !adminReason.trim() || adminEvidence.length === 0}
                      style={{ width: '100%', marginTop: '6px' }}
                    >
                      {isSubmitting ? 'Assigning...' : 'Assign to Plaza'}
                    </button>
                  </>
                ) : (
                  <div className="audit-locked-banner">
                    🔒 Submitted &amp; Assigned — Locked for audit. Cannot be edited or deleted.
                  </div>
                )}
              </div>
            </div>

            {/* Right: Plaza's Uploaded Evidence (Read-Only to Admin) */}
            <div className="evidence-section-card">
              <div className="section-banner plaza-banner">
                Plaza · Evidence Uploaded by Plaza
              </div>
              <div className="section-content">
                <div className="files-container">
                  {(disputeRow.plazaEvidence || []).length === 0 ? (
                    <div className="no-evidence-text">No data available</div>
                  ) : (
                    disputeRow.plazaEvidence.map((f, i) => (
                      <div key={i} className="evidence-chip">
                        <span className="file-meta">📎 {f}</span>
                        <span className="locked-tag">View Only</span>
                      </div>
                    ))
                  )}
                </div>

                <div className="field-block">
                  <label>Plaza Reason</label>
                  <div className="readonly-value-box">
                    {disputeRow.plazaReason || 'NA'}
                  </div>
                </div>

                <div className="field-block">
                  <label>Plaza Decision</label>
                  <div>
                    {disputeRow.disputeStatus === 'Approved' ? (
                      <span className="badge badge-green">Approved</span>
                    ) : disputeRow.disputeStatus === 'Rejected' ? (
                      <span className="badge badge-red">Rejected</span>
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
  );
};

export default MoreInformationModal;
