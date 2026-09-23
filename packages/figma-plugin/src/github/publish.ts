import type { ExportFile } from '../core/files';
import { encodePath, GitHubError, type GitHubClient } from './client';
import { normalizeSettings, parseRepository, validateSettings, type RepoSettings } from './settings';

export type PublishStep = 'reading' | 'committing' | 'branching' | 'opening';
export type PublishInput = { files: ExportFile[]; fileName: string; userName: string | null; now: Date };
export type PublishResult =
  | { kind: 'no-changes'; base: string }
  | { kind: 'opened'; number: number; url: string; branch: string };

type TreeEntry = { path: string; type: 'blob' | 'tree' | 'commit'; sha: string };

const MESSAGE = 'chore(tokens): export from Figma';

export function branchName(now: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  const date = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}`;
  const time = `${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
  return `styles/figma-export-${date}-${time}`;
}

export function prBody(input: Pick<PublishInput, 'fileName' | 'userName'>, files: { filename: string; status: string }[]): string {
  const lines = [
    `Exported from the Figma file **${input.fileName}** by ${input.userName ?? 'an unknown user'} with Export Design Tokens.`,
    '',
  ];
  const section = (label: string, statuses: string[]) => {
    const names = files.filter((file) => statuses.includes(file.status)).map((file) => `- \`${file.filename}\``);
    if (names.length > 0) {
      lines.push(`**${label}**`, ...names, '');
    }
  };
  section('Added', ['added']);
  section('Modified', ['modified', 'changed', 'renamed']);
  section('Removed', ['removed']);
  return `${lines.join('\n').trimEnd()}\n`;
}

async function listFolder(client: GitHubClient, repo: string, rootTree: string, folder: string): Promise<string[]> {
  let sha = rootTree;
  for (const segment of folder.split('/')) {
    const tree = await client.request<{ tree: TreeEntry[] }>('GET', `${repo}/git/trees/${sha}`);
    const entry = tree.tree.find((candidate) => candidate.path === segment && candidate.type === 'tree');
    if (!entry) {
      return [];
    }
    sha = entry.sha;
  }

  const listing = await client.request<{ tree: TreeEntry[]; truncated: boolean }>('GET', `${repo}/git/trees/${sha}?recursive=1`);
  if (listing.truncated) {
    throw new GitHubError(`The folder ${folder} has too many files to list.`, null);
  }
  return listing.tree.filter((entry) => entry.type === 'blob').map((entry) => `${folder}/${entry.path}`);
}

/**
 * Replaces the configured folder with the exported files in one commit on a new
 * branch and opens a pull request. Never deletes anything remote: if a later
 * step fails, the branch stays and the error names it.
 */
export async function publish(
  client: GitHubClient,
  rawSettings: RepoSettings,
  input: PublishInput,
  onStep: (step: PublishStep) => void = () => {},
): Promise<PublishResult> {
  const problems = validateSettings(rawSettings);
  if (problems.length > 0) {
    throw new GitHubError(problems[0], null);
  }
  const settings = normalizeSettings(rawSettings);
  const { owner, repo } = parseRepository(settings.repository)!;
  const r = `/repos/${owner}/${repo}`;
  const base = encodePath(settings.base);

  onStep('reading');
  const ref = await client.request<{ object: { sha: string } }>('GET', `${r}/git/ref/heads/${base}`);
  const baseCommit = await client.request<{ tree: { sha: string } }>('GET', `${r}/git/commits/${ref.object.sha}`);
  const existing = await listFolder(client, r, baseCommit.tree.sha, settings.folder);

  const exported = new Set(input.files.map((file) => `${settings.folder}/${file.path}`));
  const tree = [
    ...input.files.map((file) => ({ path: `${settings.folder}/${file.path}`, mode: '100644', type: 'blob', content: file.json })),
    ...existing.filter((path) => !exported.has(path)).map((path) => ({ path, mode: '100644', type: 'blob', sha: null })),
  ];

  onStep('committing');
  const newTree = await client.request<{ sha: string }>('POST', `${r}/git/trees`, { base_tree: baseCommit.tree.sha, tree });
  if (newTree.sha === baseCommit.tree.sha) {
    return { kind: 'no-changes', base: settings.base };
  }
  const commit = await client.request<{ sha: string }>('POST', `${r}/git/commits`, {
    message: MESSAGE,
    tree: newTree.sha,
    parents: [ref.object.sha],
  });

  onStep('branching');
  const branch = branchName(input.now);
  try {
    await client.request('POST', `${r}/git/refs`, { ref: `refs/heads/${branch}`, sha: commit.sha });
  } catch (error) {
    if (error instanceof GitHubError && error.status === 422) {
      throw new GitHubError('Branch already exists.', 422);
    }
    throw error;
  }

  onStep('opening');
  try {
    const compare = await client.request<{ files?: { filename: string; status: string }[] }>(
      'GET',
      `${r}/compare/${base}...${commit.sha}`,
    );
    const pr = await client.request<{ number: number; html_url: string }>('POST', `${r}/pulls`, {
      title: MESSAGE,
      head: branch,
      base: settings.base,
      body: prBody(input, compare.files ?? []),
    });
    return { kind: 'opened', number: pr.number, url: pr.html_url, branch };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new GitHubError(
      `Branch ${branch} was created, but opening the pull request failed: ${reason}`,
      error instanceof GitHubError ? error.status : null,
    );
  }
}
