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

## Releasing

1. Add a changeset with each change: `pnpm changeset`.
2. When ready to release, run `pnpm changeset version` to bump `css-to-dtcg` and update its
   `CHANGELOG.md`, then commit that to `main`.
3. Tag the commit with the new version and push the tag:
   `git tag v0.1.0 && git push origin v0.1.0`.

The Release workflow checks that the tag matches the `css-to-dtcg` version, publishes it to
npm with provenance via npm trusted publishing, and creates a GitHub Release with the
changelog entry and the Figma plugin zipped (`manifest.json` + `dist/`, ready for Figma's
"Import plugin from manifest…").

The very first publish must be done by a maintainer (`cd packages/css-to-dtcg && npm publish`),
because npm only lets you configure a trusted publisher for a package that exists. Then, on
npmjs.com → css-to-dtcg → Settings → Trusted publishing, add this repository and the
`release.yml` workflow.

Licensed under MIT.
