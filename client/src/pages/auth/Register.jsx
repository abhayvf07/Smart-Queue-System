import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { User, Mail, Lock, Eye, EyeOff, UserPlus, AlertCircle } from 'lucide-react';

const Register = () => {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');

  const { register } = useAuth();
  const navigate = useNavigate();

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) {
      errs.name = 'Name is required.';
    } else if (form.name.trim().length < 2) {
      errs.name = 'Name must be at least 2 characters.';
    } else if (form.name.trim().length > 50) {
      errs.name = 'Name cannot exceed 50 characters.';
    }
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
    if (form.password !== form.confirmPassword) {
      errs.confirmPassword = 'Passwords do not match.';
    }
    return errs;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
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
      const result = await register(form.name.trim(), form.email, form.password);
      if (result.success) {
        navigate('/dashboard', { replace: true });
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
    <div className="auth-page" id="register-page">
      <div className="auth-container animate-in">
        <div className="auth-card">
          <div className="auth-header">
            <div className="auth-logo">⚡</div>
            <h1 className="auth-title">Create Account</h1>
            <p className="auth-subtitle">Join SmartQueue to skip the wait</p>
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
              id="register-error"
            >
              <AlertCircle size={16} />
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label className="form-label" htmlFor="register-name">Full Name</label>
              <input
                type="text"
                id="register-name"
                name="name"
                className={`form-input ${errors.name ? 'error' : ''}`}
                placeholder="John Doe"
                value={form.name}
                onChange={handleChange}
                autoComplete="name"
                autoFocus
              />
              {errors.name && (
                <div className="form-error" id="name-error">
                  <AlertCircle size={12} /> {errors.name}
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="register-email">Email Address</label>
              <input
                type="email"
                id="register-email"
                name="email"
                className={`form-input ${errors.email ? 'error' : ''}`}
                placeholder="you@example.com"
                value={form.email}
                onChange={handleChange}
                autoComplete="email"
              />
              {errors.email && (
                <div className="form-error" id="email-error">
                  <AlertCircle size={12} /> {errors.email}
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="register-password">Password</label>
              <div className="password-toggle">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="register-password"
                  name="password"
                  className={`form-input ${errors.password ? 'error' : ''}`}
                  placeholder="Min. 6 characters"
                  value={form.password}
                  onChange={handleChange}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && (
                <div className="form-error" id="password-error">
                  <AlertCircle size={12} /> {errors.password}
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="register-confirm">Confirm Password</label>
              <input
                type="password"
                id="register-confirm"
                name="confirmPassword"
                className={`form-input ${errors.confirmPassword ? 'error' : ''}`}
                placeholder="Re-enter your password"
                value={form.confirmPassword}
                onChange={handleChange}
                autoComplete="new-password"
              />
              {errors.confirmPassword && (
                <div className="form-error" id="confirm-error">
                  <AlertCircle size={12} /> {errors.confirmPassword}
                </div>
              )}
            </div>



            <button
              type="submit"
              className="btn btn-primary btn-full btn-lg"
              disabled={loading}
              id="register-submit"
            >
              {loading ? (
                <>
                  <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }}></div>
                  Creating Account...
                </>
              ) : (
                <>
                  <UserPlus size={18} />
                  Create Account
                </>
              )}
            </button>
          </form>

          <div className="auth-footer">
            Already have an account?{' '}
            <Link to="/login" id="goto-login">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
