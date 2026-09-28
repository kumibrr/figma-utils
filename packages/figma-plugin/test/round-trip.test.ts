import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { buildExport } from '../src/core/build-export';
import { multipleFiles } from '../src/core/files';
import { inferScopes } from '../src/core/infer-scopes';
import type { Snapshot } from '../src/core/snapshot';

const example = fileURLToPath(new URL('../../../examples/lumen-academy/', import.meta.url));

function readTree(dir: string): Map<string, string> {
  const files = new Map<string, string>();
  const walk = (current: string) => {
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

describe('CSS → css-to-dtcg → Figma → plugin', () => {
  const snapshot = JSON.parse(readFileSync(join(example, 'figma-snapshot.json'), 'utf8')) as Snapshot;
  const result = buildExport(snapshot);

  it('exports the example without errors', () => {
    expect(result.errors).toEqual([]);
  });

  const expectExample = (built: ReturnType<typeof buildExport>) => {
    const expected = readTree(join(example, 'tokens'));
    const actual = new Map(multipleFiles(built).map((file) => [file.path, file.json]));

    expect([...actual.keys()].sort()).toEqual([...expected.keys()].sort());
    for (const [path, json] of expected) {
      expect(actual.get(path), path).toBe(json);
    }
  };

  it('reproduces examples/lumen-academy/tokens byte for byte', () => {
    expectExample(result);
  });

  it('reproduces the example after the plugin sets every number and string scope', () => {
    const unscoped: Snapshot = {
      ...snapshot,
      variables: snapshot.variables.map((variable) =>
        variable.resolvedType === 'COLOR' ? variable : { ...variable, scopes: ['ALL_SCOPES'] },
      ),
    };
    const fixes = new Map(inferScopes(unscoped).map((fix) => [fix.variableId, fix.scopes]));
    const fixed: Snapshot = {
      ...unscoped,
      variables: unscoped.variables.map((variable) => ({ ...variable, scopes: fixes.get(variable.id) ?? variable.scopes })),
    };

    expect(fixes.size).toBe(unscoped.variables.filter((variable) => variable.resolvedType !== 'COLOR').length);
    expect(inferScopes(fixed)).toEqual([]);
    expect(buildExport(fixed).errors).toEqual([]);
    expectExample(buildExport(fixed));
  });

  it('blocks the export until the weights imported without their Font weight scope are fixed', () => {
    const asImported: Snapshot = {
      ...snapshot,
      variables: snapshot.variables.map((variable) =>
        variable.scopes.includes('FONT_WEIGHT') ? { ...variable, scopes: ['ALL_SCOPES'] } : variable,
      ),
    };

    expect(buildExport(asImported).errors.map((error) => `${error.collection} ${error.variable}`)).toEqual([
      'typography weight/regular',
      'typography weight/medium',
      'typography weight/bold',
      'typography weight/title',
    ]);
  });
});
