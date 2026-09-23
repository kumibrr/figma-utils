import { describe, expect, it } from 'vitest';

import { createClient, encodePath, GitHubError, toError } from '../src/github/client';

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers });

describe('createClient', () => {
  it('sends the token and GitHub headers, and parses JSON', async () => {
    const seen: { url: string; init: RequestInit }[] = [];
    const client = createClient('ghp_secret', async (url, init) => {
      seen.push({ url: String(url), init: init! });
      return json(200, { ok: true });
    });

    await expect(client.request('POST', '/repos/a/b/git/trees', { x: 1 })).resolves.toEqual({ ok: true });
    expect(seen[0].url).toBe('https://api.github.com/repos/a/b/git/trees');
    expect(seen[0].init.method).toBe('POST');
    expect(seen[0].init.body).toBe('{"x":1}');
    expect(seen[0].init.headers).toMatchObject({
      Authorization: 'Bearer ghp_secret',
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    });
  });

  it('maps network failures', async () => {
    const client = createClient('t', async () => {
      throw new TypeError('Failed to fetch');
    });

    await expect(client.request('GET', '/user')).rejects.toEqual(new GitHubError("Couldn't reach GitHub.", null));
  });

  it('throws mapped errors for non-2xx responses', async () => {
    const client = createClient('t', async () => json(401, { message: 'Bad credentials' }));

    await expect(client.request('GET', '/user')).rejects.toMatchObject({ message: 'GitHub rejected the token.', status: 401 });
  });
});

describe('toError', () => {
  it('maps the documented statuses', async () => {
    expect((await toError(json(403, {}))).message).toBe('The token has no permission for this repository.');
    expect((await toError(json(404, {}))).message).toBe('Repository or branch not found.');
    expect((await toError(json(409, {}))).message).toBe('The repository is empty.');
    expect((await toError(json(500, { message: 'Boom' }))).message).toBe('GitHub error 500: Boom');
  });

  it('explains rate limits with the local reset time', async () => {
    const reset = new Date(2026, 8, 23, 14, 5);
    const error = await toError(
      json(403, {}, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(reset.getTime() / 1000) }),
    );

    expect(error.message).toBe('GitHub rate limit reached; try again at 14:05.');
    expect((await toError(json(429, {}))).message).toBe('GitHub rate limit reached; try again later.');
  });

  it('never suggests replacing the token', async () => {
    for (const status of [401, 403, 404, 409, 422, 500]) {
      expect((await toError(json(status, {}))).message.toLowerCase()).not.toContain('replace');
    }
  });
});

describe('encodePath', () => {
  it('keeps slashes and encodes each segment', () => {
    expect(encodePath('feature/a b#1')).toBe('feature/a%20b%231');
  });
});
