import { describe, expect, it } from 'vitest';

import { createBranch, listBranches, listRepos, ownersOf, reposOf, type Repo } from '../src/github/browse';
import { createClient } from '../src/github/client';

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

const apiRepo = (owner: string, name: string, push = true) => ({
  name,
  full_name: `${owner}/${name}`,
  owner: { login: owner },
  default_branch: 'main',
  permissions: { push },
});

const repo = (owner: string, name: string, canPush = true): Repo => ({
  owner,
  name,
  fullName: `${owner}/${name}`,
  defaultBranch: 'main',
  canPush,
});

describe('listRepos', () => {
  it('maps repositories and pages until a short page', async () => {
    const full = Array.from({ length: 100 }, (_, index) => apiRepo('acme', `r${index}`));
    const { client, calls } = fakeGitHub({
      'GET /user/repos?per_page=100&sort=full_name&page=1': () => [200, full],
      'GET /user/repos?per_page=100&sort=full_name&page=2': () => [200, [apiRepo('ada', 'site', false)]],
    });

    const repos = await listRepos(client);

    expect(repos).toHaveLength(101);
    expect(repos[100]).toEqual({ owner: 'ada', name: 'site', fullName: 'ada/site', defaultBranch: 'main', canPush: false });
    expect(calls).toHaveLength(2);
  });

  it('treats a missing permissions object as not pushable', async () => {
    const { client } = fakeGitHub({
      'GET /user/repos?per_page=100&sort=full_name&page=1': () => [200, [{ ...apiRepo('acme', 'ui'), permissions: undefined }]],
    });

    expect((await listRepos(client))[0].canPush).toBe(false);
  });
});

describe('ownersOf', () => {
  it('lists distinct owners, sorted case-insensitively', () => {
    expect(ownersOf([repo('beta', 'a'), repo('Acme', 'b'), repo('beta', 'c'), repo('ada', 'd')])).toEqual(['Acme', 'ada', 'beta']);
  });
});

describe('reposOf', () => {
  it("keeps the owner's pushable repositories, sorted by name", () => {
    const repos = [repo('acme', 'web'), repo('acme', 'api', false), repo('ada', 'site'), repo('acme', 'Docs')];

    expect(reposOf(repos, 'acme').map((r) => r.name)).toEqual(['Docs', 'web']);
  });
});

describe('listBranches', () => {
  it('returns branch names across pages', async () => {
    const full = Array.from({ length: 100 }, (_, index) => ({ name: `b${index}` }));
    const { client } = fakeGitHub({
      'GET /repos/acme/ui/branches?per_page=100&page=1': () => [200, full],
      'GET /repos/acme/ui/branches?per_page=100&page=2': () => [200, []],
    });

    const branches = await listBranches(client, 'acme', 'ui');

    expect(branches).toHaveLength(100);
    expect(branches[0]).toBe('b0');
  });
});

describe('createBranch', () => {
  it('creates the branch at the head of the source branch', async () => {
    const { client, calls } = fakeGitHub({
      'GET /repos/acme/ui/git/ref/heads/release/1.0': () => [200, { object: { sha: 'abc' } }],
      'POST /repos/acme/ui/git/refs': () => [201, {}],
    });

    await createBranch(client, 'acme', 'ui', 'design/tokens', 'release/1.0');

    expect(calls.at(-1)).toEqual({
      method: 'POST',
      path: '/repos/acme/ui/git/refs',
      body: { ref: 'refs/heads/design/tokens', sha: 'abc' },
    });
  });

  it('encodes the source branch in the path', async () => {
    const { client, calls } = fakeGitHub({});

    await expect(createBranch(client, 'acme', 'ui', 'x', 'a b')).rejects.toThrow('Repository or branch not found.');
    expect(calls[0].path).toBe('/repos/acme/ui/git/ref/heads/a%20b');
  });

  it('treats an existing branch as created', async () => {
    const { client } = fakeGitHub({
      'GET /repos/acme/ui/git/ref/heads/main': () => [200, { object: { sha: 'abc' } }],
      'POST /repos/acme/ui/git/refs': () => [422, { message: 'Reference already exists' }],
    });

    await expect(createBranch(client, 'acme', 'ui', 'dev', 'main')).resolves.toBeUndefined();
  });

  it('reports any other refusal', async () => {
    const { client } = fakeGitHub({
      'GET /repos/acme/ui/git/ref/heads/main': () => [200, { object: { sha: 'abc' } }],
      'POST /repos/acme/ui/git/refs': () => [422, { message: 'refs/heads/a..b is not a valid ref name.' }],
    });

    await expect(createBranch(client, 'acme', 'ui', 'a..b', 'main')).rejects.toThrow('GitHub error 422: refs/heads/a..b is not a valid ref name.');
  });
});
