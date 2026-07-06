import { useCallback, useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type AddToHomeScreenResult =
  | 'accepted'
  | 'dismissed'
  | 'ios-instructions'
  | 'android-instructions'
  | 'already-installed'
  | 'unavailable';

function detectIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function useAddToHomeScreen() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS] = useState(detectIOS);
  const [isStandalone, setIsStandalone] = useState(detectStandalone);

  useEffect(() => {
    if (isStandalone) return;

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const onAppInstalled = () => {
      setIsStandalone(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, [isStandalone]);

  const canInstall = !isStandalone;

  const promptInstall = useCallback(async (): Promise<AddToHomeScreenResult> => {
    if (isStandalone) return 'already-installed';

    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      return outcome;
    }

    if (isIOS) return 'ios-instructions';

    const isAndroid = /Android/i.test(navigator.userAgent);
    if (isAndroid) return 'android-instructions';

    return 'unavailable';
  }, [deferredPrompt, isIOS, isStandalone]);

  return {
    canInstall,
    hasNativePrompt: deferredPrompt !== null,
    isIOS,
    isStandalone,
    promptInstall,
  };
}
