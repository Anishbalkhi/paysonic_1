import React, { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import './GlobalTableResizer.scss';

const STORAGE_PREFIX = 'paysonic_tbl_widths_v2_';
const STORAGE_SCALE_PREFIX = 'paysonic_tbl_scale_v2_';

const SCALE_LEVELS = [
  { key: 'compact-70', label: '70%', percent: 70 },
  { key: 'compact', label: '80%', percent: 80 },
  { key: 'compact-90', label: '90%', percent: 90 },
  { key: 'normal', label: '100%', percent: 100 },
  { key: 'stretched-1', label: '110%', percent: 110 },
  { key: 'stretched-2', label: '120%', percent: 120 },
  { key: 'stretched-3', label: '130%', percent: 130 },
];

/**
 * Applies both CSS attributes and inline zoom style to reliably scale tables
 */
const applyTableScale = (table, scaleItem) => {
  if (!table) return;
  table.setAttribute('data-table-scale', scaleItem.key);
  const ratio = scaleItem.percent / 100;
  table.style.zoom = String(ratio);
  table.dataset.zoomPercent = String(scaleItem.percent);
};

/**
 * GlobalTableResizer
 * ─────────────────────────────────────────────────────────────────────────────
 * Enables interactive column width stretching & shrinking on each table across
 * the application, plus a toolbar option to increase/decrease table density (zoom).
 * Strict single-toolbar enforcement per container.
 */
export const GlobalTableResizer = () => {
  const location = useLocation();
  const initTimeoutRef = useRef(null);

  useEffect(() => {
    // Deduplicates toolbars globally to ensure strictly single toolbar per container
    const enforceSingleToolbars = () => {
      const toolbars = Array.from(document.querySelectorAll('.table-stretch-toolbar'));
      const seenContainers = new Set();

      toolbars.forEach((tb) => {
        const parent = tb.parentElement;
        if (!parent) return;
        if (seenContainers.has(parent)) {
          // Extra toolbar in the same container: remove immediately!
          tb.remove();
        } else {
          seenContainers.add(parent);
        }
      });
    };

    const attachToTables = () => {
      const allTables = Array.from(document.querySelectorAll('table'));
      if (!allTables || allTables.length === 0) return;

      // Filter out non-main tables (calendars, modals, child/nested tables, diff tables)
      const validTables = allTables.filter((table) => {
        if (
          table.closest('.react-calendar') ||
          table.closest('.date-picker') ||
          table.closest('.dispute-modal') ||
          table.closest('.modal-body') ||
          table.closest('.diff-table') ||
          table.classList.contains('child-table') ||
          table.closest('.child-table') ||
          table.classList.contains('sub-table') ||
          table.closest('.sub-table')
        ) {
          return false;
        }
        return true;
      });

      if (validTables.length === 0) return;

      const pathKey = location.pathname.replace(/\/$/, '') || '/';
      const claimedContainers = new Set();

      validTables.forEach((table, tblIdx) => {
        const tableKey = `${pathKey}_tbl_${tblIdx}`;

        setupColumnResizers(table, tableKey);
        setupTableStretchToolbar(table, tableKey, claimedContainers);
      });

      enforceSingleToolbars();
    };

    const setupColumnResizers = (table, tableKey) => {
      const thead = table.querySelector('thead');
      if (!thead) return;

      const thList = thead.querySelectorAll('th');
      if (!thList || thList.length === 0) return;

      // Load saved column widths from localStorage
      let savedWidths = {};
      try {
        const raw = localStorage.getItem(STORAGE_PREFIX + tableKey);
        if (raw) savedWidths = JSON.parse(raw);
      } catch {}

      thList.forEach((th, colIdx) => {
        th.classList.add('col-resizable');

        // Apply saved width if available
        if (savedWidths[colIdx]) {
          const w = savedWidths[colIdx];
          th.style.width = `${w}px`;
          th.style.minWidth = `${w}px`;
        }

        // Avoid adding duplicate resizers
        if (th.querySelector('.col-resizer')) return;

        const resizer = document.createElement('div');
        resizer.className = 'col-resizer';
        resizer.title = 'Drag to stretch or decrease column size • Double-click to auto-fit';
        resizer.setAttribute('role', 'separator');
        resizer.setAttribute('aria-orientation', 'vertical');

        let startX = 0;
        let startWidth = 0;

        const onMouseMove = (e) => {
          const currentZoom = parseFloat(table.style.zoom) || 1;
          const diff = (e.pageX - startX) / currentZoom;
          const newWidth = Math.max(50, Math.round(startWidth + diff));

          th.style.width = `${newWidth}px`;
          th.style.minWidth = `${newWidth}px`;
          th.style.maxWidth = `${newWidth}px`;

          // Ensure table container allows horizontal expansion without clipping
          if (table.parentElement) {
            table.parentElement.style.overflowX = 'auto';
          }
        };

        const onMouseUp = () => {
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
          document.body.classList.remove('table-is-resizing');

          // Save new width to localStorage
          try {
            const currentWidth = Math.round(th.getBoundingClientRect().width);
            let map = {};
            const raw = localStorage.getItem(STORAGE_PREFIX + tableKey);
            if (raw) map = JSON.parse(raw);
            map[colIdx] = currentWidth;
            localStorage.setItem(STORAGE_PREFIX + tableKey, JSON.stringify(map));
          } catch {}
        };

        resizer.addEventListener('mousedown', (e) => {
          e.stopPropagation();
          e.preventDefault();
          startX = e.pageX;
          startWidth = th.getBoundingClientRect().width;

          document.body.classList.add('table-is-resizing');
          document.addEventListener('mousemove', onMouseMove);
          document.addEventListener('mouseup', onMouseUp);
        });

        // Double-click to reset this column to default
        resizer.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          e.preventDefault();
          th.style.width = '';
          th.style.minWidth = '';
          th.style.maxWidth = '';

          try {
            let map = {};
            const raw = localStorage.getItem(STORAGE_PREFIX + tableKey);
            if (raw) map = JSON.parse(raw);
            delete map[colIdx];
            localStorage.setItem(STORAGE_PREFIX + tableKey, JSON.stringify(map));
          } catch {}
        });

        th.appendChild(resizer);
      });
    };

    const setupTableStretchToolbar = (table, tableKey, claimedContainers) => {
      // Find parent container or wrapper
      const wrapper = table.closest('.table-wrapper') ||
                      table.closest('.table-responsive') ||
                      table.closest('.status-table-card') ||
                      table.closest('.table-container') ||
                      table.parentElement;

      if (!wrapper) return;

      // Find best toolbar anchor across different layout structures
      let targetToolbar =
        wrapper.querySelector('.top-bar-right-actions') ||
        wrapper.querySelector('.left-toolbar-actions') ||
        wrapper.querySelector('.table-toolbar-row') ||
        wrapper.querySelector('.table-actions-row') ||
        wrapper.querySelector('.table-top-bar') ||
        wrapper.parentElement?.querySelector('.top-bar-right-actions') ||
        wrapper.parentElement?.querySelector('.left-toolbar-actions') ||
        wrapper.parentElement?.querySelector('.table-toolbar-row') ||
        wrapper.parentElement?.querySelector('.table-actions-row') ||
        wrapper.parentElement?.querySelector('.table-top-bar');

      if (!targetToolbar && wrapper.previousElementSibling) {
        const prev = wrapper.previousElementSibling;
        targetToolbar =
          prev.querySelector('.left-toolbar-actions') ||
          prev.querySelector('.top-bar-right-actions') ||
          (prev.classList.contains('table-toolbar-row') ||
           prev.classList.contains('table-top-bar') ||
           prev.classList.contains('table-actions-row') ? prev : null);
      }

      // Restore saved table scale
      let savedScaleKey = 'normal';
      try {
        const raw = localStorage.getItem(STORAGE_SCALE_PREFIX + tableKey);
        if (raw && SCALE_LEVELS.some((l) => l.key === raw)) {
          savedScaleKey = raw;
        }
      } catch {}

      const currentIdx = Math.max(0, SCALE_LEVELS.findIndex((l) => l.key === savedScaleKey));
      const currentLevel = SCALE_LEVELS[currentIdx] || SCALE_LEVELS.find((l) => l.key === 'normal') || SCALE_LEVELS[3];

      // Always apply scale directly to the live table element
      applyTableScale(table, currentLevel);

      // If a target container is already claimed by another table on this page, do not add a duplicate!
      if (targetToolbar) {
        if (claimedContainers.has(targetToolbar)) {
          return;
        }
        claimedContainers.add(targetToolbar);
      }

      // Check if toolbar control already exists in targetToolbar or wrapper
      const containerToSearch = targetToolbar || wrapper;
      const existingInContainer = Array.from(containerToSearch.querySelectorAll('.table-stretch-toolbar'));

      if (existingInContainer.length > 0) {
        // Keep at most ONE toolbar in this container, remove any duplicates immediately!
        while (existingInContainer.length > 1) {
          const dup = existingInContainer.pop();
          dup.remove();
        }

        const singleToolbar = existingInContainer[0];
        // If this single toolbar is already bound to this active table, update its label and exit
        if (singleToolbar._boundTable === table && table.isConnected) {
          const valSpan = singleToolbar.querySelector('.stretch-val');
          if (valSpan && valSpan.textContent !== currentLevel.label) {
            valSpan.textContent = currentLevel.label;
          }
          return;
        }
        // If stale or bound to an unmounted table, remove it so we can create a clean fresh one
        singleToolbar.remove();
      }

      // Also clean up any other toolbar that claims this tableKey in the document
      document.querySelectorAll(`.table-stretch-toolbar[data-for="${tableKey}"]`).forEach((el) => el.remove());

      // Create Stretch / Size Toolbar
      const toolbar = document.createElement('div');
      toolbar.className = 'table-stretch-toolbar';
      toolbar.setAttribute('data-for', tableKey);
      toolbar._boundTable = table;
      toolbar.title = 'Increase size by stretching or decrease column & table size';

      toolbar.innerHTML = `
        <span class="stretch-badge" title="Table size and column stretch controls">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 3 21 3 21 9"></polyline>
            <polyline points="9 21 3 21 3 15"></polyline>
            <line x1="21" y1="3" x2="14" y2="10"></line>
            <line x1="3" y1="21" x2="10" y2="14"></line>
          </svg>
          Size:
        </span>
        <button type="button" class="stretch-btn stretch-dec" title="Decrease size (Compact)" aria-label="Decrease table size">−</button>
        <span class="stretch-val">${currentLevel.label}</span>
        <button type="button" class="stretch-btn stretch-inc" title="Increase size by stretching (Expand)" aria-label="Increase table size">+</button>
        <button type="button" class="stretch-btn stretch-reset" title="Reset table size and column widths back to default" aria-label="Reset table size">↺</button>
      `;

      const btnDec = toolbar.querySelector('.stretch-dec');
      const btnInc = toolbar.querySelector('.stretch-inc');
      const btnReset = toolbar.querySelector('.stretch-reset');
      const valSpan = toolbar.querySelector('.stretch-val');

      const updateScale = (newIdx) => {
        const clampedIdx = Math.max(0, Math.min(SCALE_LEVELS.length - 1, newIdx));
        const item = SCALE_LEVELS[clampedIdx];
        applyTableScale(table, item);
        if (valSpan) valSpan.textContent = item.label;
        try {
          localStorage.setItem(STORAGE_SCALE_PREFIX + tableKey, item.key);
        } catch {}
      };

      btnDec.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const currentKey = table.getAttribute('data-table-scale') || 'normal';
        const curIdx = SCALE_LEVELS.findIndex((l) => l.key === currentKey);
        const nextIdx = curIdx > 0 ? curIdx - 1 : 0;
        updateScale(nextIdx);
      });

      btnInc.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const currentKey = table.getAttribute('data-table-scale') || 'normal';
        const curIdx = SCALE_LEVELS.findIndex((l) => l.key === currentKey);
        const nextIdx = curIdx >= 0 ? Math.min(SCALE_LEVELS.length - 1, curIdx + 1) : 3;
        updateScale(nextIdx);
      });

      btnReset.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Reset scale to normal (100%)
        const normalIdx = SCALE_LEVELS.findIndex((l) => l.key === 'normal');
        updateScale(normalIdx >= 0 ? normalIdx : 3);

        // Reset all custom column widths on this table
        const thList = table.querySelectorAll('thead th');
        thList.forEach((th) => {
          th.style.width = '';
          th.style.minWidth = '';
          th.style.maxWidth = '';
        });

        try {
          localStorage.removeItem(STORAGE_PREFIX + tableKey);
          localStorage.removeItem(STORAGE_SCALE_PREFIX + tableKey);
        } catch {}
      });

      if (targetToolbar) {
        // Enforce strictly one toolbar in targetToolbar
        targetToolbar.querySelectorAll('.table-stretch-toolbar').forEach((el) => el.remove());
        targetToolbar.appendChild(toolbar);
      } else {
        // Fallback: mount before scrolling container
        const mountContainer = table.closest('.table-responsive') || table;
        mountContainer.parentElement?.querySelectorAll('.table-stretch-toolbar').forEach((el) => el.remove());
        mountContainer.parentElement?.insertBefore(toolbar, mountContainer);
      }
    };

    // Clean up any stale toolbars from other pages immediately on navigation
    document.querySelectorAll('.table-stretch-toolbar').forEach((el) => {
      if (!el._boundTable || !el._boundTable.isConnected) {
        el.remove();
      }
    });

    // Attach immediately and monitor for dynamic table updates
    attachToTables();
    initTimeoutRef.current = setTimeout(attachToTables, 250);

    const observer = new MutationObserver((mutations) => {
      // Ignore mutations from our own scaling attributes or toolbar DOM additions
      const isInternal = mutations.every((m) => {
        if (m.type === 'attributes' && (m.attributeName === 'data-table-scale' || m.attributeName === 'style')) {
          return true;
        }
        if (m.target && m.target.classList && m.target.classList.contains('table-stretch-toolbar')) {
          return true;
        }
        return false;
      });
      if (isInternal) return;

      attachToTables();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      if (initTimeoutRef.current) clearTimeout(initTimeoutRef.current);
      observer.disconnect();
      // On unmounting / page change, remove any stray toolbars so they don't bleed into the next page
      document.querySelectorAll('.table-stretch-toolbar').forEach((el) => el.remove());
    };
  }, [location.pathname]);

  return null;
};

export default GlobalTableResizer;
