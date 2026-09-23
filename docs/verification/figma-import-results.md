# Figma import verification

Date:
Figma version (desktop/browser):

## Procedure

1. In a new Figma design file, open Local variables.
2. Create a collection named `primitives`. Right-click its only mode → **Import mode** →
   `docs/verification/figma-import/primitives/default.tokens.json`.
3. Create a collection named `semantic/theme` with two modes, `light` and `dark`.
   Import `semantic-theme/light.tokens.json` into `light` and `semantic-theme/dark.tokens.json` into `dark`.
4. Answer the questions below.
5. Right-click the `primitives` collection → **Export modes**, and paste the exported JSON for
   `size/ratio`, `size/s` and `weight/bold` under question 3.

## Questions

1. Scopes: does `weight/bold` show only "Font weight" in its scoping, and `family/title` only "Font family"?
   Answer:
2. Cross-collection alias: does `text/default` in `semantic/theme` show as an alias to `primitives` → `gray/900` (light) and `gray/100` (dark), not as a raw colour?
   Answer:
3. Numbers: what do `size/ratio` (typed 0.2) and `size/s` (0.875) look like in the re-export?
   Answer:
4. Same-collection alias: does `text/muted` alias `text/default`?
   Answer:
5. Did the import show any warnings or errors? Paste them.
   Answer:

## Consequences for the `figma` target

(Filled in by the executor from the answers: which of `com.figma.scopes`, `aliasData` without ids,
and plain `{…}` references work, and what must change in Task 8.)
