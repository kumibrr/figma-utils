import type { SnapshotCollection } from './snapshot';

export type Token = { $type: string; $value: unknown; $description?: string };
export type Tree = { [key: string]: Tree | Token };

export const setPath = (collection: SnapshotCollection, modeName: string): string =>
  collection.modes.length === 1 ? collection.name : `${collection.name}/${modeName}`;

export const tokenPath = (collectionName: string, variableName: string): string[] => [
  collectionName.split('/')[0],
  ...variableName.split('/'),
];

export function invalidNameReason(path: string[]): string | null {
  for (const segment of path) {
    if (segment === '') {
      return 'name has an empty segment';
    }
    if (/[.{}]/.test(segment)) {
      return `name segment "${segment}" contains one of . { }`;
    }
    if (segment.startsWith('$')) {
      return `name segment "${segment}" starts with $`;
    }
  }
  return null;
}

export function invalidSetPathReason(setName: string): string | null {
  const unsafe =
    setName.includes('\\') || setName.split('/').some((segment) => segment === '' || segment === '.' || segment === '..');
  return unsafe ? 'collection and mode names cannot have empty, "." or ".." segments or contain \\' : null;
}

const isToken = (node: Tree | Token | undefined): node is Token =>
  node !== undefined && typeof node === 'object' && '$value' in node;

/** Places a token; returns false when the path collides with a token or group. */
export function nest(tree: Tree, path: string[], token: Token): boolean {
  let node: Tree = tree;

  for (const segment of path.slice(0, -1)) {
    const child = node[segment];
    if (child === undefined) {
      node[segment] = {};
    } else if (isToken(child)) {
      return false;
    }
    node = node[segment] as Tree;
  }

  const last = path[path.length - 1];
  if (node[last] !== undefined) {
    return false;
  }
  node[last] = token;
  return true;
}
