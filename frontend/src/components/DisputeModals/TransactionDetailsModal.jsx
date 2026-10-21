import React, { useState, useEffect } from 'react';
import { TRANSACTION_MASTER, PLAZA_MAP } from '../../config/disputeConstants';
import { formatDateTime, formatDateOnly } from '../../utils/dateUtils';
import { resolveDisputeDates } from '../../services/dispute/DisputeManagementService';
import {
  downloadSingleEvidence,
  downloadMultipleEvidenceSequentially,
  downloadAllEvidenceAsZip,
  getEvidenceDownloadName,
  toRoman,
} from '../../utils/evidenceDownloader';
import EvidencePreviewModal from './EvidencePreviewModal';
import './DisputeModals.scss';

export const TransactionDetailsModal = ({ isOpen, onClose, disputeRow }) => {
  const [previewTarget, setPreviewTarget] = useState(null);
  const [copiedRemark, setCopiedRemark] = useState(false);
  const [isZippingPlaza, setIsZippingPlaza] = useState(false);
  const [isDownloadingPlaza, setIsDownloadingPlaza] = useState(false);

  const handleCopy = async (text) => {
    if (!text) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopiedRemark(true);
      setTimeout(() => setCopiedRemark(false), 2000);
    } catch (err) {
      console.error('Failed to copy remark:', err);
    }
  };

  const handleDownloadPlazaSingle = async () => {
    const list = disputeRow?.plazaEvidence || [];
    if (list.length === 0) return;
    try {
      setIsDownloadingPlaza(true);
      await downloadSingleEvidence(list[0], 0, 1, disputeRow);
    } catch (err) {
      alert('Failed to download evidence file: ' + err.message);
    } finally {
      setIsDownloadingPlaza(false);
    }
  };

  const handleDownloadPlazaSeries = async () => {
    const list = disputeRow?.plazaEvidence || [];
    if (list.length === 0) return;
    try {
      setIsDownloadingPlaza(true);
      await downloadMultipleEvidenceSequentially(list, disputeRow);
    } catch (err) {
      alert('Failed to download evidence files: ' + err.message);
    } finally {
      setIsDownloadingPlaza(false);
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

  const handleDownloadItem = async (file, index, list) => {
    try {
      await downloadSingleEvidence(file, index, list.length, disputeRow);
    } catch (err) {
      alert('Failed to download evidence file: ' + err.message);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.key === 'Escape' || e.key === 'Esc') && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !disputeRow) return null;

  const acqTxnId = disputeRow.acqTxnId;
  const staticTxn = TRANSACTION_MASTER[acqTxnId] || {};
  const master = {
    tollTxnId: disputeRow.tollTxnId && disputeRow.tollTxnId !== '—' ? disputeRow.tollTxnId : (staticTxn.tollTxnId || '—'),
    vrn: disputeRow.vrn && disputeRow.vrn !== '—' ? disputeRow.vrn : (staticTxn.vrn || '—'),
    tagId: disputeRow.tagId && disputeRow.tagId !== '—' ? disputeRow.tagId : (staticTxn.tagId || '—'),
    plazaId: disputeRow.plazaId || staticTxn.plazaId || '—',
    plazaName: disputeRow.plazaName || staticTxn.plazaName || PLAZA_MAP[disputeRow.plazaId] || '—',
    txnDate: disputeRow.txnDate || staticTxn.txnDate || '—',
    txnAmount: disputeRow.txnAmount !== undefined && disputeRow.txnAmount !== null ? disputeRow.txnAmount : (staticTxn.txnAmount || 0),
  };

  const assignedAtDisplay = (() => {
    if (disputeRow.assignedAt) {
      const f = formatDateTime(disputeRow.assignedAt);
      if (f && f !== '—') return f;
    }
    if (disputeRow.adminRemarksAt) {
      const f = formatDateTime(disputeRow.adminRemarksAt);
      if (f && f !== '—') return f;
    }
    if (disputeRow.assigned) {
      const fallback = disputeRow.updatedAt || disputeRow.plazaActionTime || disputeRow.createdAt;
      if (fallback && fallback !== 'Pending Plaza Decision') {
        const f = formatDateTime(fallback);
        if (f && f !== '—') return f;
      }
    }
    return '—';
  })();

  const { disputeRaiseDate, tatDueDate } = resolveDisputeDates(disputeRow, master);

  const txnRows = [
    { label: 'Acq Txn ID (RRN)', val: acqTxnId, isCode: true },
    { label: 'Toll Txn ID', val: master.tollTxnId, isCode: true },
    { label: 'VRN', val: master.vrn },
    { label: 'Tag ID', val: master.tagId, isCode: true },
    { label: 'Toll Plaza ID', val: master.plazaId, isCode: true },
    { label: 'Toll Plaza Name', val: master.plazaName || PLAZA_MAP[master.plazaId] || disputeRow.plazaName },
    { label: 'Txn Date', val: master.txnDate },
    { label: 'Txn Amount', val: `₹ ${Number(master.txnAmount || 0).toFixed(2)}`, isHighlight: true },
  ];

  const disputeRows = [
    { label: 'Dispute Raise Date', val: disputeRaiseDate },
    { label: 'TAT Due Date', val: tatDueDate, isHighlight: true },
    { label: 'Dispute Amount', val: `₹ ${Number(disputeRow.disputeAmount || 0).toFixed(2)}`, isHighlight: true },
    { label: 'Function Code', val: disputeRow.functionCode || '—', isCode: true },
    { label: 'Dispute Name', val: disputeRow.disputeType || '—' },
    { label: 'CB Reason', val: disputeRow.cbReason || '—' },
    { label: 'Assigned Date & Time', val: assignedAtDisplay },
    { label: 'Plaza Action', val: disputeRow.plazaAction || 'No' },
    { label: 'Plaza Action Date & Time', val: disputeRow.plazaActionTime ? (disputeRow.plazaActionTime === 'Pending Plaza Decision' ? '—' : formatDateTime(disputeRow.plazaActionTime)) : (disputeRow.plazaActionAt ? formatDateTime(disputeRow.plazaActionAt) : '—') },
    { label: 'CB Plaza Status', val: disputeRow.disputeStatus || 'NA' },
    { label: 'Plaza Reason / Remarks', val: disputeRow.plazaReason || disputeRow.plazaRemarks || 'NA', isCopyable: true },
  ];

  const adminEvidence = disputeRow.adminEvidence || [];
  const plazaEvidence = disputeRow.plazaEvidence || [];
  const hasEvidence = adminEvidence.length > 0 || plazaEvidence.length > 0;

  return (
    <>
      <div className="dispute-modal-overlay" onClick={onClose}>
        <div
          className="dispute-modal size-txn-details"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          <div className="modal-header-banner">
            <h2>Transaction Details</h2>
            <button type="button" className="btn-close-modal" onClick={onClose}>
              ✕
            </button>
          </div>

          <div className="modal-body">
            <div className="txn-details-grid-layout">
              {/* Left Column: Transaction Details */}
              <div className="txn-details-card">
                <div className="txn-details-card-header">
                  <span className="card-badge">TRANSACTION DETAILS</span>
                </div>
                <div className="kv-detail-list">
                  {txnRows.map((r, i) => (
                    <div key={i} className="kv-item">
                      <span className="kv-label">{r.label}</span>
                      <span
                        className={`kv-val ${r.isCode ? 'code' : ''} ${
                          r.isHighlight ? 'highlight' : ''
                        }`}
                      >
                        {r.val}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column: Dispute & Plaza Lifecycle */}
              <div className="txn-details-card">
                <div className="txn-details-card-header">
                  <span className="card-badge">DISPUTE &amp; PLAZA LIFECYCLE</span>
                </div>
                <div className="kv-detail-list">
                  {disputeRows.map((r, i) => (
                    <div key={i} className="kv-item">
                      <span className="kv-label">{r.label}</span>
                      <span
                        className={`kv-val ${r.isCode ? 'code' : ''} ${
                          r.isHighlight ? 'highlight' : ''
                        }`}
                        style={r.isCopyable ? { display: 'inline-flex', alignItems: 'center', gap: '8px' } : {}}
                      >
                        <span>{r.val}</span>
                        {r.isCopyable && (
                          <button
                            type="button"
                            onClick={() => handleCopy(r.val)}
                            title="Copy Plaza Remarks"
                            style={{
                              background: copiedRemark ? '#dcfce7' : '#eff6ff',
                              color: copiedRemark ? '#15803d' : '#1d4ed8',
                              border: `1px solid ${copiedRemark ? '#86efac' : '#bfdbfe'}`,
                              borderRadius: '4px',
                              padding: '1px 6px',
                              fontSize: '0.72rem',
                              cursor: 'pointer',
                              fontWeight: 600,
                            }}
                          >
                            {copiedRemark ? '✓ Copied' : '📋 Copy'}
                          </button>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {hasEvidence && (
              <div className="txn-modal-evidence-section">
                <div className="evidence-section-header">
                  <div className="evidence-header-left">
                    <span className="evidence-header-title">📎 Attached Evidence Files</span>
                    <span className="evidence-header-badge">Visible to both Admin &amp; Plaza</span>
                  </div>
                  {plazaEvidence.length > 0 && (
                    <div className="evidence-header-actions">
                      {plazaEvidence.length === 1 ? (
                        <button
                          type="button"
                          className="btn-evidence-action btn-single"
                          onClick={handleDownloadPlazaSingle}
                          disabled={isDownloadingPlaza}
                          title={`Download Plaza evidence file named by RRN (${disputeRow.acqTxnId || 'RRN'})`}
                        >
                          {isDownloadingPlaza ? '⏳ Downloading...' : '⬇️ Download Plaza Evidence'}
                        </button>
                      ) : (
                        <div className="btn-actions-duo">
                          <button
                            type="button"
                            className="btn-evidence-action btn-zip"
                            onClick={handleDownloadPlazaZip}
                            disabled={isZippingPlaza}
                            title={`Download all ${plazaEvidence.length} files as ${(disputeRow.acqTxnId || 'RRN')}.zip`}
                          >
                            {isZippingPlaza ? '⏳ Zipping...' : '📦 Download ZIP'}
                          </button>
                          <button
                            type="button"
                            className="btn-evidence-action btn-series"
                            onClick={handleDownloadPlazaSeries}
                            disabled={isDownloadingPlaza}
                            title="Download individual files in RRN-I, RRN-II format"
                          >
                            {isDownloadingPlaza ? '⏳ Downloading...' : '⬇️ Download (RRN-I, II)'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="evidence-chips-list">
                  {adminEvidence.map((f, i) => {
                    const name = typeof f === 'string' ? f : f.name;
                    const dlName = getEvidenceDownloadName(f, i, adminEvidence.length, disputeRow);
                    return (
                      <div key={`acq-${i}`} className="evidence-chip-mini">
                        <div
                          className="chip-meta-clickable"
                          onClick={() => setPreviewTarget({ file: f, source: 'Acquirer Evidence', fileList: adminEvidence })}
                          title={`Click to preview ${name}`}
                        >
                          <span className="badge-acq-mini">Acquirer</span>
                          <span className="file-name-mini">📎 {name}</span>
                          {adminEvidence.length > 1 && (
                            <span className="file-roman-tag">({toRoman(i + 1)})</span>
                          )}
                        </div>
                        <div className="chip-actions-group">
                          <button
                            type="button"
                            className="btn-mini-chip btn-mini-view"
                            onClick={() => setPreviewTarget({ file: f, source: 'Acquirer Evidence', fileList: adminEvidence })}
                            title="Preview File"
                          >
                            👁️ View
                          </button>
                          <button
                            type="button"
                            className="btn-mini-chip btn-mini-download"
                            onClick={() => handleDownloadItem(f, i, adminEvidence)}
                            title={`Download as ${dlName}`}
                          >
                            ⬇️ Download
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {plazaEvidence.map((f, i) => {
                    const name = typeof f === 'string' ? f : f.name;
                    const dlName = getEvidenceDownloadName(f, i, plazaEvidence.length, disputeRow);
                    return (
                      <div key={`plz-${i}`} className="evidence-chip-mini">
                        <div
                          className="chip-meta-clickable"
                          onClick={() => setPreviewTarget({ file: f, source: 'Plaza Evidence', fileList: plazaEvidence })}
                          title={`Click to preview ${name}`}
                        >
                          <span className="badge-plz-mini">Plaza</span>
                          <span className="file-name-mini">📎 {name}</span>
                          {plazaEvidence.length > 1 && (
                            <span className="file-roman-tag">({toRoman(i + 1)})</span>
                          )}
                        </div>
                        <div className="chip-actions-group">
                          <button
                            type="button"
                            className="btn-mini-chip btn-mini-view"
                            onClick={() => setPreviewTarget({ file: f, source: 'Plaza Evidence', fileList: plazaEvidence })}
                            title="Preview File"
                          >
                            👁️ View
                          </button>
                          <button
                            type="button"
                            className="btn-mini-chip btn-mini-download"
                            onClick={() => handleDownloadItem(f, i, plazaEvidence)}
                            title={`Download as ${dlName}`}
                          >
                            ⬇️ Download
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
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

export default TransactionDetailsModal;
