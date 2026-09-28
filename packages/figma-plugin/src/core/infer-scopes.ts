import { SIZE_SCOPES } from 'css-to-dtcg/scopes';

import { isAlias, type Snapshot, type SnapshotVariable } from './snapshot';

export type ScopeKind = 'fontWeight' | 'size' | 'fontFamily';

/** A scope the plugin can set on a variable so it exports; `because` says what gave it away. */
export type ScopeFix = {
  variableId: string;
  collection: string;
  variable: string;
  kind: ScopeKind;
  scopes: string[];
  because: string;
};

const SCOPES: Record<ScopeKind, string[]> = { fontWeight: ['FONT_WEIGHT'], size: SIZE_SCOPES, fontFamily: ['FONT_FAMILY'] };

const WEIGHT = /weight/i;
const FAMILY = /famil|font/i;
// A CSS font stack ends with a generic family, e.g. `'Roboto Slab', serif`.
const FONT_STACK = /(^|,)\s*(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-serif|ui-sans-serif|ui-monospace)\s*$/i;

const isWeightValue = (value: number) => Number.isInteger(value) && value >= 100 && value <= 900 && value % 100 === 0;

/** True when tokenType would refuse the variable only because of its scopes. */
export function needsScope(variable: SnapshotVariable): boolean {
  const { resolvedType, scopes } = variable;
  if (resolvedType === 'FLOAT') {
    return scopes.length === 0 || scopes.includes('ALL_SCOPES');
  }
  if (resolvedType === 'STRING') {
    return !scopes.includes('FONT_FAMILY') && !scopes.includes('FONT_STYLE');
  }
  return false;
}

/**
 * Suggests a scope for every number and string variable that can't export without one,
 * in Figma order. A string is only suggested Font family when something points to a font;
 * a number is a weight when its name, Web code syntax, aliases or values say so, else a size.
 */
export function inferScopes(snapshot: Snapshot): ScopeFix[] {
  const variables = new Map(snapshot.variables.map((variable) => [variable.id, variable]));
  const inferred = new Map<string, { kind: ScopeKind; because: string } | null>();
  const visiting = new Set<string>();

  /** The kind a variable has, or would have once its suggested scope is applied. */
  function kindOf(variable: SnapshotVariable): ScopeKind | null {
    if (!needsScope(variable)) {
      if (variable.resolvedType === 'FLOAT') return variable.scopes.includes('FONT_WEIGHT') ? 'fontWeight' : 'size';
      if (variable.resolvedType === 'STRING' && variable.scopes.includes('FONT_FAMILY')) return 'fontFamily';
      return null;
    }
    return infer(variable)?.kind ?? null;
  }

  /** What every alias in the variable points to: one kind, `mixed`, or null when there are none. */
  function aliasKind(variable: SnapshotVariable): { kind: ScopeKind; target: string } | 'mixed' | null {
    let found: { kind: ScopeKind; target: string } | null = null;
    for (const value of Object.values(variable.valuesByMode)) {
      const target = isAlias(value) ? variables.get(value.aliasId) : undefined;
      const kind = target && kindOf(target);
      if (!target || !kind) continue;
      if (found && found.kind !== kind) return 'mixed';
      found ??= { kind, target: target.name };
    }
    return found;
  }

  function infer(variable: SnapshotVariable): { kind: ScopeKind; because: string } | null {
    if (inferred.has(variable.id)) return inferred.get(variable.id)!;
    if (visiting.has(variable.id)) return null;
    visiting.add(variable.id);

    const result = variable.resolvedType === 'FLOAT' ? inferNumber(variable) : inferString(variable);

    visiting.delete(variable.id);
    inferred.set(variable.id, result);
    return result;
  }

  function inferNumber(variable: SnapshotVariable): { kind: ScopeKind; because: string } | null {
    if (WEIGHT.test(variable.name)) return { kind: 'fontWeight', because: 'name' };
    if (WEIGHT.test(variable.codeSyntax.WEB ?? '')) return { kind: 'fontWeight', because: 'Web code syntax' };

    const aliased = aliasKind(variable);
    if (aliased === 'mixed') return null;
    if (aliased) return { kind: aliased.kind, because: `aliases ${aliased.target}` };

    const literals = Object.values(variable.valuesByMode).filter((value): value is number => typeof value === 'number');
    if (literals.length > 0 && literals.every(isWeightValue)) {
      return { kind: 'fontWeight', because: `value ${literals[0]}` };
    }
    return { kind: 'size', because: 'no weight hint' };
  }

  function inferString(variable: SnapshotVariable): { kind: ScopeKind; because: string } | null {
    if (FAMILY.test(variable.name)) return { kind: 'fontFamily', because: 'name' };
    const web = variable.codeSyntax.WEB ?? '';
    if (FAMILY.test(web) || FONT_STACK.test(web)) return { kind: 'fontFamily', because: 'Web code syntax' };

    const aliased = aliasKind(variable);
    return aliased && aliased !== 'mixed' ? { kind: aliased.kind, because: `aliases ${aliased.target}` } : null;
  }

  const fixes: ScopeFix[] = [];
  for (const collection of snapshot.collections) {
    for (const variableId of collection.variableIds) {
      const variable = variables.get(variableId);
      const result = variable && needsScope(variable) ? infer(variable) : null;
      if (variable && result) {
        fixes.push({
          variableId,
          collection: collection.name,
          variable: variable.name,
          kind: result.kind,
          scopes: SCOPES[result.kind],
          because: result.because,
        });
      }
    }
  }
  return fixes;
}
