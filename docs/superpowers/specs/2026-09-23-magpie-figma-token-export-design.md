# Magpie — Figma design-token export plugin

Date: 2026-09-23
Status: Draft for review

## Purpose

Magpie is a Figma plugin that exports a file's local variables as W3C DTCG design
tokens, in the same shape the existing `scripts/design-tokens` script produces from
the CSS atoms. Figma is the source of truth; the export goes either to the user's
computer or, as a pull request, to a GitHub repository where a separate Action
(out of scope) imports it into the UI components project.

- Runs in the normal Figma editor and in Dev Mode.
- The repository is open source (MIT). The plugin itself is published privately to
  the team's Figma organization, not to Community.
- Because the code is public, nothing is hard-coded to the team's naming (brands,
  `academy`, `semantic`, …). Every rule is derived from generic Figma structure.

## Scope

In scope: local variables of the current file (collections, modes, values, aliases,
scopes, descriptions, Web code syntax).

Out of scope for v1: styles (text/effect/grid), library variables, `$metadata.json`,
editable commit/PR text, oklch output (designed for, not built), the import Action.

## Architecture

```
manifest.json            editorType ["figma","dev"], capabilities ["inspect"],
                         permissions ["currentuser"], documentAccess "dynamic-page",
                         networkAccess.allowedDomains ["https://api.github.com"]
src/
  plugin/                Figma main thread — the only code that touches figma.*
    main.ts              opens UI, answers messages, clientStorage get/set,
                         figma.openExternal, closePlugin
    snapshot.ts          local collections + variables → Snapshot (plain JSON)
  core/                  pure, no Figma, no DOM
    build-export.ts      buildExport(snapshot) → { files, errors }
    sets.ts              collection/mode → set path; variable name → token path
    tokens.ts            one variable value → DTCG token
    color.ts             Figma RGBA → JSON colour value (hex now, oklch later)
    numbers.ts           recover the typed decimal from Figma's float
    font-stack.ts        parse a Web code syntax font stack
    themes.ts            $themes.json derivation
    single-file.ts       sets + themes → one tokens.json object
  github/
    client.ts            thin fetch wrapper over api.github.com, error mapping
    publish.ts           base → tree → commit → branch → compare → PR
  ui/                    Preact, runs in the plugin iframe
    App.tsx, ExportDialog, FileList, ExportButton (split + menu),
    GitHubSettings, ErrorList, ResultBanner
    state.ts             screen logic as plain functions (tested)
    download.ts          Blob downloads, zip via fflate
  shared/messages.ts     typed main ↔ UI message protocol
```

Tooling: TypeScript (strict), Preact, Vite with `vite-plugin-singlefile` for the UI
HTML, esbuild (or Vite library build) for `main.ts`, Vitest, pnpm. `themeColors: true`
so the UI uses Figma's CSS variables and follows Figma light/dark.

### Data flow

1. On open, the main thread takes a `Snapshot` and posts it to the UI.
2. The UI runs `buildExport` and renders the file preview or the error list.
3. Before every export action the UI requests a fresh snapshot and rebuilds, so an
   open window never exports stale data. A refresh icon on the preview does the same.
4. Downloads, zipping and GitHub calls happen in the UI iframe.
5. Settings, the token and the remembered destination are stored by the main thread
   in `figma.clientStorage` (per user, per machine), because only the main thread has
   access to it.

The Snapshot boundary is what makes the conversion testable: `core/` is exercised
entirely with fixture snapshots.

## Snapshot

```ts
type RGBA = { r: number; g: number; b: number; a: number } // 0..1, as Figma gives
type Value = RGBA | number | string | boolean | { aliasId: string }

type Snapshot = {
  fileName: string
  userName: string | null
  collections: {
    id: string
    name: string
    modes: { id: string; name: string }[]
    variableIds: string[]            // Figma order
  }[]                                // Figma order
  variables: {
    id: string
    name: string                     // "gray/100"
    collectionId: string
    resolvedType: 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN'
    scopes: string[]
    description: string
    codeSyntax: { WEB?: string }
    valuesByMode: Record<string, Value>
  }[]
}
```

Only local variables are included. An alias whose target id is not in the snapshot
(e.g. a library variable) is an error at build time.

## Conversion rules

### Sets and paths

- **Set path**: single-mode collection → `collection.name`; multi-mode collection →
  `collection.name + "/" + mode.name`, one set per mode.
- **Token path**: `[firstSegment(collection.name), ...variable.name.split("/")]`.
  `gray/100` in `primitives` → `primitives.gray.100`; `primary` in `semantic/theme`
  → `semantic.primary`.
- **Order**: sets follow collection order then mode order; keys inside a set follow
  `variableIds` order.

### Values

Evaluated per variable per mode. Aliases are checked first.

