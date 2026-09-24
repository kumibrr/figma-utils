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
   Answer: `family/title` shows only "Font family". `weight/bold` shows all scopes (see question 3).
2. Cross-collection alias: does `text/default` in `semantic/theme` show as an alias to `primitives` → `gray/900` (light) and `gray/100` (dark), not as a raw colour?
   Answer: Yes, both modes are linked to `primitives`.
3. Numbers: what do `size/ratio` (typed 0.2) and `size/s` (0.875) look like in the re-export?
   Answer: `size/ratio` → `0.20000000298023224`, `size/s` → `0.875`, `weight/bold` → `700`.
   All three re-export with `"com.figma.scopes": ["ALL_SCOPES"]`, although the import file gave
   `weight/bold` `["FONT_WEIGHT"]`: Import mode dropped that scope (it kept `FONT_FAMILY`, see question 1).

   ```json
   "size": {
     "s": { "$type": "number", "$value": 0.875,
       "$extensions": { "com.figma.variableId": "VariableID:1:6", "com.figma.scopes": ["ALL_SCOPES"] } },
     "ratio": { "$type": "number", "$value": 0.20000000298023224,
       "$extensions": { "com.figma.variableId": "VariableID:1:7", "com.figma.scopes": ["ALL_SCOPES"] } }
   },
   "weight": {
     "bold": { "$type": "number", "$value": 700,
       "$extensions": { "com.figma.variableId": "VariableID:1:8", "com.figma.scopes": ["ALL_SCOPES"] } }
   }
   ```
4. Same-collection alias: does `text/muted` alias `text/default`?
   Answer: Yes.
5. Did the import show any warnings or errors? Paste them.
   Answer: No.

## Consequences for the `figma` target

- `com.figma.aliasData` without ids works for cross-collection aliases.
- Plain `{…}` references work for same-collection aliases.
- Numbers come back as float32 (`0.2` → `0.20000000298023224`); the plugin already recovers `0.2`.
- `com.figma.scopes` kept `FONT_FAMILY` on a string but dropped `FONT_WEIGHT` on a number.
  Because the plugin derives `fontWeight` from that scope, an imported weight would export as a
  `dimension`. `scope-probe/default.tokens.json` narrows down which input Figma honours.

## Scope probe

Import `docs/verification/figma-import/scope-probe/default.tokens.json` into the only mode of a new
collection named `scope-probe`, then paste its **Export modes** output here.

Result (2026-09-24):

| Probe | Import | Re-export |
| --- | --- | --- |
| `a` number, `["FONT_WEIGHT"]` | imported | `["ALL_SCOPES"]` |
| `b` `$type: fontWeight` | **skipped, no warning** | — |
| `c` `$type: fontWeight` + `["FONT_WEIGHT"]` | **skipped, no warning** | — |
| `d` number, `["FONT_SIZE"]` | imported | `["FONT_SIZE"]` |
| `e` number, `["FONT_WEIGHT", "OPACITY"]` | imported | `["OPACITY"]` |
| `f` string, `["FONT_FAMILY"]` | imported | `["FONT_FAMILY"]` |
| `g` `$type: fontFamily` | imported as string | `["ALL_SCOPES"]` |

Import mode keeps every scope except `FONT_WEIGHT`, which it always drops, and it skips DTCG
`fontWeight` tokens. No import file can mark a number as a font weight; that scope has to be set in
Figma after importing.

Decision: the `figma` target gives sizes every size scope (everything but Opacity and Font weight)
and keeps `["FONT_WEIGHT"]` on weights in case Figma starts honouring it. The plugin refuses a number
variable with no scopes or `ALL_SCOPES`, so an imported weight whose scope was not set by hand blocks
the export instead of becoming a rem dimension.
