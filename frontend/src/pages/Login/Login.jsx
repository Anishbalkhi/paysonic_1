import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getDefaultRouteForUser } from '../../config/roleMenus';
import SecurityService from '../../services/security/SecurityService';
import './Login.scss';

export const Login = () => {
  const { login, isAuthenticated, currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [timeoutNotice, setTimeoutNotice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Brute Force & Rate Limiting Security States ──
  const [isLockedOut, setIsLockedOut] = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [remainingAttempts, setRemainingAttempts] = useState(null);
  const [rateLimitSeconds, setRateLimitSeconds] = useState(0);
  const [progressiveDelayNotice, setProgressiveDelayNotice] = useState(false);

  // Clean up any inactivity notice and only show relevant device notices
  useEffect(() => {
    sessionStorage.removeItem('paysonic_timeout_notice');
    const params = new URLSearchParams(location.search);
    const reason = params.get('reason');
    if (reason === 'inactivity') {
      navigate('/login', { replace: true });
      return;
    }
    const notice =
      reason === 'concurrent_device'
        ? 'You have been logged out because your account was logged in on another device.'
        : '';
    if (notice) {
      setTimeoutNotice(notice);
    }
  }, [location.search, navigate]);

  // Listen for global 429 Rate Limit exceeded events from HTTP client
  useEffect(() => {
    const handleRateLimit = (e) => {
      if (e.detail) {
        const secs = e.detail.retryAfter || 60;
        setRateLimitSeconds(secs);
      }
    };

    window.addEventListener('paysonic_rate_limit_exceeded', handleRateLimit);
    return () => window.removeEventListener('paysonic_rate_limit_exceeded', handleRateLimit);
  }, []);

  // ── Lockout Countdown Ticker (MM:SS) ──
  useEffect(() => {
    let timer;
    if (isLockedOut && lockoutSeconds > 0) {
      timer = setInterval(() => {
        setLockoutSeconds((prev) => {
          if (prev <= 1) {
            setIsLockedOut(false);
            setRemainingAttempts(5);
            setError('');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isLockedOut, lockoutSeconds]);

  // ── Rate Limit Retry-After Countdown Ticker ──
  useEffect(() => {
    let timer;
    if (rateLimitSeconds > 0) {
      timer = setInterval(() => {
        setRateLimitSeconds((prev) => {
          if (prev <= 1) {
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [rateLimitSeconds]);

  // Check lockout status for the entered identifier on blur
  const checkAccountLockout = async (targetId) => {
    const idToCheck = (targetId || identifier).trim().toLowerCase();
    if (!idToCheck) return;
    try {
      const status = await SecurityService.checkLockout(idToCheck);
      if (status.isLocked) {
        setIsLockedOut(true);
        setLockoutSeconds(status.remainingSeconds || 900);
        setRemainingAttempts(0);
      } else {
        if (status.remainingAttempts !== undefined) {
          setRemainingAttempts(status.remainingAttempts);
        }
      }
    } catch {}
  };

  // Time-based theme & video detection
  const getIsDayTime = () => {
    const hours = new Date().getHours();
    return hours >= 6 && hours < 18; // 6:00 AM to 5:59 PM is Day
  };

  const [timeMode, setTimeMode] = useState('auto'); // 'auto' | 'day' | 'night'
  const [currentIsDay, setCurrentIsDay] = useState(getIsDayTime);

  // Re-check system time periodically
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIsDay(getIsDayTime());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const isDay = timeMode === 'auto' ? currentIsDay : timeMode === 'day';
  const activeTheme = isDay ? 'light' : 'dark';

  // Video selection based on Day / Night
  const videoSrc = isDay ? '/data/toll-plaza-day.mp4' : '/data/toll-plaza-night.mp4';

  const from = location.state?.from?.pathname;

  useEffect(() => {
    if (isAuthenticated && currentUser) {
      const targetDestination = (from && from !== '/') ? from : getDefaultRouteForUser(currentUser);
      navigate(targetDestination, { replace: true });
    }
  }, [isAuthenticated, currentUser, navigate, from]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLockedOut || rateLimitSeconds > 0) return;

    setError('');
    setTimeoutNotice('');

    if (!identifier.trim()) { setError('Please enter your registered email address.'); return; }
    if (!password)           { setError('Please enter your password.'); return; }

    // Progressive backoff delay for suspicious/repeated attempts
    if (remainingAttempts !== null && remainingAttempts <= 2) {
      setProgressiveDelayNotice(true);
      await new Promise((r) => setTimeout(r, 1200));
      setProgressiveDelayNotice(false);
    }

    setIsSubmitting(true);
    await new Promise((r) => setTimeout(r, 600));

    try {
      const session = await login(identifier.trim(), password);
      // Navigate to target: Dashboard if permitted, otherwise user's first allowed menu
      const targetDestination = (from && from !== '/') ? from : getDefaultRouteForUser(session);
      navigate(targetDestination, { replace: true });
    } catch (err) {
      if (err.isLocked) {
        setIsLockedOut(true);
        setLockoutSeconds(err.remainingSeconds || 900);
        setRemainingAttempts(0);
        setError(err.message || 'Account locked due to multiple failed login attempts.');
      } else if (err.isRateLimited) {
        const secs = err.retryAfter || 60;
        setRateLimitSeconds(secs);
      } else {
        if (err.remainingAttempts !== undefined) {
          setRemainingAttempts(err.remainingAttempts);
        }
        setError(err.message || 'Invalid credentials. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`login-page login-page--${activeTheme}`} data-theme={activeTheme}>

      {/* ── LEFT: Dynamic Day/Night Video ── */}
      <div className="login-left">
        <video
          key={videoSrc}
          className="login-video"
          src={videoSrc}
          autoPlay
          loop
          muted
          playsInline
        />
        <div className={`login-video-overlay login-video-overlay--${isDay ? 'day' : 'night'}`} />
        <div className="login-brand-badge">
          <div className="login-brand-mark">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M5 19 14 5l1.8 6.5L20 9" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span>Pay<b>sonic</b></span>
        </div>
        <div className="login-live-badge">
          <span className={`live-dot ${isDay ? 'amber' : 'red'}`} />
          {isDay ? '☀️ Day Operations • Live Feed' : '🌙 Night Operations • Live Feed'}
        </div>
        <div className="login-left-footer">
          <div className="left-stat"><span className="stat-dot green" />RFID FASTag</div>
          <div className="left-stat"><span className="stat-dot green" />DDoS Shield</div>
          <div className="left-stat"><span className="stat-dot green" />Brute-Force Shield</div>
          <div className="left-stat"><span className="stat-dot green" />99.9% Uptime</div>
        </div>
      </div>

      {/* ── RIGHT: Form with Theme Switcher ── */}
      <div className="login-right">
        {/* Subtle Theme Switcher Pill */}
        <div className="login-theme-switch">
          <button
            type="button"
            className={`theme-pill-btn ${timeMode === 'auto' ? 'active' : ''}`}
            onClick={() => setTimeMode('auto')}
            title="Auto mode: changes according to local time"
          >
            <span className="pill-icon">⏱️</span>
            <span className="pill-text">Auto ({isDay ? 'Day' : 'Night'})</span>
          </button>
          <button
            type="button"
            className={`theme-pill-btn ${timeMode === 'day' ? 'active' : ''}`}
            onClick={() => setTimeMode('day')}
            title="Day / Light mode"
          >
            <span className="pill-icon">☀️</span>
            <span className="pill-text">Day</span>
          </button>
          <button
            type="button"
            className={`theme-pill-btn ${timeMode === 'night' ? 'active' : ''}`}
            onClick={() => setTimeMode('night')}
            title="Night / Dark mode"
          >
            <span className="pill-icon">🌙</span>
            <span className="pill-text">Night</span>
          </button>
        </div>

        <div className="login-form-wrap">

          {/* Logo */}
          <div className="lf-logo">
            <div className="lf-logo-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M5 19 14 5l1.8 6.5L20 9" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="lf-logo-text"><span className="pay">Pay</span><span className="sonic">sonic</span></span>
          </div>

          {/* Headings */}
          <h1 className="lf-title">Welcome back</h1>
          <p className="lf-sub">Sign in to your Toll Operations account</p>

          {/* ── SECURITY: Temporary Sign-in Pause ── */}
          {rateLimitSeconds > 0 && (
            <div className="lf-security-alert lf-security-alert--ratelimit" role="alert">
              <div className="lf-alert-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <div className="lf-alert-content">
                <span className="lf-alert-title">Please Wait to Sign In</span>
                <span className="lf-alert-desc">
                  Too many sign-in attempts detected. You will be able to log in after:
                </span>
                <div className="lf-cooldown-timer lf-cooldown-timer--amber">
                  <span className="lf-cooldown-pulse amber" />
                  <span>Available in: <strong>{SecurityService.formatCooldown(rateLimitSeconds)}</strong></span>
                </div>
              </div>
            </div>
          )}

          {/* ── SECURITY: Brute-Force Lockout Alert with Live Countdown ── */}
          {isLockedOut && (
            <div className="lf-security-alert lf-security-alert--lockout" role="alert">
              <div className="lf-alert-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </div>
              <div className="lf-alert-content">
                <span className="lf-alert-title">Account Security Lockout Active</span>
                <span className="lf-alert-desc">
                  This account has been temporarily locked after 5 consecutive failed login attempts to safeguard against credential brute-forcing.
                </span>
                <div className="lf-cooldown-timer">
                  <span className="lf-cooldown-pulse" />
                  <span>Lockout Cooldown: <strong>{SecurityService.formatCooldown(lockoutSeconds)}</strong></span>
                </div>
              </div>
            </div>
          )}

          {/* ── SECURITY: Remaining Attempts Warning Badge ── */}
          {!isLockedOut && remainingAttempts !== null && remainingAttempts > 0 && remainingAttempts < 5 && (
            <div className="lf-security-alert lf-security-alert--warning" role="alert">
              <div className="lf-alert-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <div className="lf-alert-content">
                <span className="lf-alert-title">
                  Security Warning: {remainingAttempts} attempt{remainingAttempts === 1 ? '' : 's'} remaining
                </span>
                <span className="lf-alert-desc">
                  5 consecutive incorrect attempts will automatically lock your account for 15 minutes.
                </span>
              </div>
            </div>
          )}

          {/* ── Progressive Delay Notice ── */}
          {progressiveDelayNotice && (
            <div className="lf-security-pill">
              <span className="lf-spinner-mini" />
              <span>Applying progressive security verification backoff…</span>
            </div>
          )}

          {/* General Error */}
          {error && !isLockedOut && (
            <div className="lf-error" role="alert">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {error}
            </div>
          )}

          {/* Inactivity Timeout Notice */}
          {timeoutNotice && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 14px',
                borderRadius: '8px',
                background: '#fffbeb',
                border: '1px solid #fde68a',
                color: '#b45309',
                fontSize: '13px',
                fontWeight: 500,
                marginBottom: '16px',
                lineHeight: 1.4,
              }}
              role="alert"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>{timeoutNotice}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>

            {/* Email */}
            <div className="lf-field">
              <label htmlFor="lf-email" className="lf-label">Email</label>
              <input
                id="lf-email"
                type="email"
                className={`lf-input ${error ? 'lf-input--err' : ''} ${isLockedOut ? 'lf-input--locked' : ''}`}
                placeholder="name@tolloperator.com"
                value={identifier}
                disabled={isLockedOut}
                onBlur={() => checkAccountLockout()}
                onChange={e => {
                  setIdentifier(e.target.value);
                  setError('');
                }}
                autoComplete="email"
                autoFocus
              />
            </div>

            {/* Password */}
            <div className="lf-field">
              <div className="lf-label-row">
                <label htmlFor="lf-pw" className="lf-label">Password</label>
                <button type="button" className="lf-forgot" disabled={isLockedOut}>Forgot password?</button>
              </div>
              <div className="lf-pw-wrap">
                <input
                  id="lf-pw"
                  type={showPassword ? 'text' : 'password'}
                  className={`lf-input ${error ? 'lf-input--err' : ''} ${isLockedOut || rateLimitSeconds > 0 ? 'lf-input--locked' : ''}`}
                  placeholder={isLockedOut ? "Account temporarily locked" : rateLimitSeconds > 0 ? `Try again in ${SecurityService.formatCooldown(rateLimitSeconds)}` : "Enter your password"}
                  value={password}
                  disabled={isLockedOut || rateLimitSeconds > 0}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="lf-eye"
                  disabled={isLockedOut}
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'Hide' : 'Show'}
                >
                  {showPassword ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Remember me */}
            <label className="lf-remember">
              <input
                type="checkbox"
                disabled={isLockedOut}
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
              />
              <span>Keep me signed in</span>
            </label>

            {/* Submit */}
            <button
              id="lf-submit"
              type="submit"
              className={`lf-btn ${isLockedOut ? 'lf-btn--locked' : ''}`}
              disabled={isSubmitting || isLockedOut || rateLimitSeconds > 0}
            >
              {isLockedOut ? (
                <>🔒 Locked ({SecurityService.formatCooldown(lockoutSeconds)})</>
              ) : rateLimitSeconds > 0 ? (
                <>⏱ You can log in after: {SecurityService.formatCooldown(rateLimitSeconds)}</>
              ) : isSubmitting ? (
                <><span className="lf-spinner" /> Signing in…</>
              ) : (
                <>Sign in</>
              )}
            </button>

          </form>


          <p className="lf-footer">© 2026 Paysonic Pvt. Ltd. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
