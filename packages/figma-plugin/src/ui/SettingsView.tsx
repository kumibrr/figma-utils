import { useEffect, useRef, useState } from 'preact/hooks';

import { createBranch, listBranches, listRepos, ownersOf, reposOf, type Repo } from '../github/browse';
import { createClient, type GitHubClient } from '../github/client';
import { checkSettings, normalizeSettings, validateSettings } from '../github/settings';
import type { Prefs } from '../shared/messages';
import { Spinner } from './icons';
import { call } from './rpc';
import {
  cancelReplace,
  errorBanner,
  initialPick,
  initialTokenField,
  isNewBranch,
  startReplace,
  tokenToSave,
  type TokenField,
} from './state';

const TOKEN_HELP_URL = 'https://github.com/settings/personal-access-tokens/new';

type Props = { prefs: Prefs; onPrefs: (prefs: Prefs) => void; onDone: () => void };
type List<T> = { kind: 'idle' } | { kind: 'loading' } | { kind: 'ready'; items: T[] } | { kind: 'error'; message: string };
type Status = { kind: 'idle' } | { kind: 'checking' } | { kind: 'error'; messages: string[] };

const message = (error: unknown) => errorBanner(error).text;

export function SettingsView({ prefs, onPrefs, onDone }: Props) {
  const [token, setToken] = useState<TokenField>(initialTokenField(prefs.hasToken));
  const [repos, setRepos] = useState<List<Repo>>({ kind: 'idle' });
  const [owner, setOwner] = useState<string | null>(null);
  const [repo, setRepo] = useState<string | null>(null);
  const [missing, setMissing] = useState<string | null>(null);
  const [branches, setBranches] = useState<List<string>>({ kind: 'idle' });
  const [base, setBase] = useState(prefs.settings?.base ?? '');
  const [folder, setFolder] = useState(prefs.settings?.folder ?? 'tokens');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const client = useRef<GitHubClient | null>(null);
  // Only the latest branch request may update the list.
  const branchRequest = useRef(0);

  const repoList = repos.kind === 'ready' ? repos.items : [];
  const owners = ownersOf(repoList);
  const ownerRepos = owner ? reposOf(repoList, owner) : [];
  const selected = ownerRepos.find((candidate) => candidate.name === repo) ?? null;
  const branchNames = branches.kind === 'ready' ? branches.items : [];
  const locked = token.mode === 'entering' || repos.kind !== 'ready';

  function onRepo(name: string) {
    setRepo(name);
    setMissing(null);
    const target = ownerRepos.find((candidate) => candidate.name === name);
    if (target) {
      setBase(target.defaultBranch);
      void loadBranches(target);
    }
  }

  async function loadBranches(target: Repo) {
    const request = ++branchRequest.current;
    setBranches({ kind: 'loading' });
    try {
      const items = await listBranches(client.current!, target.owner, target.name);
      if (request === branchRequest.current) setBranches({ kind: 'ready', items });
    } catch (error) {
      if (request === branchRequest.current) setBranches({ kind: 'error', message: message(error) });
    }
  }

  /** Lists repositories with `token` and picks up the current (or saved) choices. */
  async function loadRepos(token: string): Promise<boolean> {
    setRepos({ kind: 'loading' });
    const next = createClient(token);
    try {
      const items = await listRepos(next);
      client.current = next;
      setRepos({ kind: 'ready', items });

      const current = owner && repo ? { repository: `${owner}/${repo}`, base, folder } : prefs.settings;
      const pick = initialPick(items, current);
      setOwner(pick.owner);
      setMissing(pick.missing);
      const target = items.find((candidate) => candidate.owner === pick.owner && candidate.name === pick.repo) ?? null;
      setRepo(target?.name ?? null);
      if (target) {
        setBase(pick.missing === null && current ? current.base : target.defaultBranch);
        void loadBranches(target);
      } else {
        setBranches({ kind: 'idle' });
      }
      return true;
    } catch (error) {
      setRepos({ kind: 'error', message: message(error) });
      return false;
    }
  }

  useEffect(() => {
    if (prefs.hasToken) {
      void call('getToken').then((stored) => {
        if (stored) void loadRepos(stored);
        else setToken(initialTokenField(false));
      });
    }
  }, []);

  async function onContinue() {
    const draft = tokenToSave(token);
    if (!draft) {
      setRepos({ kind: 'error', message: 'Enter a token.' });
      return;
    }
    if (await loadRepos(draft)) {
      await call('saveToken', draft);
      onPrefs({ ...prefs, hasToken: true });
      setToken({ mode: 'saved' });
    }
  }

  function onKeepToken() {
    setToken(cancelReplace());
    // The previous lists are still in state unless the rejected draft replaced them.
    if (repos.kind !== 'ready') {
      void call('getToken').then((stored) => {
        if (stored) void loadRepos(stored);
      });
    }
  }

  function onOwner(value: string) {
    setOwner(value);
    setMissing(null);
    const list = reposOf(repoList, value);
    const only = list.length === 1 ? list[0] : null;
    setRepo(only?.name ?? null);
    if (only) {
      setBase(only.defaultBranch);
      void loadBranches(only);
    } else {
      branchRequest.current++;
      setBranches({ kind: 'idle' });
    }
  }

  async function onSave(event: Event) {
    event.preventDefault();
    if (locked || !owner || !selected) {
      setStatus({ kind: 'error', messages: ['Pick a repository.'] });
      return;
    }
    const settings = normalizeSettings({ repository: `${owner}/${selected.name}`, base, folder });
    const problems = validateSettings(settings);
    if (problems.length > 0) {
      setStatus({ kind: 'error', messages: problems });
      return;
    }

    setStatus({ kind: 'checking' });
    try {
      if (isNewBranch(branchNames, settings.base)) {
        await createBranch(client.current!, owner, selected.name, settings.base, selected.defaultBranch);
      }
      await call('saveSettings', settings);
      onPrefs({ ...prefs, settings, hasToken: true });
      await checkSettings(client.current!, settings);
      onDone();
    } catch (error) {
      setStatus({ kind: 'error', messages: [message(error)] });
    }
  }

  return (
    <form class="view" onSubmit={(event) => void onSave(event)}>
      <header class="header">
        <h1 class="header__title">GitHub settings</h1>
      </header>

      <div class="settings">
        <div class="field">
          <span>Token</span>
          {token.mode === 'saved' ? (
            <div class="token-saved">
              <span class="muted">Token saved</span>
              <button type="button" class="button button--secondary" onClick={() => setToken(startReplace())}>
                Replace token
              </button>
            </div>
          ) : (
            <>
              <div class="field__row">
                <input
                  type="password"
                  autocomplete="off"
                  value={token.draft}
                  placeholder="github_pat_…"
                  onInput={(event) => setToken({ ...token, draft: (event.currentTarget as HTMLInputElement).value })}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      void onContinue();
                    }
                  }}
                />
                <button
                  type="button"
                  class="button button--secondary"
                  disabled={repos.kind === 'loading'}
                  onClick={() => void onContinue()}
                >
                  Continue
                </button>
              </div>
              <p class="hint">
                Create a fine-grained token with <b>Contents</b> and <b>Pull requests</b> set to read and write. A token
                belongs to one owner: for an organization's repositories, pick the organization as the resource owner.{' '}
                <button type="button" class="link" onClick={() => void call('openUrl', TOKEN_HELP_URL)}>
                  Create a token
                </button>
              </p>
              {token.canCancel && (
                <button type="button" class="link field__link" onClick={onKeepToken}>
                  Keep the saved token
                </button>
              )}
            </>
          )}
          {repos.kind === 'loading' && (
            <p class="hint">
              <Spinner /> Loading repositories…
            </p>
          )}
          {repos.kind === 'error' && <p class="danger">{repos.message}</p>}
        </div>

        <label class="field">
          <span>Owner</span>
          <select value={owner ?? ''} disabled={locked} onChange={(event) => onOwner((event.currentTarget as HTMLSelectElement).value)}>
            <option value="" disabled>
              {repos.kind === 'ready' && owners.length === 0 ? 'No repositories' : 'Choose an owner'}
            </option>
            {owners.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <div class="field">
          <label class="field">
            <span>Repository</span>
            <select
              value={repo ?? ''}
              disabled={locked || !owner || ownerRepos.length === 0}
              onChange={(event) => onRepo((event.currentTarget as HTMLSelectElement).value)}
            >
              <option value="" disabled>
                Choose a repository
              </option>
              {ownerRepos.map((candidate) => (
                <option key={candidate.name} value={candidate.name}>
                  {candidate.name}
                </option>
              ))}
            </select>
          </label>
          {!locked && owner && ownerRepos.length === 0 && (
            <p class="danger">The token can't push to any repository of {owner}.</p>
          )}
          {!locked && missing && <p class="danger">{missing} isn't available with this token — pick a repository.</p>}
        </div>

        <div class="field">
          <label class="field">
            <span>Base branch</span>
            <input
              list="branches"
              value={base}
              disabled={locked || !selected}
              onInput={(event) => setBase((event.currentTarget as HTMLInputElement).value)}
            />
          </label>
          <datalist id="branches">
            {branchNames.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
          {!locked && selected && branches.kind === 'loading' && (
            <p class="hint">
              <Spinner /> Loading branches…
            </p>
          )}
          {!locked && selected && branches.kind === 'error' && <p class="danger">{branches.message}</p>}
          {!locked && selected && branches.kind === 'ready' && isNewBranch(branchNames, base) && (
            <p class="hint">
              New branch — will be created from <b>{selected.defaultBranch}</b>.
            </p>
          )}
        </div>

        <label class="field">
          <span>Folder</span>
          <input value={folder} disabled={locked || !selected} onInput={(event) => setFolder((event.currentTarget as HTMLInputElement).value)} />
        </label>
      </div>

      {status.kind === 'error' && (
        <ul class="banner banner--error" role="alert">
          {status.messages.map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ul>
      )}

      <footer class="footer">
        <button type="button" class="button button--secondary" onClick={onDone}>
          Back
        </button>
        <button type="submit" class="button button--primary" disabled={status.kind === 'checking' || locked || !selected}>
          {status.kind === 'checking' ? 'Checking…' : 'Save'}
        </button>
      </footer>
    </form>
  );
}
