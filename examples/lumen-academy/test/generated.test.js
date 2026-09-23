import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildTokens, serialize } from 'css-to-dtcg';
import { describe, expect, it } from 'vitest';

import config from '../css-to-dtcg.config.js';
import { makeSnapshot } from '../scripts/make-snapshot.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** @returns {Map<string, string>} relative path → contents */
function readTree(dir) {
  const files = new Map();
  if (!existsSync(dir)) {
    return files;
  }
  const walk = (current) => {
    for (const entry of readdirSync(current)) {
      const full = join(current, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else {
        files.set(relative(dir, full).split('\\').join('/'), readFileSync(full, 'utf8'));
      }
    }
  };
  walk(dir);
  return files;
}

const generated = (target) => new Map(buildTokens(config, { target, root }).files.map((file) => [file.path, file.json]));

describe.each([
  ['dtcg', 'tokens'],
  ['figma', 'figma'],
])('committed %s output', (target, folder) => {
  it(`${folder}/ matches a fresh generation (run "pnpm tokens" if this fails)`, () => {
    const expected = generated(target);
    const actual = readTree(join(root, folder));

    expect([...actual.keys()].sort()).toEqual([...expected.keys()].sort());
    for (const [path, json] of expected) {
      expect(actual.get(path), path).toBe(json);
    }
  });
});

describe('dtcg output', () => {
  const files = generated('dtcg');
  const read = (path) => JSON.parse(files.get(path));

  it('has one file per set plus $themes.json', () => {
    expect([...files.keys()]).toEqual([
      'primitives.json',
      'semantic/brand/nova.json',
      'semantic/brand/orbit.json',
      'semantic/brand/ember.json',
      'semantic/theme/light.json',
      'semantic/theme/dark.json',
      'typography.json',
      '$themes.json',
    ]);
  });

  it('describes both theme axes', () => {
    expect(read('$themes.json')).toEqual([
      { name: 'nova', group: 'Brand', selectedTokenSets: { primitives: 'source', 'semantic/brand/nova': 'enabled' } },
      { name: 'orbit', group: 'Brand', selectedTokenSets: { primitives: 'source', 'semantic/brand/orbit': 'enabled' } },
      { name: 'ember', group: 'Brand', selectedTokenSets: { primitives: 'source', 'semantic/brand/ember': 'enabled' } },
      { name: 'light', group: 'Theme', selectedTokenSets: { primitives: 'source', 'semantic/theme/light': 'enabled' } },
      { name: 'dark', group: 'Theme', selectedTokenSets: { primitives: 'source', 'semantic/theme/dark': 'enabled' } },
    ]);
  });

  it('keeps the $type of non-colour references', () => {
    const { typography } = read('typography.json');

    expect(typography.weight.title).toEqual({ $type: 'fontWeight', $value: '{typography.weight.bold}' });
    expect(typography.family.heading).toEqual({ $type: 'fontFamily', $value: '{typography.family.title}' });
  });

  it('keeps the alpha channel of the overlay', () => {
    expect(read('primitives.json').primitives.base.overlay).toEqual({ $type: 'color', $value: '#1515178c' });
  });
});

describe('figma-snapshot.json', () => {
  const snapshot = makeSnapshot();
  const variable = (collection, name) => snapshot.variables.find((v) => v.id === `VariableID:${collection}/${name}`);

  it('matches a fresh simulation (run "pnpm tokens" if this fails)', () => {
    expect(readFileSync(join(root, 'figma-snapshot.json'), 'utf8')).toBe(serialize(snapshot));
  });

  it('creates collections in import order with their modes', () => {
    expect(snapshot.collections.map((c) => [c.name, c.modes.map((m) => m.name)])).toEqual([
      ['primitives', ['default']],
      ['semantic/brand', ['nova', 'orbit', 'ember']],
      ['semantic/theme', ['light', 'dark']],
      ['typography', ['default']],
    ]);
  });

  it('stores numbers and colours at Figma precision', () => {
    const leading = variable('typography', 'leading/display');

    expect(leading.resolvedType).toBe('FLOAT');
    expect(leading.valuesByMode['typography:default']).toBe(Math.fround(3.6));
    expect(leading.valuesByMode['typography:default']).not.toBe(3.6);
    expect(variable('primitives', 'base/overlay').valuesByMode['primitives:default']).toEqual({
      r: Math.fround(0x15 / 255),
      g: Math.fround(0x15 / 255),
      b: Math.fround(0x17 / 255),
      a: Math.fround(0x8c / 255),
    });
  });

  it('turns aliasData and same-collection references into aliases', () => {
    expect(variable('semantic/theme', 'primary/default').valuesByMode['semantic/theme:light']).toEqual({
      aliasId: 'VariableID:semantic/brand/brand/700',
    });
    expect(variable('typography', 'weight/title').valuesByMode['typography:default']).toEqual({
      aliasId: 'VariableID:typography/weight/bold',
    });
  });

  it('carries scopes and the Web code syntax a designer adds after import', () => {
    expect(variable('typography', 'weight/bold').scopes).toEqual(['FONT_WEIGHT']);
    expect(variable('typography', 'family/legend')).toMatchObject({
      resolvedType: 'STRING',
      scopes: ['FONT_FAMILY'],
      codeSyntax: { WEB: "'JetBrains Mono', monospace" },
      valuesByMode: { 'typography:default': 'JetBrains Mono' },
    });
    expect(variable('typography', 'family/heading').codeSyntax).toEqual({});
  });
});
