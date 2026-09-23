import { describe, expect, it } from 'vitest';

import { tokenType, toToken } from '../src/core/tokens';
import { alias, rgba, variable } from './helpers';

const noAliases = () => undefined;

describe('tokenType', () => {
  it('derives the type from resolvedType and scopes only', () => {
    expect(tokenType(variable('p', 'c', 'COLOR', {}))).toEqual({ type: 'color' });
    expect(tokenType(variable('p', 'w', 'FLOAT', {}, { scopes: ['FONT_WEIGHT'] }))).toEqual({ type: 'fontWeight' });
    expect(tokenType(variable('p', 'size', 'FLOAT', {}))).toEqual({ type: 'dimension' });
    expect(tokenType(variable('p', 'font-weight', 'FLOAT', {}))).toEqual({ type: 'dimension' });
    expect(tokenType(variable('p', 'f', 'STRING', {}, { scopes: ['FONT_FAMILY'] }))).toEqual({ type: 'fontFamily' });
  });

  it('explains unsupported variables', () => {
    expect(tokenType(variable('p', 'b', 'BOOLEAN', {}))).toEqual({ reason: 'boolean variables are not supported' });
    expect(tokenType(variable('p', 'e', 'EASING', {}))).toEqual({ reason: 'easing variables are not supported' });
    expect(tokenType(variable('p', 's', 'STRING', {}))).toEqual({ reason: 'string variables need the Font family scope' });
    expect(tokenType(variable('p', 's', 'STRING', {}, { scopes: ['FONT_STYLE'] }))).toEqual({
      reason: 'font style strings are not supported; use a number variable with the Font weight scope',
    });
  });
});

describe('toToken', () => {
  it('converts literals', () => {
    expect(toToken(variable('p', 'c', 'COLOR', {}), rgba(1, 1, 1), noAliases)).toEqual({
      ok: true,
      token: { $type: 'color', $value: '#ffffff' },
    });
    expect(toToken(variable('p', 's', 'FLOAT', {}), Math.fround(0.85), noAliases)).toEqual({
      ok: true,
      token: { $type: 'dimension', $value: { value: 0.85, unit: 'rem' } },
    });
    expect(toToken(variable('p', 'w', 'FLOAT', {}, { scopes: ['FONT_WEIGHT'] }), 700, noAliases)).toEqual({
      ok: true,
      token: { $type: 'fontWeight', $value: 700 },
    });
  });

  it('reads the font stack from Web code syntax', () => {
    const family = variable('p', 'f', 'STRING', {}, { scopes: ['FONT_FAMILY'], codeSyntax: { WEB: "'Roboto Slab', serif" } });

    expect(toToken(family, 'Roboto Slab', noAliases)).toEqual({
      ok: true,
      token: { $type: 'fontFamily', $value: ['Roboto Slab', 'serif'] },
    });
    expect(toToken(family, 'Inter', noAliases)).toEqual({
      ok: false,
      perMode: true,
      reason: 'Web code syntax starts with "Roboto Slab" but the value is "Inter"',
    });
  });

  it('turns aliases into references typed by the aliasing variable', () => {
    const pathOf = (id: string) => (id === 'v:primitives/gray/900' ? ['primitives', 'gray', '900'] : undefined);
    const family = variable('p', 'f', 'STRING', {}, { scopes: ['FONT_FAMILY'], codeSyntax: { WEB: 'nonsense, serif' } });

    expect(toToken(variable('s', 't', 'COLOR', {}), alias('primitives', 'gray/900'), pathOf)).toEqual({
      ok: true,
      token: { $type: 'color', $value: '{primitives.gray.900}' },
    });
    expect(toToken(family, alias('primitives', 'gray/900'), pathOf)).toEqual({
      ok: true,
      token: { $type: 'fontFamily', $value: '{primitives.gray.900}' },
    });
  });

  it('reports an alias to a variable that is not local', () => {
    expect(toToken(variable('s', 't', 'COLOR', {}), { aliasId: 'VariableID:abc/-1:-1' }, noAliases)).toEqual({
      ok: false,
      perMode: true,
      reason: 'aliases a variable that is not local to this file',
    });
  });

  it('reports unsupported types once per variable', () => {
    expect(toToken(variable('p', 'b', 'BOOLEAN', {}), true, noAliases)).toEqual({
      ok: false,
      perMode: false,
      reason: 'boolean variables are not supported',
    });
  });

  it('adds a non-empty description after $value', () => {
    const result = toToken(variable('p', 'c', 'COLOR', {}, { description: 'Page background' }), rgba(0, 0, 0), noAliases);

    expect(result).toEqual({ ok: true, token: { $type: 'color', $value: '#000000', $description: 'Page background' } });
    expect(Object.keys((result as { token: object }).token)).toEqual(['$type', '$value', '$description']);
    expect(toToken(variable('p', 'c', 'COLOR', {}, { description: '   ' }), rgba(0, 0, 0), noAliases)).toEqual({
      ok: true,
      token: { $type: 'color', $value: '#000000' },
    });
  });
});
