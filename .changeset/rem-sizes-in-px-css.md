---
'css-to-dtcg': minor
---

`--target figma` writes sizes in px instead of rem numbers (`0.875rem` → `14`), since Figma has no rem. The new `--base-font-size` flag (and `baseFontSize` option of `buildTokens`) sets how many px make a rem, 16 by default. `css-to-dtcg/units` exports the shared `remToPx` and `pxToRem`.