| Figma | DTCG token |
|---|---|
| Alias to a local variable | `$value: "{target.token.path}"`; `$type` from the aliasing variable's own type/scopes (rows below) |
| `COLOR` | `$type: "color"`, `$value` lowercase `#rrggbb`, or `#rrggbbaa` when alpha < 1 (channels `round(c × 255)`) |
| `FLOAT`, scopes include `FONT_WEIGHT` | `$type: "fontWeight"`, `$value: <number>` |
| any other `FLOAT` | `$type: "dimension"`, `$value: { value: <number>, unit: "rem" }` |
| `STRING`, scopes include `FONT_FAMILY` | `$type: "fontFamily"`, `$value: string[]` (see Font family) |
| anything else | error |

Key order inside a token: `$type`, `$value`, then `$description` only when the Figma
description is non-empty.

**Colour isolation.** Only `color.ts` knows how a colour is written. The planned
migration to oklch (DTCG `{ colorSpace: "oklch", components: [...], alpha }`) is a
change to that module and its tests alone.

**Numbers.** Values are never parsed or computed on; the goal is to emit exactly the
decimal the designer typed. Figma returns `FLOAT` values as JS numbers at reduced
(32-bit) precision, so `0.85` may arrive as `0.8500000238418579`. `numbers.ts`
returns the shortest decimal `d` (trying `toPrecision(1..17)`) that maps back to
`x`: when `x` is exactly representable as a float32 (`Math.fround(x) === x`), the
test is `Math.fround(Number(d)) === x`; otherwise it is `Number(d) === x`. So a
float32 value recovers what was typed, and a full double is left untouched.
Values are emitted as JSON numbers, matching the existing script and DTCG.

### Font family

For a non-alias `STRING` with `FONT_FAMILY` scope and value `v`:

1. If `codeSyntax.WEB` is a font stack (same grammar as `values.js` `FONT_STACK`:
   comma-separated names, optionally quoted), split on commas, trim, strip quotes.
   - If the first family ≠ `v` (case-insensitive, trimmed) → error (the two drifted).
   - Otherwise `$value` is the split list, e.g. `["Roboto Slab", "serif"]`.
2. Otherwise (no Web code syntax, or something like `var(--title-font-family)`) →
   `$value: [v]`.

Aliased font-family variables are exported as `{path}` and never read their own code
syntax; the fallback stays on the target.

### `$themes.json`

- One theme per mode of every multi-mode collection, in collection then mode order.
- `group`: last segment of the collection name, first letter capitalized
  (`semantic/brand` → `Brand`). `name`: mode name.
- `selectedTokenSets`: every single-mode set reachable from this mode's values through
  alias chains is `"source"` (in set order), then the theme's own set as `"enabled"`.
  When a chain enters another multi-mode collection, all of that collection's modes
  are followed (light → `semantic.academy.*` → `primitives`), but multi-mode sets are
  never listed — the other theme group selects them.
- No multi-mode collections → `[]`.

This deliberately differs from the sample, where `light`/`dark` omit
`primitives: "source"`; one rule has to hold for every theme.

No `$metadata.json` is produced: only Tokens Studio reads it, and the code project
does not need it.

### Output files

- JSON text: `JSON.stringify(value, null, 2) + "\n"`, identical to the script.
- **Multiple files**: `<setPath>.json` per set, then `$themes.json`.
- **Single file**: `tokens.json` = `{ [setPath]: tree, …, "$themes": [...] }`.

### Errors

`buildExport` validates everything and returns every error; any error blocks both
destinations. Each error carries collection name, variable name, mode (when relevant)
and a reason:

- alias to a variable that is not local
- unsupported type/scope (`BOOLEAN`, `STRING` without `FONT_FAMILY`, string font weight)
- path collision: a token and a group share a path (`gray` and `gray/100`), or two
  collections yield the same set path
- Web code syntax font stack whose first family differs from the value

## UI

Single window, based on the provided mockup, Figma theme colours, identical in both
editors.

```
┌ Export tokens ─────────────── ⚙ ┐
│ [ Single file | Multiple files ] │
│ Preview                        ⟳ │
│ ┌──────────────────────────────┐ │
│ │ 🗎 primitives.json         ⤓ │ │
│ │ 🗎 semantic/brand/age360.json│ │
│ │ 🗎 …                         │ │
│ │ 🗎 $themes.json              │ │
│ └──────────────────────────────┘ │
│              [Cancel] [Export ▾] │
└──────────────────────────────────┘
```

- **Format toggle**: Single file / Multiple files. Default Multiple files.
- **Preview**: full relative paths. Clicking a row downloads that file alone (hover
  shows a download icon). Single file mode lists `tokens.json`.
- **Export button**: split button. The main part performs the selected destination;
  the ▾ opens a menu:
  - **Export to GitHub repo** — default on first use. Button is black with the
    GitHub logo. Always exports multiple files; the menu item notes "(multiple files)".
  - **Export to this computer** — blue Figma button with a download icon. Downloads
    `tokens.zip` (containing `tokens/…`) or `tokens.json`.
  Picking a menu item only changes the destination; it does not export. The choice is
  remembered per user in `clientStorage`.
