import { describe, expect, it } from 'vitest';

import { invalidNameReason, invalidSetPathReason, nest, setPath, tokenPath, type Tree } from '../src/core/sets';
import { collection } from './helpers';

describe('setPath', () => {
  it('uses the collection name for a single-mode collection', () => {
    expect(setPath(collection('primitives', ['Mode 1']), 'Mode 1')).toBe('primitives');
  });

  it('adds the mode for a multi-mode collection', () => {
    expect(setPath(collection('semantic/theme', ['light', 'dark']), 'dark')).toBe('semantic/theme/dark');
  });
});

describe('tokenPath', () => {
  it('roots the variable under the first segment of the collection name', () => {
    expect(tokenPath('primitives', 'gray/100')).toEqual(['primitives', 'gray', '100']);
    expect(tokenPath('semantic/theme', 'primary')).toEqual(['semantic', 'primary']);
  });
});

describe('invalidNameReason', () => {
  it('accepts normal names', () => {
    expect(invalidNameReason(['primitives', 'gray', '100'])).toBeNull();
  });

  it('rejects names that would break references', () => {
    expect(invalidNameReason(['primitives', 'spacing', '1.5'])).toBe('name segment "1.5" contains one of . { }');
    expect(invalidNameReason(['primitives', '{x}'])).toBe('name segment "{x}" contains one of . { }');
    expect(invalidNameReason(['primitives', '$type'])).toBe('name segment "$type" starts with $');
    expect(invalidNameReason(['primitives', 'a', '', 'b'])).toBe('name has an empty segment');
  });
});

describe('invalidSetPathReason', () => {
  it('accepts normal set paths', () => {
    expect(invalidSetPathReason('semantic/theme/dark')).toBeNull();
  });

  it('rejects paths that could escape the export folder', () => {
    expect(invalidSetPathReason('../escape')).toBe('collection and mode names cannot have empty, "." or ".." segments or contain \\');
    expect(invalidSetPathReason('a/./b')).not.toBeNull();
    expect(invalidSetPathReason('a\\b')).not.toBeNull();
    expect(invalidSetPathReason('a//b')).not.toBeNull();
  });
});

describe('nest', () => {
  const token = { $type: 'color', $value: '#ffffff' };

  it('nests tokens and refuses collisions', () => {
    const tree: Tree = {};

    expect(nest(tree, ['primitives', 'gray', '100'], token)).toBe(true);
    expect(nest(tree, ['primitives', 'gray'], token)).toBe(false);
    expect(nest(tree, ['primitives', 'gray', '100', 'x'], token)).toBe(false);
    expect(nest(tree, ['primitives', 'gray', '100'], token)).toBe(false);
    expect(tree).toEqual({ primitives: { gray: { 100: token } } });
  });
});
