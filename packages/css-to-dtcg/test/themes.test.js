import { describe, expect, it } from 'vitest';

import { deriveThemes } from '../src/themes.js';
import { serialize } from '../src/serialize.js';

const sets = [
  { name: 'primitives', references: [] },
  { name: 'semantic/brand/nova', group: 'Brand', references: ['primitives'] },
  { name: 'semantic/brand/orbit', group: 'Brand', references: ['primitives'] },
  {
    name: 'semantic/theme/light',
    group: 'Theme',
    references: ['semantic/brand/nova', 'semantic/brand/orbit'],
  },
  { name: 'semantic/theme/dark', group: 'Theme', themeName: 'Dark mode', references: ['primitives'] },
  { name: 'typography', references: [] },
];

describe('deriveThemes', () => {
  it('lists directly referenced ungrouped sets as source, then the own set as enabled', () => {
    expect(deriveThemes(sets)[0]).toEqual({
      name: 'nova',
      group: 'Brand',
      selectedTokenSets: { primitives: 'source', 'semantic/brand/nova': 'enabled' },
    });
  });

  it('follows references through another group without listing its sets', () => {
    expect(deriveThemes(sets)[2]).toEqual({
      name: 'light',
      group: 'Theme',
      selectedTokenSets: { primitives: 'source', 'semantic/theme/light': 'enabled' },
    });
  });

  it('uses themeName when given', () => {
    expect(deriveThemes(sets)[3].name).toBe('Dark mode');
  });

  it('never mentions a set nobody references', () => {
    expect(JSON.stringify(deriveThemes(sets))).not.toContain('typography');
  });

  it('follows chains through ungrouped sets', () => {
    const chain = [
      { name: 'base', references: [] },
      { name: 'primitives', references: ['base'] },
      { name: 'semantic/theme/light', group: 'Theme', references: ['primitives'] },
    ];

    expect(deriveThemes(chain)[0].selectedTokenSets).toEqual({
      base: 'source',
      primitives: 'source',
      'semantic/theme/light': 'enabled',
    });
  });

  it('returns an empty list when nothing is grouped', () => {
    expect(deriveThemes([{ name: 'primitives', references: [] }])).toEqual([]);
  });
});

describe('serialize', () => {
  it('uses two-space JSON with a trailing newline', () => {
    expect(serialize({ a: [1] })).toBe('{\n  "a": [\n    1\n  ]\n}\n');
  });
});
