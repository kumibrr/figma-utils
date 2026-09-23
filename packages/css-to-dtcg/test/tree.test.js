import { describe, expect, it } from 'vitest';

import { nest } from '../src/tree.js';

const token = (value) => ({ $type: 'color', $value: value });

describe('nest', () => {
  it('builds nested groups', () => {
    const tree = {};

    expect(nest(tree, ['primitives', 'gray', '100'], token('#fff'))).toBe(true);
    expect(nest(tree, ['primitives', 'gray', '200'], token('#eee'))).toBe(true);
    expect(tree).toEqual({ primitives: { gray: { 100: token('#fff'), 200: token('#eee') } } });
  });

  it('refuses a token where a group already exists', () => {
    const tree = {};
    nest(tree, ['primitives', 'gray', '100'], token('#fff'));

    expect(nest(tree, ['primitives', 'gray'], token('#000'))).toBe(false);
  });

  it('refuses a group below an existing token', () => {
    const tree = {};
    nest(tree, ['primitives', 'gray'], token('#000'));

    expect(nest(tree, ['primitives', 'gray', '100'], token('#fff'))).toBe(false);
  });

  it('refuses the same path twice', () => {
    const tree = {};
    nest(tree, ['primitives', 'gray'], token('#000'));

    expect(nest(tree, ['primitives', 'gray'], token('#111'))).toBe(false);
  });
});
