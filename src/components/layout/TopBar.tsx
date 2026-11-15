import React, { useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bell, Menu, User, LogOut, Smartphone } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { Notification } from '../../hooks/useNotifications';
import { formatRelativeTime } from '../../utils/dateFormatter';
import { apiService } from '../../services/api';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useAddToHomeScreen } from '../../hooks/useAddToHomeScreen';
import { AddToHomeScreenModal } from '../AddToHomeScreenModal';

interface TopBarProps {
  title: string;
  onMenuToggle: () => void;
  notificationCount?: number;
  userName?: string;
  notifications?: Notification[];
  onMarkAsRead?: (notificationId: string) => void;
  onMarkAllAsRead?: () => void;
  /** Load notifications only when the bell dropdown is opened. */
  onLoadNotifications?: () => void;
  hideSidebar?: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  title,
  onMenuToggle,
  notificationCount = 0,
  userName = '',
  notifications = [],
  onMarkAsRead,
  onMarkAllAsRead,
  onLoadNotifications,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [hasUnreadTools, setHasUnreadTools] = useState(false);
  const [addToHomeScreenMode, setAddToHomeScreenMode] = useState<
    'ios-instructions' | 'android-instructions' | 'unavailable' | null
  >(null);
  const { canInstall, promptInstall } = useAddToHomeScreen();

