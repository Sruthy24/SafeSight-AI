import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldAlert, Eye, EyeOff, Loader2, AlertCircle, Lock, Mail, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function RegisterPage() {
  const navigate     = useNavigate();
  const { register } = useAuth();

  const [fullName,    setFullName]    = useState('');
  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [confirm,     setConfirm]     = useState('');
  const [showPw,      setShowPw]      = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  // Password strength (0-4)
  function getStrength(pw) {
    if (!pw) return 0;
    let score = 0;
    if (pw.length >= 8)          score++;
    if (/[A-Z]/.test(pw))        score++;
    if (/[0-9]/.test(pw))        score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    return score;
  }
  const strength = getStrength(password);
  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][strength];
  const strengthColor = ['', '#ef4444', '#f97316', '#eab308', '#10b981'][strength];

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    // Client-side validation
    const errs = {};
    if (!fullName.trim())                   errs.full_name        = 'Full name is required.';
    if (!email.trim())                       errs.email            = 'Email is required.';
    if (!password)                           errs.password         = 'Password is required.';
    else if (password.length < 8)           errs.password         = 'Password must be at least 8 characters.';
    if (!confirm)                            errs.confirm_password = 'Please confirm your password.';
    else if (confirm !== password)          errs.confirm_password = 'Passwords do not match.';

    if (Object.keys(errs).length) { setFieldErrors(errs); return; }

    setLoading(true);
    try {
      await register(fullName.trim(), email.trim(), password, confirm);
      navigate('/', { replace: true });
    } catch (err) {
      if (err.fields) setFieldErrors(err.fields);
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function clearFieldError(field) {
    setFieldErrors(p => ({ ...p, [field]: '' }));
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
            <FeatureBadge icon="🛡️" text="PPE Compliance Monitoring" />
            <FeatureBadge icon="🎥" text="Video Scene Analysis" />
            <FeatureBadge icon="⚠️" text="Real-time Violation Alerts" />
            <FeatureBadge icon="📄" text="Automated Safety Reports" />
          </div>

          <p className="auth-brand-tagline">
            Protecting workers through intelligent computer vision
          </p>
        </div>
        <div className="auth-deco-circle auth-deco-circle--1" />
        <div className="auth-deco-circle auth-deco-circle--2" />
      </div>

      {/* Right panel — form */}
      <div className="auth-form-panel">
        <div className="auth-card">
          {/* Mobile logo */}
          <div className="auth-mobile-logo">
            <div className="auth-logo-circle auth-logo-circle--sm">
              <ShieldAlert size={24} color="#ffffff" />
            </div>
            <span className="auth-mobile-brand">SafeSight AI</span>
          </div>

          <h2 className="auth-card-title">Create an account</h2>
          <p className="auth-card-subtitle">Join SafeSight AI to monitor workplace safety</p>

          {error && (
            <div className="auth-alert auth-alert--error">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="auth-form">
            {/* Full Name */}
            <div className="auth-field">
              <label className="auth-label" htmlFor="reg-name">Full name</label>
              <div className={`auth-input-wrap ${fieldErrors.full_name ? 'auth-input-wrap--error' : ''}`}>
                <User size={16} className="auth-input-icon" />
                <input
                  id="reg-name"
                  type="text"
                  className="auth-input"
                  placeholder="Jane Smith"
                  value={fullName}
                  onChange={e => { setFullName(e.target.value); clearFieldError('full_name'); }}
                  autoComplete="name"
                  disabled={loading}
                />
              </div>
              {fieldErrors.full_name && <span className="auth-field-error">{fieldErrors.full_name}</span>}
            </div>

            {/* Email */}
            <div className="auth-field">
              <label className="auth-label" htmlFor="reg-email">Email address</label>
              <div className={`auth-input-wrap ${fieldErrors.email ? 'auth-input-wrap--error' : ''}`}>
                <Mail size={16} className="auth-input-icon" />
                <input
                  id="reg-email"
                  type="email"
                  className="auth-input"
                  placeholder="you@company.com"
                  value={email}
                  onChange={e => { setEmail(e.target.value); clearFieldError('email'); }}
                  autoComplete="email"
                  disabled={loading}
                />
              </div>
              {fieldErrors.email && <span className="auth-field-error">{fieldErrors.email}</span>}
            </div>

            {/* Password */}
            <div className="auth-field">
              <label className="auth-label" htmlFor="reg-pw">Password</label>
              <div className={`auth-input-wrap ${fieldErrors.password ? 'auth-input-wrap--error' : ''}`}>
                <Lock size={16} className="auth-input-icon" />
                <input
                  id="reg-pw"
                  type={showPw ? 'text' : 'password'}
                  className="auth-input"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={e => { setPassword(e.target.value); clearFieldError('password'); }}
                  autoComplete="new-password"
                  disabled={loading}
                />
                <button type="button" className="auth-pw-toggle" onClick={() => setShowPw(p => !p)} tabIndex={-1}>
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {fieldErrors.password && <span className="auth-field-error">{fieldErrors.password}</span>}
              {/* Strength meter */}
              {password && (
                <div className="auth-strength">
                  <div className="auth-strength-bar">
                    {[1, 2, 3, 4].map(n => (
                      <div
                        key={n}
                        className="auth-strength-segment"
                        style={{ backgroundColor: n <= strength ? strengthColor : '#e2e8f0' }}
                      />
                    ))}
                  </div>
                  <span className="auth-strength-label" style={{ color: strengthColor }}>{strengthLabel}</span>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div className="auth-field">
              <label className="auth-label" htmlFor="reg-confirm">Confirm password</label>
              <div className={`auth-input-wrap ${fieldErrors.confirm_password ? 'auth-input-wrap--error' : ''}`}>
                <Lock size={16} className="auth-input-icon" />
                <input
                  id="reg-confirm"
                  type={showConfirm ? 'text' : 'password'}
                  className="auth-input"
                  placeholder="Re-enter your password"
                  value={confirm}
                  onChange={e => { setConfirm(e.target.value); clearFieldError('confirm_password'); }}
                  autoComplete="new-password"
                  disabled={loading}
                />
                <button type="button" className="auth-pw-toggle" onClick={() => setShowConfirm(p => !p)} tabIndex={-1}>
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {fieldErrors.confirm_password && <span className="auth-field-error">{fieldErrors.confirm_password}</span>}
            </div>

            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 size={18} className="auth-spinner-inline" />
                  Creating account…
                </>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          <p className="auth-switch">
            Already have an account?{' '}
            <Link to="/login" className="auth-link">Sign in</Link>
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
