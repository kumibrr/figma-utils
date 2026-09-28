import type { Snapshot } from '../core/snapshot';
import type { RepoSettings } from '../github/settings';

export type Destination = 'github' | 'computer';

export type ScopeChange = { variableId: string; scopes: string[] };

/** `canEdit` is false in Dev Mode, where the plugin can read the file but not change it. */
export type Prefs = { settings: RepoSettings | null; hasToken: boolean; destination: Destination; canEdit: boolean };

/** Everything the UI can ask the main thread to do. */
export interface Methods {
  getSnapshot(): Snapshot;
  /** Returns how many variables were changed. */
  applyScopes(changes: ScopeChange[]): number;
  getPrefs(): Prefs;
  saveSettings(settings: RepoSettings): void;
  saveToken(token: string): void;
  getToken(): string | null;
  saveDestination(destination: Destination): void;
  openUrl(url: string): void;
  close(): void;
}

export type MethodName = keyof Methods;

export type RpcRequest = {
  [K in MethodName]: { rpc: 'request'; id: number; method: K; params: Parameters<Methods[K]> };
}[MethodName];

export type RpcResponse = { rpc: 'response'; id: number; result?: unknown; error?: string };
