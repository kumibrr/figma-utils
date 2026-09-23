import { encodePath, GitHubError, type GitHubClient } from './client';

export type RepoSettings = { repository: string; base: string; folder: string };

export function parseRepository(value: string): { owner: string; repo: string } | null {
  const match = /^\s*([\w.-]+)\/([\w.-]+)\s*$/.exec(value);
  return match ? { owner: match[1], repo: match[2] } : null;
}

export const normalizeFolder = (folder: string) => folder.trim().replace(/^\/+|\/+$/g, '');

export const normalizeSettings = (settings: RepoSettings): RepoSettings => ({
  repository: settings.repository.trim(),
  base: settings.base.trim(),
  folder: normalizeFolder(settings.folder),
});

export function validateSettings(settings: RepoSettings): string[] {
  const problems: string[] = [];
  const folder = normalizeFolder(settings.folder);

  if (!parseRepository(settings.repository)) {
    problems.push('Repository must look like owner/repo.');
  }
  if (settings.base.trim() === '') {
    problems.push('Base branch is required.');
  }
  if (folder === '') {
    problems.push("Folder can't be the repository root.");
  } else if (folder.split('/').some((segment) => segment === '' || segment === '.' || segment === '..')) {
    problems.push('Folder can\'t contain "." or ".." segments.');
  }
  return problems;
}

/** Confirms the repository exists, the token can push, and the base branch exists. */
export async function checkSettings(client: GitHubClient, settings: RepoSettings): Promise<void> {
  const { owner, repo } = parseRepository(settings.repository)!;
  const info = await client.request<{ permissions?: { push?: boolean } }>('GET', `/repos/${owner}/${repo}`);

  if (!info.permissions?.push) {
    throw new GitHubError(`The token can't push to ${owner}/${repo}.`, null);
  }
  await client.request('GET', `/repos/${owner}/${repo}/branches/${encodePath(settings.base.trim())}`);
}
