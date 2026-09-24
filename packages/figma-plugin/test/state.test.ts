import { describe, expect, it } from 'vitest';

import { buildExport } from '../src/core/build-export';
import {
  cancelReplace,
  destinationLabel,
  errorBanner,
  exportAction,
  exportBlocker,
  freshFile,
  groupErrors,
  initialPick,
  initialTokenField,
  isNewBranch,
  previewFiles,
  resultBanner,
  startReplace,
  STEP_TEXT,
  tokenToSave,
} from '../src/ui/state';
import type { Repo } from '../src/github/browse';
import { collection, rgba, snapshot, variable } from './helpers';

const result = buildExport(
  snapshot([collection('primitives', ['Mode 1'])], [variable('primitives', 'gray/900', 'COLOR', { 'Mode 1': rgba(0, 0, 0) })]),
);
const settings = { repository: 'acme/ui', base: 'main', folder: 'tokens' };

describe('previewFiles', () => {
  it('lists the files of the chosen format', () => {
    expect(previewFiles(result, 'multiple').map((file) => file.path)).toEqual(['primitives.json', '$themes.json']);
    expect(previewFiles(result, 'single').map((file) => file.path)).toEqual(['tokens.json']);
  });
});

describe('exportBlocker', () => {
  it('blocks while loading, publishing, on errors and when empty', () => {
    expect(exportBlocker({ status: 'loading' }, false)).toBe('loading');
    expect(exportBlocker({ status: 'failed', message: 'x' }, false)).toBe('failed');
    expect(exportBlocker({ status: 'ready', result }, true)).toBe('publishing');
    expect(exportBlocker({ status: 'ready', result: { ...result, errors: [{ collection: 'a', reason: 'b' }] } }, false)).toBe('errors');
    expect(exportBlocker({ status: 'ready', result: { sets: [], themes: [], errors: [] } }, false)).toBe('empty');
    expect(exportBlocker({ status: 'ready', result }, false)).toBeNull();
  });
});

describe('exportAction', () => {
  it('opens settings when GitHub is not configured', () => {
    expect(exportAction({ destination: 'github', format: 'multiple', result, settings: null, hasToken: true })).toEqual({ kind: 'open-settings' });
    expect(exportAction({ destination: 'github', format: 'multiple', result, settings, hasToken: false })).toEqual({ kind: 'open-settings' });
  });

  it('always publishes multiple files, whatever the toggle says', () => {
    const action = exportAction({ destination: 'github', format: 'single', result, settings, hasToken: true });

    expect(action.kind).toBe('publish');
    expect(action.kind === 'publish' && action.files.map((file) => file.path)).toEqual(['primitives.json', '$themes.json']);
  });

  it('downloads a zip or a single file for this computer', () => {
    expect(exportAction({ destination: 'computer', format: 'multiple', result, settings: null, hasToken: false }).kind).toBe('download-zip');
    expect(exportAction({ destination: 'computer', format: 'single', result, settings: null, hasToken: false })).toMatchObject({
      kind: 'download-file',
      file: { path: 'tokens.json' },
    });
  });
});

describe('labels and banners', () => {
  it('labels destinations, noting multiple files for GitHub in single-file mode', () => {
    expect(destinationLabel('github', 'multiple')).toBe('Export to GitHub repo');
    expect(destinationLabel('github', 'single')).toBe('Export to GitHub repo (multiple files)');
    expect(destinationLabel('computer', 'single')).toBe('Export to this computer');
  });

  it('describes each publish step', () => {
    expect(STEP_TEXT).toEqual({
      reading: 'Reading repository…',
      committing: 'Committing…',
      branching: 'Creating branch…',
      opening: 'Opening PR…',
    });
  });

  it('turns results and errors into banners', () => {
    expect(resultBanner({ kind: 'opened', number: 42, url: 'u', branch: 'b' })).toEqual({ kind: 'success', text: 'PR #42 opened', url: 'u' });
    expect(resultBanner({ kind: 'no-changes', base: 'main' })).toEqual({ kind: 'info', text: 'No changes vs main' });
    expect(errorBanner(new Error('GitHub rejected the token.'))).toEqual({ kind: 'error', text: 'GitHub rejected the token.' });
  });
});

