import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Menu, User, LogOut, Settings as SettingsIcon } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface TopBarProps {
  title: string;
  onMenuToggle: () => void;
  notificationCount?: number;
  userName?: string;
}

export const TopBar: React.FC<TopBarProps> = ({ title, onMenuToggle, notificationCount = 0, userName = 'User' }) => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <header className="bg-white border-b border-neutral-200 shadow-sm sticky top-0 z-30">
      <div className="flex items-center justify-between h-16 px-4">
        {/* Left section */}
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuToggle}
            className="lg:hidden p-2 rounded hover:bg-neutral-100 transition-colors"
            aria-label="Toggle menu"
          >
            <Menu className="w-6 h-6 text-neutral-700" />
          </button>
          <h1 className="text-lg font-semibold text-neutral-900">{title}</h1>
        </div>

        {/* Right section */}
        <div className="flex items-center gap-2">
          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 rounded hover:bg-neutral-100 transition-colors"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5 text-neutral-700" />
              {notificationCount > 0 && (
                <span className="absolute top-1 right-1 bg-error text-white text-xs font-medium w-5 h-5 rounded-full flex items-center justify-center">
                  {notificationCount > 9 ? '9+' : notificationCount}
                </span>
              )}
            </button>

            {/* Notifications dropdown */}
            {showNotifications && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowNotifications(false)}
                />
                <div className="absolute right-0 mt-2 w-80 bg-white rounded shadow-level-2 z-50 max-h-96 overflow-y-auto">
                  <div className="p-3 border-b border-neutral-200">
                    <h3 className="font-semibold text-neutral-900">Notifications</h3>
                  </div>
                  {notificationCount === 0 ? (
                    <div className="p-4 text-center text-neutral-500">
                      No new notifications
                    </div>
                  ) : (
                    <div className="divide-y divide-neutral-200">
                      {/* Placeholder notifications */}
                      <div className="p-3 hover:bg-neutral-50 cursor-pointer">
                        <p className="text-sm text-neutral-900">New application submitted</p>
                        <p className="text-xs text-neutral-500 mt-1">5 minutes ago</p>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* User profile */}
          <div className="relative">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center gap-2 p-2 rounded hover:bg-neutral-100 transition-colors"
              aria-label="User menu"
            >
              <div className="w-8 h-8 bg-brand-primary rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-white">{userName.charAt(0).toUpperCase()}</span>
              </div>
            </button>

            {/* Profile dropdown */}
            {showProfileMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowProfileMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-48 bg-white rounded shadow-level-2 z-50 py-1">
                  <div className="px-4 py-2 border-b border-neutral-200">
                    <p className="text-sm font-medium text-neutral-900">{userName}</p>
                  </div>
                  <button 
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
                    onClick={() => {
                      setShowProfileMenu(false);
                      navigate('/profile');
                    }}
                  >
                    <User className="w-4 h-4" />
                    Profile
                  </button>
                  <button 
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
                    onClick={() => {
                      setShowProfileMenu(false);
                      navigate('/settings');
                    }}
                  >
                    <SettingsIcon className="w-4 h-4" />
                    Settings
                  </button>
                  <button 
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-error hover:bg-neutral-50 transition-colors"
                    onClick={() => {
                      setShowProfileMenu(false);
                      handleLogout();
                    }}
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
