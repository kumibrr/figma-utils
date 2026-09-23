import type { Snapshot, SnapshotValue } from '../core/snapshot';

export function toSnapshotValue(value: VariableValue): SnapshotValue {
  if (typeof value === 'object' && value !== null) {
    if ('type' in value && value.type === 'VARIABLE_ALIAS') {
      return { aliasId: value.id };
    }
    if ('r' in value) {
      return { r: value.r, g: value.g, b: value.b, a: 'a' in value ? value.a : 1 };
    }
  }
  return value as SnapshotValue;
}

/** Reads the current file's local variables. The only place that reads figma.variables. */
export async function readSnapshot(): Promise<Snapshot> {
  const [collections, variables] = await Promise.all([
    figma.variables.getLocalVariableCollectionsAsync(),
    figma.variables.getLocalVariablesAsync(),
  ]);

  return {
    fileName: figma.root.name,
    userName: figma.currentUser?.name ?? null,
    collections: collections.map((collection) => ({
      id: collection.id,
      name: collection.name,
      modes: collection.modes.map((mode) => ({ id: mode.modeId, name: mode.name })),
      variableIds: [...collection.variableIds],
    })),
    variables: variables.map((variable) => ({
      id: variable.id,
      name: variable.name,
      collectionId: variable.variableCollectionId,
      resolvedType: variable.resolvedType,
      scopes: [...variable.scopes],
      description: variable.description,
      codeSyntax: variable.codeSyntax.WEB ? { WEB: variable.codeSyntax.WEB } : {},
      valuesByMode: Object.fromEntries(
        Object.entries(variable.valuesByMode).map(([modeId, value]) => [modeId, toSnapshotValue(value)]),
      ),
    })),
  };
}
