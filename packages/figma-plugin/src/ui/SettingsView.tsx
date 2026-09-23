import { useState } from 'preact/hooks';

import { createClient } from '../github/client';
import { checkSettings, normalizeSettings, validateSettings, type RepoSettings } from '../github/settings';
import type { Prefs } from '../shared/messages';
import { call } from './rpc';
import { cancelReplace, errorBanner, initialTokenField, startReplace, tokenToSave, type TokenField } from './state';

const TOKEN_HELP_URL = 'https://github.com/settings/personal-access-tokens/new';
const DEFAULTS: RepoSettings = { repository: '', base: 'main', folder: 'tokens' };

type Props = { prefs: Prefs; onPrefs: (prefs: Prefs) => void; onDone: () => void };
type Status = { kind: 'idle' } | { kind: 'checking' } | { kind: 'error'; messages: string[] };

export function SettingsView({ prefs, onPrefs, onDone }: Props) {
  const [form, setForm] = useState<RepoSettings>(prefs.settings ?? DEFAULTS);
  const [token, setToken] = useState<TokenField>(initialTokenField(prefs.hasToken));
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const update = (key: keyof RepoSettings) => (event: Event) =>
    setForm({ ...form, [key]: (event.currentTarget as HTMLInputElement).value });

  async function onSave(event: Event) {
    event.preventDefault();
    const problems = validateSettings(form);
    const newToken = tokenToSave(token);
    if (!newToken && !prefs.hasToken) {
      problems.push('Enter a token.');
    }
    if (problems.length > 0) {
      setStatus({ kind: 'error', messages: problems });
      return;
    }

    setStatus({ kind: 'checking' });
    const settings = normalizeSettings(form);
    await call('saveSettings', settings);
    if (newToken) {
      await call('saveToken', newToken);
      setToken({ mode: 'saved' });
    }
    const next: Prefs = { ...prefs, settings, hasToken: true };
    onPrefs(next);

    try {
      const stored = await call('getToken');
      await checkSettings(createClient(stored ?? ''), settings);
      onDone();
    } catch (error) {
      setStatus({ kind: 'error', messages: [errorBanner(error).text] });
    }
  }

  return (
    <form class="view" onSubmit={(event) => void onSave(event)}>
      <header class="header">
        <h1 class="header__title">GitHub settings</h1>
      </header>

      <label class="field">
        <span>Repository</span>
        <input value={form.repository} placeholder="owner/repo" onInput={update('repository')} />
      </label>
      <label class="field">
        <span>Base branch</span>
        <input value={form.base} onInput={update('base')} />
      </label>
      <label class="field">
        <span>Folder</span>
        <input value={form.folder} onInput={update('folder')} />
      </label>

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
            <input
              type="password"
              autocomplete="off"
              value={token.draft}
              placeholder="github_pat_…"
              onInput={(event) => setToken({ ...token, draft: (event.currentTarget as HTMLInputElement).value })}
            />
            <p class="hint">
              Create a fine-grained token with <b>Contents</b> and <b>Pull requests</b> set to read and write for this
              repository.{' '}
              <button type="button" class="link" onClick={() => void call('openUrl', TOKEN_HELP_URL)}>
                Create a token
              </button>
            </p>
            {token.canCancel && (
              <button type="button" class="link" onClick={() => setToken(cancelReplace())}>
                Keep the saved token
              </button>
            )}
          </>
        )}
      </div>

      {status.kind === 'error' && (
        <ul class="banner banner--error" role="alert">
          {status.messages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}

      <footer class="footer">
        <button type="button" class="button button--secondary" onClick={onDone}>
          Back
        </button>
        <button type="submit" class="button button--primary" disabled={status.kind === 'checking'}>
          {status.kind === 'checking' ? 'Checking…' : 'Save'}
        </button>
      </footer>
    </form>
  );
}
