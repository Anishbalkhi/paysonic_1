import React, { useEffect } from 'react';
import './Modal.scss';
import Button from '../Button/Button';

export const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  confirmVariant = 'primary',
  showFooter = true,
  isLoading = false,
}) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="c-modal-overlay" onClick={onClose}>
      <div
        className="c-modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="c-modal__header">
          <h3>{title}</h3>
          <button
            type="button"
            className="close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <div className="c-modal__body">{children}</div>

        {showFooter && (
          <div className="c-modal__footer">
            <Button variant="secondary" onClick={onClose} disabled={isLoading}>
              {cancelText}
            </Button>
            {onConfirm && (
              <Button
                variant={confirmVariant}
                onClick={onConfirm}
                loading={isLoading}
              >
                {confirmText}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;
