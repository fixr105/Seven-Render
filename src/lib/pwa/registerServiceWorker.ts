export async function registerServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none',
    });

    void registration.update();

    registration.addEventListener('updatefound', () => {
      const installing = registration.installing;
      if (!installing) return;

      installing.addEventListener('statechange', () => {
        if (installing.state === 'activated' && navigator.serviceWorker.controller) {
          window.location.reload();
        }
      });
    });
  } catch {
    // PWA install remains available via manual browser UI when SW registration fails.
  }
}
