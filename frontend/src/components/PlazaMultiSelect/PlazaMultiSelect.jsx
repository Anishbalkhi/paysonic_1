import React, { useState, useEffect, useRef, useMemo } from 'react';
import useOnboardedPlazas from '../../hooks/useOnboardedPlazas';
import './PlazaMultiSelect.scss';

export const PlazaMultiSelect = ({
  selectedPlazas = [],
  onChange,
  label = 'Plaza Name / ID',
  placeholder = 'All Plazas (Select specific)',
  id = 'plazaMultiSelect',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { plazas } = useOnboardedPlazas();
  const containerRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);

  // Filter plazas based on inner search
  const filteredPlazas = useMemo(() => {
    if (!searchTerm.trim()) return plazas;
    const q = searchTerm.toLowerCase().trim();
    return plazas.filter(
      (p) => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)
    );
  }, [plazas, searchTerm]);

  const isAllSelected = plazas.length > 0 && selectedPlazas.length === plazas.length;
  const isPartiallySelected = selectedPlazas.length > 0 && selectedPlazas.length < plazas.length;

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      onChange([]);
    } else {
      onChange(plazas.map((p) => p.id));
    }
  };

  const handleTogglePlaza = (plazaId) => {
    if (selectedPlazas.includes(plazaId)) {
      onChange(selectedPlazas.filter((id) => id !== plazaId));
    } else {
      onChange([...selectedPlazas, plazaId]);
    }
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange([]);
  };

  // Label to show on closed trigger button
  const triggerLabel = useMemo(() => {
    if (selectedPlazas.length === 0) {
      return placeholder;
    }
    if (isAllSelected) {
      return `All Plazas Selected (${plazas.length})`;
    }
    if (selectedPlazas.length === 1) {
      const match = plazas.find((p) => p.id === selectedPlazas[0]);
      return match ? `${match.id} - ${match.name}` : `Plaza ${selectedPlazas[0]}`;
    }
    return `${selectedPlazas.length} of ${plazas.length} Plazas Selected`;
  }, [selectedPlazas, isAllSelected, plazas, placeholder]);

  return (
    <div className="plaza-multiselect-container" ref={containerRef}>
      {label && <label htmlFor={id} className="multiselect-label">{label}</label>}

      <div
        id={id}
        className={`multiselect-trigger ${isOpen ? 'active' : ''} ${selectedPlazas.length > 0 ? 'has-selection' : ''}`}
        onClick={() => setIsOpen((prev) => !prev)}
        tabIndex={0}
        role="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="trigger-text" title={triggerLabel}>
          {selectedPlazas.length > 0 && (
            <span className="selection-badge">
              {isAllSelected ? 'ALL' : selectedPlazas.length}
            </span>
          )}
          <span className="label-text">{triggerLabel}</span>
        </div>

        <div className="trigger-actions">
          {selectedPlazas.length > 0 && (
            <button
              type="button"
              className="clear-btn"
              onClick={handleClear}
              title="Clear plaza filter"
              aria-label="Clear selection"
            >
              ✕
            </button>
          )}
          <svg
            className={`chevron-icon ${isOpen ? 'rotate' : ''}`}
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>

      {isOpen && (
        <div className="multiselect-dropdown" role="listbox">
          {/* Search box inside dropdown */}
          <div className="dropdown-search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#98A2B3" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
            <input
              type="text"
              placeholder="Search by ID or name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
            {searchTerm && (
              <button
                type="button"
                className="clear-search"
                onClick={(e) => {
                  e.stopPropagation();
                  setSearchTerm('');
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Quick Actions Header */}
          <div className="dropdown-header">
            <label className="checkbox-row select-all-row" onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={isAllSelected}
                ref={(el) => {
                  if (el) el.indeterminate = isPartiallySelected;
                }}
                onChange={handleToggleSelectAll}
              />
              <span className="checkbox-custom" />
              <span className="checkbox-label font-bold">
                {isAllSelected ? 'Deselect All' : 'Select All Plazas'}
              </span>
            </label>

            <span className="counter-tag">
              {selectedPlazas.length} / {plazas.length}
            </span>
          </div>

          {/* Scrollable list of plaza checkboxes */}
          <div className="dropdown-list">
            {filteredPlazas.length === 0 ? (
              <div className="empty-message">No matching plazas found</div>
            ) : (
              filteredPlazas.map((p) => {
                const checked = selectedPlazas.includes(p.id);
                return (
                  <label
                    key={p.id}
                    className={`checkbox-row item-row ${checked ? 'selected' : ''}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleTogglePlaza(p.id)}
                    />
                    <span className="checkbox-custom" />
                    <span className="checkbox-label">
                      <strong className="plaza-id">{p.id}</strong>
                      <span className="plaza-sep">-</span>
                      <span className="plaza-name">{p.name}</span>
                    </span>
                  </label>
                );
              })
            )}
          </div>

          {/* Footer with summary and Done button */}
          <div className="dropdown-footer">
            <button
              type="button"
              className="btn-link"
              onClick={() => onChange([])}
            >
              Reset to All
            </button>
            <button
              type="button"
              className="btn-apply"
              onClick={() => setIsOpen(false)}
            >
              Apply Filter
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlazaMultiSelect;
