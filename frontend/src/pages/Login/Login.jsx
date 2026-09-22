import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getDefaultRouteForRole } from '../../config/roleMenus';
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
  const [isSubmitting, setIsSubmitting] = useState(false);

  const from = location.state?.from?.pathname;

  React.useEffect(() => {
    if (isAuthenticated && currentUser) {
      const targetDestination = (from && from !== '/') ? from : getDefaultRouteForRole(currentUser.role);
      navigate(targetDestination, { replace: true });
    }
  }, [isAuthenticated, currentUser, navigate, from]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!identifier.trim()) { setError('Please enter your email address.'); return; }
    if (!password)           { setError('Please enter your password.'); return; }
    setIsSubmitting(true);
    await new Promise(r => setTimeout(r, 700));
    try {
      const session = login(identifier.trim(), password);
      // Navigate to target: Dashboard if permitted, otherwise the just next page to dashboard (/tag-details)
      const targetDestination = (from && from !== '/') ? from : getDefaultRouteForRole(session?.role);
      navigate(targetDestination, { replace: true });
    } catch (err) {
      setError(err.message || 'Invalid credentials. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-page">

      {/* ── LEFT: Video ── */}
      <div className="login-left">
        <video className="login-video" src="/toll-plaza.mp4" autoPlay loop muted playsInline />
        <div className="login-video-overlay" />
        <div className="login-brand-badge">
          <div className="login-brand-mark">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M5 19 14 5l1.8 6.5L20 9" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span>Pay<b>sonic</b></span>
        </div>
        <div className="login-live-badge">
          <span className="live-dot" />
          Live Video Feed
        </div>
        <div className="login-left-footer">
          <div className="left-stat"><span className="stat-dot green" />RFID FASTag</div>
          <div className="left-stat"><span className="stat-dot green" />Real-Time</div>
          <div className="left-stat"><span className="stat-dot green" />99.9% Uptime</div>
        </div>
      </div>

      {/* ── RIGHT: Form ── */}
      <div className="login-right">
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

          {/* Error */}
          {error && (
            <div className="lf-error" role="alert">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>

            {/* Email */}
            <div className="lf-field">
              <label htmlFor="lf-email" className="lf-label">Email address</label>
              <input
                id="lf-email"
                type="email"
                className={`lf-input ${error ? 'lf-input--err' : ''}`}
                placeholder="name@tolloperator.com"
                value={identifier}
                onChange={e => { setIdentifier(e.target.value); setError(''); }}
                autoComplete="email"
                autoFocus
              />
            </div>

            {/* Password */}
            <div className="lf-field">
              <div className="lf-label-row">
                <label htmlFor="lf-pw" className="lf-label">Password</label>
                <button type="button" className="lf-forgot">Forgot password?</button>
              </div>
              <div className="lf-pw-wrap">
                <input
                  id="lf-pw"
                  type={showPassword ? 'text' : 'password'}
                  className={`lf-input ${error ? 'lf-input--err' : ''}`}
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="lf-eye"
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
              <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} />
              <span>Keep me signed in</span>
            </label>

            {/* Submit */}
            <button
              id="lf-submit"
              type="submit"
              className="lf-btn"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <><span className="lf-spinner" /> Signing in…</>
              ) : (
                <>Sign in</>
              )}
            </button>

          </form>

          {/* Trust strip */}
          <div className="lf-trust">
            <span className="lf-trust-item">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              256-bit SSL
            </span>
            <span className="lf-trust-sep" />
            <span className="lf-trust-item">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              ISO 27001
            </span>
            <span className="lf-trust-sep" />
            <span className="lf-trust-item">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              PCI-DSS
            </span>
          </div>

          <p className="lf-footer">© 2026 Paysonic Pvt. Ltd. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
