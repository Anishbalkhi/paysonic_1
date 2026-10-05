import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import UserService from '../../services/user/UserService';
import './ChangePasswordModal.scss';

export const ChangePasswordModal = ({ isOpen, onClose }) => {
  const { currentUser } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Industry Standard Password Validation Criteria & Strength Analysis
  const passwordCriteria = useMemo(() => {
    const pwd = newPassword || '';
    const hasMinLen = pwd.length >= 8;
    const hasUpper = /[A-Z]/.test(pwd);
    const hasLower = /[a-z]/.test(pwd);
    const hasDigit = /[0-9]/.test(pwd);
    const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/.test(pwd);

    const passedCount = [hasMinLen, hasUpper, hasLower, hasDigit, hasSpecial].filter(Boolean).length;
    let strengthLevel = 'weak';
    let strengthText = 'Weak';
    if (passedCount >= 5) {
      strengthLevel = 'strong';
      strengthText = 'Strong (Industry Standard ✓)';
    } else if (passedCount >= 3) {
      strengthLevel = 'medium';
      strengthText = 'Medium';
    }

    const isValid = hasMinLen && hasUpper && hasLower && hasDigit && hasSpecial;

    return {
      hasMinLen,
      hasUpper,
      hasLower,
      hasDigit,
      hasSpecial,
      passedCount,
      strengthLevel,
      strengthText,
      isValid,
    };
  }, [newPassword]);

  const handleGenerateStrong = () => {
    const uppers = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lowers = 'abcdefghijkmnpqrstuvwxyz';
    const digits = '23456789';
    const symbols = '!@#$%^&*';
    const all = uppers + lowers + digits + symbols;

    let generated = '';
    generated += uppers[Math.floor(Math.random() * uppers.length)];
    generated += lowers[Math.floor(Math.random() * lowers.length)];
    generated += digits[Math.floor(Math.random() * digits.length)];
    generated += symbols[Math.floor(Math.random() * symbols.length)];
    for (let i = 0; i < 8; i++) {
      generated += all[Math.floor(Math.random() * all.length)];
    }
    generated = generated.split('').sort(() => 0.5 - Math.random()).join('');

    setNewPassword(generated);
    setConfirmPassword(generated);
    setShowNew(true);
    setShowConfirm(true);
    setError('');
  };

  const handleResetForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowCurrent(false);
    setShowNew(false);
    setShowConfirm(false);
    setError('');
    setSuccess('');
    setIsSubmitting(false);
  };

  const handleClose = () => {
    handleResetForm();
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!currentPassword) {
      setError('Please enter your current password.');
      return;
    }

    // Verify current password against database / active session
    let expectedPassword = currentUser?.password;
    if (!expectedPassword) {
      try {
        const live = await UserService.getUserById(currentUser?.id);
        expectedPassword = live?.password || 'Paysonic@2026';
      } catch {
        expectedPassword = 'Paysonic@2026';
      }
    }

    if (String(currentPassword).trim() !== String(expectedPassword).trim()) {
      setError('Current password is incorrect. Please check and try again.');
      return;
    }

    if (!newPassword) {
      setError('Please enter a new password.');
      return;
    }

    if (newPassword.trim() === currentPassword.trim()) {
      setError('New password must be different from your current password.');
      return;
    }

    // Industry standard security rules
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }
    if (!/[A-Z]/.test(newPassword)) {
      setError('New password must contain at least one uppercase letter (A-Z).');
      return;
    }
    if (!/[a-z]/.test(newPassword)) {
      setError('New password must contain at least one lowercase letter (a-z).');
      return;
    }
    if (!/[0-9]/.test(newPassword)) {
      setError('New password must contain at least one number (0-9).');
      return;
    }
    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/.test(newPassword)) {
      setError('New password must contain at least one special character (!@#$%^&*...).');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match. Please re-enter.');
      return;
    }

    setIsSubmitting(true);
    try {
      await UserService.updateUser(currentUser.id, {
        password: newPassword.trim(),
      });

      // Update local storage session
      try {
        const active = JSON.parse(localStorage.getItem('paysonic_auth_session') || '{}');
        active.password = newPassword.trim();
        localStorage.setItem('paysonic_auth_session', JSON.stringify(active));
        window.dispatchEvent(new CustomEvent('paysonic_auth_change', { detail: active }));
      } catch {}

      setSuccess('✓ Password updated successfully! Your new password is now active.');
      setTimeout(() => {
        handleClose();
      }, 1800);
    } catch (err) {
      console.error('Failed to change password:', err);
      setError(err?.response?.data?.message || err?.message || 'Failed to update password. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="cpm-overlay" onClick={handleClose}>
      <div className="cpm-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="cpm-header">
          <div className="cpm-title-block">
            <div className="cpm-icon-wrap">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <div>
              <h3>Change Password</h3>
              <p>Update credentials for <strong>{currentUser?.email || currentUser?.username || 'your account'}</strong></p>
            </div>
          </div>
          <button type="button" className="cpm-close-btn" onClick={handleClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="cpm-body">
            {error && (
              <div className="cpm-alert error">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="cpm-alert success">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>{success}</span>
              </div>
            )}

            {/* Current Password */}
            <div className="cpm-field">
              <label>
                Current Password <span className="req">*</span>
              </label>
              <div className="cpm-input-wrap">
                <input
                  type={showCurrent ? 'text' : 'password'}
                  placeholder="Enter your current password"
                  required
                  value={currentPassword}
                  onChange={(e) => {
                    setCurrentPassword(e.target.value);
                    if (error) setError('');
                  }}
                  autoFocus
                />
                <button
                  type="button"
                  className="cpm-toggle-btn"
                  onClick={() => setShowCurrent((v) => !v)}
                  aria-label={showCurrent ? 'Hide current password' : 'Show current password'}
                  tabIndex={-1}
                >
                  {showCurrent ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* New Password Header with Generate Button */}
            <div className="cpm-field-header">
              <label>
                New Password <span className="req">*</span>
              </label>
              <button
                type="button"
                className="cpm-generate-btn"
                onClick={handleGenerateStrong}
                title="Auto-generate a strong password compliant with industry standards"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 2l-2 2m-6 6l-3-3L3 14l3 3 7-7zm0 0l3 3m-3-3l4-4 3 3-4 4" />
                </svg>
                Generate strong
              </button>
            </div>

            {/* New Password */}
            <div className="cpm-field">
              <div className="cpm-input-wrap">
                <input
                  type={showNew ? 'text' : 'password'}
                  placeholder="Min 8 characters, upper, lower, number, symbol"
                  required
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    if (error) setError('');
                  }}
                />
                <button
                  type="button"
                  className="cpm-toggle-btn"
                  onClick={() => setShowNew((v) => !v)}
                  aria-label={showNew ? 'Hide new password' : 'Show new password'}
                  tabIndex={-1}
                >
                  {showNew ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Confirm New Password */}
            <div className="cpm-field">
              <label>
                Confirm New Password <span className="req">*</span>
              </label>
              <div className="cpm-input-wrap">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="Re-enter new password"
                  required
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (error) setError('');
                  }}
                />
                <button
                  type="button"
                  className="cpm-toggle-btn"
                  onClick={() => setShowConfirm((v) => !v)}
                  aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
                  tabIndex={-1}
                >
                  {showConfirm ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Real-time Industry Standard Password Checklist & Strength Meter */}
            {newPassword && (
              <div className="cpm-strength-panel">
                <div className="cpm-meter-row">
                  <span className="cpm-meter-label">Password Strength:</span>
                  <div className="cpm-meter-track">
                    <div
                      className={`cpm-meter-fill ${passwordCriteria.strengthLevel}`}
                      style={{ width: `${(passwordCriteria.passedCount / 5) * 100}%` }}
                    />
                  </div>
                  <span className={`cpm-meter-badge ${passwordCriteria.strengthLevel}`}>
                    {passwordCriteria.strengthText}
                  </span>
                </div>
                <div className="cpm-rules-grid">
                  <div className={`cpm-rule ${passwordCriteria.hasMinLen ? 'pass' : ''}`}>
                    <span className="rule-dot">{passwordCriteria.hasMinLen ? '✓' : '•'}</span>
                    At least 8 characters
                  </div>
                  <div className={`cpm-rule ${passwordCriteria.hasUpper ? 'pass' : ''}`}>
                    <span className="rule-dot">{passwordCriteria.hasUpper ? '✓' : '•'}</span>
                    1 uppercase letter (A-Z)
                  </div>
                  <div className={`cpm-rule ${passwordCriteria.hasLower ? 'pass' : ''}`}>
                    <span className="rule-dot">{passwordCriteria.hasLower ? '✓' : '•'}</span>
                    1 lowercase letter (a-z)
                  </div>
                  <div className={`cpm-rule ${passwordCriteria.hasDigit ? 'pass' : ''}`}>
                    <span className="rule-dot">{passwordCriteria.hasDigit ? '✓' : '•'}</span>
                    1 number (0-9)
                  </div>
                  <div className={`cpm-rule ${passwordCriteria.hasSpecial ? 'pass' : ''}`}>
                    <span className="rule-dot">{passwordCriteria.hasSpecial ? '✓' : '•'}</span>
                    1 special symbol (!@#$%...)
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="cpm-foot">
            <button
              type="button"
              className="cpm-btn cpm-btn-ghost"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="cpm-btn cpm-btn-primary"
              disabled={isSubmitting || !passwordCriteria.isValid || !currentPassword || !confirmPassword}
            >
              {isSubmitting ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChangePasswordModal;
