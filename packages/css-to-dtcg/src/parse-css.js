const COMMENT = /\/\*[\s\S]*?\*\//g;
const BLOCK = /([^{}]+)\{([^{}]*)\}/g;
const CUSTOM_PROPERTY = /(--[\w-]+)\s*:\s*([^;]+?)\s*(?:;|$)/g;

/**
 * @typedef {{ selector: string, declarations: Map<string, string>, duplicates: string[] }} Block
 */

/**
 * Collapses whitespace so `:root,\n[data-x]` and `:root, [data-x]` compare equal.
 * @param {string} selector
 * @returns {string}
 */
export function normalizeSelector(selector) {
  return selector.trim().replace(/\s+/g, ' ').replace(/\s*,\s*/g, ', ');
}

/**
 * Splits a stylesheet into its top-level blocks, keeping only the custom
 * properties. Token source files are flat, so a regex pass is enough; nested
 * blocks (such as @media) are rejected rather than misread.
 * @param {string} css
 * @returns {Block[]}
 */
export function parseBlocks(css) {
  const source = css.replace(COMMENT, '');
  const matches = [...source.matchAll(BLOCK)];
  const openBraces = (source.match(/\{/g) ?? []).length;

  if (matches.length !== openBraces) {
    throw new Error('nested blocks (such as @media) are not supported in token source files');
  }

  const blocks = [];

  for (const [, selector, body] of matches) {
    const declarations = new Map();
    const duplicates = [];

    for (const [, name, value] of body.matchAll(CUSTOM_PROPERTY)) {
      if (declarations.has(name)) {
        duplicates.push(name);
      }
      declarations.set(name, value.trim());
    }

    if (declarations.size > 0) {
      blocks.push({ selector: normalizeSelector(selector), declarations, duplicates });
    }
  }

  return blocks;
}
