import { TokenBuildError } from './errors.js';
import { capitalize, firstSegment, invalidPathReason, lastSegment, parentOf, tokenPath } from './naming.js';
import { normalizeSelector, parseBlocks } from './parse-css.js';
import { nest } from './tree.js';
import { parseValue } from './values.js';

/**
 * @typedef {import('./values.js').Token} Token
 * @typedef {import('./values.js').ParsedValue} ParsedValue
 * @typedef {import('./config.js').Config} Config
 * @typedef {{ cssName: string, path: string[], token: Token, target?: string }} ModelToken
 * @typedef {{ name: string, group?: string, collection: string, mode: string, tokens: ModelToken[], references: string[] }} ModelSet
 * @typedef {{
 *   sets: ModelSet[],
 *   importOrder: string[],
 *   pathOf: (cssName: string) => string[],
 *   collectionOf: (cssName: string) => string,
 *   resolveLiteral: (cssName: string) => Token,
 * }} Model
 */

const key = (setName, cssName) => `${setName}\u0000${cssName}`;

/**
 * @param {Config} config
 * @param {{ readFile: (file: string) => string }} io
 * @returns {Model}
 */
export function buildModel(config, { readFile }) {
  /** @type {string[]} */
  const errors = [];
  const blockCache = new Map();
  const blocksOf = (file) => {
    if (!blockCache.has(file)) {
      blockCache.set(file, parseBlocks(readFile(file)));
    }
    return blockCache.get(file);
  };

  // 1. Declared sets: every block with the configured selector, merged.
  /** @type {{ name: string, declarations: Map<string, string> }[]} */
  const rawSets = [];

  for (const set of config.sets) {
    let blocks;
    try {
      blocks = blocksOf(set.file);
    } catch (error) {
      errors.push(`set ${set.name}: cannot read ${set.file}: ${error.message}`);
      continue;
    }

    const selector = normalizeSelector(set.selector);
    const matching = blocks.filter((block) => block.selector === selector);

    if (matching.length === 0) {
      errors.push(`set ${set.name}: no "${set.selector}" block with custom properties in ${set.file}`);
      continue;
    }

    const declarations = new Map();
    for (const block of matching) {
      for (const name of block.duplicates) {
        errors.push(`set ${set.name}: ${name} is declared twice in "${set.selector}" in ${set.file}`);
      }
      for (const [name, value] of block.declarations) {
        if (declarations.has(name)) {
          errors.push(`set ${set.name}: ${name} is declared twice in "${set.selector}" in ${set.file}`);
        }
        declarations.set(name, value);
      }
    }
    rawSets.push({ name: set.name, declarations });
  }

  // 2. Custom sets.
  if (config.customSets) {
    try {
      const result = config.customSets({ blocks: blocksOf });
      const consumes = new Set(result.consumes ?? []);
      const declaredByCustom = new Set();

      for (const raw of rawSets) {
        for (const name of consumes) {
          raw.declarations.delete(name);
        }
      }
      for (const custom of result.sets) {
        rawSets.push({ name: custom.name, declarations: new Map(custom.declarations) });
        for (const name of custom.declarations.keys()) {
          declaredByCustom.add(name);
        }
      }
      for (const name of consumes) {
        if (!declaredByCustom.has(name)) {
          errors.push(`customSets consumes ${name} but no custom set declares it`);
        }
      }
    } catch (error) {
      errors.push(`customSets threw: ${error.message}`);
    }
  }

  // 3. Set names and theme groups.
  const setNames = new Set();
  for (const raw of rawSets) {
    if (setNames.has(raw.name)) {
      errors.push(`set name ${raw.name} is used twice`);
    }
    setNames.add(raw.name);
  }

  const groupOf = new Map();
  for (const [group, names] of Object.entries(config.themes ?? {})) {
    const known = names.filter((name) => setNames.has(name));
    const parents = [...new Set(known.map(parentOf))];

    if (parents.length > 1 || parents[0] === '') {
      errors.push(`themes.${group}: sets must share one parent path, got ${parents.map((p) => p || '(none)').join(', ')}`);
    } else if (parents.length === 1) {
      const expected = capitalize(lastSegment(parents[0]));
      if (group !== expected) {
        errors.push(`themes.${group}: group key must be "${expected}" to match its collection "${parents[0]}"`);
      }
      if (setNames.has(parents[0])) {
        errors.push(`set ${parents[0]} has the same name as the collection of theme group ${group}`);
      }
    }

    for (const name of names) {
      if (!setNames.has(name)) {
        errors.push(`themes.${group}: unknown set ${name}`);
      } else if (groupOf.has(name)) {
        errors.push(`set ${name} is in two theme groups (${groupOf.get(name)} and ${group})`);
      } else {
        groupOf.set(name, group);
      }
    }
  }

  // A theme group becomes one Figma collection with one mode per set: it needs
  // at least two sets, and every set must declare the same custom properties
  // because a Figma variable has a value in every mode.
  const declarationsOf = new Map(rawSets.map((raw) => [raw.name, raw.declarations]));
  for (const [group, names] of Object.entries(config.themes ?? {})) {
    if (names.length < 2) {
      errors.push(`themes.${group}: a theme group needs at least two sets; a single set is a plain set`);
      continue;
    }
    if (!names.every((name) => setNames.has(name)) || new Set(names.map(parentOf)).size !== 1) {
      continue;
    }
    const declared = new Set(names.flatMap((name) => [...declarationsOf.get(name).keys()]));
    for (const name of names) {
      const missing = [...declared].filter((cssName) => !declarationsOf.get(name).has(cssName));
      if (missing.length > 0) {
        errors.push(`themes.${group}: set ${name} is missing ${missing.join(', ')}, which other sets in the group declare`);
      }
    }
  }

  // 4. Paths and the global index.
  /** @type {Map<string, { path: string[], sets: string[] }>} */
  const index = new Map();
  for (const raw of rawSets) {
    for (const cssName of raw.declarations.keys()) {
      let path;
      try {
        path = tokenPath(cssName, raw.name, config);
      } catch (error) {
        errors.push(`${raw.name} ${cssName}: path function threw: ${error.message}`);
        continue;
      }

      const reason = invalidPathReason(path);
      if (reason) {
        errors.push(`${raw.name} ${cssName}: ${reason}`);
        continue;
      }
      const root = firstSegment(raw.name);
      if (path[0] !== root) {
        errors.push(`${raw.name} ${cssName}: the token path must start with "${root}", got "${path[0]}"`);
        continue;
      }

      const entry = index.get(cssName);
      if (!entry) {
        index.set(cssName, { path, sets: [raw.name] });
      } else {
        if (entry.path.join('.') !== path.join('.')) {
          errors.push(`${cssName} maps to ${entry.path.join('.')} in ${entry.sets[0]} but to ${path.join('.')} in ${raw.name}`);
        }
        entry.sets.push(raw.name);
      }
    }
  }

  // 5. Values.
  /** @type {Map<string, ParsedValue>} */
  const parsed = new Map();
  for (const raw of rawSets) {
    for (const [cssName, value] of raw.declarations) {
      try {
        parsed.set(key(raw.name, cssName), parseValue(value));
      } catch (error) {
        errors.push(`${raw.name} ${cssName}: ${error.message}`);
      }
    }
  }

  /** @returns {Token} */
  const resolveLiteral = (cssName, trail = []) => {
    if (trail.includes(cssName)) {
      throw new Error(`reference cycle: ${[...trail, cssName].join(' → ')}`);
    }
    const entry = index.get(cssName);
    if (!entry) {
      throw new Error(`${cssName} is not declared in any set`);
    }
    const value = parsed.get(key(entry.sets[0], cssName));
    if (!value) {
      throw new Error(`${cssName} has an unsupported value`);
    }
    return value.kind === 'literal' ? value.token : resolveLiteral(value.name, [...trail, cssName]);
  };

  // 6. Tokens and references.
  /** @type {ModelSet[]} */
  const sets = [];
  for (const raw of rawSets) {
    const group = groupOf.get(raw.name);
    const tokens = [];
    const references = new Set();
    const tree = {};

    for (const cssName of raw.declarations.keys()) {
      const entry = index.get(cssName);
      const value = parsed.get(key(raw.name, cssName));
      if (!entry || !value) {
        continue;
      }

      let modelToken;
      if (value.kind === 'literal') {
        modelToken = { cssName, path: entry.path, token: value.token };
      } else {
        const target = index.get(value.name);
        if (!target) {
          errors.push(`${raw.name} ${cssName}: var(${value.name}) does not match any custom property in the configured sets`);
          continue;
        }
        let literal;
        try {
          literal = resolveLiteral(value.name, [cssName]);
        } catch (error) {
          errors.push(`${raw.name} ${cssName}: ${error.message}`);
          continue;
        }
        modelToken = {
          cssName,
          path: entry.path,
          target: value.name,
          token: { $type: literal.$type, $value: `{${target.path.join('.')}}` },
        };
        for (const setName of target.sets) {
          // An alias inside the own group stays in the same mode, as in Figma.
          if (setName !== raw.name && !(group && groupOf.get(setName) === group)) {
            references.add(setName);
          }
        }
      }

      if (!nest(tree, entry.path, modelToken.token)) {
        errors.push(`${raw.name} ${cssName}: ${entry.path.join('.')} collides with another token or group`);
        continue;
      }
      tokens.push(modelToken);
    }

    const order = rawSets.map((candidate) => candidate.name);
    sets.push({
      name: raw.name,
      group,
      collection: group ? parentOf(raw.name) : raw.name,
      mode: group ? lastSegment(raw.name) : 'default',
      tokens,
      references: [...references].sort((a, b) => order.indexOf(a) - order.indexOf(b)),
    });
  }

  // 7. Collection import order: stable topological sort.
  const collections = [...new Set(sets.map((set) => set.collection))];
  const collectionOfSet = new Map(sets.map((set) => [set.name, set.collection]));
  const dependencies = new Map(collections.map((collection) => [collection, new Set()]));

  for (const set of sets) {
    for (const reference of set.references) {
      const target = collectionOfSet.get(reference);
      if (target && target !== set.collection) {
        dependencies.get(set.collection).add(target);
      }
    }
  }

  const importOrder = [];
  const placed = new Set();
  while (importOrder.length < collections.length) {
    const next = collections.find(
      (collection) => !placed.has(collection) && [...dependencies.get(collection)].every((dep) => placed.has(dep)),
    );
    if (next === undefined) {
      errors.push(`collections reference each other in a cycle: ${collections.filter((c) => !placed.has(c)).join(', ')}`);
      break;
    }
    importOrder.push(next);
    placed.add(next);
  }

  if (errors.length > 0) {
    throw new TokenBuildError(errors);
  }

  return {
    sets,
    importOrder,
    pathOf: (cssName) => index.get(cssName).path,
    collectionOf: (cssName) => collectionOfSet.get(index.get(cssName).sets[0]),
    resolveLiteral: (cssName) => resolveLiteral(cssName),
  };
}
