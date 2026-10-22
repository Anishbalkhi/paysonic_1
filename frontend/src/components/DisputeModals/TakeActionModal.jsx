import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import DisputeManagementService, { resolveDisputeDates } from '../../services/dispute/DisputeManagementService';
import { formatDateTime, formatDateOnly } from '../../utils/dateUtils';
import {
  downloadSingleEvidence,
  downloadAllEvidenceAsZip,
} from '../../utils/evidenceDownloader';
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
  const [remarkError, setRemarkError] = useState('');
  const [evidenceError, setEvidenceError] = useState('');
  const [previewTarget, setPreviewTarget] = useState(null); // { file, source }
  const [isZippingPlaza, setIsZippingPlaza] = useState(false);
  const [isZippingAdmin, setIsZippingAdmin] = useState(false);

  const handleDownloadSingle = async (item, index, list) => {
    try {
      await downloadSingleEvidence(item, index, list.length, disputeRow);
    } catch (err) {
      alert('Failed to download evidence file: ' + err.message);
    }
  };

  const handleDownloadPlazaZip = async () => {
    const list = plazaEvidence || [];
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
    const list = disputeRow?.adminEvidence || [];
    if (list.length === 0) return;
    try {
      setIsZippingAdmin(true);
      await downloadAllEvidenceAsZip(list, disputeRow);
    } catch (err) {
      alert('Failed to download Acquirer Evidence ZIP: ' + err.message);
    } finally {
      setIsZippingAdmin(false);
    }
  };

  useEffect(() => {
    if (disputeRow) {
      setPlazaReason(disputeRow.plazaReason !== 'NA' ? disputeRow.plazaReason || '' : '');
      setPlazaEvidence(disputeRow.plazaEvidence || []);
      setErrorMsg('');
      setRemarkError('');
      setEvidenceError('');
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

  const isDecided = disputeRow.disputeStatus !== 'NA';
  const isAssigned = Boolean(disputeRow.assigned);

  const assignedAtDisplay = (() => {
    if (disputeRow.assignedAt) {
      const f = formatDateTime(disputeRow.assignedAt);
      if (f && f !== '—') return f;
    }
    if (disputeRow.assigned_at) {
      const f = formatDateTime(disputeRow.assigned_at);
      if (f && f !== '—') return f;
    }
    if (disputeRow.adminRemarksAt) {
      const f = formatDateTime(disputeRow.adminRemarksAt);
      if (f && f !== '—') return f;
    }
    if (disputeRow.admin_remarks_at) {
      const f = formatDateTime(disputeRow.admin_remarks_at);
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

  const plazaActionTimeDisplay = (() => {
    if (disputeRow.plazaActionTime && disputeRow.plazaActionTime !== 'Pending Plaza Decision' && disputeRow.plazaActionTime !== '—') {
      return formatDateTime(disputeRow.plazaActionTime);
    }
    if (disputeRow.plazaActionAt && disputeRow.plazaActionAt !== '—') {
      return formatDateTime(disputeRow.plazaActionAt);
    }
    if (disputeRow.decidedAt && disputeRow.decidedAt !== '—') {
      return formatDateTime(disputeRow.decidedAt);
    }
    return '—';
  })();

  const { disputeRaiseDate, tatDueDate } = resolveDisputeDates(disputeRow);

  const handleDecision = async (decision) => {
    setErrorMsg('');
    setRemarkError('');
    setEvidenceError('');

    if (decision === 'Rejected') {
      let hasError = false;
      if (!plazaReason.trim()) {
        setRemarkError('Plaza remarks / justification are mandatory when rejecting a dispute.');
        hasError = true;
      }
      if (plazaEvidence.length === 0) {
        setEvidenceError('At least one counter-evidence file is mandatory when rejecting a dispute.');
        hasError = true;
      }
      if (hasError) return;
    }

    try {
      setIsSubmitting(true);
      const actorName = currentUser?.name || currentUser?.role || 'Plaza User';
      const actorPlazaId = currentUser?.assignedPlazaId || currentUser?.plazaId;
      const finalRemarks = plazaReason.trim() || (decision === 'Approved' ? 'Accepted' : '');
      await DisputeManagementService.submitPlazaDecision(
        disputeRow.rowId || disputeRow.disputeId,
        decision,
        finalRemarks,
        plazaEvidence,
        actorName,
        actorPlazaId,
        disputeRow
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

    const fileListForSource = isPlazaCol ? plazaEvidence : (disputeRow.adminEvidence || []);

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
                <label>Dispute Raise Date</label>
                <div className="meta-display">
                  {disputeRaiseDate}
                </div>
              </div>
              <div className="meta-box">
                <label>TAT Due Date (T+8)</label>
                <div className="meta-display" style={{ color: '#0369a1', fontWeight: 600 }}>
                  {tatDueDate}
                </div>
              </div>
              <div className="meta-box">
                <label>Assigned Date &amp; Time</label>
                <div className="meta-display">
                  {assignedAtDisplay}
                </div>
              </div>
              <div className="meta-box">
                <label>Plaza Action Date &amp; Time</label>
                <div className="meta-display" style={{ fontWeight: 600 }}>
                  {plazaActionTimeDisplay}
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
                  <div className="field-block">
                    <label>Reason Given by Acquirer</label>
                    <div className="readonly-value-box" style={{ minHeight: '84px' }}>
                      {disputeRow.adminReason || 'Not provided'}
                    </div>
                  </div>

                  <div className="attachment-section-label" style={{ marginTop: '10px' }}>
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
                      Plaza Remarks / Justification <span style={{ color: '#ef4444' }}>* (Mandatory for Rejection)</span>
                    </label>
                    <textarea
                      id="plazaReasonInput"
                      rows={3}
                      placeholder={
                        isDecided
                          ? 'No reason recorded'
                          : 'Optional when accepting, mandatory when rejecting...'
                      }
                      value={plazaReason}
                      onChange={(e) => {
                        setPlazaReason(e.target.value);
                        if (errorMsg) setErrorMsg('');
                        if (remarkError) setRemarkError('');
                      }}
                      style={remarkError ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : {}}
                      disabled={isDecided}
                    />
                    {remarkError && (
                      <div style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '4px', fontWeight: 500 }}>
                        ⚠️ {remarkError}
                      </div>
                    )}
                  </div>

                  {!isDecided ? (
                    <>
                      <EvidenceUploader
                        files={plazaEvidence}
                        onChange={(files) => {
                          setPlazaEvidence(files);
                          if (errorMsg) setErrorMsg('');
                          if (evidenceError) setEvidenceError('');
                        }}
                        disabled={isSubmitting}
                        label="Upload Evidence"
                        mandatoryText="* (Mandatory for Rejection)"
                        hasError={Boolean(evidenceError)}
                        errorMessage={evidenceError}
                        onPreview={(file) => setPreviewTarget({ file, source: 'Plaza Counter-Evidence', fileList: plazaEvidence })}
                      />

                      {errorMsg && (
                        <div
                          style={{
                            marginTop: '10px',
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

                      <div className="decision-actions-row" style={{ marginTop: '14px', display: 'flex', gap: '10px' }}>
                        <button
                          type="button"
                          className="btn-approve"
                          onClick={() => handleDecision('Approved')}
                          disabled={isSubmitting}
                          style={{ flex: 1, padding: '10px 16px', fontWeight: 600 }}
                        >
                          {isSubmitting ? 'Submitting...' : '✓ Accept Dispute'}
                        </button>
                        <button
                          type="button"
                          className="btn-reject"
                          onClick={() => handleDecision('Rejected')}
                          disabled={isSubmitting}
                          style={{ flex: 1, padding: '10px 16px', fontWeight: 600 }}
                          title="Reject dispute (requires counter-evidence & remarks)"
                        >
                          {isSubmitting ? 'Submitting...' : '✕ Reject Dispute (Requires File & Remarks)'}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="attachment-section-label" style={{ marginTop: '10px' }}>
                        <span>Plaza Attachments ({plazaEvidence.length})</span>
                        <span className="sub-tag">Visible to Admin &amp; Plaza</span>
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
                        {disputeRow.plazaActionTime && disputeRow.plazaActionTime !== 'Pending Plaza Decision' ? ` on ${formatDateTime(disputeRow.plazaActionTime)}` : ''} — Locked for audit.
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
        fileList={previewTarget?.fileList || []}
        source={previewTarget?.source || 'Evidence'}
        disputeRow={disputeRow}
      />
    </>
  );
};

export default TakeActionModal;