- **Cancel** closes the plugin.
- **States**
  - Loading: spinner in the list while the snapshot is read.
  - Errors: the list is replaced by the error list grouped by collection
    (`variable — reason`); Export is disabled until a refresh is clean.
  - Empty: "No local variables in this file."; Export disabled.
  - Publishing: spinner on Export plus the current step ("Creating branch…",
    "Committing…", "Opening PR…").
  - Result banner: "PR #42 opened" + **Open** (via `figma.openExternal`);
    "No changes vs `main`"; or a readable error. Errors never offer a token
    replacement.
- **GitHub settings** (⚙, or Export to GitHub when not configured)
  - Repository `owner/repo`, Base branch (default `main`), Folder (default `tokens`).
  - Token, write-only:
    - none saved → password field plus a link explaining how to create a fine-grained
      token with *Contents* and *Pull requests* read/write.
    - saved → "Token saved" and **Replace token**. The token is never shown again.
    - Replace token → an empty field appears; the saved token is kept. Submitting
      overwrites the saved token with the new one. Cancelling keeps the old one.
  - Save runs the settings check (below) and shows the result inline.

## GitHub

Token stored in `clientStorage`, sent as `Authorization: Bearer <token>`. Requests run
from the UI iframe to `https://api.github.com`.

### Settings check

- `GET /repos/{owner}/{repo}` → exists and `permissions.push === true`.
- `GET /repos/{owner}/{repo}/branches/{base}` → base branch exists.

### Publish

1. `GET /git/ref/heads/{base}` → base commit; `GET /git/commits/{sha}` → base tree.
2. Walk the tree down to `{folder}` segment by segment, then list that subtree
   recursively (avoids truncation of full-repo recursive listings).
3. `POST /git/trees` with `base_tree` = base tree:
   - every exported file at `{folder}/{path}`, mode `100644`, inline `content`;
   - every existing file under `{folder}` not in the export with `sha: null` (delete).
4. If the new tree sha equals the base tree sha → "No changes vs `{base}`"; stop.
   Nothing is created.
5. `POST /git/commits` — message `chore(tokens): export from Figma`, parent = base.
6. `POST /git/refs` — `refs/heads/styles/figma-export-YYYYMMDD-HHmmss` (UTC).
7. `GET /compare/{base}...{commitSha}` → added / modified / removed file lists.
8. `POST /pulls` — title `chore(tokens): export from Figma`, head = new branch,
   base = `{base}`, body = Figma file name, exporting user, file summary.
9. Show the PR number and link.

The exported format is always multiple files, regardless of the toggle.

### Error mapping

| Condition | Message |
|---|---|
| 401 | GitHub rejected the token. |
| 403 with rate-limit headers exhausted | GitHub rate limit reached; try again at HH:MM. |
| 403 otherwise | The token has no permission for this repository. |
| 404 | Repository or branch not found. |
| 409 | The repository is empty. |
| 422 on ref creation | Branch already exists. |
| network failure | Couldn't reach GitHub. |

If a step fails after the branch was created, the branch is left in place and the
message names it. The plugin never deletes anything remotely.

## Testing and verification

- **core/** — TDD with Vitest; one test file per module (tokens, color, numbers,
  font-stack, sets, themes, errors).
- **Golden test** — a fixture `Snapshot` reconstructed from the sample `tokens.zip`
  (numbers passed through `Math.fround`, colours as 0..1 floats, font families with
  Web code syntax stacks). Expected output: the sample files verbatim, except
  `$themes.json` where `light`/`dark` gain `primitives: "source"`.
- **Real-data fixture** — a hidden development command logs the real `Snapshot` as
  JSON so the fixture can be replaced with the team's actual file.
- **github/** — Vitest with a mocked `fetch`: call sequence, deletion entries,
  no-change path, error mapping, branch-created-but-PR-failed message.
- **ui/state.ts** — plain-function tests: destination menu and persistence, token
  replace flow, disabled states, result banners. No component tests.
- **plugin/** — thin; verified manually in Figma desktop in both the normal editor
  and Dev Mode against a written checklist.
- **CI** — GitHub Actions: `pnpm install`, `tsc --noEmit`, `vitest run`.

## Decisions log

| # | Decision |
|---|---|
| Source format | Output of the existing `scripts/design-tokens` script is the reference |
| Units | Figma numbers are already rem; unit `rem` is appended |
| Types | From variable scopes |
| Themes | Uniform `source` rule; light/dark gain `primitives: "source"` |
| Metadata | No `$metadata.json` |
| Validation | All errors collected; any error blocks export |
| Colours | Hex now; colour formatting isolated for the oklch migration |
| Numbers | Shortest decimal recovering the typed value; emitted as JSON numbers |
| Font family | Web code syntax stack if present and consistent; else `[value]`; aliases kept |
| Variables | Local only; library aliases are errors |
| GitHub auth | Fine-grained PAT in `clientStorage`, write-only in the UI |
| GitHub output | Always multiple files; whole folder replaced; branch `styles/figma-export-<UTC timestamp>` |
| Settings storage | `clientStorage`, per user |
| Destination | Split Export button + menu, GitHub default, remembered per user |
| License / distribution | MIT open-source repo; plugin private to the Figma organization |
