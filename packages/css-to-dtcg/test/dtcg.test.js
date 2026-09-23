import { describe, expect, it } from 'vitest';

import { buildModel } from '../src/model.js';
import { themeInputs, toDtcgFiles } from '../src/targets/dtcg.js';

const files = {
  'colors.css': ':root { --gray-900: #2a2a2e; --nova-700: #6038c4; }',
  'brands.css': ":root, [data-brand='nova'] { --brand-700: var(--nova-700); }\n[data-brand='orbit'] { --brand-700: var(--gray-900); }",
  'theme.css': ":root { --text-default: var(--gray-900); --primary-default: var(--brand-700); }\n[data-mode='dark'] { --text-default: var(--gray-900); --primary-default: var(--brand-700); }",
};

// Theme sets first in config on purpose: $themes.json must still follow import order.
const model = buildModel(
  {
    sets: [
      { name: 'semantic/theme/light', file: 'theme.css', selector: ':root' },
      { name: 'semantic/theme/dark', file: 'theme.css', selector: "[data-mode='dark']" },
      { name: 'primitives', file: 'colors.css', selector: ':root' },
      { name: 'semantic/brand/nova', file: 'brands.css', selector: ":root, [data-brand='nova']" },
      { name: 'semantic/brand/orbit', file: 'brands.css', selector: "[data-brand='orbit']" },
    ],
    themes: {
      Theme: ['semantic/theme/light', 'semantic/theme/dark'],
      Brand: ['semantic/brand/nova', 'semantic/brand/orbit'],
    },
  },
  { readFile: (file) => files[file] },
);

describe('toDtcgFiles', () => {
  it('writes one file per set plus $themes.json', () => {
    expect(toDtcgFiles(model).map((file) => file.path)).toEqual([
      'semantic/theme/light.json',
      'semantic/theme/dark.json',
      'primitives.json',
      'semantic/brand/nova.json',
      'semantic/brand/orbit.json',
      '$themes.json',
    ]);
  });

  it('nests tokens under their full path with $type before $value', () => {
    const light = toDtcgFiles(model)[0].json;

    expect(light).toBe(
      `${JSON.stringify(
        {
          semantic: {
            text: { default: { $type: 'color', $value: '{primitives.gray.900}' } },
            primary: { default: { $type: 'color', $value: '{semantic.brand.700}' } },
          },
        },
        null,
        2,
      )}\n`,
    );
  });

  it('orders themes by collection import order', () => {
    const themes = JSON.parse(toDtcgFiles(model).at(-1).json);

    expect(themes).toEqual([
      { name: 'nova', group: 'Brand', selectedTokenSets: { primitives: 'source', 'semantic/brand/nova': 'enabled' } },
      { name: 'orbit', group: 'Brand', selectedTokenSets: { primitives: 'source', 'semantic/brand/orbit': 'enabled' } },
      { name: 'light', group: 'Theme', selectedTokenSets: { primitives: 'source', 'semantic/theme/light': 'enabled' } },
      { name: 'dark', group: 'Theme', selectedTokenSets: { primitives: 'source', 'semantic/theme/dark': 'enabled' } },
    ]);
  });

  it('exposes theme inputs in import order', () => {
    expect(themeInputs(model).map((set) => set.name)).toEqual([
      'primitives',
      'semantic/brand/nova',
      'semantic/brand/orbit',
      'semantic/theme/light',
      'semantic/theme/dark',
    ]);
  });
});
