import React, { useState, useEffect } from 'react';
import { TRANSACTION_MASTER, PLAZA_MAP } from '../../config/disputeConstants';
import { formatDisplayDateTime } from '../../services/dispute/DisputeManagementService';
import EvidencePreviewModal from './EvidencePreviewModal';
import './DisputeModals.scss';

export const TransactionDetailsModal = ({ isOpen, onClose, disputeRow }) => {
  const [previewTarget, setPreviewTarget] = useState(null);

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
      const f = formatDisplayDateTime(disputeRow.assignedAt);
      if (f) return f;
    }
    if (disputeRow.adminRemarksAt) {
      const f = formatDisplayDateTime(disputeRow.adminRemarksAt);
      if (f) return f;
    }
    if (disputeRow.assigned) {
      const fallback = disputeRow.updatedAt || disputeRow.plazaActionTime || disputeRow.createdAt;
      if (fallback && fallback !== 'Pending Plaza Decision') {
        const f = formatDisplayDateTime(fallback);
        if (f) return f;
      }
    }
    return '—';
  })();

  const rows = [
    { label: 'Acq Txn ID (RRN)', val: acqTxnId, isCode: true },
    { label: 'Toll Txn ID', val: master.tollTxnId, isCode: true },
    { label: 'VRN', val: master.vrn },
    { label: 'Tag ID', val: master.tagId, isCode: true },
    { label: 'Toll Plaza ID', val: master.plazaId, isCode: true },
    { label: 'Toll Plaza Name', val: master.plazaName || PLAZA_MAP[master.plazaId] || disputeRow.plazaName },
    { label: 'Txn Date', val: master.txnDate },
    { label: 'Txn Amount', val: `₹ ${Number(master.txnAmount || 0).toFixed(2)}`, isHighlight: true },
    { label: 'Dispute Raise Date', val: disputeRow.settlementDate || disputeRow.cbRaisedDate || '—' },
    { label: 'CB Reason', val: disputeRow.cbReason || '—' },
    { label: 'Dispute Amount', val: `₹ ${Number(disputeRow.disputeAmount || 0).toFixed(2)}`, isHighlight: true },
    { label: 'Function Code', val: disputeRow.functionCode || '—', isCode: true },
    { label: 'Dispute Name', val: disputeRow.disputeType || '—' },
    { label: 'Assigned Date & Time', val: assignedAtDisplay },
    { label: 'TAT Due Date', val: disputeRow.tatDueDate || '—', isHighlight: true },
    { label: 'Plaza Action', val: disputeRow.plazaAction || 'No' },
    { label: 'Plaza Action Date & Time', val: disputeRow.plazaActionTime || '—' },
    { label: 'CB Plaza Status', val: disputeRow.disputeStatus || 'NA' },
  ];

  const adminEvidence = disputeRow.adminEvidence || [];
  const plazaEvidence = disputeRow.plazaEvidence || [];
  const hasEvidence = adminEvidence.length > 0 || plazaEvidence.length > 0;

  return (
    <>
      <div className="dispute-modal-overlay" onClick={onClose}>
        <div
          className="dispute-modal size-sm"
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
            <div className="kv-detail-list">
              {rows.map((r, i) => (
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

            {hasEvidence && (
              <div className="txn-modal-evidence-section">
                <div className="evidence-section-title">
                  <span>📎 Attached Evidence Files</span>
                  <small>Visible to both Admin &amp; Plaza</small>
                </div>
                <div className="evidence-chips-list">
                  {adminEvidence.map((f, i) => {
                    const name = typeof f === 'string' ? f : f.name;
                    return (
                      <div
                        key={`acq-${i}`}
                        className="evidence-chip-mini"
                        onClick={() => setPreviewTarget({ file: f, source: 'Acquirer Evidence', fileList: adminEvidence })}
                        title="Click to view file"
                      >
                        <span className="badge-acq-mini">Acquirer</span>
                        <span className="file-name-mini">📎 {name}</span>
                        <span className="view-action-mini">👁️ View</span>
                      </div>
                    );
                  })}
                  {plazaEvidence.map((f, i) => {
                    const name = typeof f === 'string' ? f : f.name;
                    return (
                      <div
                        key={`plz-${i}`}
                        className="evidence-chip-mini"
                        onClick={() => setPreviewTarget({ file: f, source: 'Plaza Evidence', fileList: plazaEvidence })}
                        title="Click to view file"
                      >
                        <span className="badge-plz-mini">Plaza</span>
                        <span className="file-name-mini">📎 {name}</span>
                        <span className="view-action-mini">👁️ View</span>
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
