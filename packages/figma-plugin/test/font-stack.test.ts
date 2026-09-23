import { describe, expect, it } from 'vitest';

import { fontFamilyValue, parseFontStack } from '../src/core/font-stack';

describe('parseFontStack', () => {
  it('splits a stack and strips quotes', () => {
    expect(parseFontStack("'Roboto Slab', serif")).toEqual(['Roboto Slab', 'serif']);
    expect(parseFontStack('"JetBrains Mono", monospace')).toEqual(['JetBrains Mono', 'monospace']);
    expect(parseFontStack('Inter')).toEqual(['Inter']);
  });

  it('returns null for code syntax that is not a font stack', () => {
    expect(parseFontStack('var(--title-font-family)')).toBeNull();
    expect(parseFontStack('16px')).toBeNull();
    expect(parseFontStack('')).toBeNull();
  });
});

describe('fontFamilyValue', () => {
  it('uses the stack when its first family matches the value', () => {
    expect(fontFamilyValue('Roboto Slab', "'Roboto Slab', serif")).toEqual({ ok: true, value: ['Roboto Slab', 'serif'] });
    expect(fontFamilyValue('roboto slab', "'Roboto Slab', serif")).toEqual({ ok: true, value: ['Roboto Slab', 'serif'] });
  });

  it('falls back to the value alone', () => {
    expect(fontFamilyValue('Inter', undefined)).toEqual({ ok: true, value: ['Inter'] });
    expect(fontFamilyValue('Inter', 'var(--family-body)')).toEqual({ ok: true, value: ['Inter'] });
  });

  it('reports a stack that drifted from the value', () => {
    expect(fontFamilyValue('Inter', "'Roboto Slab', serif")).toEqual({
      ok: false,
      reason: 'Web code syntax starts with "Roboto Slab" but the value is "Inter"',
    });
  });
});