  const fetchToolsUnread = useCallback(async () => {
    if (user?.role !== 'nbfc') return;
    try {
      const res = await apiService.getNBFCToolsHistory();
      if (!res.success || !res.data?.jobs) return;
      const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
      const hasRecentReady = (res.data.jobs as Array<{ status?: string; createdAt?: string; date?: string }>).some(
        (j) => j.status === 'ready' && new Date(j.createdAt ?? j.date ?? 0).getTime() > twentyFourHoursAgo
      );
      setHasUnreadTools(hasRecentReady);
    } catch {
      setHasUnreadTools(false);
    }
  }, [user?.role]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleAddToHomeScreen = async () => {
    setShowProfileMenu(false);
    const result = await promptInstall();
    if (result === 'ios-instructions' || result === 'android-instructions' || result === 'unavailable') {
      setAddToHomeScreenMode(result);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead && onMarkAsRead) {
      onMarkAsRead(notification.id);
    }

    let target: string | null = null;

    if (notification.actionLink && typeof notification.actionLink === 'string') {
      const link = notification.actionLink.trim();
      const lower = link.toLowerCase();
      const isExternal = lower.startsWith('http://') || lower.startsWith('https://');
      const isJavaScriptScheme = lower.startsWith('javascript:');
      const isInternalRoute = link.startsWith('/') && !link.startsWith('//');

      if (link && !isExternal && !isJavaScriptScheme && isInternalRoute) {
        target = link;
      }
    } else if (notification.relatedFile) {
      const fileId = String(notification.relatedFile).trim();
      if (fileId && fileId !== 'undefined') {
        target = `/applications/${fileId}`;
      }
    }

    if (!target) {
      if (notification.actionLink || notification.relatedFile) {
        alert(t('topbar.invalidNotificationLink'));
      }
      setShowNotifications(false);
      return;
    }

    navigate(target);
    setShowNotifications(false);
  };

  const isOnToolsPage = location.pathname === '/nbfc/tools';
  const handleToolsClick = () => {
    if (isOnToolsPage) {
      navigate('/dashboard');
    } else {
      void fetchToolsUnread();
      navigate('/nbfc/tools');
    }
  };

  const toggleNotifications = () => {
    const next = !showNotifications;
    setShowNotifications(next);
    if (next) {
      onLoadNotifications?.();
    }
  };

  return (
    <header
      className="sticky top-0 z-30 w-full border-b border-sf-border bg-sf-surface pt-safe"
      aria-label={title ? t('topbar.pageTitle', { title }) : undefined}
    >
      <div className="flex h-14 w-full items-center justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-4 pl-4">
          <button
            onClick={onMenuToggle}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-sf-text hover:bg-sf-soft lg:hidden"
            aria-label={t('topbar.toggleMenu')}
          >
            <Menu className="h-5 w-5" />
          </button>
          {title && !location.pathname.startsWith('/applications/new') ? (
            <p className="truncate text-sm font-medium leading-5 text-sf-text">
              {title}
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-2 pr-4">
          <LanguageSwitcher />
          {user?.role === 'nbfc' && (
            <button
              onClick={handleToolsClick}
              className="relative inline-flex min-h-11 items-center rounded-full bg-sf-navy px-3 text-sm text-white hover:opacity-90"
              aria-label={isOnToolsPage ? t('topbar.backToDashboard') : t('topbar.aiTools')}
            >
              {isOnToolsPage ? t('topbar.backToDashboard') : t('topbar.tools')}
              {!isOnToolsPage && hasUnreadTools && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-error rounded-full" />
              )}
            </button>
          )}
          <div className="relative">
            <button
              onClick={toggleNotifications}
              className="relative p-2 min-h-[44px] min-w-[44px] rounded hover:bg-neutral-100 transition-colors touch-manipulation"
              aria-label={t('topbar.notifications')}
            >
              <Bell className="w-5 h-5 text-neutral-700" />
              {notificationCount > 0 && (
                <span className="absolute top-0.5 right-0.5 bg-error text-white text-xs font-semibold w-5 h-5 rounded-full flex items-center justify-center">
                  {notificationCount > 9 ? '9+' : notificationCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowNotifications(false)}
                />
                <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-lg shadow-level-2 z-50 max-h-96 overflow-y-auto border border-neutral-200">
                  <div className="p-4 border-b border-neutral-200 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-neutral-900">{t('topbar.notifications')}</h3>
                    {notificationCount > 0 && onMarkAllAsRead && (
                      <button
                        onClick={() => {
                          onMarkAllAsRead();
                        }}
                        className="text-xs text-brand-primary hover:text-brand-primary-dark font-medium"
                      >
                        {t('topbar.markAllAsRead')}
                      </button>
                    )}
                  </div>
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-neutral-500">
                      {t('topbar.noNotifications')}
                    </div>
                  ) : (
                    <div className="divide-y divide-neutral-200">
                      {notifications.map((notification) => (
                        <div
                          key={notification.id}
                          onClick={() => handleNotificationClick(notification)}
                          className={`p-3 hover:bg-neutral-50 cursor-pointer transition-colors ${
                            !notification.isRead ? 'bg-neutral-50' : ''
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <div className="flex-1 min-w-0">
                              <p
                                className={`text-sm ${
                                  !notification.isRead
                                    ? 'font-semibold text-neutral-900'
                                    : 'text-neutral-700'
                                }`}
                              >
                                {notification.title}
                              </p>
                              <p className="text-xs text-neutral-600 mt-1 line-clamp-2">
                                {notification.message}
                              </p>
                              <p className="text-xs text-neutral-500 mt-1">
                                {formatRelativeTime(notification.createdAt)}
                              </p>
                            </div>
                            {!notification.isRead && (
                              <div className="w-2 h-2 bg-brand-primary rounded-full mt-1 flex-shrink-0" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="relative">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center gap-2 p-2 min-h-[44px] min-w-[44px] rounded hover:bg-neutral-100 transition-colors touch-manipulation"
              aria-label={t('topbar.userMenu')}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sf-navy-light">
                <span className="text-sm font-medium text-sf-navy">{(userName || 'U').charAt(0).toUpperCase()}</span>
              </div>
            </button>

            {showProfileMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowProfileMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-48 min-w-[12rem] max-w-[calc(100vw-2rem)] bg-white rounded-lg shadow-level-2 z-50 py-1 border border-neutral-200">
                  <div className="px-4 py-2 border-b border-neutral-200">
                    <p className="text-sm font-semibold text-neutral-900">{userName}</p>
                  </div>
                  <button
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
                    onClick={() => {
                      setShowProfileMenu(false);
                      navigate('/profile');
                    }}
                  >
                    <User className="w-4 h-4" />
                    {t('topbar.profile')}
                  </button>
                  {canInstall && (
                    <button
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
                      onClick={() => void handleAddToHomeScreen()}
                    >
                      <Smartphone className="w-4 h-4" />
                      {t('topbar.addToHomeScreen')}
                    </button>
                  )}
                  <button
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-error hover:bg-neutral-50 transition-colors"
                    onClick={() => {
                      setShowProfileMenu(false);
                      handleLogout();
                    }}
                  >
                    <LogOut className="w-4 h-4" />
                    {t('topbar.logout')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      <AddToHomeScreenModal
        isOpen={addToHomeScreenMode !== null}
        onClose={() => setAddToHomeScreenMode(null)}
        mode={addToHomeScreenMode ?? 'unavailable'}
      />
    </header>
  );
};
