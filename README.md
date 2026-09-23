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

Licensed under MIT.
