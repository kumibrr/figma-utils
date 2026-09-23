import { describe, expect, it } from 'vitest';

import { capitalize, firstSegment, invalidPathReason, lastSegment, parentOf, tokenPath } from '../src/naming.js';

describe('segments', () => {
  it('splits set names on slashes', () => {
    expect(firstSegment('semantic/brand/nova')).toBe('semantic');
    expect(lastSegment('semantic/brand/nova')).toBe('nova');
    expect(parentOf('semantic/brand/nova')).toBe('semantic/brand');
    expect(parentOf('primitives')).toBe('');
    expect(capitalize('brand')).toBe('Brand');
  });
});

describe('tokenPath', () => {
  it('splits the name on hyphens under the set root', () => {
    expect(tokenPath('--gray-100', 'primitives')).toEqual(['primitives', 'gray', '100']);
    expect(tokenPath('--text-default', 'semantic/theme/light')).toEqual(['semantic', 'text', 'default']);
  });

  it('treats a double hyphen like a single one', () => {
    expect(tokenPath('--legend-frozen--default', 'primitives')).toEqual(['primitives', 'legend', 'frozen', 'default']);
  });

  it('uses an override under the set root', () => {
    expect(tokenPath('--color-white', 'primitives', { overrides: { '--color-white': ['base', 'white'] } })).toEqual([
      'primitives',
      'base',
      'white',
    ]);
  });

  it('lets a path function take over completely', () => {
    const path = (name, setName) => [setName, 'custom', name.slice(2)];

    expect(tokenPath('--gray-100', 'primitives', { path, overrides: { '--gray-100': ['x'] } })).toEqual([
      'primitives',
      'custom',
      'gray-100',
    ]);
  });
});

describe('invalidPathReason', () => {
  it('accepts a normal path', () => {
    expect(invalidPathReason(['primitives', 'gray', '100'])).toBeNull();
  });

  it('rejects paths that would break references or nesting', () => {
    expect(invalidPathReason(['primitives'])).toMatch(/at least two/);
    expect(invalidPathReason('primitives.gray')).toMatch(/array/);
    expect(invalidPathReason(['primitives', ''])).toMatch(/empty/);
    expect(invalidPathReason(['primitives', 'a.b'])).toMatch(/\. \{ \}/);
    expect(invalidPathReason(['primitives', '{a}'])).toMatch(/\. \{ \}/);
    expect(invalidPathReason(['primitives', '$type'])).toMatch(/\$/);
  });
});
