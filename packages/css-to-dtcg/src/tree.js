/** A leaf is any object carrying `$value` (or `$type`). */
const isLeaf = (node) => node !== null && typeof node === 'object' && ('$value' in node || '$type' in node);

/**
 * Places `value` at `path` inside `tree`.
 * @param {Record<string, any>} tree
 * @param {string[]} path
 * @param {object} value
 * @returns {boolean} false when the path collides with an existing token or group
 */
export function nest(tree, path, value) {
  let node = tree;

  for (const segment of path.slice(0, -1)) {
    if (node[segment] === undefined) {
      node[segment] = {};
    } else if (isLeaf(node[segment])) {
      return false;
    }
    node = node[segment];
  }

  const last = path.at(-1);
  if (node[last] !== undefined) {
    return false;
  }

  node[last] = value;
  return true;
}
