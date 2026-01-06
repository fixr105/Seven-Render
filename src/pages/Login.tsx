import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthSafe } from '../hooks/useAuthSafe';
import { apiService } from '../services/api';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { User, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import homeGif from '../components/ui/home2.gif?url';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { user, signIn, refreshUser, setAuthUserAndToken } = useAuthSafe();
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
      // Validate username and passcode via backend (which proxies to n8n)
      // This eliminates CORS issues since backend-to-backend calls don't have CORS restrictions
      // The validate endpoint now also generates a token if validation succeeds
      const validateResponse = await apiService.validate(username, passcode);

      if (validateResponse.success && validateResponse.data?.success) {
        // If validation succeeds and token is returned, set it and user data directly
        if (validateResponse.data?.token && validateResponse.data?.user) {
          // Ensure name is set - extract from email if missing
          const userData = validateResponse.data.user;
          if (!userData.name && userData.email) {
            userData.name = userData.email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          }
          
          // Set token and user directly from validate response (avoids extra API call)
          setAuthUserAndToken(userData, validateResponse.data.token);
    
          // Success - navigate will happen automatically via useEffect when user is set
          navigate('/dashboard');
        } else if (validateResponse.data?.validated) {
          // Validation succeeded but no token - user might not be in User Accounts table
          setError(validateResponse.data?.error || 'User validated but could not create session. Please contact support.');
        } else {
          // Validation succeeded but unexpected response format
          setError('Login successful but unexpected response format. Please try again.');
        }
      } else {
        setError(validateResponse.error || validateResponse.data?.error || validateResponse.data?.message || 'Invalid username or passcode');
      }
    } catch (err: any) {
      console.error('Login error:', err);
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
        </div>

        {/* Right Side - Login Form */}
        <div className="w-full">
          <div className="bg-white rounded-2xl shadow-2xl p-8 lg:p-10">

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
