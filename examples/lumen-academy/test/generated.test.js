import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildTokens } from 'css-to-dtcg';
import { describe, expect, it } from 'vitest';

import config from '../css-to-dtcg.config.js';

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
