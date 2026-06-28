import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Eye, EyeOff, LogIn, AlertCircle } from 'lucide-react';

const Login = () => {
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');

  const { login } = useAuth();
  const navigate = useNavigate();

  const validate = () => {
    const errs = {};
    if (!form.email.trim()) {
      errs.email = 'Email is required.';
    } else if (!/^\S+@\S+\.\S+$/.test(form.email)) {
      errs.email = 'Please enter a valid email address.';
    }
    if (!form.password) {
      errs.password = 'Password is required.';
    } else if (form.password.length < 6) {
      errs.password = 'Password must be at least 6 characters.';
    }
    return errs;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    // Clear field error on change
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
    if (serverError) setServerError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);
    try {
      const result = await login(form.email, form.password);
      if (result.success) {
        // Check role for redirect
        const userData = JSON.parse(localStorage.getItem('sq_user'));
        navigate(userData?.role === 'admin' ? '/admin' : '/dashboard', { replace: true });
      } else {
        setServerError(result.message);
      }
    } catch (err) {
      setServerError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page" id="login-page">
      <div className="auth-container animate-in">
        <div className="auth-card">
          <div className="auth-header">
            <div className="auth-logo">⚡</div>
            <h1 className="auth-title">Welcome Back</h1>
            <p className="auth-subtitle">Sign in to manage your queue</p>
          </div>

          {serverError && (
            <div
              className="flex items-center gap-2 mb-4"
              style={{
                padding: '12px 16px',
                background: 'var(--danger-glow)',
                border: '1px solid var(--danger)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--danger-light)',
                fontSize: '0.85rem',
              }}
              id="login-error"
            >
              <AlertCircle size={16} />
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label className="form-label" htmlFor="login-email">
                Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  id="login-email"
                  name="email"
                  className={`form-input ${errors.email ? 'error' : ''}`}
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={handleChange}
                  autoComplete="email"
                  autoFocus
                />
              </div>
              {errors.email && (
                <div className="form-error" id="email-error">
                  <AlertCircle size={12} />
                  {errors.email}
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="login-password">
                Password
              </label>
              <div className="password-toggle">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="login-password"
                  name="password"
                  className={`form-input ${errors.password ? 'error' : ''}`}
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={handleChange}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  id="toggle-password"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && (
                <div className="form-error" id="password-error">
                  <AlertCircle size={12} />
                  {errors.password}
                </div>
              )}
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-full btn-lg"
              disabled={loading}
              id="login-submit"
            >
              {loading ? (
                <>
                  <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }}></div>
                  Signing in...
                </>
              ) : (
                <>
                  <LogIn size={18} />
                  Sign In
                </>
              )}
            </button>
          </form>

          <div className="auth-footer">
            Don&apos;t have an account?{' '}
            <Link to="/register" id="goto-register">
              Create one
            </Link>
          </div>
        </div>

        <div className="text-center mt-4">
          <Link to="/display" className="text-sm text-muted" id="goto-display">
            View Live Queue Display →
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
