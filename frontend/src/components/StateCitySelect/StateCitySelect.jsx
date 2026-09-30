import React, { useState, useRef, useEffect } from 'react';
import { INDIA_STATES, getCitiesForState } from '../../utils/indiaCities';
import './StateCitySelect.css';

/**
 * StateCitySelect — Reusable searchable State + dependent City dropdowns
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
  const [cityOpen, setCityOpen] = useState(false);
  const stateRef = useRef(null);
  const cityRef = useRef(null);

  const cities = getCitiesForState(stateValue);

  const filteredStates = stateSearch.trim()
    ? INDIA_STATES.filter((s) =>
        s.toLowerCase().startsWith(stateSearch.toLowerCase().trim())
      )
    : INDIA_STATES;

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
    setStateSearch('');
    setStateOpen(false);
    if (onStateBlur) onStateBlur();
  };

  const handleCitySelect = (city) => {
    onCityChange(city);
    setCityOpen(false);
    if (onCityBlur) onCityBlur();
  };

  const handleStateInputChange = (e) => {
    const val = e.target.value.toUpperCase();
    setStateSearch(val);
    setStateOpen(true);
    // If user clears the input, also clear the selected state
    if (!val) {
      onStateChange('');
      onCityChange('');
    }
  };

  return (
    <>
      {/* ── State ── */}
      <div className="form-group" ref={stateRef}>
        <label>
          State {required && <span className="req">*</span>}
        </label>
        <div className={`scs-wrapper ${stateError ? 'invalid' : ''}`}>
          <input
            type="text"
            className="scs-input"
            placeholder="Type to search state…"
            value={stateOpen ? stateSearch : stateValue}
            onFocus={() => {
              setStateSearch('');
              setStateOpen(true);
            }}
            onChange={handleStateInputChange}
            onBlur={() => {
              // small delay so click on option registers first
              setTimeout(() => {
                setStateOpen(false);
                if (onStateBlur) onStateBlur();
              }, 150);
            }}
            autoComplete="off"
          />
          <span className="scs-chevron" onClick={() => setStateOpen((p) => !p)}>
            {stateOpen ? '▲' : '▼'}
          </span>
          {stateOpen && filteredStates.length > 0 && (
            <ul className="scs-dropdown">
              {filteredStates.map((s) => (
                <li
                  key={s}
                  className={`scs-option ${s === stateValue ? 'selected' : ''}`}
                  onMouseDown={() => handleStateSelect(s)}
                >
                  {s}
                </li>
              ))}
            </ul>
          )}
          {stateOpen && filteredStates.length === 0 && (
            <ul className="scs-dropdown">
              <li className="scs-option scs-no-result">No state found</li>
            </ul>
          )}
        </div>
        {stateError && <div className="field-error">{stateError}</div>}
      </div>

      {/* ── City ── */}
      <div className="form-group" ref={cityRef}>
        <label>
          City {required && <span className="req">*</span>}
        </label>
        <div className={`scs-wrapper ${cityError ? 'invalid' : ''} ${!stateValue ? 'scs-disabled' : ''}`}>
          {cities.length > 0 ? (
            <>
              <input
                type="text"
                className="scs-input"
                placeholder={stateValue ? 'Select city…' : 'Select state first'}
                value={cityOpen ? '' : cityValue}
                readOnly={!stateValue}
                onFocus={() => stateValue && setCityOpen(true)}
                onBlur={() => {
                  setTimeout(() => {
                    setCityOpen(false);
                    if (onCityBlur) onCityBlur();
                  }, 150);
                }}
                autoComplete="off"
              />
              <span
                className="scs-chevron"
                onClick={() => stateValue && setCityOpen((p) => !p)}
              >
                {cityOpen ? '▲' : '▼'}
              </span>
              {cityOpen && (
                <ul className="scs-dropdown">
                  {cities.map((c) => (
                    <li
                      key={c}
                      className={`scs-option ${c === cityValue ? 'selected' : ''}`}
                      onMouseDown={() => handleCitySelect(c)}
                    >
                      {c}
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <input
              type="text"
              className="scs-input"
              placeholder={stateValue ? 'Enter city name' : 'Select state first'}
              value={cityValue}
              disabled={!stateValue}
              onChange={(e) => onCityChange(e.target.value.toUpperCase())}
              onBlur={() => { if (onCityBlur) onCityBlur(); }}
              autoComplete="off"
            />
          )}
        </div>
        {cityError && <div className="field-error">{cityError}</div>}
      </div>
    </>
  );
};

export default StateCitySelect;
