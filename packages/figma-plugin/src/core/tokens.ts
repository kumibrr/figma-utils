import { DEFAULT_BASE_FONT_SIZE, pxToRem } from 'css-to-dtcg/units';

import { toHex } from './color';
import { fontFamilyValue } from './font-stack';
import { recoverNumber } from './numbers';
import type { Token } from './sets';
import { isAlias, type RGBA, type SnapshotValue, type SnapshotVariable } from './snapshot';

export type TokenType = 'color' | 'fontWeight' | 'dimension' | 'fontFamily';

/** The unit sizes are exported in: rem divides Figma's px by the base font size. */
export type SizeUnit = 'rem' | 'px';

export const isSizeUnit = (value: unknown): value is SizeUnit => value === 'rem' || value === 'px';

export const NUMBER_SCOPE_REASON =
  'number variables need a scope: Font weight for a weight, or a size scope such as Gap or Font size for a size';
export const STRING_SCOPE_REASON = 'string variables need the Font family scope';

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
        return { reason: NUMBER_SCOPE_REASON };
      }
      // A unitless opacity is not a size, and css-to-dtcg has no token type for it either.
      if (variable.scopes.every((scope) => scope === 'OPACITY')) {
        return { reason: 'opacity variables are not supported' };
      }
      return { type: 'dimension' };
    case 'STRING':
      if (variable.scopes.includes('FONT_FAMILY')) {
        return { type: 'fontFamily' };
      }
      if (variable.scopes.includes('FONT_STYLE')) {
        return { reason: 'font style strings are not supported; use a number variable with the Font weight scope' };
      }
      return { reason: STRING_SCOPE_REASON };
    default:
      return { reason: `${variable.resolvedType.toLowerCase()} variables are not supported` };
  }
}

export type TokenResult = { ok: true; token: Token } | { ok: false; reason: string; perMode: boolean };

/** Sizes are px in Figma; exported as rem (`baseFontSize` px to the rem) unless `sizeUnit` is px. */
export function toToken(
  variable: SnapshotVariable,
  value: SnapshotValue,
  pathOf: (variableId: string) => string[] | undefined,
  baseFontSize = DEFAULT_BASE_FONT_SIZE,
  sizeUnit: SizeUnit = 'rem',
): TokenResult {
  const type = tokenType(variable);
  if ('reason' in type) {
    return { ok: false, reason: type.reason, perMode: false };
  }

  let $value: unknown;

  const alias = isAlias(value) ? value : undefined;
  const target = alias && pathOf(alias.aliasId);
  if (target) {
    $value = `{${target.join('.')}}`;
  } else {
    const literal = alias ? alias.resolved?.value : value;
    if (literal === undefined) {
      return { ok: false, reason: 'aliases a variable whose value could not be resolved in Figma', perMode: true };
    }
    switch (type.type) {
      case 'color':
        $value = toHex(literal as RGBA);
        break;
      case 'fontWeight':
        $value = recoverNumber(literal as number);
        break;
      case 'dimension': {
        const px = recoverNumber(literal as number);
        $value = sizeUnit === 'px' ? { value: px, unit: 'px' } : { value: pxToRem(px, baseFontSize), unit: 'rem' };
        break;
      }
      case 'fontFamily': {
        const webCodeSyntax = alias ? alias.resolved?.webCodeSyntax : variable.codeSyntax.WEB;
        const family = fontFamilyValue(literal as string, webCodeSyntax);
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
