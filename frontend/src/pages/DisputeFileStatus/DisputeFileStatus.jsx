import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import DisputeManagementService from '../../services/dispute/DisputeManagementService';
import TablePagination from '../../components/common/TablePagination';
import { formatFetchTime, formatDateTime } from '../../utils/dateUtils';
import { parseNpci01FileName } from '../../utils/npciFileNameParser';
import './DisputeFileStatus.scss';

export const DisputeFileStatus = () => {
  const navigate = useNavigate();
  const [batches, setBatches] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [fetchTime, setFetchTime] = useState('');

  const formatDisputeDate = (val, meta) => {
    if (val && typeof val === 'string') {
      const trimmed = val.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        const [y, m, d] = trimmed.split('-');
        return `${d}-${m}-${y}`;
      }
      if (/^\d{2}-\d{2}-\d{4}$/.test(trimmed)) {
        return trimmed;
      }
      return trimmed;
    }
    if (meta?.isValid && meta?.releaseDate) {
      return meta.releaseDate;
    }
    return '—';
  };

  const handleClearAll = async () => {
    try {
      await DisputeManagementService.clearAllDisputes();
    } catch (e) {
      console.error('Failed to clear batches:', e);
    }
    setBatches([]);
    localStorage.removeItem('paysonic_dispute_batches_db_cache_v1');
    localStorage.removeItem('paysonic_dispute_batches_v1');
    localStorage.removeItem('paysonic_dispute_batches_v2');
    localStorage.removeItem('paysonic_dispute_batches_live_v1');
  };

  const handleDeleteBatch = async (batchId) => {
    try {
      await DisputeManagementService.deleteBatch(batchId);
    } catch (e) {
      console.debug('Batch delete notice:', e);
    }
    setBatches((prev) => {
      const updated = prev.filter((b) => b.batchId !== batchId);
      localStorage.setItem('paysonic_dispute_batches_db_cache_v1', JSON.stringify(updated));
      return updated;
    });
  };

  useEffect(() => {
    const load = async () => {
      try {
        const live = await DisputeManagementService.fetchBatches();
        if (Array.isArray(live)) {
          setBatches(live);
        } else {
          setBatches([]);
        }
      } catch (e) {
        console.debug('Batches fetch notice:', e);
        setBatches([]);
      }
      setFetchTime(formatFetchTime(new Date()));
    };
    load();
  }, []);

  const paginatedBatches = useMemo(() => {
    if (!Array.isArray(batches)) return [];
    const from = (currentPage - 1) * pageSize;
    return batches.slice(from, from + pageSize);
  }, [batches, currentPage, pageSize]);

  return (
    <div className="dispute-file-status-page">
      <div className="page-header-block">
        <div>
          <h1>Dispute File Status</h1>
          <p className="subtitle">
            Audit log of uploaded dispute files, selected dispute file dates, match rates, and queue assignment states.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {batches.length > 0 && (
            <button
              type="button"
              className="btn btn-secondary"
              style={{ color: '#ef4444', borderColor: '#fca5a5' }}
              onClick={handleClearAll}
            >
              Clear All Batches
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate('/dispute-handling/file-upload')}
          >
            + Upload NPCI 01 File
          </button>
        </div>
      </div>

      <div className="status-table-card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>File Name</th>
                <th>Dispute Date</th>
                <th>Uploaded AT</th>
                <th>Uploaded By</th>
                <th style={{ textAlign: 'right' }}>Total Rows</th>
                <th style={{ textAlign: 'right' }}>Matched Rows</th>
                <th style={{ textAlign: 'right' }}>Unmatched Rows</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {batches.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '36px', color: '#94a3b8' }}>
                    No dispute files uploaded yet. Click <strong>+ Upload NPCI 01 File</strong> to upload a CSV file.
                  </td>
                </tr>
              ) : (
                paginatedBatches.map((b) => {
                  const meta = parseNpci01FileName(b.fileName || '');
                  const disputeDateDisplay = formatDisputeDate(b.disputeFileDate, meta);
                  return (
                    <tr key={b.batchId}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 600 }}>📄 {b.fileName}</span>
                          {meta.isValid && meta.is01File && (
                            <span style={{ fontSize: '0.68rem', padding: '2px 6px', background: '#e0f2fe', color: '#0369a1', borderRadius: '4px', fontWeight: 700 }}>
                              01 FILE
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ fontWeight: 700, color: '#0f172a' }}>
                        {disputeDateDisplay}
                      </td>
                      <td>{formatDateTime(b.uploadedAt)}</td>
                      <td>{b.uploadedBy || 'Master Admin'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{b.totalRows}</td>
                      <td style={{ textAlign: 'right', color: '#16a34a', fontWeight: 700 }}>
                        {b.matchedRows}
                      </td>
                      <td style={{ textAlign: 'right', color: '#dc2626', fontWeight: 700 }}>
                        {b.unmatchedRows}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="badge badge-green">{b.status || 'Processed'}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => navigate('/dispute-handling/chargeback-assign')}
                          >
                            View Queue
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline-danger btn-sm"
                            title="Delete this batch"
                            style={{ padding: '3px 8px', fontSize: '0.78rem' }}
                            onClick={() => handleDeleteBatch(b.batchId)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Pagination Bar */}
        <TablePagination
          totalItems={batches.length}
          currentPage={currentPage}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
          pageSizeOptions={[10, 25, 50, 100]}
        />
      </div>
    </div>
  );
};

export default DisputeFileStatus;
