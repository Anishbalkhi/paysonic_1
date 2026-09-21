import React, { useState } from 'react';
import UserActivityService from '../../../services/userActivity/UserActivityService';

export const ExportConfirmModal = ({ isOpen, onClose, totalRecords = 0, exportContext = null, onExportComplete }) => {
  const [format, setFormat] = useState('csv');
  const [scope, setScope] = useState('filtered');
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen) return null;

  const countToExport =
    scope === 'filtered' && exportContext?.count !== undefined
      ? exportContext.count
      : totalRecords;

  const activeFilters = exportContext?.filters || {};
  const activeFilterList = [];
  if (activeFilters.module && activeFilters.module !== 'All modules') {
    activeFilterList.push(`Module: ${activeFilters.module}`);
  }
  if (activeFilters.action && activeFilters.action !== 'All actions') {
    activeFilterList.push(`Action: ${activeFilters.action}`);
  }
  if (activeFilters.status && activeFilters.status !== 'All statuses') {
    activeFilterList.push(`Status: ${activeFilters.status}`);
  }
  if (activeFilters.date && activeFilters.date !== 'all') {
    activeFilterList.push(`Date: ${activeFilters.date}`);
  }
  if (activeFilters.search) {
    activeFilterList.push(`Query: "${activeFilters.search}"`);
  }

  const handleDownload = async () => {
    setIsExporting(true);
    try {
      const result = await UserActivityService.exportAudit(
        scope === 'filtered' ? activeFilters : {},
        format
      );
      const blob = new Blob([result.data], { type: result.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      if (onExportComplete) onExportComplete();
      onClose();
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="overlay open center">
      <div className="modal modal-sm">
        <div className="modal-head">
          <div>
            <h2>Export Audit Repository</h2>
            <span>Confirmation of export count and filter parameters</span>
          </div>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="modal-body">
          <p style={{ fontSize: '13.5px', color: 'var(--body-text)', margin: 0 }}>
            Generate an official compliance snapshot of recorded administrative events, actor signatures, and state changes.
          </p>

          <div className="field">
            <label style={{ fontSize: '13px', fontWeight: 600 }}>Export File Format</label>
            <div className="format-options">
              <label className={`format-pill ${format === 'csv' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="format"
                  value="csv"
                  checked={format === 'csv'}
                  onChange={() => setFormat('csv')}
                />
                <div>
                  <strong>CSV / Excel (.csv)</strong>
                  <span>Formatted for Excel, Google Sheets, &amp; NPCI audits</span>
                </div>
              </label>

              <label className={`format-pill ${format === 'json' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="format"
                  value="json"
                  checked={format === 'json'}
                  onChange={() => setFormat('json')}
                />
                <div>
                  <strong>Structured JSON (.json)</strong>
                  <span>Raw payload with before/after deltas for SIEM</span>
                </div>
              </label>
            </div>
          </div>

          <div className="field">
            <label style={{ fontSize: '13px', fontWeight: 600 }}>Export Scope</label>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              style={{
                border: '1px solid #D0D5DD',
                borderRadius: '8px',
                padding: '9px 12px',
                fontSize: '13.5px',
              }}
            >
              <option value="filtered">
                Current Filtered View ({countToExport} records)
              </option>
              <option value="full">Full Ledger Database ({totalRecords} records)</option>
            </select>
          </div>

          {/* Record Count and Applied Filters Confirmation (Acceptance Criteria) */}
          <div
            style={{
              background: '#F0F9FF',
              border: '1px solid #B9E6FE',
              borderRadius: '8px',
              padding: '12px 14px',
              fontSize: '13px',
              color: '#026AA2',
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: '4px' }}>
              Export Confirmation Summary:
            </div>
            <div>
              Record Count: <strong>{countToExport} matching event{countToExport === 1 ? '' : 's'}</strong>
            </div>
            <div style={{ marginTop: '3px', fontSize: '12px', color: '#035388' }}>
              Filters Applied:{' '}
              {activeFilterList.length > 0 ? (
                <strong>{activeFilterList.join(' · ')}</strong>
              ) : (
                <em>None (All records included)</em>
              )}
            </div>
          </div>
        </div>

        <div className="modal-foot">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={isExporting}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleDownload}
            disabled={isExporting || countToExport === 0}
          >
            {isExporting ? 'Compiling File...' : `Confirm & Download (${countToExport})`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportConfirmModal;
