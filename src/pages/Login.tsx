import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthSafe } from '../hooks/useAuthSafe';
import { UserRole } from '../services/api';
import { User, Briefcase, Shield, Building2 } from 'lucide-react';

// User profiles for each role
const USER_PROFILES = {
  client: {
    email: 'client@test.com',
    role: 'client' as UserRole,
    name: 'Test Client',
    icon: User,
    color: 'bg-blue-500',
    description: 'Client (DSA Partner)',
  },
  kam: {
    email: 'kam@test.com',
    role: 'kam' as UserRole,
    name: 'Test KAM',
    icon: Briefcase,
    color: 'bg-green-500',
    description: 'Key Account Manager',
  },
  credit_team: {
    email: 'credit@test.com',
    role: 'credit_team' as UserRole,
    name: 'Test Credit',
    icon: Shield,
    color: 'bg-purple-500',
    description: 'Credit Team',
  },
  nbfc: {
    email: 'nbfc@test.com',
    role: 'nbfc' as UserRole,
    name: 'Test NBFC',
    icon: Building2,
    color: 'bg-orange-500',
    description: 'NBFC Partner',
  },
};

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { user, signInAsTestUser } = useAuthSafe();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleRoleSelect = async (roleKey: keyof typeof USER_PROFILES) => {
    const profile = USER_PROFILES[roleKey];
    // Use the bypass function to directly set user without authentication
    signInAsTestUser(profile.role, profile.email);
    
    // Small delay to ensure token is set in localStorage before navigation
    // This prevents race conditions where API calls happen before token is available
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Navigate to dashboard (user and token are now set)
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        {/* Logo and title */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-brand-primary rounded-xl mb-6 shadow-lg">
            <span className="text-white font-bold text-3xl">SF</span>
          </div>
          <h1 className="text-4xl font-bold text-neutral-900 mb-2">Seven Fincorp</h1>
          <p className="text-lg text-neutral-600">Loan Management Dashboard</p>
          <p className="text-sm text-neutral-500 mt-2">Select your role to continue</p>
        </div>

        {/* Role Selection Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Object.entries(USER_PROFILES).map(([key, profile]) => {
            const Icon = profile.icon;
            return (
              <button
                key={key}
                onClick={() => handleRoleSelect(key as keyof typeof USER_PROFILES)}
                className="group bg-white rounded-xl shadow-level-2 p-8 hover:shadow-level-3 transition-all duration-200 hover:scale-105 border-2 border-transparent hover:border-brand-primary/30 text-left"
              >
                <div className="flex items-start gap-6">
                  <div className={`${profile.color} w-16 h-16 rounded-xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform`}>
                    <Icon className="w-8 h-8" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-neutral-900 mb-2 group-hover:text-brand-primary transition-colors">
                      {profile.name}
                    </h3>
                    <p className="text-sm text-neutral-600 mb-4">{profile.description}</p>
                    <div className="flex items-center gap-2 text-xs text-neutral-500">
                      <span className="font-mono bg-neutral-100 px-2 py-1 rounded">{profile.email}</span>
                    </div>
                  </div>
                  <div className="text-brand-primary opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-12 text-center text-sm text-neutral-500">
          <p>© 2025 Seven Fincorp. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
};
