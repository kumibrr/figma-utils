/**
 * @typedef {{ name: string, group?: string, themeName?: string, references: string[] }} ThemeSetInput
 * @typedef {{ name: string, group: string, selectedTokenSets: Record<string, 'source' | 'enabled'> }} Theme
 */

/** @param {string} name */
const lastSegment = (name) => name.split('/').at(-1);

/**
 * One theme per grouped set. Every ungrouped set the theme reaches through
 * references is a "source"; grouped sets are never listed because their own
 * group selects them. Shared with the Figma plugin so both tools agree.
 * @param {ThemeSetInput[]} sets in the order themes and sources should appear
 * @returns {Theme[]}
 */
export function deriveThemes(sets) {
  const byName = new Map(sets.map((set) => [set.name, set]));
  const members = new Map();

  for (const set of sets) {
    if (set.group) {
      members.set(set.group, [...(members.get(set.group) ?? []), set.name]);
    }
  }

  return sets
    .filter((set) => set.group)
    .map((set) => {
      const seen = new Set([set.name]);
      const reached = new Set();
      const queue = [...set.references];

      while (queue.length > 0) {
        const name = queue.shift();
        if (seen.has(name)) {
          continue;
        }
        seen.add(name);

        const current = byName.get(name);
        if (!current) {
          continue;
        }

        queue.push(...current.references);

        if (current.group) {
          queue.push(...members.get(current.group));
        } else {
          reached.add(name);
        }
      }

      const selectedTokenSets = {};
      for (const candidate of sets) {
        if (reached.has(candidate.name)) {
          selectedTokenSets[candidate.name] = 'source';
        }
      }
      selectedTokenSets[set.name] = 'enabled';

      return { name: set.themeName ?? lastSegment(set.name), group: set.group, selectedTokenSets };
    });
}
