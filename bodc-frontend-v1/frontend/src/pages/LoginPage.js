import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate   = useNavigate();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [needs2FA, setNeeds2FA] = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(email, password, needs2FA ? totpCode : null);

      if (result.requires_2fa) {
        setNeeds2FA(true);
        setLoading(false);
        return;
      }

      // Redirect based on role
      if (result.role === 'worker')      navigate('/timer');
      else if (result.role === 'approver') navigate('/dashboard');
      else if (result.role === 'org_admin') navigate('/users');
      else navigate('/orgs');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* Brand */}
        <div style={styles.brand}>
          <div style={styles.brandIcon}>
            <svg width="24" height="24" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="2">
              <circle cx="8" cy="8" r="6"/><path d="M8 5v3.5l2 1.5"/>
            </svg>
          </div>
          <div>
            <div style={styles.brandName}>BODC</div>
            <div style={styles.brandSub}>Business Operations Data Capture</div>
          </div>
        </div>

        <h1 style={styles.heading}>{needs2FA ? 'Two-factor authentication' : 'Sign in'}</h1>
        <p style={styles.subheading}>
          {needs2FA ? 'Enter the 6-digit code from your authenticator app.' : 'Enter your email and password to continue.'}
        </p>

        {error && <div className="alert alert-danger">{error}</div>}

        <form onSubmit={handleSubmit}>
          {!needs2FA ? (
            <>
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  autoComplete="email"
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-label">Password</label>
                  <Link to="/forgot-password" style={styles.forgotLink}>Forgot password?</Link>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
              </div>
            </>
          ) : (
            <div className="form-group" style={{ marginBottom: 20 }}>
              <label className="form-label">Authentication code</label>
              <input
                type="text"
                value={totpCode}
                onChange={e => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                inputMode="numeric"
                autoComplete="one-time-code"
                style={{ letterSpacing: '0.3em', fontSize: 20, textAlign: 'center' }}
                autoFocus
                required
              />
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-lg btn-full"
            disabled={loading}
          >
            {loading ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : needs2FA ? 'Verify' : 'Sign in'}
          </button>

          {needs2FA && (
            <button
              type="button"
              className="btn btn-secondary btn-full"
              style={{ marginTop: 10 }}
              onClick={() => { setNeeds2FA(false); setTotpCode(''); }}
            >
              Back
            </button>
          )}
        </form>

        {/* Test account helper — remove before production */}
        {process.env.NODE_ENV === 'development' && (
          <div style={styles.devHelper}>
            <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, color: 'var(--text3)' }}>DEV — Quick login</div>
            {[
              ['jamie@ridgeline.com.au', 'Worker'],
              ['approver@ridgeline.com.au', 'Approver'],
              ['admin@ridgeline.com.au', 'Admin'],
              ['superadmin@bodc.app', 'Super Admin'],
            ].map(([e, label]) => (
              <button key={e} style={styles.devBtn} onClick={() => { setEmail(e); setPassword('Password1!'); }}>
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: 'var(--bg)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: '32px 28px',
    width: '100%',
    maxWidth: 420,
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 28,
  },
  brandIcon: {
    width: 44,
    height: 44,
    background: 'var(--blue)',
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: { fontSize: 18, fontWeight: 700, letterSpacing: -0.3 },
  brandSub:  { fontSize: 11, color: 'var(--text3)', marginTop: 1 },
  heading:   { fontSize: 20, fontWeight: 700, marginBottom: 6, letterSpacing: -0.3 },
  subheading:{ fontSize: 13, color: 'var(--text2)', marginBottom: 20, lineHeight: 1.5 },
  forgotLink:{ fontSize: 12, color: 'var(--blue)', textDecoration: 'none' },
  devHelper: {
    marginTop: 20,
    paddingTop: 16,
    borderTop: '1px solid var(--border)',
  },
  devBtn: {
    display: 'inline-block',
    marginRight: 6,
    marginBottom: 6,
    padding: '4px 10px',
    borderRadius: 6,
    border: '1px solid var(--border2)',
    background: 'transparent',
    fontSize: 11,
    cursor: 'pointer',
    color: 'var(--text2)',
  },
};
