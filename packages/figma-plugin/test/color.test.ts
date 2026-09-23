import { describe, expect, it } from 'vitest';

import { toHex } from '../src/core/color';

const f = Math.fround;

describe('toHex', () => {
  it('writes lowercase #rrggbb from Figma float channels', () => {
    expect(toHex({ r: f(0x60 / 255), g: f(0x38 / 255), b: f(0xc4 / 255), a: 1 })).toBe('#6038c4');
  });

  it('adds an alpha byte when the colour is not opaque', () => {
    expect(toHex({ r: f(0x15 / 255), g: f(0x15 / 255), b: f(0x17 / 255), a: f(0x8c / 255) })).toBe('#1515178c');
  });

  it('treats an alpha that rounds to ff as opaque', () => {
    expect(toHex({ r: 1, g: 1, b: 1, a: 0.999 })).toBe('#ffffff');
  });

  it('clamps out-of-range channels', () => {
    expect(toHex({ r: 1.2, g: -0.1, b: 0, a: 1 })).toBe('#ff0000');
  });
});
