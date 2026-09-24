# css-to-dtcg

Turn CSS custom properties into [W3C DTCG](https://www.designtokens.org/) design tokens —
and into files Figma can import mode by mode.

The default output is byte-identical to what the **Export Design Tokens** Figma plugin
exports, so you can seed Figma from your CSS, let Figma become the source of truth, and
export back without noise.

## Install

    npm install --save-dev css-to-dtcg

## Configure

Create `css-to-dtcg.config.js` (ESM) next to your `package.json`:

```js
export default {
  outDir: 'tokens',
  figmaOutDir: 'figma',
  sets: [
    { name: 'primitives', file: 'src/css/colors.css', selector: ':root' },
    { name: 'semantic/brand/nova', file: 'src/css/brands.css', selector: ":root, [data-brand='nova']" },
    { name: 'semantic/brand/orbit', file: 'src/css/brands.css', selector: "[data-brand='orbit']" },
    { name: 'semantic/theme/light', file: 'src/css/theme.css', selector: ':root' },
    { name: 'semantic/theme/dark', file: 'src/css/theme.css', selector: "[data-mode='dark']" },
    { name: 'typography', file: 'src/css/typography.css', selector: ':root' },
  ],
  themes: {
    Brand: ['semantic/brand/nova', 'semantic/brand/orbit'],
    Theme: ['semantic/theme/light', 'semantic/theme/dark'],
  },
};
```

- **sets** — each set is the custom properties of one selector block in one file. Blocks
  with the same selector in a file are merged. Paths are relative to the config file.
- **themes** — sets that are modes of one axis (one Figma collection). A group needs at
  least two sets, all declaring the same custom properties (a Figma variable has a value
  in every mode). The key must be the capitalized last segment of the sets' shared parent
  (`Brand` for `semantic/brand/*`).
- **overrides** — `{ '--color-white': ['base', 'white'] }` to place a name elsewhere.
- **path** — `(cssName, setName) => string[]` to replace the naming rule entirely. The
  first segment must be the set's first segment.
- **customSets** — `({ blocks }) => ({ sets: [{ name, declarations: Map }], consumes: [] })`
  to build sets your CSS doesn't spell out as blocks. `consumes` removes names from the
  declared sets.

## Rules

| CSS | Token |
|---|---|
| `var(--x)` | `{path.of.x}`, `$type` taken from the target |
| `#rgb`, `#rrggbb`, `#rrggbbaa` | `color`, normalized to lowercase 6/8 digits |
| `0.875rem` | `dimension` `{ value: 0.875, unit: "rem" }` |
| `700` | `fontWeight` |
| `'Roboto Slab', serif` | `fontFamily` `["Roboto Slab", "serif"]` |

Names become paths by splitting on `-` under the set's first segment:
`--gray-100` in `primitives` → `primitives.gray.100`.

CSS keywords and named colours (`transparent`, `none`, `red`, …) are unsupported values,
never font families.

The build fails — listing every problem at once — on unsupported values, references to
undeclared properties, cycles, path collisions, duplicate declarations and invalid theme
groups. Nothing is silently dropped.

## Run

    npx css-to-dtcg                    # DTCG files into outDir
    npx css-to-dtcg --target figma     # Figma Import-mode files into figmaOutDir

The output directory is replaced on every run. It must be inside the project, must not
contain any source CSS file, and `outDir` and `figmaOutDir` must not be inside each other.

## Importing into Figma

`--target figma` writes `<collection>/<mode>.tokens.json` and prints the order to import
collections in. In Figma, create each collection with its modes **in that order**, then
right-click each mode → **Import mode**. Afterwards:

- for every font-family variable, set its **Web code syntax** to the full stack
  (e.g. `'Roboto Slab', serif`) — Figma's format has no field for fallbacks;
- for every font-weight variable, set its scope to **Font weight** — the files include it,
  but Import mode drops that one scope.

Colours import with all scopes and sizes with every size scope (radius, width/height, gap,
stroke, effects, font size, line height, letter and paragraph spacing).

## API

```js
import { buildTokens } from 'css-to-dtcg';

const { files, importOrder } = buildTokens(config, { target: 'dtcg', root: process.cwd() });
```

`css-to-dtcg/themes` (`deriveThemes`) and `css-to-dtcg/serialize` (`serialize`) are
browser-safe and shared with the Figma plugin.

## License

MIT
