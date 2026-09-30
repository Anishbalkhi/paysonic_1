import React, { useState, useRef, useEffect } from 'react';
import { INDIA_STATES, getCitiesForState } from '../../utils/indiaCities';
import './StateCitySelect.css';

/**
 * StateCitySelect — Reusable searchable State + searchable dependent City dropdowns
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
  const [citySearch, setCitySearch] = useState('');
  const [cityOpen, setCityOpen] = useState(false);

  const stateRef = useRef(null);
  const cityRef = useRef(null);

  const cities = getCitiesForState(stateValue);

  // Filter states based on user typing
  const filteredStates = stateSearch.trim()
    ? INDIA_STATES.filter((s) =>
        s.toLowerCase().includes(stateSearch.toLowerCase().trim())
      )
    : INDIA_STATES;

  // Filter cities for selected state based on user typing
  const filteredCities = citySearch.trim()
    ? cities.filter((c) =>
        c.toLowerCase().includes(citySearch.toLowerCase().trim())
      )
    : cities;



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

  const handleCitySelect = (city) => {
    onCityChange(city);
    setCitySearch(city);
    setCityOpen(false);
    if (onCityBlur) onCityBlur();
  };

  const handleCityInputChange = (e) => {
    const val = e.target.value.toUpperCase();
    setCitySearch(val);
    onCityChange(val);
    setCityOpen(true);
  };

  const isExactCityMatch = cities.some(
    (c) => c.toLowerCase() === (citySearch || '').trim().toLowerCase()
  );

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
            value={stateOpen ? stateSearch : (stateValue || '')}
            onFocus={() => {
              setStateSearch(stateValue || '');
              setStateOpen(true);
            }}
            onChange={handleStateInputChange}
            onBlur={() => {
              setTimeout(() => {
                setStateOpen(false);
                if (onStateBlur) onStateBlur();
              }, 200);
            }}
            autoComplete="off"
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
            <ul className="scs-dropdown">
              {filteredStates.map((s) => (
                <li
                  key={s}
                  className={`scs-option ${s === stateValue ? 'selected' : ''}`}
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
            onBlur={() => {
              setTimeout(() => {
                setCityOpen(false);
                if (onCityBlur) onCityBlur();
              }, 200);
            }}
            autoComplete="off"
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
            <ul className="scs-dropdown">
              {filteredCities.length > 0 ? (
                <>
                  {filteredCities.map((c) => (
                    <li
                      key={c}
                      className={`scs-option ${c === cityValue ? 'selected' : ''}`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleCitySelect(c);
                      }}
                    >
                      {c}
                    </li>
                  ))}
                  {/* If user typed a custom city not in the standard list, allow saving it */}
                  {citySearch.trim() && !isExactCityMatch && (
                    <li
                      className="scs-option scs-custom"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleCitySelect(citySearch.trim().toUpperCase());
                      }}
                    >
                      Use &ldquo;{citySearch.trim().toUpperCase()}&rdquo; (Custom City)
                    </li>
                  )}
                </>
              ) : (
                <>
                  {citySearch.trim() ? (
                    <li
                      className="scs-option scs-custom"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleCitySelect(citySearch.trim().toUpperCase());
                      }}
                    >
                      Use &ldquo;{citySearch.trim().toUpperCase()}&rdquo; (Custom City)
                    </li>
                  ) : (
                    <li className="scs-option scs-no-result">No cities listed for this state</li>
                  )}
                </>
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
