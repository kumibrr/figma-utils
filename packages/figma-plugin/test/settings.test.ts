import { describe, expect, it } from 'vitest';

import { createClient } from '../src/github/client';
import { checkSettings, normalizeFolder, normalizeSettings, parseRepository, validateSettings } from '../src/github/settings';

const valid = { repository: 'acme/ui', base: 'main', folder: 'tokens' };

describe('parseRepository', () => {
  it('reads owner/repo', () => {
    expect(parseRepository(' acme/ui-kit.js ')).toEqual({ owner: 'acme', repo: 'ui-kit.js' });
    expect(parseRepository('acme')).toBeNull();
    expect(parseRepository('https://github.com/acme/ui')).toBeNull();
  });
});

describe('normalizeFolder', () => {
  it('trims whitespace and slashes', () => {
    expect(normalizeFolder(' /design/tokens/ ')).toBe('design/tokens');
  });
});

describe('validateSettings', () => {
  it('accepts valid settings', () => {
    expect(validateSettings(valid)).toEqual([]);
  });

  it('never lets the folder be the repository root or escape it', () => {
    expect(validateSettings({ ...valid, folder: '' })).toEqual(["Folder can't be the repository root."]);
    expect(validateSettings({ ...valid, folder: '/' })).toEqual(["Folder can't be the repository root."]);
    expect(validateSettings({ ...valid, folder: 'a/../b' })).toEqual(['Folder can\'t contain "." or ".." segments.']);
  });

  it('checks repository and base branch', () => {
    expect(validateSettings({ repository: 'acme', base: ' ', folder: 'tokens' })).toEqual([
      'Repository must look like owner/repo.',
      'Base branch is required.',
    ]);
  });

  it('normalizes before saving', () => {
    expect(normalizeSettings({ repository: ' acme/ui ', base: ' main ', folder: '/tokens/' })).toEqual(valid);
  });
});

describe('checkSettings', () => {
  const clientFor = (routes: Record<string, [number, unknown]>) =>
    createClient('t', async (url) => {
      const [status, body] = routes[String(url).replace('https://api.github.com', '')] ?? [404, {}];
      return new Response(JSON.stringify(body), { status });
    });

  it('passes when the token can push and the base branch exists', async () => {
    const client = clientFor({ '/repos/acme/ui': [200, { permissions: { push: true } }], '/repos/acme/ui/branches/main': [200, {}] });

    await expect(checkSettings(client, valid)).resolves.toBeUndefined();
  });

  it('fails when the token cannot push', async () => {
    const client = clientFor({ '/repos/acme/ui': [200, { permissions: { push: false } }] });

    await expect(checkSettings(client, valid)).rejects.toThrow("The token can't push to acme/ui.");
  });

  it('fails when the base branch is missing', async () => {
    const client = clientFor({ '/repos/acme/ui': [200, { permissions: { push: true } }] });

    await expect(checkSettings(client, valid)).rejects.toThrow('Repository or branch not found.');
  });
});
