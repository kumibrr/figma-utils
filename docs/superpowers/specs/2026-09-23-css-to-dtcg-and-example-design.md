# `css-to-dtcg` package and Lumen Academy example

Date: 2026-09-23
Status: Draft for review
Repository: `figma-utils`
Companion spec: `2026-09-23-figma-plugin-token-export-design.md`

## Purpose

- **`css-to-dtcg`** — an npm package (CLI + API) that turns CSS custom properties
  into W3C DTCG token files. It generalizes the team's `scripts/design-tokens` script
  so any project can seed Figma from its CSS. Its default output is byte-identical to
  what the "Export Design Tokens" plugin exports, so CSS → Figma → plugin → tokens is
  a lossless loop.
- **`examples/lumen-academy`** — a fictitious app with made-up brands that
  demonstrates the whole loop and is the shared test data for both packages. No real
  team data lives in the repository.

## Repository layout

pnpm workspaces monorepo, MIT licence.

```
figma-utils/
  packages/
    figma-plugin/          Export Design Tokens (companion spec)
    css-to-dtcg/           this spec
  examples/
    lumen-academy/         this spec
  docs/superpowers/specs/
  .changeset/
  .github/workflows/       ci.yml, release.yml
  package.json             workspace root (private)
  pnpm-workspace.yaml
  LICENSE, README.md
```

Build order: monorepo + example data → figma plugin → `css-to-dtcg`.

## `css-to-dtcg`

### Form

- Unscoped npm package `css-to-dtcg` (name verified free on 2026-09-23).
- JavaScript with JSDoc types; `.d.ts` generated with `tsc --allowJs
  --declaration --emitDeclarationOnly` at publish time.
- ESM only, Node ≥ 20, no runtime dependencies (the regex parser from the original
  script is kept; the atom files it targets have no nested blocks).
- CLI: `css-to-dtcg [--config css-to-dtcg.config.js] [--target dtcg|figma]`.
  Default config path `./css-to-dtcg.config.js`, default target `dtcg`.
- API: `buildTokens(config, { target }) → { files: { path, json }[] }`, plus the
  shared helpers `deriveThemes` and `serialize` (see Sharing with the plugin).

```
packages/css-to-dtcg/
  src/
    cli.js            argument parsing, config loading, writes files
    index.js          buildTokens, public exports
    config.js         load + validate the config
    parse-css.js      from the original script (unchanged behaviour)
    values.js         from the original script, $type of references now from target
    naming.js         default hyphen rule + overrides + custom path
    index-names.js    global custom-property index for var() resolution
    themes.js         deriveThemes (shared with the plugin)
    serialize.js      JSON.stringify(x, null, 2) + "\n" (shared with the plugin)
    targets/dtcg.js   default output
    targets/figma.js  Figma "Import mode" output
  test/               original tests ported, plus new ones
  README.md
```

### Config

```js
// css-to-dtcg.config.js
export default {
  outDir: 'tokens',                    // dtcg target
  figmaOutDir: 'figma',                // figma target
  sets: [
    { name: 'primitives',           file: 'src/css/colors.css',     selector: ':root' },
    { name: 'semantic/brand/nova',  file: 'src/css/brands.css',     selector: ":root, [data-brand='nova']" },
    { name: 'semantic/brand/orbit', file: 'src/css/brands.css',     selector: "[data-brand='orbit']" },
    { name: 'semantic/brand/ember', file: 'src/css/brands.css',     selector: "[data-brand='ember']" },
    { name: 'semantic/theme/light', file: 'src/css/theme.css',      selector: ':root' },
    { name: 'semantic/theme/dark',  file: 'src/css/theme.css',      selector: "[data-mode='dark']" },
    { name: 'typography',           file: 'src/css/typography.css', selector: ':root' },
  ],
  themes: {
    Brand: ['semantic/brand/nova', 'semantic/brand/orbit', 'semantic/brand/ember'],
    Theme: ['semantic/theme/light', 'semantic/theme/dark'],
  },
  overrides: { /* '--name': ['path', 'segments'] */ },   // optional
  path: undefined,                                       // optional (name, setName) => string[]
  customSets: undefined,                                 // optional, see below
}
```

Validation (all errors reported together, then exit 1):

- every `file` exists; every `(file, selector)` block exists (selector compared as
  the trimmed selector text, as `parseBlocks` returns it);
- set names unique; every name in `themes` is a declared or custom set;
- all sets in one theme group share the same parent path (`semantic/brand/*`) — that
  parent becomes the Figma collection;
- a set belongs to at most one theme group;
- each group key equals the last segment of its parent path, first letter
  capitalized (`Brand` ↔ `semantic/brand`) — the plugin derives group names that way
  from Figma collection names, so any other key would break the lossless loop.

### Paths

For custom property `--a-b-c` in set `S`, with `root = firstSegment(S)`:

