const HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const VAR = /^var\(\s*(--[\w-]+)\s*\)$/;
const REM = /^(-?(?:\d+\.?\d*|\.\d+))rem$/;
const NUMBER = /^\d+$/;
// A family is quoted, or an unquoted identifier sequence that cannot start
// with a digit — so `16px` or `0 1px red` are rejected instead of read as fonts.
const FAMILY = String.raw`(?:'[^']+'|"[^"]+"|[A-Za-z_-][\w-]*(?:\s+[A-Za-z_-][\w-]*)*)`;
const FONT_STACK = new RegExp(String.raw`^${FAMILY}(?:\s*,\s*${FAMILY})*$`);

/**
 * @typedef {{ $type: string, $value: unknown }} Token
 * @typedef {{ kind: 'literal', token: Token } | { kind: 'ref', name: string }} ParsedValue
 */

/**
 * Normalizes a hex colour to the exact text the Figma plugin exports, so a
 * CSS → Figma → plugin round trip is byte-identical.
 * @param {string} hex
 * @returns {string}
 */
export function normalizeHex(hex) {
  let digits = hex.slice(1).toLowerCase();

  if (digits.length <= 4) {
    digits = [...digits].map((digit) => digit + digit).join('');
  }

  if (digits.length === 8 && digits.endsWith('ff')) {
    digits = digits.slice(0, 6);
  }

  return `#${digits}`;
}

/** @param {string} $type @param {unknown} $value @returns {ParsedValue} */
const literal = ($type, $value) => ({ kind: 'literal', token: { $type, $value } });

/**
 * A var() stays a reference, never the value it resolves to: flattening would
 * give Figma a dead copy that cannot follow a mode switch.
 * @param {string} rawValue
 * @returns {ParsedValue}
 */
export function parseValue(rawValue) {
  const value = rawValue.trim();

  const reference = VAR.exec(value);
  if (reference) {
    return { kind: 'ref', name: reference[1] };
  }

  if (HEX.test(value)) {
    return literal('color', normalizeHex(value));
  }

  const rem = REM.exec(value);
  if (rem) {
    return literal('dimension', { value: Number(rem[1]), unit: 'rem' });
  }

  // Must precede FONT_STACK: \w matches digits, so a bare weight would
  // otherwise be swallowed into a one-element family array.
  if (NUMBER.test(value)) {
    return literal('fontWeight', Number(value));
  }

  if (FONT_STACK.test(value)) {
    return literal(
      'fontFamily',
      value.split(',').map((family) => family.trim().replace(/^['"]|['"]$/g, '')),
    );
  }

  throw new Error(`unsupported value shape: ${rawValue}`);
}
