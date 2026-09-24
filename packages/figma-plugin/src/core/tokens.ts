import { toHex } from './color';
import { fontFamilyValue } from './font-stack';
import { recoverNumber } from './numbers';
import type { Token } from './sets';
import { isAlias, type RGBA, type SnapshotValue, type SnapshotVariable } from './snapshot';

export type TokenType = 'color' | 'fontWeight' | 'dimension' | 'fontFamily';

export function tokenType(variable: SnapshotVariable): { type: TokenType } | { reason: string } {
  switch (variable.resolvedType) {
    case 'COLOR':
      return { type: 'color' };
    case 'FLOAT':
      if (variable.scopes.includes('FONT_WEIGHT')) {
        return { type: 'fontWeight' };
      }
      // Figma's Import mode drops the Font weight scope, so an unscoped number may be a weight.
      if (variable.scopes.length === 0 || variable.scopes.includes('ALL_SCOPES')) {
        return {
          reason: 'number variables need a scope: Font weight for a weight, or a size scope such as Gap or Font size for a size',
        };
      }
      return { type: 'dimension' };
    case 'STRING':
      if (variable.scopes.includes('FONT_FAMILY')) {
        return { type: 'fontFamily' };
      }
      if (variable.scopes.includes('FONT_STYLE')) {
        return { reason: 'font style strings are not supported; use a number variable with the Font weight scope' };
      }
      return { reason: 'string variables need the Font family scope' };
    default:
      return { reason: `${variable.resolvedType.toLowerCase()} variables are not supported` };
  }
}

export type TokenResult = { ok: true; token: Token } | { ok: false; reason: string; perMode: boolean };

export function toToken(
  variable: SnapshotVariable,
  value: SnapshotValue,
  pathOf: (variableId: string) => string[] | undefined,
): TokenResult {
  const type = tokenType(variable);
  if ('reason' in type) {
    return { ok: false, reason: type.reason, perMode: false };
  }

  let $value: unknown;

  if (isAlias(value)) {
    const target = pathOf(value.aliasId);
    if (!target) {
      return { ok: false, reason: 'aliases a variable that is not local to this file', perMode: true };
    }
    $value = `{${target.join('.')}}`;
  } else {
    switch (type.type) {
      case 'color':
        $value = toHex(value as RGBA);
        break;
      case 'fontWeight':
        $value = recoverNumber(value as number);
        break;
      case 'dimension':
        $value = { value: recoverNumber(value as number), unit: 'rem' };
        break;
      case 'fontFamily': {
        const family = fontFamilyValue(value as string, variable.codeSyntax.WEB);
        if (!family.ok) {
          return { ok: false, reason: family.reason, perMode: true };
        }
        $value = family.value;
        break;
      }
    }
  }

  const token: Token = { $type: type.type, $value };
  if (variable.description.trim() !== '') {
    token.$description = variable.description;
  }
  return { ok: true, token };
}
