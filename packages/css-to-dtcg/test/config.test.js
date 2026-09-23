import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { checkConfigShape, loadConfig } from '../src/config.js';

const valid = { sets: [{ name: 'primitives', file: 'colors.css', selector: ':root' }] };

describe('checkConfigShape', () => {
  it('accepts a minimal config', () => {
    expect(checkConfigShape(valid)).toEqual([]);
  });

  it('requires a non-empty sets array', () => {
    expect(checkConfigShape({})).toEqual(['config.sets must be a non-empty array']);
    expect(checkConfigShape({ sets: [] })).toEqual(['config.sets must be a non-empty array']);
  });

  it('requires name, file and selector strings on every set', () => {
    expect(checkConfigShape({ sets: [{ name: 'a' }] })).toEqual([
      'config.sets[0].file must be a non-empty string',
      'config.sets[0].selector must be a non-empty string',
    ]);
  });

  it('refuses set names that could escape the output folder', () => {
    const errors = checkConfigShape({ sets: [{ name: '../escape', file: 'a.css', selector: ':root' }] });

    expect(errors).toEqual(['config.sets[0].name "../escape" has an empty, "." or ".." segment or a backslash']);
  });

  it('checks the optional fields', () => {
    const errors = checkConfigShape({
      ...valid,
      themes: { Brand: 'semantic/brand/nova' },
      overrides: { '--a': 'b' },
      path: 'nope',
      customSets: 1,
      outDir: 3,
    });

    expect(errors).toEqual([
      'config.themes.Brand must be an array of set names',
      'config.overrides["--a"] must be an array of strings',
      'config.path must be a function',
      'config.customSets must be a function',
      'config.outDir must be a string',
    ]);
  });
});

describe('loadConfig', () => {
  it('imports the default export and reports the config directory as root', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'css-to-dtcg-'));
    const file = join(dir, 'css-to-dtcg.config.mjs');
    writeFileSync(file, `export default ${JSON.stringify(valid)};\n`);

    await expect(loadConfig(file)).resolves.toEqual({ config: valid, root: dir });
  });

  it('explains a missing config file', async () => {
    await expect(loadConfig('/definitely/not/here.js')).rejects.toThrow(/config file not found/);
  });
});
