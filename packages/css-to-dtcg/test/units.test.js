import { describe, expect, it } from 'vitest';

import { isBaseFontSize, pxToRem, remToPx } from '../src/units.js';

describe('units', () => {
  it('converts with 16px to the rem by default', () => {
    expect(remToPx(0.875)).toBe(14);
    expect(pxToRem(14)).toBe(0.875);
  });

  it('converts with another base without float noise', () => {
    expect(remToPx(1.1, 10)).toBe(11);
    expect(pxToRem(11, 10)).toBe(1.1);
    expect(pxToRem(57.6, 16)).toBe(3.6);
  });

  it('accepts only positive finite base font sizes', () => {
    expect(isBaseFontSize(16)).toBe(true);
    expect(isBaseFontSize(10.5)).toBe(true);
    expect([0, -1, Infinity, NaN, '16', undefined].some(isBaseFontSize)).toBe(false);
  });
});
