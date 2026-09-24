# Lumen Academy

A made-up academy with three brands — **nova** (violet), **orbit** (teal) and
**ember** (amber) — and light/dark themes. It shows the full design-token loop
between CSS and Figma using [`css-to-dtcg`](../../packages/css-to-dtcg) and the
[Export Design Tokens](../../packages/figma-plugin) Figma plugin.

## Run the page

    pnpm --filter lumen-academy dev

## Token sources

| File | Set(s) |
|---|---|
| `src/css/colors.css` `:root` | `primitives` |
| `src/css/brands.css` `:root, [data-brand='nova']`, `[data-brand='orbit']`, `[data-brand='ember']` | `semantic/brand/*` (theme group **Brand**) |
| `src/css/theme.css` `:root`, `[data-mode='dark']` | `semantic/theme/light`, `semantic/theme/dark` (theme group **Theme**) |
| `src/css/typography.css` `:root` | `typography` |

`src/css/components.css` only consumes tokens.

## The loop

1. **CSS → tokens.** `pnpm --filter lumen-academy tokens` writes:
   - `tokens/` — DTCG files, one per set, plus `$themes.json`;
   - `figma/` — one file per Figma collection mode;
   - `figma-snapshot.json` — what the plugin would read after step 2 (used by tests).
2. **Tokens → Figma.** In a Figma design file, open *Local variables* and create these
   collections **in this order**, with these modes:

   | Collection | Modes |
   |---|---|
   | `primitives` | `default` |
   | `semantic/brand` | `nova`, `orbit`, `ember` |
   | `semantic/theme` | `light`, `dark` |
   | `typography` | `default` |

   Right-click each mode → **Import mode** and pick the matching
   `figma/<collection>/<mode>.tokens.json`. Then set the **Web code syntax** of the
   three font families: `family/body` → `Inter, sans-serif`, `family/title` →
   `Fraunces, serif`, `family/legend` → `'JetBrains Mono', monospace`. Finally set the
   scope of `weight/regular`, `weight/medium`, `weight/bold` and `weight/title` to
   **Font weight**: Import mode drops that scope, and the plugin refuses unscoped numbers.
3. **Figma → tokens.** Run **Export Design Tokens** and download the files, or open a
   pull request. The result equals `tokens/` byte for byte.

## Tests

    pnpm --filter lumen-academy test

fails if any generated file is stale — run `pnpm --filter lumen-academy tokens` and
commit the result.
