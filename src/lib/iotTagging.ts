export function normalizeIotDeviceId(raw: string): string {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

export function isValidImeiLuhn(digits: string): boolean {
  if (!/^\d{15}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 15; i += 1) {
    let n = Number(digits[14 - i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
}

export function validateIotDeviceId(raw: string): string | null {
  const id = normalizeIotDeviceId(raw);
  if (id.length < 6 || id.length > 30) {
    return 'Enter the device ID printed on the IoT unit.';
  }
  if (/^\d{15}$/.test(id) && !isValidImeiLuhn(id)) {
    return 'This IMEI is not valid. Check the 15 digits.';
  }
  return null;
}

export function normalizeChassis(raw: string): string {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

export function validateChassisNumber(raw: string, vehicleChassis?: string): string | null {
  const chassis = normalizeChassis(raw);
  if (chassis.length !== 17) {
    return 'Chassis number must be 17 characters';
  }
  if (/[IOQ]/.test(chassis)) {
    return 'Chassis number cannot contain I, O or Q';
  }
  const expected = normalizeChassis(vehicleChassis || '');
  if (expected && chassis !== expected) {
    return 'Chassis number does not match vehicle details';
  }
  return null;
}
