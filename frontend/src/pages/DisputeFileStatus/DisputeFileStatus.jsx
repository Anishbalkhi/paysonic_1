import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import DisputeManagementService from '../../services/dispute/DisputeManagementService';
import TablePagination from '../../components/common/TablePagination';
import { formatFetchTime } from '../../utils/dateUtils';
import './DisputeFileStatus.scss';

export const DisputeFileStatus = () => {
  const navigate = useNavigate();
  const [batches, setBatches] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [fetchTime, setFetchTime] = useState('');

  useEffect(() => {
    setBatches(DisputeManagementService.getBatches());
    setFetchTime(formatFetchTime(new Date()));
  }, []);

  const paginatedBatches = useMemo(() => {
    const from = (currentPage - 1) * pageSize;
    return batches.slice(from, from + pageSize);
  }, [batches, currentPage, pageSize]);

  return (
    <div className="dispute-file-status-page">
      <div className="page-header-block" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1>Dispute File Status</h1>
          <p className="subtitle">
            Audit log of all uploaded bank and NPCI dispute files, reconciliation match ratios, and processing states.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {fetchTime && (
            <div className="report-fetch-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem', color: '#1e293b', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', padding: '6px 14px', borderRadius: '6px', fontWeight: 600 }}>
              🕒 Data Fetch Time: {fetchTime}
            </div>
          )}
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate('/dispute-handling/file-upload')}
          >
            + Upload New Dispute File
          </button>
        </div>
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
                paginatedBatches.map((b) => (
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
