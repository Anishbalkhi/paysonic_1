import React, { useState, useRef, useEffect, useMemo } from 'react';
import { INDIA_STATES, getCitiesForState } from '../../utils/indiaCities';
import './StateCitySelect.css';

/**
 * StateCitySelect — Reusable searchable State + searchable dependent City dropdowns
 * Full Keyboard Navigation Support:
 * - Up/Down Arrow keys to traverse dropdown options with live input preview & auto-scroll
 * - Enter key to select active highlighted option & automatically focus City input
 * - Tab key selects highlighted option and advances to next field
 * - Escape key dismisses dropdown and reverts to saved selection
 * - Custom cities supported with seamless keyboard selection
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
  const [stateSearch, setStateSearch] = useState(stateValue || '');
  const [stateOpen, setStateOpen] = useState(false);
  const [isStateSearching, setIsStateSearching] = useState(false);
  const [stateHighlightedIndex, setStateHighlightedIndex] = useState(-1);

  const [citySearch, setCitySearch] = useState(cityValue || '');
  const [cityOpen, setCityOpen] = useState(false);
  const [isCitySearching, setIsCitySearching] = useState(false);
  const [cityHighlightedIndex, setCityHighlightedIndex] = useState(-1);

  const stateRef = useRef(null);
  const cityRef = useRef(null);
  const stateInputRef = useRef(null);
  const cityInputRef = useRef(null);
  const stateListRef = useRef(null);
  const cityListRef = useRef(null);

  // Synchronize internal search text when external props change
  useEffect(() => {
    setStateSearch(stateValue || '');
  }, [stateValue]);

  useEffect(() => {
    setCitySearch(cityValue || '');
  }, [cityValue]);

  const cities = useMemo(() => getCitiesForState(stateValue), [stateValue]);

  // Filter states: show ALL states when just browsing; filter when user is typing
  const filteredStates = useMemo(() => {
    if (!isStateSearching || !stateSearch.trim()) {
      return INDIA_STATES;
    }
    const q = stateSearch.toLowerCase().trim();
    return INDIA_STATES.filter((s) => s.toLowerCase().includes(q));
  }, [isStateSearching, stateSearch]);

  // Filter cities: show all cities of selected state when browsing; filter when typing
  const filteredCities = useMemo(() => {
    if (!isCitySearching || !citySearch.trim()) {
      return cities;
    }
    const q = citySearch.toLowerCase().trim();
    return cities.filter((c) => c.toLowerCase().includes(q));
  }, [cities, isCitySearching, citySearch]);

  // Navigable city options (standard + custom if typed text is not in standard list)
  const cityOptions = useMemo(() => {
    const list = filteredCities.map((c) => ({ type: 'standard', value: c }));
    if (isCitySearching && citySearch.trim()) {
      const exactMatch = cities.some(
        (c) => c.toLowerCase() === citySearch.trim().toLowerCase()
      );
      if (!exactMatch) {
        list.push({
          type: 'custom',
          value: citySearch.trim().toUpperCase(),
          label: `Use "${citySearch.trim().toUpperCase()}" (Custom City)`,
        });
      }
    }
    return list;
  }, [filteredCities, cities, isCitySearching, citySearch]);

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

  // Set initial highlight when State dropdown opens
  useEffect(() => {
    if (stateOpen) {
      if (!isStateSearching && stateValue) {
        const idx = filteredStates.findIndex(
          (s) => s.toUpperCase() === stateValue.toUpperCase()
        );
        setStateHighlightedIndex(idx >= 0 ? idx : 0);
      } else if (stateHighlightedIndex < 0 && filteredStates.length > 0) {
        setStateHighlightedIndex(0);
      }
    } else {
      setStateHighlightedIndex(-1);
    }
  }, [stateOpen, isStateSearching, filteredStates, stateValue]);

  // Set initial highlight when City dropdown opens
  useEffect(() => {
    if (cityOpen) {
      if (!isCitySearching && cityValue) {
        const idx = cityOptions.findIndex(
          (c) => c.value.toUpperCase() === cityValue.toUpperCase()
        );
        setCityHighlightedIndex(idx >= 0 ? idx : 0);
      } else if (cityHighlightedIndex < 0 && cityOptions.length > 0) {
        setCityHighlightedIndex(0);
      }
    } else {
      setCityHighlightedIndex(-1);
    }
  }, [cityOpen, isCitySearching, cityOptions, cityValue]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (stateRef.current && !stateRef.current.contains(e.target)) {
        setStateOpen(false);
        setIsStateSearching(false);
      }
      if (cityRef.current && !cityRef.current.contains(e.target)) {
        setCityOpen(false);
        setIsCitySearching(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleStateSelect = (state) => {
    if (!state) return;
    onStateChange(state);
    if (state !== stateValue) {
      onCityChange('');
      setCitySearch('');
    }
    setStateSearch(state);
    setIsStateSearching(false);
    setStateOpen(false);
    setStateHighlightedIndex(-1);
    // Smoothly focus city input for mouse-free keyboard workflow
    setTimeout(() => {
      cityInputRef.current?.focus();
    }, 50);
  };

  const handleCitySelect = (city) => {
    if (!city) return;
    onCityChange(city);
    setCitySearch(city);
    setIsCitySearching(false);
    setCityOpen(false);
    setCityHighlightedIndex(-1);
  };

  const handleStateInputChange = (e) => {
    const val = e.target.value.toUpperCase();
    setStateSearch(val);
    setIsStateSearching(true);
    setStateOpen(true);
    setStateHighlightedIndex(0);
    if (!val) {
      onStateChange('');
      onCityChange('');
      setCitySearch('');
    }
  };

  const handleCityInputChange = (e) => {
    const val = e.target.value.toUpperCase();
    setCitySearch(val);
    setIsCitySearching(true);
    onCityChange(val);
    setCityOpen(true);
    setStateHighlightedIndex(0);
  };

  const handleStateKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!stateOpen) {
        setStateOpen(true);
        setIsStateSearching(false);
        const idx = filteredStates.findIndex(
          (s) => s.toUpperCase() === (stateValue || '').toUpperCase()
        );
        setStateHighlightedIndex(idx >= 0 ? idx : 0);
        return;
      }
      if (filteredStates.length === 0) return;
      setStateHighlightedIndex((prev) => (prev < filteredStates.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!stateOpen) {
        setStateOpen(true);
        setIsStateSearching(false);
        const idx = filteredStates.findIndex(
          (s) => s.toUpperCase() === (stateValue || '').toUpperCase()
        );
        setStateHighlightedIndex(idx >= 0 ? idx : filteredStates.length - 1);
        return;
      }
      if (filteredStates.length === 0) return;
      setStateHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filteredStates.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (stateOpen) {
        if (stateHighlightedIndex >= 0 && stateHighlightedIndex < filteredStates.length) {
          handleStateSelect(filteredStates[stateHighlightedIndex]);
        } else if (filteredStates.length > 0) {
          handleStateSelect(filteredStates[0]);
        }
      } else {
        setStateOpen(true);
        setIsStateSearching(false);
      }
    } else if (e.key === 'Tab') {
      if (stateOpen && stateHighlightedIndex >= 0 && stateHighlightedIndex < filteredStates.length) {
        handleStateSelect(filteredStates[stateHighlightedIndex]);
      } else {
        setStateOpen(false);
        setIsStateSearching(false);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setStateOpen(false);
      setIsStateSearching(false);
      setStateSearch(stateValue || '');
    }
  };

  const handleCityKeyDown = (e) => {
    if (!stateValue) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!cityOpen) {
        setCityOpen(true);
        setIsCitySearching(false);
        const idx = cityOptions.findIndex(
          (c) => c.value.toUpperCase() === (cityValue || '').toUpperCase()
        );
        setCityHighlightedIndex(idx >= 0 ? idx : 0);
        return;
      }
      if (cityOptions.length === 0) return;
      setCityHighlightedIndex((prev) => (prev < cityOptions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!cityOpen) {
        setCityOpen(true);
        setIsCitySearching(false);
        const idx = cityOptions.findIndex(
          (c) => c.value.toUpperCase() === (cityValue || '').toUpperCase()
        );
        setCityHighlightedIndex(idx >= 0 ? idx : cityOptions.length - 1);
        return;
      }
      if (cityOptions.length === 0) return;
      setCityHighlightedIndex((prev) => (prev > 0 ? prev - 1 : cityOptions.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (cityOpen) {
        if (cityHighlightedIndex >= 0 && cityHighlightedIndex < cityOptions.length) {
          handleCitySelect(cityOptions[cityHighlightedIndex].value);
        } else if (cityOptions.length > 0) {
          handleCitySelect(cityOptions[0].value);
        } else if (citySearch.trim()) {
          handleCitySelect(citySearch.trim().toUpperCase());
        }
      } else {
        setCityOpen(true);
        setIsCitySearching(false);
      }
    } else if (e.key === 'Tab') {
      if (cityOpen && cityHighlightedIndex >= 0 && cityHighlightedIndex < cityOptions.length) {
        handleCitySelect(cityOptions[cityHighlightedIndex].value);
      } else if (cityOpen && isCitySearching && citySearch.trim()) {
        const match = cities.find((c) => c.toLowerCase() === citySearch.trim().toLowerCase());
        handleCitySelect(match || citySearch.trim().toUpperCase());
      } else {
        setCityOpen(false);
        setIsCitySearching(false);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setCityOpen(false);
      setIsCitySearching(false);
      setCitySearch(cityValue || '');
    }
  };

  const handleStateBlur = () => {
    setTimeout(() => {
      if (stateRef.current && stateRef.current.contains(document.activeElement)) {
        return;
      }
      setStateOpen(false);
      setIsStateSearching(false);
      if (stateSearch.trim()) {
        const match = INDIA_STATES.find(
          (s) => s.toLowerCase() === stateSearch.trim().toLowerCase()
        );
        if (match && match !== stateValue) {
          handleStateSelect(match);
        } else if (!match && !stateValue) {
          setStateSearch('');
        } else {
          setStateSearch(stateValue || '');
        }
      } else {
        setStateSearch(stateValue || '');
      }
      if (onStateBlur) onStateBlur();
    }, 150);
  };

  const handleCityBlur = () => {
    setTimeout(() => {
      if (cityRef.current && cityRef.current.contains(document.activeElement)) {
        return;
      }
      setCityOpen(false);
      setIsCitySearching(false);
      if (citySearch.trim()) {
        const match = cities.find(
          (c) => c.toLowerCase() === citySearch.trim().toLowerCase()
        );
        const finalCity = match || citySearch.trim().toUpperCase();
        if (finalCity !== cityValue) {
          handleCitySelect(finalCity);
        }
      } else {
        setCitySearch(cityValue || '');
      }
      if (onCityBlur) onCityBlur();
    }, 150);
  };

  // Compute live value displayed inside inputs
  const displayStateValue = isStateSearching
    ? stateSearch
    : stateOpen && stateHighlightedIndex >= 0 && filteredStates[stateHighlightedIndex]
    ? filteredStates[stateHighlightedIndex]
    : (stateValue || '');

  const displayCityValue = isCitySearching
    ? citySearch
    : cityOpen && cityHighlightedIndex >= 0 && cityOptions[cityHighlightedIndex]?.value
    ? cityOptions[cityHighlightedIndex].value
    : (cityValue || '');

  return (
    <>
      {/* ── State ── */}
      <div className="form-group" ref={stateRef}>
        <label id="scs-state-label">
          State {required && <span className="req">*</span>}
        </label>
        <div className={`scs-wrapper ${stateError ? 'invalid' : ''}`}>
          <input
            ref={stateInputRef}
            type="text"
            className="scs-input"
            placeholder="Type or press ↓ to select state…"
            value={displayStateValue}
            onFocus={() => {
              setIsStateSearching(false);
              setStateOpen(true);
            }}
            onChange={handleStateInputChange}
            onKeyDown={handleStateKeyDown}
            onBlur={handleStateBlur}
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
              if (!stateOpen) {
                setIsStateSearching(false);
                setStateOpen(true);
                stateInputRef.current?.focus();
              } else {
                setStateOpen(false);
              }
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
            ref={cityInputRef}
            type="text"
            className="scs-input"
            placeholder={stateValue ? 'Type or press ↓ to select city…' : 'Select state first'}
            value={displayCityValue}
            disabled={!stateValue}
            onFocus={() => {
              if (stateValue) {
                setIsCitySearching(false);
                setCityOpen(true);
              }
            }}
            onChange={handleCityInputChange}
            onKeyDown={handleCityKeyDown}
            onBlur={handleCityBlur}
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
              if (stateValue) {
                if (!cityOpen) {
                  setIsCitySearching(false);
                  setCityOpen(true);
                  cityInputRef.current?.focus();
                } else {
                  setCityOpen(false);
                }
              }
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
