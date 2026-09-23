/** @param {string} name */
export const firstSegment = (name) => name.split('/')[0];

/** @param {string} name */
export const lastSegment = (name) => name.split('/').at(-1);

/** @param {string} name */
export const parentOf = (name) => name.split('/').slice(0, -1).join('/');

/** @param {string} text */
export const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * @typedef {{ overrides?: Record<string, string[]>, path?: (cssName: string, setName: string) => string[] }} NamingOptions
 */

/**
 * Maps a custom property to its token path. The root is the set's first
 * segment, which is also how the Figma plugin roots a collection's tokens.
 * @param {string} cssName
 * @param {string} setName
 * @param {NamingOptions} [options]
 * @returns {string[]}
 */
export function tokenPath(cssName, setName, { overrides = {}, path } = {}) {
  if (path) {
    return path(cssName, setName);
  }

  const root = firstSegment(setName);
  const override = overrides[cssName];

  if (override) {
    return [root, ...override];
  }

  return [root, ...cssName.replace(/^--/, '').replaceAll('--', '-').split('-')];
}

/**
 * @param {unknown} path
 * @returns {string | null}
 */
export function invalidPathReason(path) {
  if (!Array.isArray(path)) {
    return 'the token path must be an array of strings';
  }
  if (path.length < 2) {
    return 'the token path needs at least two segments (root and name)';
  }
  for (const segment of path) {
    if (typeof segment !== 'string' || segment === '') {
      return 'token path segments must be non-empty strings';
    }
    if (/[.{}]/.test(segment)) {
      return `segment "${segment}" contains one of . { }`;
    }
    if (segment.startsWith('$')) {
      return `segment "${segment}" starts with $`;
    }
  }
  return null;
}
