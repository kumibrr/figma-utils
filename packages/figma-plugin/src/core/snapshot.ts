/** A plain, serializable copy of what the plugin reads from Figma. */
export type RGBA = { r: number; g: number; b: number; a: number };
export type Alias = { aliasId: string };
export type SnapshotValue = RGBA | number | string | boolean | Alias;

export type SnapshotMode = { id: string; name: string };

export type SnapshotCollection = {
  id: string;
  name: string;
  modes: SnapshotMode[];
  /** Figma order. */
  variableIds: string[];
};

export type SnapshotVariable = {
  id: string;
  name: string;
  collectionId: string;
  /** Figma keeps adding types (e.g. EASING); unknown ones are reported as unsupported. */
  resolvedType: 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN' | (string & {});
  scopes: string[];
  description: string;
  codeSyntax: { WEB?: string };
  valuesByMode: Record<string, SnapshotValue>;
};

export type Snapshot = {
  fileName: string;
  userName: string | null;
  /** Figma order. */
  collections: SnapshotCollection[];
  variables: SnapshotVariable[];
};

export const isAlias = (value: SnapshotValue): value is Alias =>
  typeof value === 'object' && value !== null && 'aliasId' in value;
