import { describe, expect, it } from 'vitest';

import { normalizeHex, parseValue } from '../src/values.js';

describe('parseValue', () => {
  it('reads a hex colour as a DTCG color', () => {
    expect(parseValue('#f3ffcc')).toEqual({ kind: 'literal', token: { $type: 'color', $value: '#f3ffcc' } });
  });

  it('turns a var() into a reference, never the resolved value', () => {
    expect(parseValue('var(--nova-700)')).toEqual({ kind: 'ref', name: '--nova-700' });
  });

  it('tolerates spaces inside var()', () => {
    expect(parseValue('var( --nova-700 )')).toEqual({ kind: 'ref', name: '--nova-700' });
  });

  it('reads a rem length as a DTCG dimension', () => {
    expect(parseValue('0.625rem')).toEqual({
      kind: 'literal',
      token: { $type: 'dimension', $value: { value: 0.625, unit: 'rem' } },
    });
  });

  it('reads negative and leading-dot rem lengths', () => {
    expect(parseValue('-0.5rem').token.$value).toEqual({ value: -0.5, unit: 'rem' });
    expect(parseValue('.5rem').token.$value).toEqual({ value: 0.5, unit: 'rem' });
  });

  it('reads a bare integer as a font weight', () => {
    expect(parseValue('300')).toEqual({ kind: 'literal', token: { $type: 'fontWeight', $value: 300 } });
  });

  it('reads a font stack as a fontFamily array with quotes stripped', () => {
    expect(parseValue("'Roboto Slab', serif")).toEqual({
      kind: 'literal',
      token: { $type: 'fontFamily', $value: ['Roboto Slab', 'serif'] },
    });
  });

  it('throws on a value shape it does not understand', () => {
    expect(() => parseValue('linear-gradient(red, blue)')).toThrow(/unsupported value shape/);
    expect(() => parseValue('var(--a, #fff)')).toThrow(/unsupported value shape/);
    expect(() => parseValue('16px')).toThrow(/unsupported value shape/);
  });
});

describe('normalizeHex', () => {
  it('lowercases so equal colours compare equal', () => {
    expect(normalizeHex('#F3FFCC')).toBe('#f3ffcc');
  });

  it('expands short forms', () => {
    expect(normalizeHex('#fff')).toBe('#ffffff');
    expect(normalizeHex('#0f08')).toBe('#00ff0088');
  });

  it('drops a fully opaque alpha channel, as the plugin does', () => {
    expect(normalizeHex('#112233ff')).toBe('#112233');
    expect(normalizeHex('#fffe')).toBe('#ffffffee');
  });

  it('is applied by parseValue', () => {
    expect(parseValue('#FFF').token.$value).toBe('#ffffff');
  });

  it('rejects 5- and 7-digit hex', () => {
    expect(() => parseValue('#12345')).toThrow(/unsupported value shape/);
  });
});
