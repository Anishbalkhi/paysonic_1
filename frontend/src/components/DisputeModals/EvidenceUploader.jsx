import React, { useState } from 'react';

/**
 * Format bytes to readable size
 */
export const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const MAX_FILES_LIMIT = 4;
export const MAX_COMBINED_BYTES = 10 * 1024 * 1024; // 10 MB

export const EvidenceUploader = ({
  files = [],
  onChange,
  disabled = false,
  label = 'Attach Evidence Files',
  isMandatory = false,
  onPreview,
}) => {
  const [errorMsg, setErrorMsg] = useState('');

  const totalBytes = files.reduce((acc, f) => acc + (Number(f.size) || 0), 0);
  const totalMbFormatted = (totalBytes / (1024 * 1024)).toFixed(2);
  const percentUsed = Math.min(100, Math.round((totalBytes / MAX_COMBINED_BYTES) * 100));

  const handleFileInput = (e) => {
    setErrorMsg('');
    const selected = Array.from(e.target.files || []);
    if (selected.length === 0) return;

    // Check 1: Max 4 files total
    if (files.length + selected.length > MAX_FILES_LIMIT) {
      setErrorMsg('Maximum 4 files allowed.');
      e.target.value = '';
      return;
    }

    // Check 2: Allowed file formats (PDF, JPG, JPEG, PNG)
    const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png'];
    for (const f of selected) {
      const lower = f.name.toLowerCase();
      const isAllowed = allowedExtensions.some((ext) => lower.endsWith(ext));
      if (!isAllowed) {
        setErrorMsg(`Unsupported file type: "${f.name}". Only PDF, JPG, JPEG, and PNG files are allowed.`);
        e.target.value = '';
        return;
      }
    }

    // Check 3: Combined size < 10 MB
    const newBytes = selected.reduce((acc, f) => acc + f.size, 0);
    if (totalBytes + newBytes >= MAX_COMBINED_BYTES) {
      setErrorMsg('Total attachment size must be less than 10 MB.');
      e.target.value = '';
      return;
    }

    // Read files into object with dataUrl for instant preview
    const processedPromises = selected.map((file) => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          resolve({
            name: file.name,
            size: file.size,
            type: file.type || 'application/octet-stream',
            dataUrl: reader.result,
            uploadedAt: new Date().toISOString(),
          });
        };
        reader.readAsDataURL(file);
      });
    });

    Promise.all(processedPromises).then((newFileObjects) => {
      onChange([...files, ...newFileObjects]);
      e.target.value = '';
    });
  };

  const handleRemove = (index) => {
    if (disabled) return;
    setErrorMsg('');
    const updated = files.filter((_, i) => i !== index);
    onChange(updated);
  };

  return (
    <div className="evidence-uploader-wrapper">
      <div className="uploader-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <label className="uploader-label" style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1e293b' }}>
          {label} {isMandatory && <span style={{ color: '#ef4444' }}>* (Mandatory)</span>}
        </label>
        <span className="file-count-indicator" style={{ fontSize: '0.8rem', color: '#64748b' }}>
          {files.length} / {MAX_FILES_LIMIT} files attached ({totalMbFormatted} MB / 10 MB)
        </span>
      </div>

      {/* Progress Bar */}
      <div style={{ width: '100%', height: '5px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden', marginBottom: '10px' }}>
        <div
          style={{
            height: '100%',
            width: `${percentUsed}%`,
            backgroundColor: percentUsed > 90 ? '#ef4444' : percentUsed > 60 ? '#f59e0b' : '#3b82f6',
            transition: 'width 0.3s ease',
          }}
        />
      </div>

      {/* Upload Dropzone */}
      {!disabled && files.length < MAX_FILES_LIMIT && (
        <div
          className="upload-drop-zone"
          style={{
            border: '2px dashed #cbd5e1',
            borderRadius: '8px',
            padding: '14px',
            textAlign: 'center',
            backgroundColor: '#f8fafc',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            marginBottom: '10px',
          }}
          onClick={() => document.getElementById('evidence-file-input')?.click()}
        >
          <input
            id="evidence-file-input"
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png"
            style={{ display: 'none' }}
            onChange={handleFileInput}
          />
          <div style={{ fontSize: '1.2rem', marginBottom: '4px' }}>📎</div>
          <div style={{ fontSize: '0.86rem', fontWeight: 600, color: '#334155' }}>
            Click to upload evidence files
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
            PDF, JPG, JPEG, PNG (Up to 4 files, combined size &lt; 10 MB)
          </div>
        </div>
      )}

      {/* Error Alert */}
      {errorMsg && (
        <div style={{ color: '#ef4444', backgroundColor: '#fef2f2', border: '1px solid #fecaca', padding: '8px 12px', borderRadius: '6px', fontSize: '0.82rem', marginBottom: '10px', fontWeight: 500 }}>
          ⚠️ {errorMsg}
        </div>
      )}

      {/* Attached Files List */}
      {files.length > 0 && (
        <div className="attached-files-list" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {files.map((file, idx) => {
            const fileName = typeof file === 'string' ? file : file.name || `Attachment ${idx + 1}`;
            const sizeStr = typeof file === 'object' && file.size ? formatFileSize(file.size) : '';
            const lower = fileName.toLowerCase();
            const icon = lower.endsWith('.pdf') ? '📄' : lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') ? '📷' : '📎';

            return (
              <div
                key={idx}
                className="attached-file-chip"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                }}
              >
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: onPreview ? 'pointer' : 'default', overflow: 'hidden' }}
                  onClick={() => onPreview && onPreview(file)}
                >
                  <span style={{ fontSize: '1.1rem' }}>{icon}</span>
                  <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <span style={{ fontSize: '0.86rem', fontWeight: 500, color: '#1e293b', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                      {fileName}
                    </span>
                    {sizeStr && <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{sizeStr}</span>}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {onPreview && (
                    <button
                      type="button"
                      onClick={() => onPreview(file)}
                      style={{
                        padding: '4px 8px',
                        fontSize: '0.76rem',
                        backgroundColor: '#f1f5f9',
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      👁️ View
                    </button>
                  )}
                  {!disabled && (
                    <button
                      type="button"
                      onClick={() => handleRemove(idx)}
                      style={{
                        padding: '4px 8px',
                        fontSize: '0.76rem',
                        backgroundColor: '#fee2e2',
                        color: '#ef4444',
                        border: '1px solid #fca5a5',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      ✕ Remove
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default EvidenceUploader;
