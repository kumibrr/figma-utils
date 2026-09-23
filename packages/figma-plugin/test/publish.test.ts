import { describe, expect, it } from 'vitest';

import { createClient } from '../src/github/client';
import { branchName, prBody, publish, type PublishStep } from '../src/github/publish';

type Route = (body: any) => [number, unknown];

function fakeGitHub(routes: Record<string, Route>) {
  const calls: { method: string; path: string; body?: any }[] = [];
  const client = createClient('t', async (url, init) => {
    const path = String(url).replace('https://api.github.com', '');
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, path, body });
    const route = routes[`${method} ${path}`];
    const [status, json] = route ? route(body) : [404, { message: 'Not Found' }];
    return new Response(JSON.stringify(json), { status });
  });
  return { client, calls };
}

const R = '/repos/acme/ui';
const now = new Date(Date.UTC(2026, 8, 23, 14, 30, 12));
const settings = { repository: 'acme/ui', base: 'main', folder: 'tokens' };
const files = [
  { path: 'primitives.json', json: '{}\n' },
  { path: '$themes.json', json: '[]\n' },
];
const input = { files, fileName: 'Design System', userName: 'Ada', now };

const baseRoutes = (overrides: Record<string, Route> = {}): Record<string, Route> => ({
  [`GET ${R}/git/ref/heads/main`]: () => [200, { object: { sha: 'base-commit' } }],
  [`GET ${R}/git/commits/base-commit`]: () => [200, { tree: { sha: 'root-tree' } }],
  [`GET ${R}/git/trees/root-tree`]: () => [
    200,
    { tree: [{ path: 'tokens', type: 'tree', sha: 'tokens-tree' }, { path: 'README.md', type: 'blob', sha: 'r' }] },
  ],
  [`GET ${R}/git/trees/tokens-tree?recursive=1`]: () => [
    200,
    {
      truncated: false,
      tree: [
        { path: 'primitives.json', type: 'blob', sha: 'a' },
        { path: 'old.json', type: 'blob', sha: 'b' },
        { path: 'nested', type: 'tree', sha: 'c' },
        { path: 'nested/x.json', type: 'blob', sha: 'd' },
        { path: 'vendored', type: 'commit', sha: 'e' },
      ],
    },
  ],
  [`POST ${R}/git/trees`]: () => [201, { sha: 'new-tree' }],
  [`POST ${R}/git/commits`]: () => [201, { sha: 'new-commit' }],
  [`POST ${R}/git/refs`]: () => [201, {}],
  [`GET ${R}/compare/main...new-commit`]: () => [
    200,
    {
      files: [
        { filename: 'tokens/$themes.json', status: 'added' },
        { filename: 'tokens/primitives.json', status: 'modified' },
        { filename: 'tokens/old.json', status: 'removed' },
      ],
    },
  ],
  [`POST ${R}/pulls`]: () => [201, { number: 42, html_url: 'https://github.com/acme/ui/pull/42' }],
  ...overrides,
});

describe('branchName', () => {
  it('uses a UTC timestamp without colons', () => {
    expect(branchName(now)).toBe('styles/figma-export-20260923-143012');
  });
});

