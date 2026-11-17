import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { ShieldAlert, Eye, EyeOff, Loader2, AlertCircle, Lock, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { login } = useAuth();

  const from = location.state?.from?.pathname || '/';

  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [showPw,      setShowPw]      = useState(false);
  const [rememberMe,  setRememberMe]  = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    // Client-side validation
    const errs = {};
    if (!email.trim())    errs.email    = 'Email is required.';
    if (!password)        errs.password = 'Password is required.';
    if (Object.keys(errs).length) { setFieldErrors(errs); return; }

    setLoading(true);
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      if (err.fields) setFieldErrors(err.fields);
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      {/* Left panel — branding */}
      <div className="auth-brand-panel">
        <div className="auth-brand-content">
          <div className="auth-logo-circle">
            <ShieldAlert size={40} color="#ffffff" />
          </div>
          <h1 className="auth-brand-title">SafeSight AI</h1>
          <p className="auth-brand-subtitle">Industrial Safety Vision System</p>

          <div className="auth-feature-list">
            <FeatureBadge icon="🛡️" text="Real-time PPE Violation Detection" />
            <FeatureBadge icon="🎥" text="YOLOv8-Powered Video Analysis" />
            <FeatureBadge icon="📊" text="Compliance Analytics Dashboard" />
            <FeatureBadge icon="📄" text="Automated PDF Audit Reports" />
          </div>

          <p className="auth-brand-tagline">
            Protecting workers through intelligent computer vision
          </p>
        </div>

        {/* Decorative circles */}
        <div className="auth-deco-circle auth-deco-circle--1" />
        <div className="auth-deco-circle auth-deco-circle--2" />
      </div>

      {/* Right panel — form */}
      <div className="auth-form-panel">
        <div className="auth-card">
          {/* Mobile logo (hidden on desktop) */}
          <div className="auth-mobile-logo">
            <div className="auth-logo-circle auth-logo-circle--sm">
              <ShieldAlert size={24} color="#ffffff" />
            </div>
            <span className="auth-mobile-brand">SafeSight AI</span>
          </div>

          <h2 className="auth-card-title">Welcome back</h2>
          <p className="auth-card-subtitle">Sign in to your SafeSight AI account</p>

          {/* Global error */}
          {error && (
            <div className="auth-alert auth-alert--error">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="auth-form">
            {/* Email */}
            <div className="auth-field">
              <label className="auth-label" htmlFor="login-email">Email address</label>
              <div className={`auth-input-wrap ${fieldErrors.email ? 'auth-input-wrap--error' : ''}`}>
                <Mail size={16} className="auth-input-icon" />
                <input
                  id="login-email"
                  type="email"
                  className="auth-input"
                  placeholder="you@company.com"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setFieldErrors(p => ({ ...p, email: '' })); }}
                  autoComplete="email"
                  disabled={loading}
                />
              </div>
              {fieldErrors.email && <span className="auth-field-error">{fieldErrors.email}</span>}
            </div>

            {/* Password */}
            <div className="auth-field">
              <label className="auth-label" htmlFor="login-password">Password</label>
              <div className={`auth-input-wrap ${fieldErrors.password ? 'auth-input-wrap--error' : ''}`}>
                <Lock size={16} className="auth-input-icon" />
                <input
                  id="login-password"
                  type={showPw ? 'text' : 'password'}
                  className="auth-input"
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setFieldErrors(p => ({ ...p, password: '' })); }}
                  autoComplete="current-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  className="auth-pw-toggle"
                  onClick={() => setShowPw(p => !p)}
                  tabIndex={-1}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {fieldErrors.password && <span className="auth-field-error">{fieldErrors.password}</span>}
            </div>

            {/* Remember me + Forgot password */}
            <div className="auth-row">
              <label className="auth-remember">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  disabled={loading}
                />
                <span>Remember me</span>
              </label>
              <button type="button" className="auth-link-btn">Forgot password?</button>
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="auth-submit-btn"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="auth-spinner-inline" />
                  Signing in…
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <p className="auth-switch">
            Don&apos;t have an account?{' '}
            <Link to="/register" className="auth-link">Create account</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function FeatureBadge({ icon, text }) {
  return (
    <div className="auth-feature-badge">
      <span className="auth-feature-icon">{icon}</span>
      <span>{text}</span>
    </div>
  );
}
