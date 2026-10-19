import { useEffect } from 'react';

/**
 * GlobalEscapeHandler
 * ─────────────────────────────────────────────────────────────────────────────
 * Listens for the 'Escape' key globally across the entire website.
 * Closes any open modal, dialog, popup, drawer, or dropdown overlay.
 */
export const GlobalEscapeHandler = () => {
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (e.key !== 'Escape' && e.key !== 'Esc') return;

      // Selectors for open modals, overlays, dialogs, drawers, and popups
      const overlaySelectors = [
        '.op-modal-backdrop',
        '.evidence-preview-overlay',
        '.dispute-modal-overlay',
        '.cpm-overlay',
        '.onboarding-modal-backdrop',
        '.c-modal-overlay',
        '.modal-overlay',
        '.overlay.open',
        '.overlay.center.open',
        '.overlay',
        '.drawer-backdrop',
        '[role="dialog"]',
        '[aria-modal="true"]',
        '.modal.open',
        '.modal.show',
        '.modal.center',
        '.popup-overlay',
        '.modal-backdrop',
      ];

      const openOverlays = document.querySelectorAll(overlaySelectors.join(', '));
      if (!openOverlays || openOverlays.length === 0) return;

      // Target the topmost overlay (last element in DOM or highest z-index)
      const topOverlay = openOverlays[openOverlays.length - 1];
      if (!topOverlay) return;

      // Look for a close button inside the overlay
      const closeBtn = topOverlay.querySelector(
        '.op-close-btn, .close-btn, .btn-close, .btn-close-modal, .cpm-close, .cpm-close-btn, .modal-close-btn, .c-modal__close, button[aria-label*="close" i], button[aria-label*="cancel" i], button.btn-secondary, .drawer-close-btn, .modal-header .btn-close'
      );

      if (closeBtn && typeof closeBtn.click === 'function') {
        closeBtn.click();
      } else if (typeof topOverlay.click === 'function') {
        topOverlay.click();
      }

      // Also broadcast custom event for any listeners
      window.dispatchEvent(new CustomEvent('paysonic:escape_pressed'));
    };

    window.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown, true);
    };
  }, []);

  return null;
};

export default GlobalEscapeHandler;
