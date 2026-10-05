import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DisputeManagementService from '../../services/dispute/DisputeManagementService';
import './DisputeFileStatus.scss';

export const DisputeFileStatus = () => {
  const navigate = useNavigate();
  const [batches, setBatches] = useState([]);

  useEffect(() => {
    setBatches(DisputeManagementService.getBatches());
  }, []);

  return (
    <div className="dispute-file-status-page">
      <div className="page-header-block">
        <div>
          <h1>Dispute File Status</h1>
          <p className="subtitle">
            Audit log of all uploaded bank and NPCI dispute files, reconciliation match ratios, and processing states.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => navigate('/dispute-handling/file-upload')}
        >
          + Upload New Dispute File
        </button>
      </div>

      <div className="status-table-card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Batch ID</th>
                <th>File Name</th>
                <th>Uploaded At</th>
                <th>Uploaded By</th>
                <th style={{ textAlign: 'right' }}>Total Rows</th>
                <th style={{ textAlign: 'right' }}>Matched</th>
                <th style={{ textAlign: 'right' }}>Unmatched</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {batches.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '32px', color: '#94a3b8' }}>
                    No dispute files uploaded yet.
                  </td>
                </tr>
              ) : (
                batches.map((b) => (
                  <tr key={b.batchId}>
                    <td className="code">{b.batchId}</td>
                    <td style={{ fontWeight: 600 }}>📄 {b.fileName}</td>
                    <td>{b.uploadedAt}</td>
                    <td>{b.uploadedBy}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{b.totalRows}</td>
                    <td style={{ textAlign: 'right', color: '#16a34a', fontWeight: 700 }}>
                      {b.matchedRows}
                    </td>
                    <td style={{ textAlign: 'right', color: '#dc2626', fontWeight: 700 }}>
                      {b.unmatchedRows}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="badge badge-green">{b.status}</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => navigate('/dispute-handling/chargeback-assign')}
                      >
                        View Queue
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DisputeFileStatus;
