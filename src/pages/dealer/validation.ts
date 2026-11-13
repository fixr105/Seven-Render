const VERHOEFF_D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
] as const;

const VERHOEFF_P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
] as const;

const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

export function isValidAadhaar(value: string): boolean {
  const digits = digitsOnly(value);
  if (digits.length !== 12) return false;
  let checksum = 0;
  const reversed = digits.split('').reverse().map((digit) => Number(digit));
  for (let index = 0; index < reversed.length; index += 1) {
    checksum = VERHOEFF_D[checksum][VERHOEFF_P[index % 8][reversed[index]]];
  }
  return checksum === 0;
}

export function isValidPan(value: string): boolean {
  return PAN_PATTERN.test(value.trim());
}

export function maskAadhaar(value: string): string {
  const digits = digitsOnly(value);
  const lastFour = digits.slice(-4).padStart(4, 'X');
  return `XXXX XXXX ${lastFour}`;
}

export function maskPan(value: string): string {
  const pan = value.trim().toUpperCase();
  if (pan.length < 10) return 'XXXXX0000X';
  return `XXXXX${pan.slice(5, 9)}X`;
}
