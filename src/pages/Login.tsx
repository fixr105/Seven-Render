import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthSafe } from '../hooks/useAuthSafe';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { User, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import homeGif from '../components/ui/home.gif';

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
      // Post to n8n webhook for validation
      const response = await fetch('https://fixrrahul.app.n8n.cloud/webhook/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          passcode,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // If validation succeeds, use the signIn function from auth context
        // The signIn function expects email and password, so we'll use username as email
        // and passcode as password
        const loginResult = await signIn(username, passcode);
        
        if (loginResult.error) {
          setError(typeof loginResult.error === 'string' ? loginResult.error : loginResult.error.message || 'Login failed');
        } else {
          // Success - navigate will happen automatically via useEffect
          navigate('/dashboard');
        }
      } else {
        setError(data.error || data.message || 'Invalid username or passcode');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Failed to connect to authentication service. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-primary via-brand-primary/95 to-brand-primary/90 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        {/* Left Side - GIF and Branding */}
        <div className="hidden lg:flex flex-col items-center justify-center text-white">
          <div className="mb-8">
            <img 
              src={homeGif} 
              alt="Seven Fincorp" 
              className="w-full max-w-md rounded-2xl shadow-2xl"
            />
          </div>
          <div className="text-center">
            <h1 className="text-5xl font-bold mb-4">Seven Fincorp</h1>
            <p className="text-xl text-white/90 mb-2">Loan Management Dashboard</p>
            <p className="text-sm text-white/80">Secure access to your financial dashboard</p>
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="w-full">
          <div className="bg-white rounded-2xl shadow-2xl p-8 lg:p-10">
            {/* Mobile Logo */}
            <div className="lg:hidden text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-primary rounded-xl mb-4 shadow-lg">
                <span className="text-white font-bold text-2xl">SF</span>
              </div>
              <h1 className="text-3xl font-bold text-neutral-900 mb-2">Seven Fincorp</h1>
              <p className="text-neutral-600">Loan Management Dashboard</p>
            </div>

            {/* Desktop Logo */}
            <div className="hidden lg:block text-center mb-8">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-brand-primary rounded-xl mb-6 shadow-lg">
                <span className="text-white font-bold text-3xl">SF</span>
              </div>
              <h2 className="text-3xl font-bold text-neutral-900 mb-2">Welcome Back</h2>
              <p className="text-neutral-600">Sign in to continue to your dashboard</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
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
                <a
                  href="#"
                  className="text-sm text-brand-primary hover:text-brand-primary/80 transition-colors"
                  onClick={(e) => {
                    e.preventDefault();
                    // TODO: Implement forgot passcode
                  }}
                >
                  Forgot passcode?
                </a>
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
