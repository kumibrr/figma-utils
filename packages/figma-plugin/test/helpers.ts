import type { RGBA, Snapshot, SnapshotCollection, SnapshotValue, SnapshotVariable } from '../src/core/snapshot';

export const collection = (name: string, modes: string[], variableIds: string[] = []): SnapshotCollection => ({
  id: `c:${name}`,
  name,
  modes: modes.map((mode) => ({ id: `${name}:${mode}`, name: mode })),
  variableIds,
});

export const variable = (
  collectionName: string,
  name: string,
  resolvedType: SnapshotVariable['resolvedType'],
  values: Record<string, SnapshotValue>,
  extra: Partial<SnapshotVariable> = {},
): SnapshotVariable => ({
  id: `v:${collectionName}/${name}`,
  name,
  collectionId: `c:${collectionName}`,
  resolvedType,
  scopes: ['ALL_SCOPES'],
  description: '',
  codeSyntax: {},
  valuesByMode: Object.fromEntries(Object.entries(values).map(([mode, value]) => [`${collectionName}:${mode}`, value])),
  ...extra,
});

/** Fills each collection's variableIds from the variables, in order, when left empty. */
export const snapshot = (collections: SnapshotCollection[], variables: SnapshotVariable[]): Snapshot => ({
  fileName: 'Test file',
  userName: 'Ada',
  collections: collections.map((c) =>
    c.variableIds.length > 0 ? c : { ...c, variableIds: variables.filter((v) => v.collectionId === c.id).map((v) => v.id) },
  ),
  variables,
});

export const alias = (collectionName: string, name: string) => ({ aliasId: `v:${collectionName}/${name}` });

export const rgba = (r: number, g: number, b: number, a = 1): RGBA => ({ r, g, b, a });
