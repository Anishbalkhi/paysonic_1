import React, { useState, useRef, useEffect, useMemo } from 'react';
import { INDIA_STATES, getCitiesForState } from '../../utils/indiaCities';
import './StateCitySelect.css';

/**
 * StateCitySelect — Reusable searchable State + searchable dependent City dropdowns
 * Full Keyboard Navigation Support:
 * - Up/Down Arrow keys to traverse dropdown options
 * - Enter key to select active highlighted option
 * - Escape key to dismiss dropdown
 * - Auto-scrolls dropdown list as user traverses with keyboard
 *
 * Props:
 *   stateValue   {string}   — current state value (UPPERCASE)
 *   cityValue    {string}   — current city value (UPPERCASE)
 *   onStateChange(val)      — called with new state string
 *   onCityChange(val)       — called with new city string
 *   stateError   {string}   — validation error for state field
 *   cityError    {string}   — validation error for city field
 *   onStateBlur  {fn}       — onBlur for state field
 *   onCityBlur   {fn}       — onBlur for city field
 *   required     {bool}     — show asterisk on labels (default true)
 */
export const StateCitySelect = ({
  stateValue = '',
  cityValue = '',
  onStateChange,
  onCityChange,
  stateError = '',
  cityError = '',
  onStateBlur,
  onCityBlur,
  required = true,
}) => {
  const [stateSearch, setStateSearch] = useState('');
  const [stateOpen, setStateOpen] = useState(false);
  const [stateHighlightedIndex, setStateHighlightedIndex] = useState(-1);

  const [citySearch, setCitySearch] = useState('');
  const [cityOpen, setCityOpen] = useState(false);
  const [cityHighlightedIndex, setCityHighlightedIndex] = useState(-1);

  const stateRef = useRef(null);
  const cityRef = useRef(null);
  const stateListRef = useRef(null);
  const cityListRef = useRef(null);

  const cities = useMemo(() => getCitiesForState(stateValue), [stateValue]);

  // Filter states based on user typing
  const filteredStates = useMemo(() => {
    return stateSearch.trim()
      ? INDIA_STATES.filter((s) =>
          s.toLowerCase().includes(stateSearch.toLowerCase().trim())
        )
      : INDIA_STATES;
  }, [stateSearch]);

  // Filter cities for selected state based on user typing
  const filteredCities = useMemo(() => {
    return citySearch.trim()
      ? cities.filter((c) =>
          c.toLowerCase().includes(citySearch.toLowerCase().trim())
        )
      : cities;
  }, [cities, citySearch]);

  const isExactCityMatch = useMemo(() => {
    return cities.some(
      (c) => c.toLowerCase() === (citySearch || '').trim().toLowerCase()
    );
  }, [cities, citySearch]);

  // Complete list of navigable city options (standard + custom if user typed a non-listed city)
  const cityOptions = useMemo(() => {
    const list = filteredCities.map((c) => ({ type: 'standard', value: c }));
    if (citySearch.trim() && !isExactCityMatch) {
      list.push({
        type: 'custom',
        value: citySearch.trim().toUpperCase(),
        label: `Use "${citySearch.trim().toUpperCase()}" (Custom City)`,
      });
    }
    return list;
  }, [filteredCities, citySearch, isExactCityMatch]);

  // Auto-scroll highlighted state into view
  useEffect(() => {
    if (stateOpen && stateListRef.current && stateHighlightedIndex >= 0) {
      const activeEl = stateListRef.current.children[stateHighlightedIndex];
      if (activeEl && typeof activeEl.scrollIntoView === 'function') {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [stateHighlightedIndex, stateOpen]);

  // Auto-scroll highlighted city into view
  useEffect(() => {
    if (cityOpen && cityListRef.current && cityHighlightedIndex >= 0) {
      const activeEl = cityListRef.current.children[cityHighlightedIndex];
      if (activeEl && typeof activeEl.scrollIntoView === 'function') {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [cityHighlightedIndex, cityOpen]);

  // Reset or initialize state highlight when filtered list or open state changes
  useEffect(() => {
    if (stateOpen) {
      const initialIdx = filteredStates.findIndex(
        (s) => s.toUpperCase() === (stateValue || '').toUpperCase()
      );
      setStateHighlightedIndex(initialIdx >= 0 ? initialIdx : (filteredStates.length > 0 ? 0 : -1));
    } else {
      setStateHighlightedIndex(-1);
    }
  }, [stateOpen, filteredStates, stateValue]);

  // Reset or initialize city highlight when city options or open state changes
  useEffect(() => {
    if (cityOpen) {
      const initialIdx = cityOptions.findIndex(
        (c) => c.value.toUpperCase() === (cityValue || '').toUpperCase()
      );
      setCityHighlightedIndex(initialIdx >= 0 ? initialIdx : (cityOptions.length > 0 ? 0 : -1));
    } else {
      setCityHighlightedIndex(-1);
    }
  }, [cityOpen, cityOptions, cityValue]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (stateRef.current && !stateRef.current.contains(e.target)) {
        setStateOpen(false);
      }
      if (cityRef.current && !cityRef.current.contains(e.target)) {
        setCityOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleStateSelect = (state) => {
    onStateChange(state);
    onCityChange(''); // reset city when state changes
    setStateSearch(state);
    setCitySearch('');
    setStateOpen(false);
    setStateHighlightedIndex(-1);
    if (onStateBlur) onStateBlur();
  };

  const handleStateInputChange = (e) => {
    const val = e.target.value.toUpperCase();
    setStateSearch(val);
    setStateOpen(true);
    if (!val) {
      onStateChange('');
      onCityChange('');
      setCitySearch('');
    }
  };

  const handleStateKeyDown = (e) => {
    if (!stateOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
        e.preventDefault();
        setStateOpen(true);
        setStateHighlightedIndex(0);
        return;
      }
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (filteredStates.length === 0) return;
      setStateHighlightedIndex((prev) => (prev < filteredStates.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (filteredStates.length === 0) return;
      setStateHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filteredStates.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (stateOpen && stateHighlightedIndex >= 0 && stateHighlightedIndex < filteredStates.length) {
        handleStateSelect(filteredStates[stateHighlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setStateOpen(false);
    } else if (e.key === 'Tab') {
      if (stateOpen && stateHighlightedIndex >= 0 && stateHighlightedIndex < filteredStates.length) {
        handleStateSelect(filteredStates[stateHighlightedIndex]);
      } else {
        setStateOpen(false);
      }
    }
  };

  const handleCitySelect = (city) => {
    onCityChange(city);
    setCitySearch(city);
    setCityOpen(false);
    setCityHighlightedIndex(-1);
    if (onCityBlur) onCityBlur();
  };

  const handleCityInputChange = (e) => {
    const val = e.target.value.toUpperCase();
    setCitySearch(val);
    onCityChange(val);
    setCityOpen(true);
  };

  const handleCityKeyDown = (e) => {
    if (!stateValue) return;

    if (!cityOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
        e.preventDefault();
        setCityOpen(true);
        setCityHighlightedIndex(0);
        return;
      }
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (cityOptions.length === 0) return;
      setCityHighlightedIndex((prev) => (prev < cityOptions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (cityOptions.length === 0) return;
      setCityHighlightedIndex((prev) => (prev > 0 ? prev - 1 : cityOptions.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (cityOpen && cityHighlightedIndex >= 0 && cityHighlightedIndex < cityOptions.length) {
        const item = cityOptions[cityHighlightedIndex];
        handleCitySelect(item.value);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setCityOpen(false);
    } else if (e.key === 'Tab') {
      if (cityOpen && cityHighlightedIndex >= 0 && cityHighlightedIndex < cityOptions.length) {
        const item = cityOptions[cityHighlightedIndex];
        handleCitySelect(item.value);
      } else {
        setCityOpen(false);
      }
    }
  };

  return (
    <>
      {/* ── State ── */}
      <div className="form-group" ref={stateRef}>
        <label id="scs-state-label">
          State {required && <span className="req">*</span>}
        </label>
        <div className={`scs-wrapper ${stateError ? 'invalid' : ''}`}>
          <input
            type="text"
            className="scs-input"
            placeholder="Type to search state…"
            value={stateOpen ? stateSearch : (stateValue || '')}
            onFocus={() => {
              setStateSearch(stateValue || '');
              setStateOpen(true);
            }}
            onChange={handleStateInputChange}
            onKeyDown={handleStateKeyDown}
            onBlur={() => {
              setTimeout(() => {
                setStateOpen(false);
                if (onStateBlur) onStateBlur();
              }, 200);
            }}
            autoComplete="off"
            role="combobox"
            aria-expanded={stateOpen}
            aria-haspopup="listbox"
            aria-controls="scs-state-listbox"
            aria-labelledby="scs-state-label"
          />
          <span
            className="scs-chevron"
            onClick={(e) => {
              e.stopPropagation();
              setStateOpen((p) => !p);
            }}
          >
            {stateOpen ? '▲' : '▼'}
          </span>
          {stateOpen && filteredStates.length > 0 && (
            <ul
              id="scs-state-listbox"
              role="listbox"
              className="scs-dropdown"
              ref={stateListRef}
            >
              {filteredStates.map((s, idx) => (
                <li
                  key={s}
                  role="option"
                  aria-selected={s === stateValue}
                  className={`scs-option ${s === stateValue ? 'selected' : ''} ${
                    idx === stateHighlightedIndex ? 'highlighted' : ''
                  }`}
                  onMouseEnter={() => setStateHighlightedIndex(idx)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleStateSelect(s);
                  }}
                >
                  {s}
                </li>
              ))}
            </ul>
          )}
          {stateOpen && filteredStates.length === 0 && (
            <ul className="scs-dropdown" ref={stateListRef}>
              <li className="scs-option scs-no-result">No state found</li>
            </ul>
          )}
        </div>
        {stateError && <div className="field-error">{stateError}</div>}
      </div>

      {/* ── City ── */}
      <div className="form-group" ref={cityRef}>
        <label id="scs-city-label">
          City {required && <span className="req">*</span>}
        </label>
        <div className={`scs-wrapper ${cityError ? 'invalid' : ''} ${!stateValue ? 'scs-disabled' : ''}`}>
          <input
            type="text"
            className="scs-input"
            placeholder={stateValue ? 'Type or select city…' : 'Select state first'}
            value={cityOpen ? citySearch : (cityValue || '')}
            disabled={!stateValue}
            onFocus={() => {
              if (stateValue) {
                setCitySearch(cityValue || '');
                setCityOpen(true);
              }
            }}
            onChange={handleCityInputChange}
            onKeyDown={handleCityKeyDown}
            onBlur={() => {
              setTimeout(() => {
                setCityOpen(false);
                if (onCityBlur) onCityBlur();
              }, 200);
            }}
            autoComplete="off"
            role="combobox"
            aria-expanded={cityOpen}
            aria-haspopup="listbox"
            aria-controls="scs-city-listbox"
            aria-labelledby="scs-city-label"
          />
          <span
            className="scs-chevron"
            onClick={(e) => {
              e.stopPropagation();
              if (stateValue) setCityOpen((p) => !p);
            }}
          >
            {cityOpen ? '▲' : '▼'}
          </span>

          {cityOpen && stateValue && (
            <ul
              id="scs-city-listbox"
              role="listbox"
              className="scs-dropdown"
              ref={cityListRef}
            >
              {cityOptions.length > 0 ? (
                cityOptions.map((item, idx) => (
                  <li
                    key={`${item.type}-${item.value}`}
                    role="option"
                    aria-selected={item.value === cityValue}
                    className={`scs-option ${item.type === 'custom' ? 'scs-custom' : ''} ${
                      item.value === cityValue ? 'selected' : ''
                    } ${idx === cityHighlightedIndex ? 'highlighted' : ''}`}
                    onMouseEnter={() => setCityHighlightedIndex(idx)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleCitySelect(item.value);
                    }}
                  >
                    {item.label || item.value}
                  </li>
                ))
              ) : (
                <li className="scs-option scs-no-result">No cities listed for this state</li>
              )}
            </ul>
          )}
        </div>
        {cityError && <div className="field-error">{cityError}</div>}
      </div>
    </>
  );
};

export default StateCitySelect;
