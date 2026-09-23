// Same grammar as css-to-dtcg's values.js: quoted families, or unquoted
// identifier sequences that cannot start with a digit.
const FAMILY = String.raw`(?:'[^']+'|"[^"]+"|[A-Za-z_-][\w-]*(?:\s+[A-Za-z_-][\w-]*)*)`;
const FONT_STACK = new RegExp(String.raw`^${FAMILY}(?:\s*,\s*${FAMILY})*$`);

export function parseFontStack(text: string): string[] | null {
  const value = text.trim();
  if (!FONT_STACK.test(value)) {
    return null;
  }
  return value.split(',').map((family) => family.trim().replace(/^['"]|['"]$/g, ''));
}

export type FontFamilyResult = { ok: true; value: string[] } | { ok: false; reason: string };

/**
 * Figma can only hold one font name, so the fallback stack comes from the
 * variable's Web code syntax. Anything else there (e.g. var(--x)) is ignored.
 */
export function fontFamilyValue(value: string, web: string | undefined): FontFamilyResult {
  const stack = web ? parseFontStack(web) : null;

  if (!stack) {
    return { ok: true, value: [value] };
  }
  if (stack[0].toLowerCase() !== value.trim().toLowerCase()) {
    return { ok: false, reason: `Web code syntax starts with "${stack[0]}" but the value is "${value}"` };
  }
  return { ok: true, value: stack };
}
