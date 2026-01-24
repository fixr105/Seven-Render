import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthSafe } from '../hooks/useAuthSafe';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { User, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { defaultLogger } from '../utils/logger';
import homeGif from '../components/ui/home2.gif?url';
import logo from '../components/ui/logo.png';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { user, signIn } = useAuthSafe();
  const [username, setUsername] = useState('');
  const [passcode, setPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await signIn(username, passcode);
      if (result?.error) {
        // Handle both Error objects and string errors
        const errorMessage = result.error instanceof Error 
          ? result.error.message 
          : typeof result.error === 'string' 
          ? result.error 
          : 'Login failed';
        setError(errorMessage);
        return;
      }

      navigate('/dashboard');
    } catch (err: any) {
      defaultLogger.error('Login error', {
        error: err.message,
        stack: err.stack,
      });
      // Provide user-friendly error messages
      if (err.message) {
        setError(err.message);
      } else {
        setError('Failed to connect to authentication service. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#06084a] via-brand-primary to-[#0a0d6e] flex items-center justify-center p-4">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        {/* Left Side - GIF and Branding */}
        <div className="hidden lg:flex flex-col items-center justify-center text-white">
          <div className="mb-8">
            <img 
              src={homeGif} 
              alt="Seven Fincorp" 
              className="w-full max-w-md rounded-2xl shadow-2xl ring-2 ring-white/10"
            />
          </div>
          <p className="text-white/80 text-sm mt-2">Loan management &amp; credit dashboard</p>
        </div>

        {/* Right Side - Login Form */}
        <div className="w-full flex justify-center lg:justify-end">
          <div className="bg-white rounded-2xl shadow-2xl p-8 lg:p-10 w-full max-w-md border border-neutral-100 animate-fade-in-up">

            {/* Logo and title - visible on all viewports (needed when GIF is hidden on mobile) */}
            <div className="text-center mb-6">
              <img src={logo} alt="Seven Fincorp" className="h-10 mx-auto mb-4 object-contain" />
              <h1 className="text-xl font-semibold text-neutral-900">Welcome back</h1>
              <p className="text-sm text-neutral-500 mt-1">Sign in to your account</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Error Message */}
              {error && (
                <div className="bg-error/10 border border-error/20 rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-error">{error}</p>
                  </div>
                </div>
              )}

              {/* Username Field */}
              <div>
                <Input
                  data-testid="login-username"
                  label="Username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  icon={User}
                  iconPosition="left"
                  required
                  autoComplete="username"
                  className="h-12 text-base"
                />
              </div>

              {/* Passcode Field */}
              <div>
                <label className="block mb-1 text-sm font-medium text-neutral-700">
                  Passcode
                  <span className="text-error ml-1">*</span>
                </label>
                <div className="relative">
                  <Input
                    data-testid="login-password"
                    type={showPasscode ? 'text' : 'password'}
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    placeholder="Enter your passcode"
                    icon={Lock}
                    iconPosition="left"
                    required
                    autoComplete="current-password"
                    className="h-12 text-base pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasscode(!showPasscode)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-700 transition-colors z-10 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 rounded p-1"
                    aria-label={showPasscode ? 'Hide passcode' : 'Show passcode'}
                  >
                    {showPasscode ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
              </button>
                </div>
              </div>

              {/* Remember Me (Optional) */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-brand-primary border-neutral-300 rounded focus:ring-brand-primary focus:ring-2"
                  />
                  <span className="text-sm text-neutral-600">Remember me</span>
                </label>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={loading}
                className="w-full"
                disabled={!username || !passcode || loading}
              >
                Sign In
              </Button>
            </form>

            {/* Footer */}
            <div className="mt-8 pt-6 border-t border-neutral-200 text-center">
              <p className="text-sm text-neutral-500">
                © 2025 Seven Fincorp. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