1. `path(name, S)` if the config provides it — returns the full path including root;
2. else `overrides[name]` → `[root, ...override]`;
3. else `[root, ...name.slice(2).replaceAll('--', '-').split('-')]`.

`--gray-100` in `primitives` → `primitives.gray.100`.

The same custom property must map to the same path in every set it appears in
(e.g. `--brand-700` in every brand set); otherwise it is an error.

### Values

Same grammar as the original `values.js`, in the same precedence:

| CSS value | Token |
|---|---|
| `var(--x)` | `$value: "{path of --x}"`; `$type` = the target token's `$type` (followed transitively) |
| hex `#rgb…#rrggbbaa` | `color`, lowercased |
| `<n>rem` | `dimension`, `{ value: n, unit: "rem" }` |
| bare integer | `fontWeight` |
| font stack | `fontFamily`, array, quotes stripped |
| anything else | error: unsupported value shape |

`var(--x)` resolution uses a global index of every custom property declared in any
set (declared or custom). Not found → error (never a dangling alias). Reference
cycles → error.

Differences from the original script, both intentional: references take `$type` from
their target (the script always wrote `color`), and resolution is by index rather
than per-set resolver functions.

### Custom sets hook

For projects whose CSS does not spell every mode out as a selector block (the team's
real project synthesizes one brand set per `--<brand>-p-*` ramp):

```js
customSets: ({ blocks }) => ({
  sets: [{ name: 'semantic/brand/age360', declarations: new Map([['--academy-p-700', 'var(--age360-p-700)'], …]) }, …],
  consumes: ['--academy-p-100', …],   // removed from the declared sets they appear in
})
```

- `blocks(file)` returns the parsed blocks of a CSS file (`parseBlocks` output).
- Returned sets go through the same path, value, index and theme logic as declared
  sets.
- Every consumed name must appear in at least one custom set.

### Completeness check

Built in and generic, replacing the original hard-coded counts: every custom property
in every declared block reaches the output exactly once per set, unless consumed by
`customSets`. Missing or duplicated names fail the build with the list of names.
Plain (non-custom) declarations and blocks not referenced by any set are ignored,
as the script ignored `.text--*`.

### Themes

`$themes.json` uses the plugin's rule, implemented once in `themes.js` and shared:

- one theme per set listed in `themes`; `group` = config key, `name` = last segment
  of the set name;
- `selectedTokenSets`: every set not in any group that the theme's set reaches
  through references (transitively, following all sets of any group it passes
  through) is `"source"`, in config set order; then the theme's own set `"enabled"`.

### `dtcg` target (default)

Written to `outDir`:

- `<setName>.json` per set, config order; `$themes.json`.
- Tokens nested under the full path, key order `$type`, `$value`.
- Serialized with the shared `serialize` (2-space JSON + trailing newline).

This is exactly the plugin's multi-file export.

### `figma` target

Written to `figmaOutDir`, shaped like Figma's native **Export modes** output (format
observed from a real export on 2026-09-23) so each file can be loaded with
**Import mode**:

- **Collections and modes**: a set in a theme group → collection = the group's
  shared parent path, mode = last segment (`semantic/brand/nova` → collection
  `semantic/brand`, mode `nova`). A set in no group → collection = set name, single
  mode `default`.
- **Files**: `<figmaOutDir>/<collection>/<mode>.tokens.json`; root
  `$extensions: { "com.figma.modeName": "<mode>" }`.
- **Paths**: the root segment is dropped (Figma variable `gray/100` in collection
  `primitives`); nesting follows the remaining segments.
- **Values**

  | DTCG token | Figma token |
  |---|---|
  | `color` hex | `$type: "color"`, `$value: { colorSpace: "srgb", components: [r,g,b] (0..1), alpha, hex: "#RRGGBB" }` |
  | `dimension` rem | `$type: "number"`, `$value: <rem number>` (Figma numbers hold rem by convention) |
  | `fontWeight` | `$type: "number"` |
  | `fontFamily` | `$type: "string"`, first family only, `com.figma.type: "string"` |

- **Scopes** (`com.figma.scopes`): `["FONT_WEIGHT"]` for font weights,
  `["FONT_FAMILY"]` for font families, `["ALL_SCOPES"]` otherwise. The plugin relies
  on these to recover `$type`.
- **Aliases**: same collection → `"{path.without.root}"`. Other collection → the
  resolved literal value plus `com.figma.aliasData: { targetVariableName,
  targetVariableSetName }` (Figma's export also carries ids, which do not exist
  before import).
- The CLI prints the import order: a stable topological sort of collections (every
  alias target first, ties kept in config order — for the example `primitives`,
  `semantic/brand`, `semantic/theme`, `typography`); a cycle between collections is
  an error. Collections must be created in Figma in this order, because the plugin
  orders `$themes.json` by Figma collection order.

Known manual step after import, documented in the README: Figma's format has no
field for Web code syntax, so font-family fallback stacks (`serif`) must be entered
by hand as each font-family variable's Web code syntax. The plugin reads them from
there.

