import { describe, expect, it } from 'vitest';

import { toSnapshotValue } from '../src/plugin/snapshot';

describe('toSnapshotValue', () => {
  it('turns Figma aliases into { aliasId }', () => {
    expect(toSnapshotValue({ type: 'VARIABLE_ALIAS', id: 'VariableID:1:2' })).toEqual({ aliasId: 'VariableID:1:2' });
  });

  it('always gives colours an alpha', () => {
    expect(toSnapshotValue({ r: 1, g: 0.5, b: 0 })).toEqual({ r: 1, g: 0.5, b: 0, a: 1 });
    expect(toSnapshotValue({ r: 1, g: 0.5, b: 0, a: 0.25 })).toEqual({ r: 1, g: 0.5, b: 0, a: 0.25 });
  });

  it('passes numbers, strings and booleans through', () => {
    expect(toSnapshotValue(0.20000000298023224)).toBe(0.20000000298023224);
    expect(toSnapshotValue('Inter')).toBe('Inter');
    expect(toSnapshotValue(true)).toBe(true);
  });
});
