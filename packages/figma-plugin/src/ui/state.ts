import type { BuildResult, ExportError } from '../core/build-export';
import { multipleFiles, singleFile, type ExportFile } from '../core/files';
import { ownersOf, reposOf, type Repo } from '../github/browse';
import type { PublishResult, PublishStep } from '../github/publish';
import { parseRepository, type RepoSettings } from '../github/settings';
import type { Destination } from '../shared/messages';

export type Format = 'multiple' | 'single';
export type Build = { status: 'loading' } | { status: 'ready'; result: BuildResult } | { status: 'failed'; message: string };
export type Banner = { kind: 'success'; text: string; url: string } | { kind: 'info'; text: string } | { kind: 'error'; text: string };

export const previewFiles = (result: BuildResult, format: Format): ExportFile[] =>
  format === 'single' ? [singleFile(result)] : multipleFiles(result);

/** The file with this path in a freshly built result, or null if it is no longer exported. */
export const freshFile = (result: BuildResult, format: Format, path: string): ExportFile | null =>
  previewFiles(result, format).find((file) => file.path === path) ?? null;

export type Blocker = 'loading' | 'failed' | 'errors' | 'empty' | 'publishing';

export function exportBlocker(build: Build, publishing: boolean): Blocker | null {
  if (publishing) return 'publishing';
  if (build.status === 'loading') return 'loading';
  if (build.status === 'failed') return 'failed';
  if (build.result.errors.length > 0) return 'errors';
  if (build.result.sets.length === 0) return 'empty';
  return null;
}

export type ExportAction =
  | { kind: 'open-settings' }
  | { kind: 'download-zip'; files: ExportFile[] }
  | { kind: 'download-file'; file: ExportFile }
  | { kind: 'publish'; files: ExportFile[] };

export function exportAction(input: {
  destination: Destination;
  format: Format;
  result: BuildResult;
  settings: RepoSettings | null;
  hasToken: boolean;
}): ExportAction {
  if (input.destination === 'github') {
    if (!input.settings || !input.hasToken) {
      return { kind: 'open-settings' };
    }
    return { kind: 'publish', files: multipleFiles(input.result) };
  }
  return input.format === 'single'
    ? { kind: 'download-file', file: singleFile(input.result) }
    : { kind: 'download-zip', files: multipleFiles(input.result) };
}

export function destinationLabel(destination: Destination, format: Format): string {
  if (destination === 'computer') {
    return 'Export to this computer';
  }
  return format === 'single' ? 'Export to GitHub repo (multiple files)' : 'Export to GitHub repo';
}

export const STEP_TEXT: Record<PublishStep, string> = {
  reading: 'Reading repository…',
  committing: 'Committing…',
  branching: 'Creating branch…',
  opening: 'Opening PR…',
};

export const resultBanner = (result: PublishResult): Banner =>
  result.kind === 'opened'
    ? { kind: 'success', text: `PR #${result.number} opened`, url: result.url }
    : { kind: 'info', text: `No changes vs ${result.base}` };

export const errorBanner = (error: unknown): Banner => ({
  kind: 'error',
  text: error instanceof Error ? error.message : String(error),
});

export function groupErrors(errors: ExportError[]): { collection: string; items: string[] }[] {
  const groups = new Map<string, string[]>();
  for (const error of errors) {
    const subject = error.variable
      ? `${error.variable}${error.mode ? ` (${error.mode})` : ''}`
      : error.mode
        ? `(mode ${error.mode})`
        : '(collection)';
    groups.set(error.collection, [...(groups.get(error.collection) ?? []), `${subject} — ${error.reason}`]);
  }
  return [...groups].map(([collection, items]) => ({ collection, items }));
}

export type TokenField = { mode: 'saved' } | { mode: 'entering'; draft: string; canCancel: boolean };

export const initialTokenField = (hasToken: boolean): TokenField =>
  hasToken ? { mode: 'saved' } : { mode: 'entering', draft: '', canCancel: false };

/** Replacing shows an empty field; the saved token stays until a new one is submitted. */
export const startReplace = (): TokenField => ({ mode: 'entering', draft: '', canCancel: true });

export const cancelReplace = (): TokenField => ({ mode: 'saved' });

export const tokenToSave = (field: TokenField): string | null =>
  field.mode === 'entering' && field.draft.trim() !== '' ? field.draft.trim() : null;

export const isNewBranch = (branches: string[], input: string): boolean =>
  input.trim() !== '' && !branches.includes(input.trim());

export type Pick = { owner: string | null; repo: string | null; missing: string | null };

/**
 * What the pickers start with: the saved repository when the token still reaches it,
 * otherwise whatever is the only choice. A saved repository that is gone keeps its
 * owner (when listed) and leaves the repository for the user to pick.
 */
export function initialPick(repos: Repo[], saved: RepoSettings | null): Pick {
  const owners = ownersOf(repos);
  const only = <T>(items: T[]) => (items.length === 1 ? items[0] : null);

  if (saved) {
    const parsed = parseRepository(saved.repository);
    const hit = parsed && reposOf(repos, parsed.owner).find((repo) => repo.name === parsed.repo);
    if (hit) {
      return { owner: hit.owner, repo: hit.name, missing: null };
    }
    const owner = parsed && owners.includes(parsed.owner) ? parsed.owner : only(owners);
    return { owner, repo: null, missing: saved.repository.trim() };
  }

  const owner = only(owners);
  return { owner, repo: owner ? (only(reposOf(repos, owner))?.name ?? null) : null, missing: null };
}
