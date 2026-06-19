import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, Eye, EyeOff, GraduationCap, Lock, Mail, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { SCHOOL } from '../config/school';

const REMEMBER_KEYS = {
  uniform: 'toks_login_uniform_id',
  kitchen: 'toks_login_kitchen_id',
};

/**
 * For unified gateway deployment:
 * - Development: Kitchen on different port (localhost:3005)
 * - Production: Kitchen on /kitchen/api (same domain)
 */
const kitchenEnvUrl = import.meta.env.VITE_KITCHEN_URL;
const kitchenUrlCandidate = kitchenEnvUrl && String(kitchenEnvUrl).trim();
const isValidKitchenUrl =
  kitchenUrlCandidate &&
  !kitchenUrlCandidate.includes('your-app') &&
  !kitchenUrlCandidate.includes('<your') &&
  /^https?:\/\//.test(kitchenUrlCandidate);
const KITCHEN_BASE_URL =
  isValidKitchenUrl
    ? kitchenUrlCandidate
    : window.location.origin === 'http://localhost:3000'
    ? 'http://localhost:3005'
    : window.location.origin;

const HEALTH_TIMEOUT_MS = 2200;

const FEATURES = [
  {
    icon: GraduationCap,
    title: 'Quality Education',
    desc: 'Building futures with knowledge & values',
  },
  {
    icon: Users,
    title: 'Skilled Teachers',
    desc: 'Experienced educators committed to excellence',
  },
  {
    icon: BookOpen,
    title: 'Bright Future',
    desc: 'Nurturing leaders of tomorrow',
  },
];

function WaveDivider() {
  return (
    <svg
      className="login-wave"
      viewBox="0 0 80 1000"
      preserveAspectRatio="none"
      aria-hidden
    >
      <path
        fill="#152a5e"
        d="M0,0 C48,120 20,220 56,340 C12,460 60,560 36,680 C16,800 52,900 0,1000 L0,1000 L0,0 Z"
      />
      <path
        fill="#c41e3a"
        d="M58,0 L68,0 L76,500 L68,1000 L58,1000 C62,750 62,250 58,0 Z"
      />
    </svg>
  );
}