describe('publish', () => {
  it('replaces the folder in one commit and opens a PR', async () => {
    const { client, calls } = fakeGitHub(baseRoutes());
    const steps: PublishStep[] = [];

    const result = await publish(client, settings, input, (step) => steps.push(step));

    expect(result).toEqual({
      kind: 'opened',
      number: 42,
      url: 'https://github.com/acme/ui/pull/42',
      branch: 'styles/figma-export-20260923-143012',
    });
    expect(steps).toEqual(['reading', 'committing', 'branching', 'opening']);

    const tree = calls.find((call) => call.method === 'POST' && call.path === `${R}/git/trees`)!.body;
    expect(tree).toEqual({
      base_tree: 'root-tree',
      tree: [
        { path: 'tokens/primitives.json', mode: '100644', type: 'blob', content: '{}\n' },
        { path: 'tokens/$themes.json', mode: '100644', type: 'blob', content: '[]\n' },
        { path: 'tokens/old.json', mode: '100644', type: 'blob', sha: null },
        { path: 'tokens/nested/x.json', mode: '100644', type: 'blob', sha: null },
      ],
    });

    expect(calls.find((call) => call.path === `${R}/git/commits` && call.method === 'POST')!.body).toEqual({
      message: 'chore(tokens): export from Figma',
      tree: 'new-tree',
      parents: ['base-commit'],
    });
    expect(calls.find((call) => call.path === `${R}/git/refs`)!.body).toEqual({
      ref: 'refs/heads/styles/figma-export-20260923-143012',
      sha: 'new-commit',
    });
    expect(calls.find((call) => call.path === `${R}/pulls`)!.body).toMatchObject({
      title: 'chore(tokens): export from Figma',
      head: 'styles/figma-export-20260923-143012',
      base: 'main',
    });
  });

  it('stops without creating anything when nothing changed', async () => {
    const { client, calls } = fakeGitHub(baseRoutes({ [`POST ${R}/git/trees`]: () => [201, { sha: 'root-tree' }] }));

    await expect(publish(client, settings, input)).resolves.toEqual({ kind: 'no-changes', base: 'main' });
    expect(calls.some((call) => call.path === `${R}/git/commits` && call.method === 'POST')).toBe(false);
    expect(calls.some((call) => call.path === `${R}/git/refs`)).toBe(false);
  });

  it('handles a folder that does not exist yet', async () => {
    const { client, calls } = fakeGitHub(
      baseRoutes({ [`GET ${R}/git/trees/root-tree`]: () => [200, { tree: [{ path: 'README.md', type: 'blob', sha: 'r' }] }] }),
    );

    await publish(client, settings, input);

    const tree = calls.find((call) => call.method === 'POST' && call.path === `${R}/git/trees`)!.body.tree;
    expect(tree.every((entry: { sha?: null }) => entry.sha === undefined)).toBe(true);
    expect(calls.filter((call) => call.path.startsWith(`${R}/git/trees/`))).toHaveLength(1);
  });

  it('walks a nested folder', async () => {
    const { client, calls } = fakeGitHub(
      baseRoutes({
        [`GET ${R}/git/trees/root-tree`]: () => [200, { tree: [{ path: 'design', type: 'tree', sha: 'design-tree' }] }],
        [`GET ${R}/git/trees/design-tree`]: () => [200, { tree: [{ path: 'tokens', type: 'tree', sha: 'tokens-tree' }] }],
      }),
    );

    await publish(client, { ...settings, folder: 'design/tokens' }, input);

    const tree = calls.find((call) => call.method === 'POST' && call.path === `${R}/git/trees`)!.body.tree;
    expect(tree[0].path).toBe('design/tokens/primitives.json');
    expect(tree).toContainEqual({ path: 'design/tokens/old.json', mode: '100644', type: 'blob', sha: null });
  });

  it('refuses to list a truncated folder', async () => {
    const { client } = fakeGitHub(
      baseRoutes({ [`GET ${R}/git/trees/tokens-tree?recursive=1`]: () => [200, { truncated: true, tree: [] }] }),
    );

    await expect(publish(client, settings, input)).rejects.toThrow('The folder tokens has too many files to list.');
  });

  it('refuses a folder that would replace the repository root', async () => {
    const { client, calls } = fakeGitHub(baseRoutes());

    await expect(publish(client, { ...settings, folder: '/' }, input)).rejects.toThrow("Folder can't be the repository root.");
    expect(calls).toHaveLength(0);
  });

  it('explains an existing branch', async () => {
    const { client } = fakeGitHub(baseRoutes({ [`POST ${R}/git/refs`]: () => [422, { message: 'Reference already exists' }] }));

    await expect(publish(client, settings, input)).rejects.toThrow('Branch already exists.');
  });

  it('names the branch when opening the PR fails', async () => {
    const { client } = fakeGitHub(baseRoutes({ [`POST ${R}/pulls`]: () => [500, { message: 'Boom' }] }));

    await expect(publish(client, settings, input)).rejects.toThrow(
      'Branch styles/figma-export-20260923-143012 was created, but opening the pull request failed: GitHub error 500: Boom',
    );
  });
});

describe('prBody', () => {
  it('names the file, the exporter and the changes', () => {
    expect(
      prBody(input, [
        { filename: 'tokens/a.json', status: 'added' },
        { filename: 'tokens/b.json', status: 'modified' },
        { filename: 'tokens/c.json', status: 'removed' },
      ]),
    ).toBe(
      [
        'Exported from the Figma file **Design System** by Ada with Export Design Tokens.',
        '',
        '**Added**',
        '- `tokens/a.json`',
        '',
        '**Modified**',
        '- `tokens/b.json`',
        '',
        '**Removed**',
        '- `tokens/c.json`',
        '',
      ].join('\n'),
    );
  });

  it('handles an unknown exporter', () => {
    expect(prBody({ ...input, userName: null }, [])).toBe(
      'Exported from the Figma file **Design System** by an unknown user with Export Design Tokens.\n',
    );
  });
});
