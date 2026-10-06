import React, { useState } from 'react';
import { TRANSACTION_MASTER, PLAZA_MAP } from '../../config/disputeConstants';
import EvidencePreviewModal from './EvidencePreviewModal';
import './DisputeModals.scss';

export const TransactionDetailsModal = ({ isOpen, onClose, disputeRow }) => {
  const [previewTarget, setPreviewTarget] = useState(null);

  if (!isOpen || !disputeRow) return null;

  const acqTxnId = disputeRow.acqTxnId;
  const master = TRANSACTION_MASTER[acqTxnId] || {
    tollTxnId: disputeRow.tollTxnId || '—',
    vrn: disputeRow.vrn || '—',
    tagId: disputeRow.tagId || '—',
    plazaId: disputeRow.plazaId || '—',
    plazaName: disputeRow.plazaName || '—',
    txnDate: disputeRow.txnDate || '—',
    txnAmount: disputeRow.txnAmount || 0,
  };

  const rows = [
    { label: 'Acq Txn ID (RRN)', val: acqTxnId, isCode: true },
    { label: 'Toll Txn ID', val: master.tollTxnId, isCode: true },
    { label: 'VRN', val: master.vrn },
    { label: 'Tag ID', val: master.tagId, isCode: true },
    { label: 'Toll Plaza ID', val: master.plazaId, isCode: true },
    { label: 'Toll Plaza Name', val: master.plazaName || PLAZA_MAP[master.plazaId] || disputeRow.plazaName },
    { label: 'Txn Date', val: master.txnDate },
    { label: 'Txn Amount', val: `₹ ${Number(master.txnAmount || 0).toFixed(2)}`, isHighlight: true },
    { label: 'CB Raised Date', val: disputeRow.cbRaisedDate || '—' },
    { label: 'CB Reason', val: disputeRow.cbReason || '—' },
    { label: 'Dispute Amount', val: `₹ ${Number(disputeRow.disputeAmount || 0).toFixed(2)}`, isHighlight: true },
    { label: 'Function Code', val: disputeRow.functionCode || '—', isCode: true },
    { label: 'Dispute Name', val: disputeRow.disputeType || '—' },
    { label: 'Plaza Action', val: disputeRow.plazaAction || 'No' },
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
                        onClick={() => setPreviewTarget({ file: f, source: 'Acquirer Evidence' })}
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
                        onClick={() => setPreviewTarget({ file: f, source: 'Plaza Evidence' })}
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
        source={previewTarget?.source || 'Evidence'}
        disputeRow={disputeRow}
      />
    </>
  );
};

export default TransactionDetailsModal;
