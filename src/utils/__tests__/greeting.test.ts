import { describe, expect, it } from 'vitest';
import { getGreeting } from '../greeting';

function atIst(clock: string): Date {
  return new Date(`2026-06-15T${clock}:00+05:30`);
}

describe('getGreeting', () => {
  it('uses India Standard Time boundaries', () => {
    expect(getGreeting(atIst('03:59'))).toBe('Good Night');
    expect(getGreeting(atIst('04:00'))).toBe('Good Morning');
    expect(getGreeting(atIst('11:59'))).toBe('Good Morning');
    expect(getGreeting(atIst('12:00'))).toBe('Good Afternoon');
    expect(getGreeting(atIst('15:59'))).toBe('Good Afternoon');
    expect(getGreeting(atIst('16:00'))).toBe('Good Evening');
    expect(getGreeting(atIst('19:59'))).toBe('Good Evening');
    expect(getGreeting(atIst('20:00'))).toBe('Good Night');
    expect(getGreeting(atIst('00:00'))).toBe('Good Night');
  });
});
