import { SIZE_SCOPES } from 'css-to-dtcg/scopes';

import { isAlias, type Snapshot, type SnapshotVariable } from './snapshot';
import { tokenType } from './tokens';

/** A scope the plugin can set on a variable; `because` says what gave it away. */
export type ScopeFix = {
  variableId: string;
  collection: string;
  variable: string;
  scopes: string[];
  because: string;
  /** Why the export would still refuse the variable once scoped, e.g. opacity. */
  stillBlocked: string | null;
};

/** Lowercase words of a name or code syntax, split on anything but letters and digits, and camelCase. */
export const words = (text: string): string[] =>
  text
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

type Rule = {
  scopes: string[];
  /** Word sequences to look for; each word also matches its plural. */
  phrases: string[][];
  /** Extra match on the whole variable (collection + name), e.g. "size" in a typography path. */
  inContext?: (text: string[], context: string[]) => boolean;
  /** Extra match on the raw text, e.g. a CSS font stack. */
  raw?: RegExp;
};

const TYPOGRAPHIC = ['font', 'text', 'type', 'typography'];

// First match wins, so specific phrases come before the words they contain.
const NUMBER_RULES: Rule[] = [
  { scopes: ['FONT_WEIGHT'], phrases: [['weight']] },
  { scopes: ['LINE_HEIGHT'], phrases: [['line', 'height'], ['lineheight'], ['leading']] },
  { scopes: ['LETTER_SPACING'], phrases: [['letter', 'spacing'], ['letterspacing'], ['tracking'], ['kerning']] },
  { scopes: ['PARAGRAPH_SPACING'], phrases: [['paragraph', 'spacing']] },
  { scopes: ['PARAGRAPH_INDENT'], phrases: [['paragraph', 'indent'], ['indent']] },
  {
    scopes: ['FONT_SIZE'],
    phrases: [['font', 'size'], ['text', 'size'], ['type', 'size'], ['fontsize']],
    inContext: (text, context) => text.includes('size') && context.some((word) => TYPOGRAPHIC.includes(word)),
  },
  { scopes: ['CORNER_RADIUS'], phrases: [['radius'], ['radii'], ['rounded'], ['corner']] },
  { scopes: ['OPACITY'], phrases: [['opacity'], ['alpha']] },
  { scopes: ['STROKE_FLOAT'], phrases: [['border'], ['stroke']] },
  { scopes: ['EFFECT_FLOAT'], phrases: [['blur'], ['shadow'], ['elevation'], ['spread']] },
  { scopes: ['GAP'], phrases: [['gap'], ['space'], ['spacing'], ['padding'], ['margin'], ['inset'], ['gutter']] },
  { scopes: ['WIDTH_HEIGHT'], phrases: [['width'], ['height'], ['size'], ['icon'], ['avatar']] },
];

// A CSS font stack ends with a generic family, e.g. `'Roboto Slab', serif`.
const FONT_STACK = /(^|,)\s*(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-serif|ui-sans-serif|ui-monospace)\s*$/i;

const STRING_RULES: Rule[] = [
  { scopes: ['FONT_STYLE'], phrases: [['style']] },
  { scopes: ['FONT_FAMILY'], phrases: [['family'], ['families'], ['font'], ['typeface']], raw: FONT_STACK },
  { scopes: ['TEXT_CONTENT'], phrases: [['content'], ['copy'], ['label'], ['text'], ['message'], ['placeholder']] },
];

const matchesAt = (text: string[], phrase: string[], start: number) =>
  phrase.every((word, offset) => text[start + offset] === word || text[start + offset] === `${word}s`);

const hasPhrase = (text: string[], phrase: string[]) => text.some((_, start) => matchesAt(text, phrase, start));

function matchRule(rules: Rule[], raw: string, context: string[]): string[] | null {
  const text = words(raw);
  const rule = rules.find(
    (candidate) =>
      candidate.phrases.some((phrase) => hasPhrase(text, phrase)) ||
      candidate.inContext?.(text, context) ||
      candidate.raw?.test(raw),
  );
  return rule ? rule.scopes : null;
}

const isWeightValue = (value: number) => Number.isInteger(value) && value >= 100 && value <= 900 && value % 100 === 0;