describe('groupErrors', () => {
  it('groups by collection in first-seen order', () => {
    expect(
      groupErrors([
        { collection: 'b', variable: 'x', reason: 'r1' },
        { collection: 'a', variable: 'y', mode: 'dark', reason: 'r2' },
        { collection: 'b', mode: '..', reason: 'r3' },
      ]),
    ).toEqual([
      { collection: 'b', items: ['x — r1', '(mode ..) — r3'] },
      { collection: 'a', items: ['y (dark) — r2'] },
    ]);
  });
});

describe('token field', () => {
  it('shows "saved" when a token exists and an input otherwise', () => {
    expect(initialTokenField(true)).toEqual({ mode: 'saved' });
    expect(initialTokenField(false)).toEqual({ mode: 'entering', draft: '', canCancel: false });
  });

  it('replacing starts empty, can be cancelled, and only a non-empty draft is saved', () => {
    expect(startReplace()).toEqual({ mode: 'entering', draft: '', canCancel: true });
    expect(cancelReplace()).toEqual({ mode: 'saved' });
    expect(tokenToSave({ mode: 'saved' })).toBeNull();
    expect(tokenToSave({ mode: 'entering', draft: '   ', canCancel: true })).toBeNull();
    expect(tokenToSave({ mode: 'entering', draft: ' github_pat_x ', canCancel: true })).toBe('github_pat_x');
  });
});

describe('freshFile', () => {
  it('finds the file by path in a freshly built result', () => {
    expect(freshFile(result, 'multiple', 'primitives.json')?.json).toBe(previewFiles(result, 'multiple')[0].json);
    expect(freshFile(result, 'single', 'tokens.json')?.path).toBe('tokens.json');
  });

  it('returns null when the file is no longer exported', () => {
    expect(freshFile(result, 'multiple', 'semantic/theme/light.json')).toBeNull();
  });
});

describe('isNewBranch', () => {
  it('is true only for a non-empty name that is not an existing branch', () => {
    expect(isNewBranch(['main', 'dev'], ' main ')).toBe(false);
    expect(isNewBranch(['main', 'dev'], '   ')).toBe(false);
    expect(isNewBranch(['main', 'dev'], 'release')).toBe(true);
  });
});

describe('initialPick', () => {
  const repo = (owner: string, name: string, canPush = true): Repo => ({
    owner,
    name,
    fullName: `${owner}/${name}`,
    defaultBranch: 'main',
    canPush,
  });
  const repos = [repo('acme', 'ui'), repo('acme', 'web'), repo('ada', 'site'), repo('ada', 'old', false)];

  it('pre-selects the saved repository', () => {
    expect(initialPick(repos, settings)).toEqual({ owner: 'acme', repo: 'ui', missing: null });
  });

  it('keeps the owner and reports a saved repository that is not available', () => {
    expect(initialPick(repos, { ...settings, repository: 'acme/gone' })).toEqual({ owner: 'acme', repo: null, missing: 'acme/gone' });
    expect(initialPick(repos, { ...settings, repository: 'ada/old' })).toEqual({ owner: 'ada', repo: null, missing: 'ada/old' });
    expect(initialPick(repos, { ...settings, repository: 'zed/x' })).toEqual({ owner: null, repo: null, missing: 'zed/x' });
  });

  it('auto-selects a single owner and a single pushable repository', () => {
    expect(initialPick([repo('ada', 'site'), repo('ada', 'old', false)], null)).toEqual({ owner: 'ada', repo: 'site', missing: null });
    expect(initialPick([repo('acme', 'ui'), repo('acme', 'web')], null)).toEqual({ owner: 'acme', repo: null, missing: null });
  });

  it('selects nothing when there is a choice to make', () => {
    expect(initialPick(repos, null)).toEqual({ owner: null, repo: null, missing: null });
    expect(initialPick([], null)).toEqual({ owner: null, repo: null, missing: null });
  });
});
