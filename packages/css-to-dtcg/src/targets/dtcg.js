import { serialize } from '../serialize.js';
import { deriveThemes } from '../themes.js';
import { nest } from '../tree.js';

/**
 * @typedef {{ path: string, json: string }} OutputFile
 * @typedef {import('../model.js').Model} Model
 */

/**
 * Sets in collection import order, which is also the Figma collection order
 * the plugin sees, so both tools order $themes.json identically.
 * @param {Model} model
 * @returns {import('../themes.js').ThemeSetInput[]}
 */
export function themeInputs(model) {
  const rank = new Map(model.importOrder.map((collection, index) => [collection, index]));

  return [...model.sets]
    .sort((a, b) => rank.get(a.collection) - rank.get(b.collection))
    .map((set) => ({ name: set.name, group: set.group, themeName: set.mode, references: set.references }));
}

/**
 * @param {Model} model
 * @returns {OutputFile[]}
 */
export function toDtcgFiles(model) {
  const files = model.sets.map((set) => {
    const tree = {};
    for (const { path, token } of set.tokens) {
      nest(tree, path, token);
    }
    return { path: `${set.name}.json`, json: serialize(tree) };
  });

  files.push({ path: '$themes.json', json: serialize(deriveThemes(themeInputs(model))) });
  return files;
}
