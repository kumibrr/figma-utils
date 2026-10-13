# figma-utils

Tools for keeping design tokens in sync between code and Figma.

| Package | What it does |
|---|---|
| [`css-to-dtcg`](packages/css-to-dtcg) | npm CLI + API: CSS custom properties → W3C DTCG tokens, plus files Figma can import |
| [`figma-plugin`](packages/figma-plugin) | "TokenSync" Figma plugin: Figma variables → the same DTCG files, downloaded or as a GitHub pull request |
| [`examples/lumen-academy`](examples/lumen-academy) | A fictitious app showing the full loop |

## Development

    pnpm install
    pnpm build
    pnpm typecheck
    pnpm test

## Releasing

`css-to-dtcg` (npm) and the Figma plugin (`tokensync`) have separate versions,
changelogs and releases. Each release has a `<package>@<version>` tag, e.g.
`css-to-dtcg@0.2.0` or `tokensync@2.1.0`.

1. Add a changeset with each change: `pnpm changeset`, and pick the package(s) it affects.
   A `css-to-dtcg` release also gives the plugin a patch release, because the plugin bundles it.
2. When ready to release, run `pnpm changeset version` to bump the versions and update the
   `CHANGELOG.md` files, then commit that to `main`.
3. On that commit, run `pnpm changeset tag` to tag every package whose new version isn't
   tagged yet, then push the tags: `git push --follow-tags`.

For each tag, the Release workflow checks that the tag matches the package version and creates
a GitHub Release with the changelog entry:

- `css-to-dtcg@…` stages the version on npm with provenance. It isn't public until a
  maintainer approves it (see below).
- `tokensync@…` attaches the zipped plugin (`manifest.json` + `dist/`, ready for
  Figma's "Import plugin from manifest…") and becomes the repository's latest release.

The workflow stages with the `NPM_TOKEN` repository secret: a granular access token from
npmjs.com with "Read and write (stage only)" access to `css-to-dtcg`, added under GitHub →
Settings → Secrets and variables → Actions. To publish a staged version, find its stage ID and
approve it with your 2FA code:

```sh
npm stage list css-to-dtcg
npm stage approve <stage-id>
```

Licensed under MIT.
