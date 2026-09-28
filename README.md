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

`css-to-dtcg` (npm) and the Figma plugin (`export-design-tokens`) have separate versions,
changelogs and releases. Each release has a `<package>@<version>` tag, e.g.
`css-to-dtcg@0.2.0` or `export-design-tokens@0.1.0`.

1. Add a changeset with each change: `pnpm changeset`, and pick the package(s) it affects.
   A `css-to-dtcg` release also gives the plugin a patch release, because the plugin bundles it.
2. When ready to release, run `pnpm changeset version` to bump the versions and update the
   `CHANGELOG.md` files, then commit that to `main`.
3. On that commit, run `pnpm changeset tag` to tag every package whose new version isn't
   tagged yet, then push the tags: `git push --follow-tags`.

For each tag, the Release workflow checks that the tag matches the package version and creates
a GitHub Release with the changelog entry:

- `css-to-dtcg@…` publishes to npm with provenance via npm trusted publishing.
- `export-design-tokens@…` attaches the zipped plugin (`manifest.json` + `dist/`, ready for
  Figma's "Import plugin from manifest…") and becomes the repository's latest release.

The very first publish must be done by a maintainer (`cd packages/css-to-dtcg && npm publish`),
because npm only lets you configure a trusted publisher for a package that exists. Then, on
npmjs.com → css-to-dtcg → Settings → Trusted publishing, add this repository and the
`release.yml` workflow.

Licensed under MIT.
