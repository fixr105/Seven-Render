/** Greeting from the clock in India, not the device time zone. */
export function getGreeting(date: Date = new Date()): string {
  const hour = Number(
    new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      hourCycle: 'h23',
    }).format(date)
  );
  if (hour >= 4 && hour <= 11) return 'Good Morning';
  if (hour >= 12 && hour <= 15) return 'Good Afternoon';
  if (hour >= 16 && hour <= 19) return 'Good Evening';
  return 'Good Night';
}
