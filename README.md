# figma-utils

Tools for keeping design tokens in sync between code and Figma.

| Package | What it does |
|---|---|
| [`css-to-dtcg`](packages/css-to-dtcg) | npm CLI + API: CSS custom properties → W3C DTCG tokens, plus files Figma can import |
| [`figma-plugin`](packages/figma-plugin) | "Export Design Tokens" Figma plugin: Figma variables → the same DTCG files, downloaded or as a GitHub pull request |
| [`examples/lumen-academy`](examples/lumen-academy) | A fictitious app showing the full loop |

## Development

    pnpm install
    pnpm build
    pnpm typecheck
    pnpm test

## Releasing `css-to-dtcg`

1. Add a changeset: `pnpm changeset`.
2. Merge to `main`; the Release workflow opens a "Version Packages" PR.
3. Merging that PR publishes to npm with provenance via npm trusted publishing.

The very first publish must be done by a maintainer (`cd packages/css-to-dtcg && npm publish`),
because npm only lets you configure a trusted publisher for a package that exists. Then, on
npmjs.com → css-to-dtcg → Settings → Trusted publishing, add this repository and the
`release.yml` workflow.

Licensed under MIT.
