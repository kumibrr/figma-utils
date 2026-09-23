import { describe, expect, it } from 'vitest';

import { buildExport } from '../src/core/build-export';
import { alias, collection, rgba, snapshot, variable } from './helpers';

const primitives = collection('primitives', ['Mode 1']);
const brand = collection('semantic/brand', ['nova', 'orbit']);
const theme = collection('semantic/theme', ['light', 'dark']);

const variables = [
  variable('primitives', 'gray/900', 'COLOR', { 'Mode 1': rgba(0, 0, 0) }),
  variable('primitives', 'nova/700', 'COLOR', { 'Mode 1': rgba(1, 0, 0) }),
  variable('primitives', 'orbit/700', 'COLOR', { 'Mode 1': rgba(0, 1, 0) }),
  variable('semantic/brand', 'brand/700', 'COLOR', {
    nova: alias('primitives', 'nova/700'),
    orbit: alias('primitives', 'orbit/700'),
  }),
  variable('semantic/theme', 'text/default', 'COLOR', {
    light: alias('primitives', 'gray/900'),
    dark: alias('primitives', 'gray/900'),
  }),
  variable('semantic/theme', 'primary', 'COLOR', {
    light: alias('semantic/brand', 'brand/700'),
    dark: alias('semantic/brand', 'brand/700'),
  }),
];

const good = snapshot([primitives, brand, theme], variables);

describe('buildExport', () => {
  it('produces one set per single-mode collection and one per mode otherwise', () => {
    expect(buildExport(good).sets.map((set) => set.name)).toEqual([
      'primitives',
      'semantic/brand/nova',
      'semantic/brand/orbit',
      'semantic/theme/light',
      'semantic/theme/dark',
    ]);
  });

  it('nests tokens under the collection root', () => {
    const [, nova, , light] = buildExport(good).sets;

    expect(nova.tree).toEqual({ semantic: { brand: { 700: { $type: 'color', $value: '{primitives.nova.700}' } } } });
    expect(light.tree).toEqual({
      semantic: {
        text: { default: { $type: 'color', $value: '{primitives.gray.900}' } },
        primary: { $type: 'color', $value: '{semantic.brand.700}' },
      },
    });
  });

  it('derives themes with the shared rule', () => {
    expect(buildExport(good).themes).toEqual([
      { name: 'nova', group: 'Brand', selectedTokenSets: { primitives: 'source', 'semantic/brand/nova': 'enabled' } },
      { name: 'orbit', group: 'Brand', selectedTokenSets: { primitives: 'source', 'semantic/brand/orbit': 'enabled' } },
      { name: 'light', group: 'Theme', selectedTokenSets: { primitives: 'source', 'semantic/theme/light': 'enabled' } },
      { name: 'dark', group: 'Theme', selectedTokenSets: { primitives: 'source', 'semantic/theme/dark': 'enabled' } },
    ]);
  });

  it('has no errors for a clean file', () => {
    expect(buildExport(good).errors).toEqual([]);
  });

  it('returns nothing for a file without variables', () => {
    expect(buildExport(snapshot([], []))).toEqual({ sets: [], themes: [], errors: [] });
  });

  it('reports an invalid variable once, not once per mode', () => {
    const result = buildExport(
      snapshot([theme], [variable('semantic/theme', 'flag', 'BOOLEAN', { light: true, dark: false })]),
    );

    expect(result.errors).toEqual([
      { collection: 'semantic/theme', variable: 'flag', reason: 'boolean variables are not supported' },
    ]);
  });

  it('reports per-mode problems with their mode', () => {
    const result = buildExport(
      snapshot([theme], [variable('semantic/theme', 'x', 'COLOR', { light: { aliasId: 'remote' }, dark: rgba(0, 0, 0) })]),
    );

    expect(result.errors).toEqual([
      { collection: 'semantic/theme', variable: 'x', mode: 'light', reason: 'aliases a variable that is not local to this file' },
    ]);
  });

  it('reports a missing value for a mode', () => {
    const result = buildExport(snapshot([theme], [variable('semantic/theme', 'x', 'COLOR', { light: rgba(0, 0, 0) })]));

    expect(result.errors).toEqual([
      { collection: 'semantic/theme', variable: 'x', mode: 'dark', reason: 'has no value for this mode' },
    ]);
  });

  it('reports names that would break references', () => {
    const result = buildExport(snapshot([primitives], [variable('primitives', 'spacing/1.5', 'FLOAT', { 'Mode 1': 1.5 })]));

    expect(result.errors).toEqual([
      { collection: 'primitives', variable: 'spacing/1.5', reason: 'name segment "1.5" contains one of . { }' },
    ]);
  });

  it('reports token/group collisions', () => {
    const result = buildExport(
      snapshot(
        [primitives],
        [
          variable('primitives', 'gray', 'COLOR', { 'Mode 1': rgba(0, 0, 0) }),
          variable('primitives', 'gray/100', 'COLOR', { 'Mode 1': rgba(1, 1, 1) }),
        ],
      ),
    );

    expect(result.errors).toEqual([
      { collection: 'primitives', variable: 'gray/100', reason: 'primitives.gray.100 collides with another token or group' },
    ]);
  });

  it('reports two collections that produce the same set', () => {
    const result = buildExport(snapshot([collection('a/b', ['x']), collection('a', ['b', 'c'])], []));

    expect(result.errors).toEqual([
      { collection: 'a', mode: 'b', reason: 'produces the set "a/b", which collection "a/b" also produces' },
    ]);
  });

  it('reports collection or mode names that could escape the export folder', () => {
    const result = buildExport(snapshot([collection('themes', ['..', 'dark'])], []));

    expect(result.errors).toEqual([
      {
        collection: 'themes',
        mode: '..',
        reason: 'collection and mode names cannot have empty, "." or ".." segments or contain \\',
      },
    ]);
  });

  it('reports two multi-mode collections that would share a theme group', () => {
    const result = buildExport(snapshot([collection('web/theme', ['light', 'dark']), collection('mobile/theme', ['light', 'dark'])], []));

    expect(result.errors).toEqual([
      {
        collection: 'mobile/theme',
        reason: 'would share the theme group "Theme" with collection "web/theme"; rename one of them',
      },
    ]);
  });
});
