# css-to-dtcg

## 0.3.0

### Minor Changes

- 9be5f6a: `--target figma` writes sizes in px instead of rem numbers (`0.875rem` → `14`), since Figma has no rem. The new `--base-font-size` flag (and `baseFontSize` option of `buildTokens`) sets how many px make a rem, 16 by default. `css-to-dtcg/units` exports the shared `remToPx` and `pxToRem`.

## 0.2.0

### Minor Changes

- 2bda36e: First release: CSS custom properties to DTCG tokens and Figma Import-mode files.
- 9989e1b: Export `SIZE_SCOPES` from `css-to-dtcg/scopes`, the scopes the `figma` target gives sizes.