/** True for the numbers and strings on All scopes or none, which the export refuses for their scope. */
export function needsScope(variable: SnapshotVariable): boolean {
  const { resolvedType, scopes } = variable;
  return (resolvedType === 'FLOAT' || resolvedType === 'STRING') && (scopes.length === 0 || scopes.includes('ALL_SCOPES'));
}

type Inference = { scopes: string[]; because: string };

/**
 * Suggests scopes for every number and string variable on All scopes or none, in Figma order.
 * The first of these that says something wins: the variable's name, its Web code syntax, the
 * scopes of the variables it aliases, its collection's name, then (numbers only) a weight-like
 * value, or every size scope. A string with no hint gets no suggestion.
 */
export function inferScopes(snapshot: Snapshot): ScopeFix[] {
  const variables = new Map(snapshot.variables.map((variable) => [variable.id, variable]));
  const collections = new Map(snapshot.collections.map((collection) => [collection.id, collection]));
  const inferred = new Map<string, Inference | null>();
  const visiting = new Set<string>();

  /** The scopes a variable has, or would have once its suggestion is applied. */
  function scopesOf(variable: SnapshotVariable): string[] | null {
    return needsScope(variable) ? (infer(variable)?.scopes ?? null) : variable.scopes;
  }

  /** The scopes every alias points to; `mixed` when they can't be combined, null when there are none. */
  function aliasScopes(variable: SnapshotVariable): Inference | 'mixed' | null {
    let found: Inference | null = null;
    for (const value of Object.values(variable.valuesByMode)) {
      const target = isAlias(value) ? variables.get(value.aliasId) : undefined;
      const scopes = target && scopesOf(target);
      if (!target || !scopes) continue;
      if (!found) {
        found = { scopes, because: `aliases ${target.name}` };
        continue;
      }
      const union: string[] = [...new Set([...found.scopes, ...scopes])];
      if (union.length === found.scopes.length && union.length === scopes.length) continue;
      if (variable.resolvedType !== 'FLOAT' || union.includes('FONT_WEIGHT')) return 'mixed';
      found = { ...found, scopes: union };
    }
    return found;
  }

  function infer(variable: SnapshotVariable): Inference | null {
    if (inferred.has(variable.id)) return inferred.get(variable.id)!;
    if (visiting.has(variable.id)) return null;
    visiting.add(variable.id);

    const result = inferUncached(variable);

    visiting.delete(variable.id);
    inferred.set(variable.id, result);
    return result;
  }

  function inferUncached(variable: SnapshotVariable): Inference | null {
    const number = variable.resolvedType === 'FLOAT';
    const rules = number ? NUMBER_RULES : STRING_RULES;
    const collectionName = collections.get(variable.collectionId)?.name ?? '';
    const context = [...words(collectionName), ...words(variable.name)];

    const byName = matchRule(rules, variable.name, context);
    if (byName) return { scopes: byName, because: 'name' };
    const bySyntax = matchRule(rules, variable.codeSyntax.WEB ?? '', context);
    if (bySyntax) return { scopes: bySyntax, because: 'Web code syntax' };

    const aliased = aliasScopes(variable);
    if (aliased === 'mixed') return null;
    if (aliased) return aliased;

    const byCollection = matchRule(rules, collectionName, context);
    if (byCollection) return { scopes: byCollection, because: 'collection name' };

    if (!number) return null;
    const literals = Object.values(variable.valuesByMode).filter((value): value is number => typeof value === 'number');
    if (literals.length > 0 && literals.every(isWeightValue)) {
      return { scopes: ['FONT_WEIGHT'], because: `value ${literals[0]}` };
    }
    return { scopes: SIZE_SCOPES, because: 'no hint' };
  }

  const fixes: ScopeFix[] = [];
  for (const collection of snapshot.collections) {
    for (const variableId of collection.variableIds) {
      const variable = variables.get(variableId);
      const result = variable && needsScope(variable) ? infer(variable) : null;
      if (variable && result) {
        const type = tokenType({ ...variable, scopes: result.scopes });
        fixes.push({
          variableId,
          collection: collection.name,
          variable: variable.name,
          scopes: result.scopes,
          because: result.because,
          stillBlocked: 'reason' in type ? type.reason : null,
        });
      }
    }
  }
  return fixes;
}