### Sharing with the plugin

The plugin imports `deriveThemes` and `serialize` from the `css-to-dtcg` workspace
package, so the two tools cannot drift on the `$themes.json` rule or JSON formatting.
Everything else in the plugin is Figma-specific.

### Release

- Changesets for versioning and changelog.
- `release.yml`: on `main`, the Changesets action opens a version PR; merging it
  publishes to npm with provenance via npm trusted publishing (OIDC), no long-lived
  npm token.
- The Figma plugin is published manually to the organization; it is marked
  `private` in its `package.json`.

## `examples/lumen-academy`

Fictitious "Lumen Academy" with three brands, built with Vite and plain HTML, CSS
and TypeScript (no framework).

```
examples/lumen-academy/
  index.html, src/main.ts             page + brand/theme switchers
  src/css/colors.css                  :root — nova (violet), orbit (teal), ember (amber)
                                      ramps 100–1000, gray 100–1000, base black/white,
                                      status info/success/warning/error
  src/css/brands.css                  :root, [data-brand='nova'] / [data-brand='orbit'] /
                                      [data-brand='ember'] — --brand-100…1000 rebound
  src/css/theme.css                   :root (light), [data-mode='dark'] — semantic layer
  src/css/typography.css              :root — --size-*, --leading-*, --weight-*, --family-*
                                      (Inter body, Fraunces title, JetBrains Mono legend)
  src/css/components.css              buttons, cards, text scale (consumers only)
  css-to-dtcg.config.js
  tokens/                             generated, committed (dtcg target)
  figma/                              generated, committed (figma target)
  figma-snapshot.json                 generated, committed (plugin golden input)
  scripts/make-snapshot.js            figma/ → figma-snapshot.json (simulated import)
  README.md                           the full loop, step by step
```

- Property names are chosen to fit the default hyphen rule without collisions
  (`--text-default` / `--text-muted`, never `--text` alongside `--text-muted`).
- The page: header with brand and light/dark switchers (setting `data-brand` /
  `data-mode` on `<html>`), a row of buttons, a few cards, a text-scale sample.
- `scripts/make-snapshot.js` simulates Figma's import of `figma/`: numbers through
  `Math.fround`, colours as 0..1 floats, scopes from `com.figma.scopes`, aliases from
  `{…}` and `aliasData`, and Web code syntax set from the dtcg font stacks (the
  documented manual step). It writes the plugin `Snapshot` shape.

### README loop

1. `pnpm css-to-dtcg` → `tokens/`; `pnpm css-to-dtcg --target figma` → `figma/`.
2. In Figma: create the collections and modes, **Import mode** each file in the
   printed order, then set Web code syntax on font-family variables.
3. Run Export Design Tokens → download or PR.
4. The exported files equal `tokens/`.

## Testing

- **Original tests** (`parse-css`, `values`, and the relevant parts of `build`)
  ported to the package unchanged in intent; team-specific naming and count tests
  are replaced by generic ones.
- **Unit tests** per module: naming (default rule, overrides, `path`, consistency
  error), index (resolution, missing, cycles, `$type` from target), themes, config
  validation, completeness, custom sets, both targets.
- **Example golden tests**: running both targets on the example reproduces the
  committed `tokens/` and `figma/` byte for byte.
- **Round-trip test** (lives in the plugin package): `buildExport(figma-snapshot.json)`
  equals `examples/lumen-academy/tokens/` byte for byte.
- **Figma verification task (first in the plan)**: import `figma/` into a real Figma
  file and confirm (1) `com.figma.scopes` is applied on import, (2) cross-collection
  aliases resolve from `aliasData` without ids, (3) raw numbers read back through the
  plugin API as float32 (`0.2` → `0.20000000298023224`). Any difference changes the
  `figma` target and `make-snapshot.js` before the rest is built.
- **CI** (`ci.yml`): `pnpm install`, type checks, `vitest run` across the workspace,
  example golden checks.

## Decisions log

| Topic | Decision |
|---|---|
| Repo | `figma-utils` pnpm monorepo; no "magpie" naming |
| Package | `css-to-dtcg`, unscoped, CLI + API, JS + JSDoc, ESM, Node ≥ 20 |
| Genericity | Config-driven sets `(file, selector)`, theme groups, overrides/path, customSets hook |
| Brands | Explicit selector blocks; hook keeps the team's current CSS working |
| References | Global index; `$type` from target; missing/cyclic → error |
| Completeness | Generic "every property exactly once" check |
| Themes / JSON | Shared with the plugin (`deriveThemes`, `serialize`) |
| Figma import | `--target figma` shaped like native Export modes; scopes set; code syntax manual |
| Example | Lumen Academy (nova, orbit, ember), Vite + plain TS |
| Release | Changesets + npm trusted publishing with provenance; plugin manual |
