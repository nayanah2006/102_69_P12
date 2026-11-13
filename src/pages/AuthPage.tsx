import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';
import { ToastBanner } from '../components/StatusComponents.tsx';
import type { UserRole } from '../types/index.ts';

export function AuthPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('citizen');
  const [zone, setZone] = useState('Zone 1');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const redirectByRole = (userRole: UserRole) => {
    if (userRole === 'citizen') navigate('/dashboard');
    else if (userRole === 'handler') navigate('/handler');
    else navigate('/analytics');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);
    try {
      if (mode === 'login') {
        const user = await login(email.trim(), password);
        redirectByRole(user.role);
      } else {
        const user = await register({
          name: name.trim(),
          email: email.trim(),
          mobile: mobile.trim(),
          password,
          role,
          zone,
        });
        redirectByRole(user.role);
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Authentication failed.';
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const quickLogin = async (demoEmail: string) => {
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const user = await login(demoEmail, 'Password@123');
      redirectByRole(user.role);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Demo sign-in failed.';
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-6 space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setErrorMsg(null);
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-md transition-colors ${
              mode === 'login'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setErrorMsg(null);
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-md transition-colors ${
              mode === 'register'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Create Account
          </button>
        </div>

        <div>
          <h1 className="text-xl font-bold text-slate-900 font-display">
            {mode === 'login' ? 'Sign In to FoodGuard' : 'Register New Account'}
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            {mode === 'login'
              ? 'Access your citizen complaints, officer console, or administration dashboard.'
              : 'Create a Citizen, Food Safety Officer, or Administrator account.'}
          </p>
        </div>

        {errorMsg && (
          <ToastBanner type="error" message={errorMsg} onClose={() => setErrorMsg(null)} />
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <>
              <div>
                <label htmlFor="authName" className="block text-xs font-medium text-slate-700 mb-1">
                  Full Name
                </label>
                <input
                  id="authName"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600"
                />
              </div>
              <div>
                <label htmlFor="authMobile" className="block text-xs font-medium text-slate-700 mb-1">
                  Mobile Number
                </label>
                <input
                  id="authMobile"
                  type="tel"
                  required
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="authRole" className="block text-xs font-medium text-slate-700 mb-1">
                    Role
                  </label>
                  <select
                    id="authRole"
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sky-600"
                  >
                    <option value="citizen">Citizen</option>
                    <option value="handler">Food Safety Officer</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
                {role === 'handler' && (
                  <div>
                    <label htmlFor="authZone" className="block text-xs font-medium text-slate-700 mb-1">
                      Assigned Zone
                    </label>
                    <select
                      id="authZone"
                      value={zone}
                      onChange={(e) => setZone(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sky-600"
                    >
                      <option value="Zone 1">Zone 1</option>
                      <option value="Zone 2">Zone 2</option>
                      <option value="Zone 3">Zone 3</option>
                      <option value="Zone 4">Zone 4</option>
                    </select>
                  </div>
                )}
              </div>
            </>
          )}

          <div>
            <label htmlFor="authEmail" className="block text-xs font-medium text-slate-700 mb-1">
              Email Address
            </label>
            <input
              id="authEmail"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600"
            />
          </div>

          <div>
            <label htmlFor="authPassword" className="block text-xs font-medium text-slate-700 mb-1">
              Password
            </label>
            <input
              id="authPassword"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 6 characters"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 text-sm font-semibold text-white bg-sky-700 hover:bg-sky-800 disabled:opacity-50 rounded-lg transition-colors"
          >
            {submitting ? 'Authenticating...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="pt-4 border-t border-slate-200 space-y-2">
          <p className="text-xs font-semibold text-slate-700">Quick Demo Role Sign-In</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              type="button"
              disabled={submitting}
              onClick={() => quickLogin('citizen@foodguard.gov')}
              className="px-3 py-2 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg transition-colors"
            >
              Citizen
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => quickLogin('officer1@foodguard.gov')}
              className="px-3 py-2 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg transition-colors"
            >
              Officer (Zone 1)
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => quickLogin('admin@foodguard.gov')}
              className="px-3 py-2 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg transition-colors"
            >
              Administrator
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
