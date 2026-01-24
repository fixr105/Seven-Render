export function isPageReload(): boolean {
  if (typeof performance === 'undefined' || !performance.getEntriesByType) return false;
  const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  if (nav?.type === 'reload') return true;
  if (typeof (performance as any).navigation !== 'undefined' && (performance as any).navigation?.type === 1) return true;
  return false;
}
