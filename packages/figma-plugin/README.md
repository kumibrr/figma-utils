# Export Design Tokens (Figma plugin)

Exports the current file's local Figma variables as W3C DTCG design tokens — downloaded
to your computer or opened as a pull request on GitHub. Works in the normal editor and
in Dev Mode. Output is byte-identical to [`css-to-dtcg`](../css-to-dtcg).

## Output

- One set per collection (single mode) or per mode (`<collection>/<mode>.json`), plus
  `$themes.json` (one theme per mode of every multi-mode collection).
- Token types come from variable scopes: colours → `color`; numbers → `dimension` (rem)
  or `fontWeight` (Font weight scope); strings with the Font family scope → `fontFamily`.
  The fallback stack comes from the variable's **Web code syntax**, e.g. `'Roboto Slab', serif`.
- Aliases stay references (`{primitives.gray.900}`). Aliases to library variables are errors.
- Any problem blocks the export and every problem is listed.

## GitHub

Settings (gear icon): repository `owner/repo`, base branch, folder, and a fine-grained
personal access token with **Contents** and **Pull requests** read/write on that
repository. The token is stored with `figma.clientStorage` on your machine and is never
shown again. Each export creates `styles/figma-export-<UTC timestamp>`, replaces the
folder in one commit, and opens a pull request. Nothing changed → nothing is created.

## Develop

    pnpm install
    pnpm --filter css-to-dtcg build
    pnpm --filter export-design-tokens build      # dist/code.js + dist/index.html
    pnpm --filter export-design-tokens test

Import `manifest.json` in Figma desktop (Plugins → Development → Import plugin from
manifest…). See `docs/manual-test.md` before publishing.

## Publish to your organization

1. In Figma, Plugins → Development → the plugin → **Publish**. Figma assigns a plugin id;
   put it in `manifest.json` `"id"` (replacing `export-design-tokens-dev`) and commit.
2. Choose your organization as the audience (not Community).
