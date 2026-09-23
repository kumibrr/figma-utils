import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

import { buildTokens, TokenBuildError } from '../src/index.js';
import { run } from '../src/cli.js';

let dir;
const logs = [];
const errors = [];
const io = { log: (text) => logs.push(text), error: (text) => errors.push(text) };

const writeProject = (config) => {
  writeFileSync(join(dir, 'colors.css'), ':root { --gray-100: #f7f7f8; }\n');
  writeFileSync(join(dir, 'css-to-dtcg.config.mjs'), `export default ${JSON.stringify(config)};\n`);
};

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'css-to-dtcg-cli-'));
  logs.length = 0;
  errors.length = 0;
});

describe('buildTokens', () => {
  it('reads files relative to root', () => {
    writeProject({});
    const { files } = buildTokens({ sets: [{ name: 'primitives', file: 'colors.css', selector: ':root' }] }, { root: dir });

    expect(files.map((file) => file.path)).toEqual(['primitives.json', '$themes.json']);
  });

  it('rejects an unknown target before reading anything', () => {
    expect(() => buildTokens({ sets: [{ name: 'a', file: 'x', selector: ':root' }] }, { target: 'css' })).toThrow(TokenBuildError);
  });

  it('reports config shape errors as a TokenBuildError', () => {
    expect(() => buildTokens({ sets: [] })).toThrow(/config.sets must be a non-empty array/);
  });
});

describe('run', () => {
  const config = { sets: [{ name: 'primitives', file: 'colors.css', selector: ':root' }] };

  it('writes the dtcg target into outDir, replacing stale files', async () => {
    writeProject(config);
    mkdirSync(join(dir, 'tokens'));
    writeFileSync(join(dir, 'tokens', 'stale.json'), '{}');

    const code = await run(['--config', join(dir, 'css-to-dtcg.config.mjs')], io);

    expect(code).toBe(0);
    expect(existsSync(join(dir, 'tokens', 'stale.json'))).toBe(false);
    expect(JSON.parse(readFileSync(join(dir, 'tokens', 'primitives.json'), 'utf8'))).toEqual({
      primitives: { gray: { 100: { $type: 'color', $value: '#f7f7f8' } } },
    });
    expect(logs[0]).toMatch(/Wrote 2 files/);
  });

  it('writes the figma target and prints the import order', async () => {
    writeProject(config);

    const code = await run(['--config', join(dir, 'css-to-dtcg.config.mjs'), '--target', 'figma'], io);

    expect(code).toBe(0);
    expect(existsSync(join(dir, 'figma', 'primitives', 'default.tokens.json'))).toBe(true);
    expect(logs[1]).toBe('Import collections in this order: primitives');
  });

  it('refuses an output directory that is the project root', async () => {
    writeProject({ ...config, outDir: '.' });

    const code = await run(['--config', join(dir, 'css-to-dtcg.config.mjs')], io);

    expect(code).toBe(1);
    expect(errors[0]).toMatch(/must be inside/);
    expect(existsSync(join(dir, 'colors.css'))).toBe(true);
  });

  it('refuses an output directory outside the project', async () => {
    writeProject({ ...config, outDir: '../elsewhere' });

    expect(await run(['--config', join(dir, 'css-to-dtcg.config.mjs')], io)).toBe(1);
  });

  it('prints every build problem and exits 1 without writing', async () => {
    writeProject({ sets: [{ name: 'primitives', file: 'colors.css', selector: '.missing' }] });

    const code = await run(['--config', join(dir, 'css-to-dtcg.config.mjs')], io);

    expect(code).toBe(1);
    expect(errors[0]).toMatch(/no "\.missing" block/);
    expect(existsSync(join(dir, 'tokens'))).toBe(false);
  });

  it('explains bad arguments', async () => {
    expect(await run(['--nope'], io)).toBe(1);
    expect(errors[0]).toMatch(/Unknown option/);
  });
});
