import { deriveThemes } from 'css-to-dtcg/themes';

import { invalidNameReason, invalidSetPathReason, nest, setPath, tokenPath, type Tree } from './sets';
import { isAlias, type Snapshot, type SnapshotCollection } from './snapshot';
import { toToken } from './tokens';

export type ExportError = { collection: string; variable?: string; mode?: string; reason: string };
export type BuiltSet = { name: string; tree: Tree };
export type Theme = { name: string; group: string; selectedTokenSets: Record<string, 'source' | 'enabled'> };
export type BuildResult = { sets: BuiltSet[]; themes: Theme[]; errors: ExportError[] };

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const lastSegment = (name: string) => name.split('/').at(-1) ?? name;

/** Keeps the first occurrence of each distinct error, in order. */
function dedupe(errors: ExportError[]): ExportError[] {
  const seen = new Set<string>();
  return errors.filter((error) => {
    const key = JSON.stringify([error.collection, error.variable, error.mode, error.reason]);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function buildExport(snapshot: Snapshot): BuildResult {
  const errors: ExportError[] = [];
  const collections = new Map(snapshot.collections.map((collection) => [collection.id, collection]));
  const variables = new Map(snapshot.variables.map((variable) => [variable.id, variable]));

  const pathOf = (variableId: string) => {
    const variable = variables.get(variableId);
    const collection = variable && collections.get(variable.collectionId);
    return variable && collection ? tokenPath(collection.name, variable.name) : undefined;
  };
  const setsOf = (collection: SnapshotCollection) => collection.modes.map((mode) => setPath(collection, mode.name));

  const sets: BuildResult['sets'] = [];
  const themeInputs: { name: string; group?: string; themeName: string; references: string[] }[] = [];
  const producedBy = new Map<string, string>();
  const groupOwner = new Map<string, string>();

  for (const collection of snapshot.collections) {
    const multiMode = collection.modes.length > 1;
    const group = multiMode ? capitalize(lastSegment(collection.name)) : undefined;

    if (group) {
      const owner = groupOwner.get(group);
      if (owner) {
        errors.push({
          collection: collection.name,
          reason: `would share the theme group "${group}" with collection "${owner}"; rename one of them`,
        });
      } else {
        groupOwner.set(group, collection.name);
      }
    }

    for (const mode of collection.modes) {
      const name = setPath(collection, mode.name);

      const unsafe = invalidSetPathReason(name);
      if (unsafe) {
        errors.push({ collection: collection.name, mode: multiMode ? mode.name : undefined, reason: unsafe });
        continue;
      }
      if (producedBy.has(name)) {
        errors.push({
          collection: collection.name,
          mode: multiMode ? mode.name : undefined,
          reason: `produces the set "${name}", which collection "${producedBy.get(name)}" also produces`,
        });
        continue;
      }
      producedBy.set(name, collection.name);

      const tree: Tree = {};
      const references = new Set<string>();

      for (const variableId of collection.variableIds) {
        const variable = variables.get(variableId);
        if (!variable) {
          continue;
        }

        const path = tokenPath(collection.name, variable.name);
        const badName = invalidNameReason(path);
        if (badName) {
          errors.push({ collection: collection.name, variable: variable.name, reason: badName });
          continue;
        }

        const value = variable.valuesByMode[mode.id];
        if (value === undefined) {
          errors.push({ collection: collection.name, variable: variable.name, mode: mode.name, reason: 'has no value for this mode' });
          continue;
        }

        const result = toToken(variable, value, pathOf);
        if (!result.ok) {
          errors.push({
            collection: collection.name,
            variable: variable.name,
            mode: result.perMode ? mode.name : undefined,
            reason: result.reason,
          });
          continue;
        }

        if (!nest(tree, path, result.token)) {
          errors.push({
            collection: collection.name,
            variable: variable.name,
            reason: `${path.join('.')} collides with another token or group`,
          });
          continue;
        }

        if (isAlias(value)) {
          const target = variables.get(value.aliasId);
          const targetCollection = target && collections.get(target.collectionId);
          if (targetCollection && targetCollection.id !== collection.id) {
            for (const setName of setsOf(targetCollection)) {
              references.add(setName);
            }
          }
        }
      }

      sets.push({ name, tree });
      themeInputs.push({
        name,
        group,
        themeName: mode.name,
        references: [...references],
      });
    }
  }

  return { sets, themes: deriveThemes(themeInputs) as Theme[], errors: dedupe(errors) };
}
