import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { buildExport } from '../src/core/build-export';
import { multipleFiles } from '../src/core/files';
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

  it('reproduces examples/lumen-academy/tokens byte for byte', () => {
    const expected = readTree(join(example, 'tokens'));
    const actual = new Map(multipleFiles(result).map((file) => [file.path, file.json]));

    expect([...actual.keys()].sort()).toEqual([...expected.keys()].sort());
    for (const [path, json] of expected) {
      expect(actual.get(path), path).toBe(json);
    }
  });
});
