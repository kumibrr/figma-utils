import { describe, expect, it } from 'vitest';

import { buildExport } from '../src/core/build-export';
import { multipleFiles, singleFile } from '../src/core/files';
import { alias, collection, rgba, snapshot, variable } from './helpers';

const result = buildExport(
  snapshot(
    [collection('primitives', ['Mode 1']), collection('semantic/theme', ['light', 'dark'])],
    [
      variable('primitives', 'gray/900', 'COLOR', { 'Mode 1': rgba(0, 0, 0) }),
      variable('semantic/theme', 'text', 'COLOR', {
        light: alias('primitives', 'gray/900'),
        dark: alias('primitives', 'gray/900'),
      }),
    ],
  ),
);

describe('multipleFiles', () => {
  it('writes one file per set plus $themes.json with the shared JSON style', () => {
    const files = multipleFiles(result);

    expect(files.map((file) => file.path)).toEqual([
      'primitives.json',
      'semantic/theme/light.json',
      'semantic/theme/dark.json',
      '$themes.json',
    ]);
    expect(files[0].json).toBe(
      '{\n  "primitives": {\n    "gray": {\n      "900": {\n        "$type": "color",\n        "$value": "#000000"\n      }\n    }\n  }\n}\n',
    );
  });
});

describe('singleFile', () => {
  it('keys every set by its path and adds $themes', () => {
    const file = singleFile(result);

    expect(file.path).toBe('tokens.json');
    expect(Object.keys(JSON.parse(file.json))).toEqual([
      'primitives',
      'semantic/theme/light',
      'semantic/theme/dark',
      '$themes',
    ]);
  });
});
