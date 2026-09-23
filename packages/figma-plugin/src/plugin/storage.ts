import type { RepoSettings } from '../github/settings';
import type { Destination, Prefs } from '../shared/messages';

const KEYS = { settings: 'github-settings', token: 'github-token', destination: 'destination' } as const;

export async function loadPrefs(): Promise<Prefs> {
  const [settings, token, destination] = await Promise.all([
    figma.clientStorage.getAsync(KEYS.settings),
    figma.clientStorage.getAsync(KEYS.token),
    figma.clientStorage.getAsync(KEYS.destination),
  ]);

  return {
    settings: (settings as RepoSettings | undefined) ?? null,
    hasToken: typeof token === 'string' && token !== '',
    destination: destination === 'computer' ? 'computer' : 'github',
  };
}

export const saveSettings = (settings: RepoSettings) => figma.clientStorage.setAsync(KEYS.settings, settings);

/** Overwrites the stored token. The token is never sent to the UI except for GitHub calls. */
export const saveToken = (token: string) => figma.clientStorage.setAsync(KEYS.token, token);

export async function loadToken(): Promise<string | null> {
  const token = await figma.clientStorage.getAsync(KEYS.token);
  return typeof token === 'string' && token !== '' ? token : null;
}

export const saveDestination = (destination: Destination) => figma.clientStorage.setAsync(KEYS.destination, destination);
