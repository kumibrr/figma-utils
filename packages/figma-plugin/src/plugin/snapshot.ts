import { isRgba } from '../core/color';
import { isAlias, isSnapshotError, type Alias, type ResolvedValue, type Snapshot, type SnapshotValue } from '../core/snapshot';

function isComposedColor(value: VariableValue): value is VariableComposedColor {
  return typeof value === 'object' && value !== null && ('color' in value || 'opacity' in value);
}

export function toSnapshotValue(value: Exclude<VariableValue, VariableComposedColor>): SnapshotValue {
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

/** Reads local variables and the values of library variables they reference. */
export async function readSnapshot(): Promise<Snapshot> {
  const [collections, variables] = await Promise.all([
    figma.variables.getLocalVariableCollectionsAsync(),
    figma.variables.getLocalVariablesAsync(),
  ]);
  const localCollections = new Map(collections.map((collection) => [collection.id, collection]));
  const localVariables = new Map(variables.map((variable) => [variable.id, variable]));
  const libraryVariables = new Map<string, Promise<Variable | null>>();
  const libraryCollections = new Map<string, Promise<VariableCollection | null>>();

  function getVariable(id: string) {
    const local = localVariables.get(id);
    if (local) return local;
    let lookup = libraryVariables.get(id);
    if (!lookup) {
      lookup = figma.variables.getVariableByIdAsync(id).catch(() => null);
      libraryVariables.set(id, lookup);
    }
    return lookup;
  }

  function getCollection(id: string) {
    const local = localCollections.get(id);
    if (local) return local;
    let lookup = libraryCollections.get(id);
    if (!lookup) {
      lookup = figma.variables.getVariableCollectionByIdAsync(id).catch(() => null);
      libraryCollections.set(id, lookup);
    }
    return lookup;
  }

  async function resolveAlias(
    id: string,
    source: Variable,
    sourceModeId: string,
    ancestors: ReadonlySet<string>,
  ): Promise<Alias['resolved']> {
    const visited = new Set(ancestors);
    while (!visited.has(id)) {
      visited.add(id);
      const variable = await getVariable(id);
      if (!variable) return;

      // Each export selects one local mode. Other collections use their default mode.
      const modeId = variable.variableCollectionId === source.variableCollectionId
        ? sourceModeId
        : (await getCollection(variable.variableCollectionId))?.defaultModeId;
      if (modeId === undefined) return;
      const raw = variable.valuesByMode[modeId];
      if (raw === undefined) return;

      if (isComposedColor(raw)) {
        return { value: await resolveComposedColor(raw, source, sourceModeId, visited), webCodeSyntax: variable.codeSyntax.WEB };
      }
      const value = toSnapshotValue(raw);
      if (!isAlias(value)) return { value, webCodeSyntax: variable.codeSyntax.WEB };
      id = value.aliasId;
    }
  }

  async function resolveComposedColor(
    raw: VariableComposedColor,
    source: Variable,
    sourceModeId: string,
    ancestors: ReadonlySet<string>,
  ): Promise<ResolvedValue> {
    async function resolveComponent(value: SnapshotValue, component: 'color' | 'color opacity'): Promise<ResolvedValue> {
      if (!isAlias(value)) return value;
      const resolved = await resolveAlias(value.aliasId, source, sourceModeId, ancestors);
      return resolved?.value ?? { error: `composed ${component} alias could not be resolved in Figma` };
    }

    const [color, opacity] = await Promise.all([
      resolveComponent(toSnapshotValue(raw.color), 'color'),
      resolveComponent(toSnapshotValue(raw.opacity), 'color opacity'),
    ]);
    if (isSnapshotError(color)) return color;
    if (!isRgba(color)) return { error: 'composed color requires valid RGB channels' };
    if (isSnapshotError(opacity)) return opacity;
    if (typeof opacity !== 'number' || !Number.isFinite(opacity) || opacity < 0 || opacity > 100) {
      return { error: 'composed color opacity must be a percentage from 0 to 100' };
    }
    return { r: color.r, g: color.g, b: color.b, a: opacity / 100 };
  }

  async function snapshotValues(variable: Variable): Promise<Record<string, SnapshotValue>> {
    const entries = await Promise.all(Object.entries(variable.valuesByMode).map(async ([modeId, raw]) => {
      if (isComposedColor(raw)) {
        return [modeId, await resolveComposedColor(raw, variable, modeId, new Set([variable.id]))] as const;
      }
      const value = toSnapshotValue(raw);
      if (!isAlias(value)) return [modeId, value] as const;

      const target = localVariables.get(value.aliasId);
      if (target && localCollections.has(target.variableCollectionId)) return [modeId, value] as const;

      const resolved = await resolveAlias(value.aliasId, variable, modeId, new Set([variable.id]));
      return [modeId, resolved ? { ...value, resolved } : value] as const;
    }));
    return Object.fromEntries(entries);
  }

  return {
    fileName: figma.root.name,
    userName: figma.currentUser?.name ?? null,
    collections: collections.map((collection) => ({
      id: collection.id,
      name: collection.name,
      modes: collection.modes.map((mode) => ({ id: mode.modeId, name: mode.name })),
      variableIds: [...collection.variableIds],
    })),
    variables: await Promise.all(variables.map(async (variable) => ({
      id: variable.id,
      name: variable.name,
      collectionId: variable.variableCollectionId,
      resolvedType: variable.resolvedType,
      scopes: [...variable.scopes],
      description: variable.description,
      codeSyntax: variable.codeSyntax.WEB ? { WEB: variable.codeSyntax.WEB } : {},
      valuesByMode: await snapshotValues(variable),
    }))),
  };
}