export default function Login() {
  const [email, setEmail] = useState('bursar@toks.com');
  const [password, setPassword] = useState('admin123');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [system, setSystem] = useState('uniform');
  const [systemHealth, setSystemHealth] = useState({
    uniform: 'checking',
    kitchen: 'checking',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get('system');
    if (requested === 'kitchen' || requested === 'uniform') {
      setSystem(requested);
      setError('');
    }
    if (params.get('reason') === 'timeout') {
      setError('You were signed out after 10 minutes of inactivity.');
    }
  }, []);

  useEffect(() => {
    const key = REMEMBER_KEYS[system];
    const saved = localStorage.getItem(key);
    if (saved) {
      setEmail(saved);
      setRemember(true);
      return;
    }
    setEmail(system === 'kitchen' ? 'chef_full' : 'bursar@toks.com');
  }, [system]);

  useEffect(() => {
    let alive = true;
    const pingWithTimeout = async (url) => {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), HEALTH_TIMEOUT_MS);
      try {
        const res = await fetch(url, { signal: ctrl.signal });
        return res.ok;
      } catch {
        return false;
      } finally {
        clearTimeout(t);
      }
    };

    const pingKitchenApi = async () => {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), HEALTH_TIMEOUT_MS);
      try {
        // For unified gateway: use /kitchen/api/health
        // For separate servers: use full URL
        const kitchenHealth =
          window.location.origin === 'http://localhost:3000'
            ? `${KITCHEN_BASE_URL}/api/health`
            : `${window.location.origin}/kitchen/api/health`;
        const res = await fetch(kitchenHealth, { signal: ctrl.signal });
        if (!res.ok) return false;
        const data = await res.json().catch(() => null);
        return !!(data && (data.status === 'ok' || data.service === 'kitchen'));
      } catch {
        return false;
      } finally {
        clearTimeout(t);
      }
    };

    const check = async () => {
      const [uniformOk, kitchenOk] = await Promise.all([
        pingWithTimeout('/api/health'),
        pingKitchenApi(),
      ]);
      if (!alive) return;
      setSystemHealth({
        uniform: uniformOk ? 'online' : 'offline',
        kitchen: kitchenOk ? 'online' : 'offline',
      });
      if (!uniformOk && kitchenOk) setSystem('kitchen');
    };

    check();
    const i = setInterval(check, 7000);
    return () => {
      alive = false;
      clearInterval(i);
    };
  }, []);

  const doLogin = async (emailToUse = email) => {
    setError('');
    setLoading(true);
    try {
      if (systemHealth.uniform === 'offline') {
        throw new Error('Uniform server is offline. Start the server and try again.');
      }
      await login(emailToUse, password);
      const key = REMEMBER_KEYS.uniform;
      if (remember) localStorage.setItem(key, emailToUse);
      else localStorage.removeItem(key);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const doKitchenLogin = async (usernameToUse = email) => {
    setError('');
    setLoading(true);
    try {
      if (systemHealth.kitchen !== 'online') {
        throw new Error('Kitchen server is offline. Start kitchen system and try again.');
      }
      
      // For unified gateway deployment: use /kitchen/api
      // For separate servers: use full KITCHEN_BASE_URL
      const kitchenEndpoint =
        window.location.origin === 'http://localhost:3000'
          ? `${KITCHEN_BASE_URL}/api/auth/login`
          : `${window.location.origin}/kitchen/api/auth/login`;
      
      const res = await fetch(kitchenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          username: String(usernameToUse || '').trim(),
          password,
        }),
      });
      const text = await res.text();
      let data = {};
      if (text) {
        try {
          const parsed = JSON.parse(text);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            data = parsed;
          }
        } catch {
          if (/<html/i.test(text)) {
            throw new Error(
              'Kitchen API is not reachable. On the VPS, start PM2 kitchen and set nginx proxy_pass to http://127.0.0.1:3002/ (with trailing slash).'
            );
          }
        }
      }
      const apiError =
        typeof data.error === 'string'
          ? data.error
          : typeof data.message === 'string'
            ? data.message
            : res.ok
              ? 'Kitchen login returned an invalid response'
              : `Kitchen login failed (${res.status})`;
      if (!res.ok) throw new Error(apiError);
      if (!data.user) {
        throw new Error('Kitchen login succeeded but no session was returned. Try again or contact admin.');
      }

      const key = REMEMBER_KEYS.kitchen;
      if (remember) localStorage.setItem(key, usernameToUse);
      else localStorage.removeItem(key);

      // After login, redirect to kitchen app
      const kitchenHome =
        window.location.origin === 'http://localhost:3000'
          ? `${KITCHEN_BASE_URL}/?fresh=1`
          : `${window.location.origin}/kitchen/?fresh=1`;
      window.location.assign(kitchenHome);
    } catch (err) {
      setError(err.message || 'Kitchen login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (system === 'kitchen') doKitchenLogin(email);
    else doLogin(email);
  };

  return (
    <div className="login-page">
      <div className="login-split">
        <div className="login-split-left">
          <div className="login-split-photo-wrap">
            <img
              src={SCHOOL.loginCampusUrl}
              alt={`${SCHOOL.name} campus`}
              className="login-split-photo"
            />
          </div>
          <div className="login-split-features">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="login-feature">
                <div className="login-feature-icon">
                  <Icon className="w-5 h-5" strokeWidth={1.75} />
                </div>
                <p className="login-feature-title">{title}</p>
                <p className="login-feature-desc">{desc}</p>
              </div>
            ))}
          </div>
          <WaveDivider />
        </div>

        <div className="login-split-right">
          <div className="login-split-right-inner">
            <div className="login-card">
            <div className="flex flex-col items-center mb-8 mt-3 text-center">
              <img
                src={SCHOOL.logoUrl}
                alt={SCHOOL.name}
                className="w-24 h-24 sm:w-28 sm:h-28 object-contain mb-4"
              />
              <h1 className="login-brand-title">{SCHOOL.name}</h1>
              <p className="login-brand-motto">{SCHOOL.motto}</p>
              <p className="login-brand-est">{SCHOOL.established}</p>
              <p className="login-brand-desk">{SCHOOL.deskTitle}</p>
            </div>

            <div className="mb-5">
              <p className="login-system-label">Choose system</p>
              <div className="login-system-switch" role="tablist" aria-label="Choose system">
                <button
                  type="button"
                  role="tab"
                  aria-selected={system === 'uniform'}
                  aria-pressed={system === 'uniform'}
                  disabled={systemHealth.uniform === 'offline'}
                  className={`login-system-btn ${system === 'uniform' ? 'login-system-btn-active' : ''}`}
                  onClick={() => {
                    setSystem('uniform');
                    setError('');
                    const saved = localStorage.getItem(REMEMBER_KEYS.uniform);
                    setEmail(saved || 'bursar@toks.com');
                  }}
                >
                  Uniform Desk
                  <span className={`login-system-pill login-system-pill-${systemHealth.uniform}`}>
                    {systemHealth.uniform}
                  </span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={system === 'kitchen'}
                  aria-pressed={system === 'kitchen'}
                  disabled={systemHealth.kitchen === 'offline'}
                  className={`login-system-btn ${system === 'kitchen' ? 'login-system-btn-active' : ''}`}
                  onClick={() => {
                    setSystem('kitchen');
                    setError('');
                    const saved = localStorage.getItem(REMEMBER_KEYS.kitchen);
                    setEmail(saved || 'chef_full');
                  }}
                >
                  Kitchen System
                  <span className={`login-system-pill login-system-pill-${systemHealth.kitchen}`}>
                    {systemHealth.kitchen}
                  </span>
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 w-full">
              {error && (
                <div
                  className="bg-red-50 text-sm p-3 rounded-lg border border-red-100"
                  style={{ color: '#c41e3a' }}
                >
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="login-email" className="login-field-label">
                  {system === 'kitchen' ? 'Username' : 'Email'}
                </label>
                <div className="login-input-wrap">
                  <Mail className="login-input-icon" strokeWidth={2} />
                  <input
                    id="login-email"
                    type={system === 'kitchen' ? 'text' : 'email'}
                    className="login-input"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError('');
                    }}
                    required
                    autoComplete={system === 'kitchen' ? 'username' : 'email'}
                    placeholder={system === 'kitchen' ? 'e.g. chef_full' : 'e.g. bursar@toks.com'}
                  />
                </div>
                {system === 'kitchen' && (
                  <p className="text-xs text-gray-500 mt-1">
                    Use your kitchen account username (e.g. <strong>chef_full</strong>).
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="login-password" className="login-field-label">
                  Password
                </label>
                <div className="login-input-wrap">
                  <Lock className="login-input-icon" strokeWidth={2} />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    className="login-input"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError('');
                    }}
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="login-input-toggle"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="w-[18px] h-[18px]" />
                    ) : (
                      <Eye className="w-[18px] h-[18px]" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-1">
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="login-remember rounded border-gray-300"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                  />
                  Remember me
                </label>
                <button
                  type="button"
                  className="login-forgot"
                  onClick={() =>
                    alert('Please contact the school administrator to reset your password.')
                  }
                >
                  Forgot password?
                </button>
              </div>

              <button type="submit" className="login-btn-signin mt-2" disabled={loading}>
                {loading ? 'Signing in…' : 'Sign In'}
                {!loading && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
