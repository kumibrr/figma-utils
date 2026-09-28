import { encodePath, GitHubError, type GitHubClient } from './client';

export type Repo = { owner: string; name: string; fullName: string; defaultBranch: string; canPush: boolean };

type ApiRepo = {
  name: string;
  full_name: string;
  owner: { login: string };
  default_branch: string;
  permissions?: { push?: boolean };
};

const PAGE = 100;
const byName = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });

/** Requests pages 1, 2, … until one comes back short, so no Link header parsing is needed. */
async function allPages<T>(client: GitHubClient, path: string): Promise<T[]> {
  const items: T[] = [];
  for (let page = 1; ; page++) {
    const batch = await client.request<T[]>('GET', `${path}${path.includes('?') ? '&' : '?'}page=${page}`);
    items.push(...batch);
    if (batch.length < PAGE) {
      return items;
    }
  }
}

/** Every repository the token can see. A fine-grained token only sees its own resource owner. */
export async function listRepos(client: GitHubClient): Promise<Repo[]> {
  const repos = await allPages<ApiRepo>(client, `/user/repos?per_page=${PAGE}&sort=full_name`);
  return repos.map((repo) => ({
    owner: repo.owner.login,
    name: repo.name,
    fullName: repo.full_name,
    defaultBranch: repo.default_branch,
    canPush: repo.permissions?.push === true,
  }));
}

export const ownersOf = (repos: Repo[]): string[] => [...new Set(repos.map((repo) => repo.owner))].sort(byName);

/** The owner's repositories the token can push to, by name. */
export const reposOf = (repos: Repo[], owner: string): Repo[] =>
  repos.filter((repo) => repo.owner === owner && repo.canPush).sort((a, b) => byName(a.name, b.name));

export async function listBranches(client: GitHubClient, owner: string, repo: string): Promise<string[]> {
  const branches = await allPages<{ name: string }>(client, `/repos/${owner}/${repo}/branches?per_page=${PAGE}`);
  return branches.map((branch) => branch.name);
}

/** Creates `name` at the head of `from`. A branch that already exists counts as created. */
export async function createBranch(client: GitHubClient, owner: string, repo: string, name: string, from: string): Promise<void> {
  const r = `/repos/${owner}/${repo}`;
  const ref = await client.request<{ object: { sha: string } }>('GET', `${r}/git/ref/heads/${encodePath(from)}`);
  try {
    await client.request('POST', `${r}/git/refs`, { ref: `refs/heads/${name}`, sha: ref.object.sha });
  } catch (error) {
    // Someone else created it in the meantime; any other 422 (such as an invalid name) is a real error.
    const exists = error instanceof GitHubError && error.status === 422 && /already exists/i.test(error.message);
    if (!exists) {
      throw error;
    }
  }
}
