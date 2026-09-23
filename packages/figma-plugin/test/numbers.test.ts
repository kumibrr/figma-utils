import { describe, expect, it } from 'vitest';

import { recoverNumber } from '../src/core/numbers';

describe('recoverNumber', () => {
  it('recovers values Figma stored as 32-bit floats (seen in a real export)', () => {
    expect(Math.fround(0.2)).toBe(0.20000000298023224);
    expect(recoverNumber(0.20000000298023224)).toBe(0.2);
    expect(recoverNumber(0.05999999865889549)).toBe(0.06);
  });

  it('recovers other typical rem values', () => {
    expect(recoverNumber(Math.fround(0.85))).toBe(0.85);
    expect(recoverNumber(Math.fround(3.6))).toBe(3.6);
    expect(recoverNumber(Math.fround(0.8125))).toBe(0.8125);
  });

  it('leaves exact values alone', () => {
    expect(recoverNumber(700)).toBe(700);
    expect(recoverNumber(0)).toBe(0);
    expect(recoverNumber(-0.5)).toBe(-0.5);
    expect(recoverNumber(9999)).toBe(9999);
  });

  it('never cuts digits from a full-precision double', () => {
    expect(recoverNumber(0.1 + 0.2)).toBe(0.30000000000000004);
  });
});
