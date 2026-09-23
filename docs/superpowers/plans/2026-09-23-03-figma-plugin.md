# Export Design Tokens Figma Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the "Export Design Tokens" Figma plugin (normal editor + Dev Mode) that exports a file's local variables as DTCG token files — downloaded or opened as a GitHub pull request — byte-identical to `css-to-dtcg` output.

**Architecture:** The Figma main thread only reads a plain `Snapshot` of local variables and handles `clientStorage`. Everything else runs in the UI iframe: the pure `core/` converts a `Snapshot` into sets, themes and errors; `github/` publishes through the REST API; `ui/` is Preact with its screen logic in a tested `state.ts`. `$themes.json` derivation and JSON formatting are imported from `css-to-dtcg` so the tools cannot drift.

**Tech Stack:** TypeScript (strict), Preact, Vite + `vite-plugin-singlefile` (UI), esbuild (main thread), Vitest, fflate, `@figma/plugin-typings`, `css-to-dtcg` (workspace).

**Spec:** `docs/superpowers/specs/2026-09-23-figma-plugin-token-export-design.md`

**Prerequisites:** Plan 1 (monorepo + `css-to-dtcg`) and plan 2 (Lumen Academy example, which provides `examples/lumen-academy/figma-snapshot.json` and `tokens/`).

## Global Constraints

- Plugin display name "Export Design Tokens"; package directory `packages/figma-plugin`, npm name `export-design-tokens`, `"private": true`. `figma-utils` is the only project name used anywhere.
- Manifest: `editorType: ["figma", "dev"]`, `capabilities: ["inspect"]`, `permissions: ["currentuser"]`, `documentAccess: "dynamic-page"`, `networkAccess.allowedDomains: ["https://api.github.com"]`.
- Local variables only. An alias to a variable that is not in the snapshot is an error.
- Set path: single-mode collection → `collection.name`; multi-mode → `collection.name/mode.name`. Token path: `[first segment of collection name, ...variable.name.split('/')]`.
- Types from scopes only: `COLOR` → `color`; `FLOAT` with `FONT_WEIGHT` → `fontWeight`; other `FLOAT` → `dimension` `{ value, unit: "rem" }`; `STRING` with `FONT_FAMILY` → `fontFamily`; everything else is an error.
- Colours: lowercase `#rrggbb`, or `#rrggbbaa` when the rounded alpha byte is not `ff`. Colour formatting lives only in `core/color.ts`.
- Numbers: shortest decimal that maps back to the stored float (`recoverNumber`), emitted as JSON numbers.
- Font family: Web code syntax font stack when present and its first family matches the value (case-insensitive); otherwise `[value]`; mismatch is an error. Aliases never read code syntax.
- `$description` only when the Figma description is non-empty after trimming.
- Any error blocks both destinations; all errors are shown together.
- Multiple files: `<set>.json` + `$themes.json`. Single file: `tokens.json` = `{ [set]: tree, …, "$themes": [...] }`. Downloads: `tokens.zip` containing `tokens/…`, or `tokens.json`. No `$metadata.json`.
- GitHub: always multiple files; fine-grained PAT in `clientStorage`, never displayed; branch `styles/figma-export-YYYYMMDD-HHmmss` (UTC); commit message and PR title `chore(tokens): export from Figma`; whole target folder replaced; no changes → no branch/commit/PR; the plugin never deletes anything remote.
- Error copy never suggests replacing the token.
- Destination menu items: "Export to GitHub repo" (default, black button with GitHub logo) and "Export to this computer" (blue Figma button with download icon); choice remembered per user.
- Token field: saved → "Token saved" + **Replace token**; replacing shows an empty field and keeps the old token; submitting overwrites; cancelling keeps the old one.

## Review Focus

- Variable names with `.`, `{`, `}`, a leading `$` or empty segments (`a//b`) would produce broken references; they must be reported as errors — pinned in Task 5.
- A collection or mode named `..` (or containing `\`) would escape the zip/GitHub folder; it must be an error — pinned in Task 6.
- A folder setting of `""`, `/` or `a/../b` would replace the repository root or escape it; settings validation and `publish` must refuse it — pinned in Task 10.
- A variable that is invalid in every mode (a `BOOLEAN` in a 3-mode collection) must be reported once, not three times — pinned in Task 6.
- The target folder may not exist yet, may be nested (`design/tokens`), or contain submodules/sub-folders; publishing must still delete exactly the stale blobs — pinned in Task 10.

---

## File Structure

```
packages/figma-plugin/
  package.json
  manifest.json
  tsconfig.json
  vite.config.ts               UI build (single-file HTML into dist/)
  vitest.config.ts             tests run from the package root
  README.md
  docs/manual-test.md          checklist for real Figma (normal editor + Dev Mode)
  src/
    core/
      snapshot.ts              Snapshot types + isAlias
      numbers.ts               recoverNumber
      color.ts                 toHex
      font-stack.ts            parseFontStack, fontFamilyValue
      sets.ts                  setPath, tokenPath, name checks, nest
      tokens.ts                tokenType, toToken
      build-export.ts          buildExport → { sets, themes, errors }
      files.ts                 multipleFiles, singleFile
    github/
      client.ts                createClient, GitHubError, toError
      settings.ts              RepoSettings, parseRepository, normalizeFolder, validateSettings, checkSettings
      publish.ts               publish, branchName, prBody
    shared/
      messages.ts              RPC types between main thread and UI
    plugin/
      main.ts                  showUI + RPC handlers
      snapshot.ts              readSnapshot, toSnapshotValue
      storage.ts               clientStorage wrappers
    ui/
      index.html
      main.tsx
      rpc.ts                   call()
      state.ts                 pure screen logic
      download.ts              zipFiles, downloadFile, downloadZip, downloadText
      icons.tsx
      App.tsx
      ExportView.tsx
      ExportButton.tsx
      SettingsView.tsx
      FileList.tsx
      ErrorList.tsx
      ResultBanner.tsx
      styles.css
  test/
    helpers.ts
    numbers.test.ts
    color.test.ts
    font-stack.test.ts
    sets.test.ts
    tokens.test.ts
    build-export.test.ts
    files.test.ts
    round-trip.test.ts
    plugin-snapshot.test.ts
    client.test.ts
    settings.test.ts
    publish.test.ts
    state.test.ts
    download.test.ts
```

---

### Task 1: Package scaffold that loads in Figma

**Files:**
- Create: `packages/figma-plugin/package.json`, `manifest.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`
- Create: `packages/figma-plugin/src/plugin/main.ts`, `src/ui/index.html`, `src/ui/main.tsx`
- Modify: `.gitignore` (nothing — `dist/` is already ignored)

**Interfaces:**
- Consumes: nothing yet.
- Produces: `pnpm --filter export-design-tokens build` → `dist/index.html` + `dist/code.js`; a manifest Figma can import.

- [ ] **Step 1: Create the package**

`packages/figma-plugin/package.json`:

```json
{
  "name": "export-design-tokens",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "vite build && esbuild src/plugin/main.ts --bundle --outfile=dist/code.js --target=es2017",
    "watch": "vite build --watch & esbuild src/plugin/main.ts --bundle --outfile=dist/code.js --target=es2017 --watch",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  }
}
```

Run:

```bash
pnpm --filter export-design-tokens add css-to-dtcg@workspace:* preact fflate
pnpm --filter export-design-tokens add -D typescript vite @preact/preset-vite vite-plugin-singlefile esbuild vitest @figma/plugin-typings @types/node
```

Expected: dependencies added.

`packages/figma-plugin/manifest.json`:

```json
{
  "name": "Export Design Tokens",
  "id": "export-design-tokens-dev",
  "api": "1.0.0",
  "main": "dist/code.js",
  "ui": "dist/index.html",
  "editorType": ["figma", "dev"],
  "capabilities": ["inspect"],
  "permissions": ["currentuser"],
  "documentAccess": "dynamic-page",
  "networkAccess": {
    "allowedDomains": ["https://api.github.com"]
  }
}
```

`packages/figma-plugin/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM"],
    "jsx": "react-jsx",
    "jsxImportSource": "preact",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["@figma/plugin-typings", "vite/client", "node"]
  },
  "include": ["src", "test", "vite.config.ts", "vitest.config.ts"]
}
```

`packages/figma-plugin/vite.config.ts`:

```ts
import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  root: 'src/ui',
  plugins: [preact(), viteSingleFile()],
  build: { outDir: '../../dist', emptyOutDir: true },
});
```

`packages/figma-plugin/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['test/**/*.test.ts'] },
});
```

- [ ] **Step 2: Minimal main thread and UI**

`packages/figma-plugin/src/plugin/main.ts`:

```ts
figma.showUI(__html__, { width: 360, height: 440, themeColors: true, title: 'Export tokens' });
```

`packages/figma-plugin/src/ui/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Export tokens</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

`packages/figma-plugin/src/ui/main.tsx`:

```tsx
import { render } from 'preact';

render(<p>Export Design Tokens</p>, document.getElementById('root')!);
```

- [ ] **Step 3: Build**

Run: `pnpm --filter css-to-dtcg build && pnpm --filter export-design-tokens build && ls packages/figma-plugin/dist`
Expected: `code.js  index.html`; `index.html` contains the inlined script (no separate `.js` asset).

- [ ] **Step 4: Load it in Figma (manual)**

In Figma desktop: Plugins → Development → Import plugin from manifest… → `packages/figma-plugin/manifest.json`. Run it in a design file: a window titled "Export tokens" shows "Export Design Tokens". Switch to Dev Mode, open the Plugins tab in the inspect panel, run it: same window. If Figma rejects the manifest, record the message and fix the manifest before continuing.

- [ ] **Step 5: Commit**

```bash
git add packages/figma-plugin pnpm-lock.yaml
git commit -m "feat(plugin): scaffold the Export Design Tokens plugin"
```

---

### Task 2: `numbers` — recover the typed decimal

**Files:**
- Create: `packages/figma-plugin/src/core/numbers.ts`
- Test: `packages/figma-plugin/test/numbers.test.ts`

**Interfaces:**
- Produces: `recoverNumber(value: number): number`

- [ ] **Step 1: Write the failing test**

`packages/figma-plugin/test/numbers.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { recoverNumber } from '../src/core/numbers';

describe('recoverNumber', () => {
  it('recovers values Figma stored as 32-bit floats (seen in a real export)', () => {
    expect(Math.fround(0.2)).toBe(0.20000000298023224);
    expect(recoverNumber(0.20000000298023224)).toBe(0.2);
    expect(recoverNumber(0.05999999865889549)).toBe(0.06);
  });

  it('recovers other typical rem values', () => {
    expect(recoverNumber(Math.fround(0.85))).toBe(0.85);
    expect(recoverNumber(Math.fround(3.6))).toBe(3.6);
    expect(recoverNumber(Math.fround(0.8125))).toBe(0.8125);
  });

  it('leaves exact values alone', () => {
    expect(recoverNumber(700)).toBe(700);
    expect(recoverNumber(0)).toBe(0);
    expect(recoverNumber(-0.5)).toBe(-0.5);
    expect(recoverNumber(9999)).toBe(9999);
  });

  it('never cuts digits from a full-precision double', () => {
    expect(recoverNumber(0.1 + 0.2)).toBe(0.30000000000000004);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter export-design-tokens test numbers`
Expected: FAIL — cannot resolve `../src/core/numbers`.

- [ ] **Step 3: Implement**

`packages/figma-plugin/src/core/numbers.ts`:

```ts
/**
 * Figma stores numbers as 32-bit floats, so a typed 0.2 reads back as
 * 0.20000000298023224. This returns the shortest decimal that maps back to the
 * same stored value — what the designer typed. A value that is not a float32
 * (a full double) is returned untouched, so no typed digit is ever lost.
 */
export function recoverNumber(value: number): number {
  if (!Number.isFinite(value)) {
    return value;
  }

  const isFloat32 = Math.fround(value) === value;

  for (let precision = 1; precision <= 17; precision++) {
    const candidate = Number(value.toPrecision(precision));
    if (isFloat32 ? Math.fround(candidate) === value : candidate === value) {
      return candidate;
    }
  }

  return value;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm --filter export-design-tokens test numbers`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/figma-plugin/src/core/numbers.ts packages/figma-plugin/test/numbers.test.ts
git commit -m "feat(plugin): recover typed decimals from Figma's float32 numbers"
```

---

### Task 3: `color` and `font-stack`

**Files:**
- Create: `packages/figma-plugin/src/core/snapshot.ts`, `src/core/color.ts`, `src/core/font-stack.ts`
- Test: `packages/figma-plugin/test/color.test.ts`, `test/font-stack.test.ts`

**Interfaces:**
- Produces:
  - `snapshot.ts`: `RGBA`, `Alias`, `SnapshotValue`, `SnapshotMode`, `SnapshotCollection`, `SnapshotVariable`, `Snapshot`, `isAlias(value): value is Alias` (types exactly as below).
  - `toHex(color: RGBA): string`
  - `parseFontStack(text: string): string[] | null`
  - `fontFamilyValue(value: string, web: string | undefined): { ok: true; value: string[] } | { ok: false; reason: string }`

- [ ] **Step 1: Write the snapshot types**

`packages/figma-plugin/src/core/snapshot.ts`:

```ts
/** A plain, serializable copy of what the plugin reads from Figma. */
export type RGBA = { r: number; g: number; b: number; a: number };
export type Alias = { aliasId: string };
export type SnapshotValue = RGBA | number | string | boolean | Alias;

export type SnapshotMode = { id: string; name: string };

export type SnapshotCollection = {
  id: string;
  name: string;
  modes: SnapshotMode[];
  /** Figma order. */
  variableIds: string[];
};

export type SnapshotVariable = {
  id: string;
  name: string;
  collectionId: string;
  /** Figma keeps adding types (e.g. EASING); unknown ones are reported as unsupported. */
  resolvedType: 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN' | (string & {});
  scopes: string[];
  description: string;
  codeSyntax: { WEB?: string };
  valuesByMode: Record<string, SnapshotValue>;
};

export type Snapshot = {
  fileName: string;
  userName: string | null;
  /** Figma order. */
  collections: SnapshotCollection[];
  variables: SnapshotVariable[];
};

export const isAlias = (value: SnapshotValue): value is Alias =>
  typeof value === 'object' && value !== null && 'aliasId' in value;
```

- [ ] **Step 2: Write the failing tests**

`packages/figma-plugin/test/color.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { toHex } from '../src/core/color';

const f = Math.fround;

describe('toHex', () => {
  it('writes lowercase #rrggbb from Figma float channels', () => {
    expect(toHex({ r: f(0x60 / 255), g: f(0x38 / 255), b: f(0xc4 / 255), a: 1 })).toBe('#6038c4');
  });

  it('adds an alpha byte when the colour is not opaque', () => {
    expect(toHex({ r: f(0x15 / 255), g: f(0x15 / 255), b: f(0x17 / 255), a: f(0x8c / 255) })).toBe('#1515178c');
  });

  it('treats an alpha that rounds to ff as opaque', () => {
    expect(toHex({ r: 1, g: 1, b: 1, a: 0.999 })).toBe('#ffffff');
  });

  it('clamps out-of-range channels', () => {
    expect(toHex({ r: 1.2, g: -0.1, b: 0, a: 1 })).toBe('#ff0000');
  });
});
```

`packages/figma-plugin/test/font-stack.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { fontFamilyValue, parseFontStack } from '../src/core/font-stack';

describe('parseFontStack', () => {
  it('splits a stack and strips quotes', () => {
    expect(parseFontStack("'Roboto Slab', serif")).toEqual(['Roboto Slab', 'serif']);
    expect(parseFontStack('"JetBrains Mono", monospace')).toEqual(['JetBrains Mono', 'monospace']);
    expect(parseFontStack('Inter')).toEqual(['Inter']);
  });

  it('returns null for code syntax that is not a font stack', () => {
    expect(parseFontStack('var(--title-font-family)')).toBeNull();
    expect(parseFontStack('16px')).toBeNull();
    expect(parseFontStack('')).toBeNull();
  });
});

describe('fontFamilyValue', () => {
  it('uses the stack when its first family matches the value', () => {
    expect(fontFamilyValue('Roboto Slab', "'Roboto Slab', serif")).toEqual({ ok: true, value: ['Roboto Slab', 'serif'] });
    expect(fontFamilyValue('roboto slab', "'Roboto Slab', serif")).toEqual({ ok: true, value: ['Roboto Slab', 'serif'] });
  });

  it('falls back to the value alone', () => {
    expect(fontFamilyValue('Inter', undefined)).toEqual({ ok: true, value: ['Inter'] });
    expect(fontFamilyValue('Inter', 'var(--family-body)')).toEqual({ ok: true, value: ['Inter'] });
  });

  it('reports a stack that drifted from the value', () => {
    expect(fontFamilyValue('Inter', "'Roboto Slab', serif")).toEqual({
      ok: false,
      reason: 'Web code syntax starts with "Roboto Slab" but the value is "Inter"',
    });
  });
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `pnpm --filter export-design-tokens test color font-stack`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement**

`packages/figma-plugin/src/core/color.ts`:

```ts
import type { RGBA } from './snapshot';

/** One byte, from a Figma 0..1 channel. */
const byte = (channel: number) =>
  Math.round(Math.min(1, Math.max(0, channel)) * 255)
    .toString(16)
    .padStart(2, '0');

/**
 * The only place that knows how a colour is written. Migrating to oklch means
 * changing this function (and its tests) alone.
 */
export function toHex({ r, g, b, a }: RGBA): string {
  const rgb = `#${byte(r)}${byte(g)}${byte(b)}`;
  const alpha = byte(a);
  return alpha === 'ff' ? rgb : `${rgb}${alpha}`;
}
```

`packages/figma-plugin/src/core/font-stack.ts`:

```ts
// Same grammar as css-to-dtcg's values.js: quoted families, or unquoted
// identifier sequences that cannot start with a digit.
const FAMILY = String.raw`(?:'[^']+'|"[^"]+"|[A-Za-z_-][\w-]*(?:\s+[A-Za-z_-][\w-]*)*)`;
const FONT_STACK = new RegExp(String.raw`^${FAMILY}(?:\s*,\s*${FAMILY})*$`);

export function parseFontStack(text: string): string[] | null {
  const value = text.trim();
  if (!FONT_STACK.test(value)) {
    return null;
  }
  return value.split(',').map((family) => family.trim().replace(/^['"]|['"]$/g, ''));
}

export type FontFamilyResult = { ok: true; value: string[] } | { ok: false; reason: string };

/**
 * Figma can only hold one font name, so the fallback stack comes from the
 * variable's Web code syntax. Anything else there (e.g. var(--x)) is ignored.
 */
export function fontFamilyValue(value: string, web: string | undefined): FontFamilyResult {
  const stack = web ? parseFontStack(web) : null;

  if (!stack) {
    return { ok: true, value: [value] };
  }
  if (stack[0].toLowerCase() !== value.trim().toLowerCase()) {
    return { ok: false, reason: `Web code syntax starts with "${stack[0]}" but the value is "${value}"` };
  }
  return { ok: true, value: stack };
}
```

- [ ] **Step 5: Run them to verify they pass**

Run: `pnpm --filter export-design-tokens test color font-stack`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/figma-plugin/src/core packages/figma-plugin/test
git commit -m "feat(plugin): add snapshot types, colour and font-stack conversion"
```

---

### Task 4: Test helpers and `sets`

**Files:**
- Create: `packages/figma-plugin/test/helpers.ts`, `packages/figma-plugin/src/core/sets.ts`
- Test: `packages/figma-plugin/test/sets.test.ts`

**Interfaces:**
- Consumes: snapshot types (Task 3).
- Produces:
  - `Token = { $type: string; $value: unknown; $description?: string }`, `Tree = { [key: string]: Tree | Token }`
  - `setPath(collection: SnapshotCollection, modeName: string): string`
  - `tokenPath(collectionName: string, variableName: string): string[]`
  - `invalidNameReason(path: string[]): string | null`
  - `invalidSetPathReason(setName: string): string | null`
  - `nest(tree: Tree, path: string[], token: Token): boolean`
  - test helpers: `collection(name, modes, variableIds?)`, `variable(collectionName, name, resolvedType, values, extra?)`, `snapshot(collections, variables)`, `alias(collectionName, name)`, `rgba(r, g, b, a?)`

- [ ] **Step 1: Write the helpers**

`packages/figma-plugin/test/helpers.ts`:

```ts
import type { RGBA, Snapshot, SnapshotCollection, SnapshotValue, SnapshotVariable } from '../src/core/snapshot';

export const collection = (name: string, modes: string[], variableIds: string[] = []): SnapshotCollection => ({
  id: `c:${name}`,
  name,
  modes: modes.map((mode) => ({ id: `${name}:${mode}`, name: mode })),
  variableIds,
});

export const variable = (
  collectionName: string,
  name: string,
  resolvedType: SnapshotVariable['resolvedType'],
  values: Record<string, SnapshotValue>,
  extra: Partial<SnapshotVariable> = {},
): SnapshotVariable => ({
  id: `v:${collectionName}/${name}`,
  name,
  collectionId: `c:${collectionName}`,
  resolvedType,
  scopes: ['ALL_SCOPES'],
  description: '',
  codeSyntax: {},
  valuesByMode: Object.fromEntries(Object.entries(values).map(([mode, value]) => [`${collectionName}:${mode}`, value])),
  ...extra,
});

/** Fills each collection's variableIds from the variables, in order, when left empty. */
export const snapshot = (collections: SnapshotCollection[], variables: SnapshotVariable[]): Snapshot => ({
  fileName: 'Test file',
  userName: 'Ada',
  collections: collections.map((c) =>
    c.variableIds.length > 0 ? c : { ...c, variableIds: variables.filter((v) => v.collectionId === c.id).map((v) => v.id) },
  ),
  variables,
});

export const alias = (collectionName: string, name: string) => ({ aliasId: `v:${collectionName}/${name}` });

export const rgba = (r: number, g: number, b: number, a = 1): RGBA => ({ r, g, b, a });
```

- [ ] **Step 2: Write the failing test**

`packages/figma-plugin/test/sets.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { invalidNameReason, invalidSetPathReason, nest, setPath, tokenPath, type Tree } from '../src/core/sets';
import { collection } from './helpers';

describe('setPath', () => {
  it('uses the collection name for a single-mode collection', () => {
    expect(setPath(collection('primitives', ['Mode 1']), 'Mode 1')).toBe('primitives');
  });

  it('adds the mode for a multi-mode collection', () => {
    expect(setPath(collection('semantic/theme', ['light', 'dark']), 'dark')).toBe('semantic/theme/dark');
  });
});

describe('tokenPath', () => {
  it('roots the variable under the first segment of the collection name', () => {
    expect(tokenPath('primitives', 'gray/100')).toEqual(['primitives', 'gray', '100']);
    expect(tokenPath('semantic/theme', 'primary')).toEqual(['semantic', 'primary']);
  });
});

describe('invalidNameReason', () => {
  it('accepts normal names', () => {
    expect(invalidNameReason(['primitives', 'gray', '100'])).toBeNull();
  });

  it('rejects names that would break references', () => {
    expect(invalidNameReason(['primitives', 'spacing', '1.5'])).toBe('name segment "1.5" contains one of . { }');
    expect(invalidNameReason(['primitives', '{x}'])).toBe('name segment "{x}" contains one of . { }');
    expect(invalidNameReason(['primitives', '$type'])).toBe('name segment "$type" starts with $');
    expect(invalidNameReason(['primitives', 'a', '', 'b'])).toBe('name has an empty segment');
  });
});

describe('invalidSetPathReason', () => {
  it('accepts normal set paths', () => {
    expect(invalidSetPathReason('semantic/theme/dark')).toBeNull();
  });

  it('rejects paths that could escape the export folder', () => {
    expect(invalidSetPathReason('../escape')).toBe('collection and mode names cannot have empty, "." or ".." segments or contain \\');
    expect(invalidSetPathReason('a/./b')).not.toBeNull();
    expect(invalidSetPathReason('a\\b')).not.toBeNull();
    expect(invalidSetPathReason('a//b')).not.toBeNull();
  });
});

describe('nest', () => {
  const token = { $type: 'color', $value: '#ffffff' };

  it('nests tokens and refuses collisions', () => {
    const tree: Tree = {};

    expect(nest(tree, ['primitives', 'gray', '100'], token)).toBe(true);
    expect(nest(tree, ['primitives', 'gray'], token)).toBe(false);
    expect(nest(tree, ['primitives', 'gray', '100', 'x'], token)).toBe(false);
    expect(nest(tree, ['primitives', 'gray', '100'], token)).toBe(false);
    expect(tree).toEqual({ primitives: { gray: { 100: token } } });
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `pnpm --filter export-design-tokens test sets`
Expected: FAIL — cannot resolve `../src/core/sets`.

- [ ] **Step 4: Implement**

`packages/figma-plugin/src/core/sets.ts`:

```ts
import type { SnapshotCollection } from './snapshot';

export type Token = { $type: string; $value: unknown; $description?: string };
export type Tree = { [key: string]: Tree | Token };

export const setPath = (collection: SnapshotCollection, modeName: string): string =>
  collection.modes.length === 1 ? collection.name : `${collection.name}/${modeName}`;

export const tokenPath = (collectionName: string, variableName: string): string[] => [
  collectionName.split('/')[0],
  ...variableName.split('/'),
];

export function invalidNameReason(path: string[]): string | null {
  for (const segment of path) {
    if (segment === '') {
      return 'name has an empty segment';
    }
    if (/[.{}]/.test(segment)) {
      return `name segment "${segment}" contains one of . { }`;
    }
    if (segment.startsWith('$')) {
      return `name segment "${segment}" starts with $`;
    }
  }
  return null;
}

export function invalidSetPathReason(setName: string): string | null {
  const unsafe =
    setName.includes('\\') || setName.split('/').some((segment) => segment === '' || segment === '.' || segment === '..');
  return unsafe ? 'collection and mode names cannot have empty, "." or ".." segments or contain \\' : null;
}

const isToken = (node: Tree | Token | undefined): node is Token =>
  node !== undefined && typeof node === 'object' && '$value' in node;

/** Places a token; returns false when the path collides with a token or group. */
export function nest(tree: Tree, path: string[], token: Token): boolean {
  let node: Tree = tree;

  for (const segment of path.slice(0, -1)) {
    const child = node[segment];
    if (child === undefined) {
      node[segment] = {};
    } else if (isToken(child)) {
      return false;
    }
    node = node[segment] as Tree;
  }

  const last = path[path.length - 1];
  if (node[last] !== undefined) {
    return false;
  }
  node[last] = token;
  return true;
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `pnpm --filter export-design-tokens test sets`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/figma-plugin/src/core/sets.ts packages/figma-plugin/test/helpers.ts packages/figma-plugin/test/sets.test.ts
git commit -m "feat(plugin): add set paths, token paths and collision-safe nesting"
```

---

### Task 5: `tokens` — one variable value to one token

**Files:**
- Create: `packages/figma-plugin/src/core/tokens.ts`
- Test: `packages/figma-plugin/test/tokens.test.ts`

**Interfaces:**
- Consumes: `recoverNumber` (Task 2), `toHex`, `fontFamilyValue`, snapshot types (Task 3), `Token` (Task 4).
- Produces:
  - `TokenType = 'color' | 'fontWeight' | 'dimension' | 'fontFamily'`
  - `tokenType(variable: SnapshotVariable): { type: TokenType } | { reason: string }`
  - `TokenResult = { ok: true; token: Token } | { ok: false; reason: string; perMode: boolean }`
  - `toToken(variable: SnapshotVariable, value: SnapshotValue, pathOf: (variableId: string) => string[] | undefined): TokenResult`

- [ ] **Step 1: Write the failing test**

`packages/figma-plugin/test/tokens.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { tokenType, toToken } from '../src/core/tokens';
import { alias, rgba, variable } from './helpers';

const noAliases = () => undefined;

describe('tokenType', () => {
  it('derives the type from resolvedType and scopes only', () => {
    expect(tokenType(variable('p', 'c', 'COLOR', {}))).toEqual({ type: 'color' });
    expect(tokenType(variable('p', 'w', 'FLOAT', {}, { scopes: ['FONT_WEIGHT'] }))).toEqual({ type: 'fontWeight' });
    expect(tokenType(variable('p', 'size', 'FLOAT', {}))).toEqual({ type: 'dimension' });
    expect(tokenType(variable('p', 'font-weight', 'FLOAT', {}))).toEqual({ type: 'dimension' });
    expect(tokenType(variable('p', 'f', 'STRING', {}, { scopes: ['FONT_FAMILY'] }))).toEqual({ type: 'fontFamily' });
  });

  it('explains unsupported variables', () => {
    expect(tokenType(variable('p', 'b', 'BOOLEAN', {}))).toEqual({ reason: 'boolean variables are not supported' });
    expect(tokenType(variable('p', 'e', 'EASING', {}))).toEqual({ reason: 'easing variables are not supported' });
    expect(tokenType(variable('p', 's', 'STRING', {}))).toEqual({ reason: 'string variables need the Font family scope' });
    expect(tokenType(variable('p', 's', 'STRING', {}, { scopes: ['FONT_STYLE'] }))).toEqual({
      reason: 'font style strings are not supported; use a number variable with the Font weight scope',
    });
  });
});

describe('toToken', () => {
  it('converts literals', () => {
    expect(toToken(variable('p', 'c', 'COLOR', {}), rgba(1, 1, 1), noAliases)).toEqual({
      ok: true,
      token: { $type: 'color', $value: '#ffffff' },
    });
    expect(toToken(variable('p', 's', 'FLOAT', {}), Math.fround(0.85), noAliases)).toEqual({
      ok: true,
      token: { $type: 'dimension', $value: { value: 0.85, unit: 'rem' } },
    });
    expect(toToken(variable('p', 'w', 'FLOAT', {}, { scopes: ['FONT_WEIGHT'] }), 700, noAliases)).toEqual({
      ok: true,
      token: { $type: 'fontWeight', $value: 700 },
    });
  });

  it('reads the font stack from Web code syntax', () => {
    const family = variable('p', 'f', 'STRING', {}, { scopes: ['FONT_FAMILY'], codeSyntax: { WEB: "'Roboto Slab', serif" } });

    expect(toToken(family, 'Roboto Slab', noAliases)).toEqual({
      ok: true,
      token: { $type: 'fontFamily', $value: ['Roboto Slab', 'serif'] },
    });
    expect(toToken(family, 'Inter', noAliases)).toEqual({
      ok: false,
      perMode: true,
      reason: 'Web code syntax starts with "Roboto Slab" but the value is "Inter"',
    });
  });

  it('turns aliases into references typed by the aliasing variable', () => {
    const pathOf = (id: string) => (id === 'v:primitives/gray/900' ? ['primitives', 'gray', '900'] : undefined);
    const family = variable('p', 'f', 'STRING', {}, { scopes: ['FONT_FAMILY'], codeSyntax: { WEB: 'nonsense, serif' } });

    expect(toToken(variable('s', 't', 'COLOR', {}), alias('primitives', 'gray/900'), pathOf)).toEqual({
      ok: true,
      token: { $type: 'color', $value: '{primitives.gray.900}' },
    });
    expect(toToken(family, alias('primitives', 'gray/900'), pathOf)).toEqual({
      ok: true,
      token: { $type: 'fontFamily', $value: '{primitives.gray.900}' },
    });
  });

  it('reports an alias to a variable that is not local', () => {
    expect(toToken(variable('s', 't', 'COLOR', {}), { aliasId: 'VariableID:abc/-1:-1' }, noAliases)).toEqual({
      ok: false,
      perMode: true,
      reason: 'aliases a variable that is not local to this file',
    });
  });

  it('reports unsupported types once per variable', () => {
    expect(toToken(variable('p', 'b', 'BOOLEAN', {}), true, noAliases)).toEqual({
      ok: false,
      perMode: false,
      reason: 'boolean variables are not supported',
    });
  });

  it('adds a non-empty description after $value', () => {
    const result = toToken(variable('p', 'c', 'COLOR', {}, { description: 'Page background' }), rgba(0, 0, 0), noAliases);

    expect(result).toEqual({ ok: true, token: { $type: 'color', $value: '#000000', $description: 'Page background' } });
    expect(Object.keys((result as { token: object }).token)).toEqual(['$type', '$value', '$description']);
    expect(toToken(variable('p', 'c', 'COLOR', {}, { description: '   ' }), rgba(0, 0, 0), noAliases)).toEqual({
      ok: true,
      token: { $type: 'color', $value: '#000000' },
    });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter export-design-tokens test tokens`
Expected: FAIL — cannot resolve `../src/core/tokens`.

- [ ] **Step 3: Implement**

`packages/figma-plugin/src/core/tokens.ts`:

```ts
import { toHex } from './color';
import { fontFamilyValue } from './font-stack';
import { recoverNumber } from './numbers';
import type { Token } from './sets';
import { isAlias, type RGBA, type SnapshotValue, type SnapshotVariable } from './snapshot';

export type TokenType = 'color' | 'fontWeight' | 'dimension' | 'fontFamily';

export function tokenType(variable: SnapshotVariable): { type: TokenType } | { reason: string } {
  switch (variable.resolvedType) {
    case 'COLOR':
      return { type: 'color' };
    case 'FLOAT':
      return { type: variable.scopes.includes('FONT_WEIGHT') ? 'fontWeight' : 'dimension' };
    case 'STRING':
      if (variable.scopes.includes('FONT_FAMILY')) {
        return { type: 'fontFamily' };
      }
      if (variable.scopes.includes('FONT_STYLE')) {
        return { reason: 'font style strings are not supported; use a number variable with the Font weight scope' };
      }
      return { reason: 'string variables need the Font family scope' };
    default:
      return { reason: `${variable.resolvedType.toLowerCase()} variables are not supported` };
  }
}

export type TokenResult = { ok: true; token: Token } | { ok: false; reason: string; perMode: boolean };

export function toToken(
  variable: SnapshotVariable,
  value: SnapshotValue,
  pathOf: (variableId: string) => string[] | undefined,
): TokenResult {
  const type = tokenType(variable);
  if ('reason' in type) {
    return { ok: false, reason: type.reason, perMode: false };
  }

  let $value: unknown;

  if (isAlias(value)) {
    const target = pathOf(value.aliasId);
    if (!target) {
      return { ok: false, reason: 'aliases a variable that is not local to this file', perMode: true };
    }
    $value = `{${target.join('.')}}`;
  } else {
    switch (type.type) {
      case 'color':
        $value = toHex(value as RGBA);
        break;
      case 'fontWeight':
        $value = recoverNumber(value as number);
        break;
      case 'dimension':
        $value = { value: recoverNumber(value as number), unit: 'rem' };
        break;
      case 'fontFamily': {
        const family = fontFamilyValue(value as string, variable.codeSyntax.WEB);
        if (!family.ok) {
          return { ok: false, reason: family.reason, perMode: true };
        }
        $value = family.value;
        break;
      }
    }
  }

  const token: Token = { $type: type.type, $value };
  if (variable.description.trim() !== '') {
    token.$description = variable.description;
  }
  return { ok: true, token };
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm --filter export-design-tokens test tokens`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/figma-plugin/src/core/tokens.ts packages/figma-plugin/test/tokens.test.ts
git commit -m "feat(plugin): convert variable values into DTCG tokens"
```

---

### Task 6: `buildExport` and output files

**Files:**
- Create: `packages/figma-plugin/src/core/build-export.ts`, `packages/figma-plugin/src/core/files.ts`
- Test: `packages/figma-plugin/test/build-export.test.ts`, `packages/figma-plugin/test/files.test.ts`

**Interfaces:**
- Consumes: Tasks 3–5; `deriveThemes` from `css-to-dtcg/themes`, `serialize` from `css-to-dtcg/serialize`.
- Produces:
  - `ExportError = { collection: string; variable?: string; mode?: string; reason: string }`
  - `BuiltSet = { name: string; tree: Tree }`
  - `Theme = { name: string; group: string; selectedTokenSets: Record<string, 'source' | 'enabled'> }`
  - `BuildResult = { sets: BuiltSet[]; themes: Theme[]; errors: ExportError[] }`
  - `buildExport(snapshot: Snapshot): BuildResult`
  - `ExportFile = { path: string; json: string }`
  - `multipleFiles(result: BuildResult): ExportFile[]`, `singleFile(result: BuildResult): ExportFile`

- [ ] **Step 1: Write the failing tests**

`packages/figma-plugin/test/build-export.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { buildExport } from '../src/core/build-export';
import { alias, collection, rgba, snapshot, variable } from './helpers';

const primitives = collection('primitives', ['Mode 1']);
const brand = collection('semantic/brand', ['nova', 'orbit']);
const theme = collection('semantic/theme', ['light', 'dark']);

const variables = [
  variable('primitives', 'gray/900', 'COLOR', { 'Mode 1': rgba(0, 0, 0) }),
  variable('primitives', 'nova/700', 'COLOR', { 'Mode 1': rgba(1, 0, 0) }),
  variable('primitives', 'orbit/700', 'COLOR', { 'Mode 1': rgba(0, 1, 0) }),
  variable('semantic/brand', 'brand/700', 'COLOR', {
    nova: alias('primitives', 'nova/700'),
    orbit: alias('primitives', 'orbit/700'),
  }),
  variable('semantic/theme', 'text/default', 'COLOR', {
    light: alias('primitives', 'gray/900'),
    dark: alias('primitives', 'gray/900'),
  }),
  variable('semantic/theme', 'primary', 'COLOR', {
    light: alias('semantic/brand', 'brand/700'),
    dark: alias('semantic/brand', 'brand/700'),
  }),
];

const good = snapshot([primitives, brand, theme], variables);

describe('buildExport', () => {
  it('produces one set per single-mode collection and one per mode otherwise', () => {
    expect(buildExport(good).sets.map((set) => set.name)).toEqual([
      'primitives',
      'semantic/brand/nova',
      'semantic/brand/orbit',
      'semantic/theme/light',
      'semantic/theme/dark',
    ]);
  });

  it('nests tokens under the collection root', () => {
    const [, nova, , light] = buildExport(good).sets;

    expect(nova.tree).toEqual({ semantic: { brand: { 700: { $type: 'color', $value: '{primitives.nova.700}' } } } });
    expect(light.tree).toEqual({
      semantic: {
        text: { default: { $type: 'color', $value: '{primitives.gray.900}' } },
        primary: { $type: 'color', $value: '{semantic.brand.700}' },
      },
    });
  });

  it('derives themes with the shared rule', () => {
    expect(buildExport(good).themes).toEqual([
      { name: 'nova', group: 'Brand', selectedTokenSets: { primitives: 'source', 'semantic/brand/nova': 'enabled' } },
      { name: 'orbit', group: 'Brand', selectedTokenSets: { primitives: 'source', 'semantic/brand/orbit': 'enabled' } },
      { name: 'light', group: 'Theme', selectedTokenSets: { primitives: 'source', 'semantic/theme/light': 'enabled' } },
      { name: 'dark', group: 'Theme', selectedTokenSets: { primitives: 'source', 'semantic/theme/dark': 'enabled' } },
    ]);
  });

  it('has no errors for a clean file', () => {
    expect(buildExport(good).errors).toEqual([]);
  });

  it('returns nothing for a file without variables', () => {
    expect(buildExport(snapshot([], []))).toEqual({ sets: [], themes: [], errors: [] });
  });

  it('reports an invalid variable once, not once per mode', () => {
    const result = buildExport(
      snapshot([theme], [variable('semantic/theme', 'flag', 'BOOLEAN', { light: true, dark: false })]),
    );

    expect(result.errors).toEqual([
      { collection: 'semantic/theme', variable: 'flag', reason: 'boolean variables are not supported' },
    ]);
  });

  it('reports per-mode problems with their mode', () => {
    const result = buildExport(
      snapshot([theme], [variable('semantic/theme', 'x', 'COLOR', { light: { aliasId: 'remote' }, dark: rgba(0, 0, 0) })]),
    );

    expect(result.errors).toEqual([
      { collection: 'semantic/theme', variable: 'x', mode: 'light', reason: 'aliases a variable that is not local to this file' },
    ]);
  });

  it('reports a missing value for a mode', () => {
    const result = buildExport(snapshot([theme], [variable('semantic/theme', 'x', 'COLOR', { light: rgba(0, 0, 0) })]));

    expect(result.errors).toEqual([
      { collection: 'semantic/theme', variable: 'x', mode: 'dark', reason: 'has no value for this mode' },
    ]);
  });

  it('reports names that would break references', () => {
    const result = buildExport(snapshot([primitives], [variable('primitives', 'spacing/1.5', 'FLOAT', { 'Mode 1': 1.5 })]));

    expect(result.errors).toEqual([
      { collection: 'primitives', variable: 'spacing/1.5', reason: 'name segment "1.5" contains one of . { }' },
    ]);
  });

  it('reports token/group collisions', () => {
    const result = buildExport(
      snapshot(
        [primitives],
        [
          variable('primitives', 'gray', 'COLOR', { 'Mode 1': rgba(0, 0, 0) }),
          variable('primitives', 'gray/100', 'COLOR', { 'Mode 1': rgba(1, 1, 1) }),
        ],
      ),
    );

    expect(result.errors).toEqual([
      { collection: 'primitives', variable: 'gray/100', reason: 'primitives.gray.100 collides with another token or group' },
    ]);
  });

  it('reports two collections that produce the same set', () => {
    const result = buildExport(snapshot([collection('a/b', ['x']), collection('a', ['b', 'c'])], []));

    expect(result.errors).toEqual([
      { collection: 'a', mode: 'b', reason: 'produces the set "a/b", which collection "a/b" also produces' },
    ]);
  });

  it('reports collection or mode names that could escape the export folder', () => {
    const result = buildExport(snapshot([collection('themes', ['..', 'dark'])], []));

    expect(result.errors).toEqual([
      {
        collection: 'themes',
        mode: '..',
        reason: 'collection and mode names cannot have empty, "." or ".." segments or contain \\',
      },
    ]);
  });
});
```

`packages/figma-plugin/test/files.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { buildExport } from '../src/core/build-export';
import { multipleFiles, singleFile } from '../src/core/files';
import { alias, collection, rgba, snapshot, variable } from './helpers';

const result = buildExport(
  snapshot(
    [collection('primitives', ['Mode 1']), collection('semantic/theme', ['light', 'dark'])],
    [
      variable('primitives', 'gray/900', 'COLOR', { 'Mode 1': rgba(0, 0, 0) }),
      variable('semantic/theme', 'text', 'COLOR', {
        light: alias('primitives', 'gray/900'),
        dark: alias('primitives', 'gray/900'),
      }),
    ],
  ),
);

describe('multipleFiles', () => {
  it('writes one file per set plus $themes.json with the shared JSON style', () => {
    const files = multipleFiles(result);

    expect(files.map((file) => file.path)).toEqual([
      'primitives.json',
      'semantic/theme/light.json',
      'semantic/theme/dark.json',
      '$themes.json',
    ]);
    expect(files[0].json).toBe(
      '{\n  "primitives": {\n    "gray": {\n      "900": {\n        "$type": "color",\n        "$value": "#000000"\n      }\n    }\n  }\n}\n',
    );
  });
});

describe('singleFile', () => {
  it('keys every set by its path and adds $themes', () => {
    const file = singleFile(result);

    expect(file.path).toBe('tokens.json');
    expect(Object.keys(JSON.parse(file.json))).toEqual([
      'primitives',
      'semantic/theme/light',
      'semantic/theme/dark',
      '$themes',
    ]);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter export-design-tokens test build-export files`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `build-export.ts`**

`packages/figma-plugin/src/core/build-export.ts`:

```ts
import { deriveThemes } from 'css-to-dtcg/themes';

import { invalidNameReason, invalidSetPathReason, nest, setPath, tokenPath, type Tree } from './sets';
import { isAlias, type Snapshot, type SnapshotCollection } from './snapshot';
import { toToken } from './tokens';

export type ExportError = { collection: string; variable?: string; mode?: string; reason: string };
export type BuiltSet = { name: string; tree: Tree };
export type Theme = { name: string; group: string; selectedTokenSets: Record<string, 'source' | 'enabled'> };
export type BuildResult = { sets: BuiltSet[]; themes: Theme[]; errors: ExportError[] };

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const lastSegment = (name: string) => name.split('/').at(-1) ?? name;

/** Keeps the first occurrence of each distinct error, in order. */
function dedupe(errors: ExportError[]): ExportError[] {
  const seen = new Set<string>();
  return errors.filter((error) => {
    const key = JSON.stringify([error.collection, error.variable, error.mode, error.reason]);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function buildExport(snapshot: Snapshot): BuildResult {
  const errors: ExportError[] = [];
  const collections = new Map(snapshot.collections.map((collection) => [collection.id, collection]));
  const variables = new Map(snapshot.variables.map((variable) => [variable.id, variable]));

  const pathOf = (variableId: string) => {
    const variable = variables.get(variableId);
    const collection = variable && collections.get(variable.collectionId);
    return variable && collection ? tokenPath(collection.name, variable.name) : undefined;
  };
  const setsOf = (collection: SnapshotCollection) => collection.modes.map((mode) => setPath(collection, mode.name));

  const sets: BuildResult['sets'] = [];
  const themeInputs: { name: string; group?: string; themeName: string; references: string[] }[] = [];
  const producedBy = new Map<string, string>();

  for (const collection of snapshot.collections) {
    const multiMode = collection.modes.length > 1;

    for (const mode of collection.modes) {
      const name = setPath(collection, mode.name);

      const unsafe = invalidSetPathReason(name);
      if (unsafe) {
        errors.push({ collection: collection.name, mode: multiMode ? mode.name : undefined, reason: unsafe });
        continue;
      }
      if (producedBy.has(name)) {
        errors.push({
          collection: collection.name,
          mode: multiMode ? mode.name : undefined,
          reason: `produces the set "${name}", which collection "${producedBy.get(name)}" also produces`,
        });
        continue;
      }
      producedBy.set(name, collection.name);

      const tree: Tree = {};
      const references = new Set<string>();

      for (const variableId of collection.variableIds) {
        const variable = variables.get(variableId);
        if (!variable) {
          continue;
        }

        const path = tokenPath(collection.name, variable.name);
        const badName = invalidNameReason(path);
        if (badName) {
          errors.push({ collection: collection.name, variable: variable.name, reason: badName });
          continue;
        }

        const value = variable.valuesByMode[mode.id];
        if (value === undefined) {
          errors.push({ collection: collection.name, variable: variable.name, mode: mode.name, reason: 'has no value for this mode' });
          continue;
        }

        const result = toToken(variable, value, pathOf);
        if (!result.ok) {
          errors.push({
            collection: collection.name,
            variable: variable.name,
            mode: result.perMode ? mode.name : undefined,
            reason: result.reason,
          });
          continue;
        }

        if (!nest(tree, path, result.token)) {
          errors.push({
            collection: collection.name,
            variable: variable.name,
            reason: `${path.join('.')} collides with another token or group`,
          });
          continue;
        }

        if (isAlias(value)) {
          const target = variables.get(value.aliasId);
          const targetCollection = target && collections.get(target.collectionId);
          if (targetCollection && targetCollection.id !== collection.id) {
            for (const setName of setsOf(targetCollection)) {
              references.add(setName);
            }
          }
        }
      }

      sets.push({ name, tree });
      themeInputs.push({
        name,
        group: multiMode ? capitalize(lastSegment(collection.name)) : undefined,
        themeName: mode.name,
        references: [...references],
      });
    }
  }

  return { sets, themes: deriveThemes(themeInputs) as Theme[], errors: dedupe(errors) };
}
```

- [ ] **Step 4: Implement `files.ts`**

`packages/figma-plugin/src/core/files.ts`:

```ts
import { serialize } from 'css-to-dtcg/serialize';

import type { BuildResult } from './build-export';

export type ExportFile = { path: string; json: string };

export function multipleFiles(result: BuildResult): ExportFile[] {
  return [
    ...result.sets.map((set) => ({ path: `${set.name}.json`, json: serialize(set.tree) })),
    { path: '$themes.json', json: serialize(result.themes) },
  ];
}

export function singleFile(result: BuildResult): ExportFile {
  const all: Record<string, unknown> = {};
  for (const set of result.sets) {
    all[set.name] = set.tree;
  }
  all.$themes = result.themes;
  return { path: 'tokens.json', json: serialize(all) };
}
```

- [ ] **Step 5: Run them to verify they pass**

Run: `pnpm --filter export-design-tokens test build-export files`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/figma-plugin/src/core packages/figma-plugin/test
git commit -m "feat(plugin): build sets, themes and errors from a snapshot"
```

---

### Task 7: Round-trip golden test against the example

**Files:**
- Test: `packages/figma-plugin/test/round-trip.test.ts`

**Interfaces:**
- Consumes: `buildExport`, `multipleFiles` (Task 6); `examples/lumen-academy/figma-snapshot.json` and `examples/lumen-academy/tokens/` (plan 2).

- [ ] **Step 1: Write the test**

`packages/figma-plugin/test/round-trip.test.ts`:

```ts
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { buildExport } from '../src/core/build-export';
import { multipleFiles } from '../src/core/files';
import type { Snapshot } from '../src/core/snapshot';

const example = fileURLToPath(new URL('../../../examples/lumen-academy/', import.meta.url));

function readTree(dir: string): Map<string, string> {
  const files = new Map<string, string>();
  const walk = (current: string) => {
    for (const entry of readdirSync(current)) {
      const full = join(current, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else {
        files.set(relative(dir, full).split('\\').join('/'), readFileSync(full, 'utf8'));
      }
    }
  };
  walk(dir);
  return files;
}

describe('CSS → css-to-dtcg → Figma → plugin', () => {
  const snapshot = JSON.parse(readFileSync(join(example, 'figma-snapshot.json'), 'utf8')) as Snapshot;
  const result = buildExport(snapshot);

  it('exports the example without errors', () => {
    expect(result.errors).toEqual([]);
  });

  it('reproduces examples/lumen-academy/tokens byte for byte', () => {
    const expected = readTree(join(example, 'tokens'));
    const actual = new Map(multipleFiles(result).map((file) => [file.path, file.json]));

    expect([...actual.keys()].sort()).toEqual([...expected.keys()].sort());
    for (const [path, json] of expected) {
      expect(actual.get(path), path).toBe(json);
    }
  });
});
```

- [ ] **Step 2: Run it**

Run: `pnpm --filter export-design-tokens test round-trip`
Expected: PASS. If it fails, the diff shows which rule differs between `css-to-dtcg` and the plugin; fix the side that disagrees with the specs (never edit the generated example files by hand).

- [ ] **Step 3: Commit**

```bash
git add packages/figma-plugin/test/round-trip.test.ts
git commit -m "test(plugin): prove the CSS → Figma → plugin round trip is lossless"
```

---

### Task 8: Main thread — snapshot, storage and RPC

**Files:**
- Create: `packages/figma-plugin/src/shared/messages.ts`, `src/plugin/snapshot.ts`, `src/plugin/storage.ts`, `src/ui/rpc.ts`
- Modify: `packages/figma-plugin/src/plugin/main.ts` (replace)
- Create (early, used here): `packages/figma-plugin/src/github/settings.ts` exporting only the `RepoSettings` type for now — Task 10 fills it in. Write it as:

```ts
export type RepoSettings = { repository: string; base: string; folder: string };
```

- Test: `packages/figma-plugin/test/plugin-snapshot.test.ts`

**Interfaces:**
- Consumes: snapshot types (Task 3), `RepoSettings`.
- Produces:
  - `Destination = 'github' | 'computer'`, `Prefs = { settings: RepoSettings | null; hasToken: boolean; destination: Destination }`
  - `Methods` (RPC): `getSnapshot(): Snapshot`, `getPrefs(): Prefs`, `saveSettings(settings: RepoSettings): void`, `saveToken(token: string): void`, `getToken(): string | null`, `saveDestination(destination: Destination): void`, `openUrl(url: string): void`, `close(): void`
  - `toSnapshotValue(value: VariableValue): SnapshotValue`, `readSnapshot(): Promise<Snapshot>`
  - UI: `call<K extends keyof Methods>(method: K, ...params: Parameters<Methods[K]>): Promise<Awaited<ReturnType<Methods[K]>>>`

- [ ] **Step 1: Write the failing test**

`packages/figma-plugin/test/plugin-snapshot.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { toSnapshotValue } from '../src/plugin/snapshot';

describe('toSnapshotValue', () => {
  it('turns Figma aliases into { aliasId }', () => {
    expect(toSnapshotValue({ type: 'VARIABLE_ALIAS', id: 'VariableID:1:2' })).toEqual({ aliasId: 'VariableID:1:2' });
  });

  it('always gives colours an alpha', () => {
    expect(toSnapshotValue({ r: 1, g: 0.5, b: 0 })).toEqual({ r: 1, g: 0.5, b: 0, a: 1 });
    expect(toSnapshotValue({ r: 1, g: 0.5, b: 0, a: 0.25 })).toEqual({ r: 1, g: 0.5, b: 0, a: 0.25 });
  });

  it('passes numbers, strings and booleans through', () => {
    expect(toSnapshotValue(0.20000000298023224)).toBe(0.20000000298023224);
    expect(toSnapshotValue('Inter')).toBe('Inter');
    expect(toSnapshotValue(true)).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter export-design-tokens test plugin-snapshot`
Expected: FAIL — cannot resolve `../src/plugin/snapshot`.

- [ ] **Step 3: Implement the shared types, snapshot and storage**

`packages/figma-plugin/src/shared/messages.ts`:

```ts
import type { Snapshot } from '../core/snapshot';
import type { RepoSettings } from '../github/settings';

export type Destination = 'github' | 'computer';

export type Prefs = { settings: RepoSettings | null; hasToken: boolean; destination: Destination };

/** Everything the UI can ask the main thread to do. */
export interface Methods {
  getSnapshot(): Snapshot;
  getPrefs(): Prefs;
  saveSettings(settings: RepoSettings): void;
  saveToken(token: string): void;
  getToken(): string | null;
  saveDestination(destination: Destination): void;
  openUrl(url: string): void;
  close(): void;
}

export type MethodName = keyof Methods;

export type RpcRequest = {
  [K in MethodName]: { rpc: 'request'; id: number; method: K; params: Parameters<Methods[K]> };
}[MethodName];

export type RpcResponse = { rpc: 'response'; id: number; result?: unknown; error?: string };
```

`packages/figma-plugin/src/plugin/snapshot.ts`:

```ts
import type { Snapshot, SnapshotValue } from '../core/snapshot';

export function toSnapshotValue(value: VariableValue): SnapshotValue {
  if (typeof value === 'object' && value !== null) {
    if ('type' in value && value.type === 'VARIABLE_ALIAS') {
      return { aliasId: value.id };
    }
    if ('r' in value) {
      return { r: value.r, g: value.g, b: value.b, a: 'a' in value ? value.a : 1 };
    }
  }
  return value as SnapshotValue;
}

/** Reads the current file's local variables. The only place that reads figma.variables. */
export async function readSnapshot(): Promise<Snapshot> {
  const [collections, variables] = await Promise.all([
    figma.variables.getLocalVariableCollectionsAsync(),
    figma.variables.getLocalVariablesAsync(),
  ]);

  return {
    fileName: figma.root.name,
    userName: figma.currentUser?.name ?? null,
    collections: collections.map((collection) => ({
      id: collection.id,
      name: collection.name,
      modes: collection.modes.map((mode) => ({ id: mode.modeId, name: mode.name })),
      variableIds: [...collection.variableIds],
    })),
    variables: variables.map((variable) => ({
      id: variable.id,
      name: variable.name,
      collectionId: variable.variableCollectionId,
      resolvedType: variable.resolvedType,
      scopes: [...variable.scopes],
      description: variable.description,
      codeSyntax: variable.codeSyntax.WEB ? { WEB: variable.codeSyntax.WEB } : {},
      valuesByMode: Object.fromEntries(
        Object.entries(variable.valuesByMode).map(([modeId, value]) => [modeId, toSnapshotValue(value)]),
      ),
    })),
  };
}
```

`packages/figma-plugin/src/plugin/storage.ts`:

```ts
import type { RepoSettings } from '../github/settings';
import type { Destination, Prefs } from '../shared/messages';

const KEYS = { settings: 'github-settings', token: 'github-token', destination: 'destination' } as const;

export async function loadPrefs(): Promise<Prefs> {
  const [settings, token, destination] = await Promise.all([
    figma.clientStorage.getAsync(KEYS.settings),
    figma.clientStorage.getAsync(KEYS.token),
    figma.clientStorage.getAsync(KEYS.destination),
  ]);

  return {
    settings: (settings as RepoSettings | undefined) ?? null,
    hasToken: typeof token === 'string' && token !== '',
    destination: destination === 'computer' ? 'computer' : 'github',
  };
}

export const saveSettings = (settings: RepoSettings) => figma.clientStorage.setAsync(KEYS.settings, settings);

/** Overwrites the stored token. The token is never sent to the UI except for GitHub calls. */
export const saveToken = (token: string) => figma.clientStorage.setAsync(KEYS.token, token);

export async function loadToken(): Promise<string | null> {
  const token = await figma.clientStorage.getAsync(KEYS.token);
  return typeof token === 'string' && token !== '' ? token : null;
}

export const saveDestination = (destination: Destination) => figma.clientStorage.setAsync(KEYS.destination, destination);
```

- [ ] **Step 4: Implement the main thread and the UI RPC client**

`packages/figma-plugin/src/plugin/main.ts` (replace the whole file):

```ts
import type { Methods, RpcRequest, RpcResponse } from '../shared/messages';
import { readSnapshot } from './snapshot';
import { loadPrefs, loadToken, saveDestination, saveSettings, saveToken } from './storage';

type Handlers = {
  [K in keyof Methods]: (...params: Parameters<Methods[K]>) => ReturnType<Methods[K]> | Promise<ReturnType<Methods[K]>>;
};

const handlers: Handlers = {
  getSnapshot: () => readSnapshot(),
  getPrefs: () => loadPrefs(),
  saveSettings: (settings) => saveSettings(settings),
  saveToken: (token) => saveToken(token),
  getToken: () => loadToken(),
  saveDestination: (destination) => saveDestination(destination),
  openUrl: (url) => figma.openExternal(url),
  close: () => figma.closePlugin(),
};

figma.showUI(__html__, { width: 360, height: 440, themeColors: true, title: 'Export tokens' });

figma.ui.onmessage = async (message: RpcRequest) => {
  if (message?.rpc !== 'request') {
    return;
  }

  const reply: RpcResponse = { rpc: 'response', id: message.id };
  try {
    const handler = handlers[message.method] as (...params: unknown[]) => unknown;
    reply.result = await handler(...message.params);
  } catch (error) {
    reply.error = error instanceof Error ? error.message : String(error);
  }
  figma.ui.postMessage(reply);
};
```

`packages/figma-plugin/src/ui/rpc.ts`:

```ts
import type { MethodName, Methods, RpcResponse } from '../shared/messages';

let nextId = 1;
const pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();

window.addEventListener('message', (event: MessageEvent) => {
  const message = event.data?.pluginMessage as RpcResponse | undefined;
  if (!message || message.rpc !== 'response') {
    return;
  }
  const request = pending.get(message.id);
  if (!request) {
    return;
  }
  pending.delete(message.id);
  if (message.error !== undefined) {
    request.reject(new Error(message.error));
  } else {
    request.resolve(message.result);
  }
});

export function call<K extends MethodName>(
  method: K,
  ...params: Parameters<Methods[K]>
): Promise<Awaited<ReturnType<Methods[K]>>> {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve: resolve as (value: unknown) => void, reject });
    parent.postMessage({ pluginMessage: { rpc: 'request', id, method, params } }, '*');
  });
}
```

- [ ] **Step 5: Run the test and the typecheck**

Run: `pnpm --filter export-design-tokens test plugin-snapshot && pnpm --filter export-design-tokens typecheck`
Expected: PASS; no type errors.

- [ ] **Step 6: Commit**

```bash
git add packages/figma-plugin/src
git add packages/figma-plugin/test/plugin-snapshot.test.ts
git commit -m "feat(plugin): read local variables and expose storage over RPC"
```

---

### Task 9: GitHub client and error mapping

**Files:**
- Create: `packages/figma-plugin/src/github/client.ts`
- Test: `packages/figma-plugin/test/client.test.ts`

**Interfaces:**
- Produces:
  - `class GitHubError extends Error { readonly status: number | null }`
  - `GitHubClient = { request<T>(method: string, path: string, body?: unknown): Promise<T> }`
  - `createClient(token: string, fetchImpl?: typeof fetch): GitHubClient`
  - `toError(response: Response): Promise<GitHubError>`
  - `encodePath(value: string): string` — encodes each `/`-separated segment.

- [ ] **Step 1: Write the failing test**

`packages/figma-plugin/test/client.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { createClient, encodePath, GitHubError, toError } from '../src/github/client';

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers });

describe('createClient', () => {
  it('sends the token and GitHub headers, and parses JSON', async () => {
    const seen: { url: string; init: RequestInit }[] = [];
    const client = createClient('ghp_secret', async (url, init) => {
      seen.push({ url: String(url), init: init! });
      return json(200, { ok: true });
    });

    await expect(client.request('POST', '/repos/a/b/git/trees', { x: 1 })).resolves.toEqual({ ok: true });
    expect(seen[0].url).toBe('https://api.github.com/repos/a/b/git/trees');
    expect(seen[0].init.method).toBe('POST');
    expect(seen[0].init.body).toBe('{"x":1}');
    expect(seen[0].init.headers).toMatchObject({
      Authorization: 'Bearer ghp_secret',
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    });
  });

  it('maps network failures', async () => {
    const client = createClient('t', async () => {
      throw new TypeError('Failed to fetch');
    });

    await expect(client.request('GET', '/user')).rejects.toEqual(new GitHubError("Couldn't reach GitHub.", null));
  });

  it('throws mapped errors for non-2xx responses', async () => {
    const client = createClient('t', async () => json(401, { message: 'Bad credentials' }));

    await expect(client.request('GET', '/user')).rejects.toMatchObject({ message: 'GitHub rejected the token.', status: 401 });
  });
});

describe('toError', () => {
  it('maps the documented statuses', async () => {
    expect((await toError(json(403, {}))).message).toBe('The token has no permission for this repository.');
    expect((await toError(json(404, {}))).message).toBe('Repository or branch not found.');
    expect((await toError(json(409, {}))).message).toBe('The repository is empty.');
    expect((await toError(json(500, { message: 'Boom' }))).message).toBe('GitHub error 500: Boom');
  });

  it('explains rate limits with the local reset time', async () => {
    const reset = new Date(2026, 8, 23, 14, 5);
    const error = await toError(
      json(403, {}, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(reset.getTime() / 1000) }),
    );

    expect(error.message).toBe('GitHub rate limit reached; try again at 14:05.');
    expect((await toError(json(429, {}))).message).toBe('GitHub rate limit reached; try again later.');
  });

  it('never suggests replacing the token', async () => {
    for (const status of [401, 403, 404, 409, 422, 500]) {
      expect((await toError(json(status, {}))).message.toLowerCase()).not.toContain('replace');
    }
  });
});

describe('encodePath', () => {
  it('keeps slashes and encodes each segment', () => {
    expect(encodePath('feature/a b#1')).toBe('feature/a%20b%231');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter export-design-tokens test client`
Expected: FAIL — cannot resolve `../src/github/client`.

- [ ] **Step 3: Implement**

`packages/figma-plugin/src/github/client.ts`:

```ts
export class GitHubError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
    this.name = 'GitHubError';
  }
}

export type GitHubClient = { request<T>(method: string, path: string, body?: unknown): Promise<T> };

export const encodePath = (value: string) => value.split('/').map(encodeURIComponent).join('/');

const hhmm = (date: Date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

/** Plain-language errors. None of them suggests replacing the token. */
export async function toError(response: Response): Promise<GitHubError> {
  const body = (await response.json().catch(() => ({}))) as { message?: string };
  const { status } = response;

  const rateLimited = status === 429 || (status === 403 && response.headers.get('x-ratelimit-remaining') === '0');
  if (rateLimited) {
    const reset = Number(response.headers.get('x-ratelimit-reset'));
    const when = Number.isFinite(reset) && reset > 0 ? `at ${hhmm(new Date(reset * 1000))}` : 'later';
    return new GitHubError(`GitHub rate limit reached; try again ${when}.`, status);
  }

  switch (status) {
    case 401:
      return new GitHubError('GitHub rejected the token.', status);
    case 403:
      return new GitHubError('The token has no permission for this repository.', status);
    case 404:
      return new GitHubError('Repository or branch not found.', status);
    case 409:
      return new GitHubError('The repository is empty.', status);
    default:
      return new GitHubError(`GitHub error ${status}: ${body.message ?? response.statusText}`, status);
  }
}

export function createClient(token: string, fetchImpl: typeof fetch = fetch): GitHubClient {
  return {
    async request<T>(method: string, path: string, body?: unknown): Promise<T> {
      let response: Response;
      try {
        response = await fetchImpl(`https://api.github.com${path}`, {
          method,
          headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${token}`,
            'X-GitHub-Api-Version': '2022-11-28',
            ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
      } catch {
        throw new GitHubError("Couldn't reach GitHub.", null);
      }

      if (!response.ok) {
        throw await toError(response);
      }
      return (response.status === 204 ? undefined : await response.json()) as T;
    },
  };
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm --filter export-design-tokens test client`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/figma-plugin/src/github/client.ts packages/figma-plugin/test/client.test.ts
git commit -m "feat(plugin): add a GitHub REST client with plain-language errors"
```

---

### Task 10: Settings validation, settings check and publish

**Files:**
- Modify: `packages/figma-plugin/src/github/settings.ts` (replace the type-only file from Task 8)
- Create: `packages/figma-plugin/src/github/publish.ts`
- Test: `packages/figma-plugin/test/settings.test.ts`, `packages/figma-plugin/test/publish.test.ts`

**Interfaces:**
- Consumes: `GitHubClient`, `GitHubError`, `encodePath` (Task 9); `ExportFile` (Task 6).
- Produces:
  - `RepoSettings = { repository: string; base: string; folder: string }`
  - `parseRepository(value: string): { owner: string; repo: string } | null`
  - `normalizeFolder(folder: string): string`, `normalizeSettings(settings: RepoSettings): RepoSettings`
  - `validateSettings(settings: RepoSettings): string[]`
  - `checkSettings(client: GitHubClient, settings: RepoSettings): Promise<void>`
  - `PublishStep = 'reading' | 'committing' | 'branching' | 'opening'`
  - `PublishInput = { files: ExportFile[]; fileName: string; userName: string | null; now: Date }`
  - `PublishResult = { kind: 'no-changes'; base: string } | { kind: 'opened'; number: number; url: string; branch: string }`
  - `branchName(now: Date): string`, `prBody(input, files: { filename: string; status: string }[]): string`
  - `publish(client, settings, input, onStep?: (step: PublishStep) => void): Promise<PublishResult>`

- [ ] **Step 1: Write the failing tests**

`packages/figma-plugin/test/settings.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { createClient } from '../src/github/client';
import { checkSettings, normalizeFolder, normalizeSettings, parseRepository, validateSettings } from '../src/github/settings';

const valid = { repository: 'acme/ui', base: 'main', folder: 'tokens' };

describe('parseRepository', () => {
  it('reads owner/repo', () => {
    expect(parseRepository(' acme/ui-kit.js ')).toEqual({ owner: 'acme', repo: 'ui-kit.js' });
    expect(parseRepository('acme')).toBeNull();
    expect(parseRepository('https://github.com/acme/ui')).toBeNull();
  });
});

describe('normalizeFolder', () => {
  it('trims whitespace and slashes', () => {
    expect(normalizeFolder(' /design/tokens/ ')).toBe('design/tokens');
  });
});

describe('validateSettings', () => {
  it('accepts valid settings', () => {
    expect(validateSettings(valid)).toEqual([]);
  });

  it('never lets the folder be the repository root or escape it', () => {
    expect(validateSettings({ ...valid, folder: '' })).toEqual(["Folder can't be the repository root."]);
    expect(validateSettings({ ...valid, folder: '/' })).toEqual(["Folder can't be the repository root."]);
    expect(validateSettings({ ...valid, folder: 'a/../b' })).toEqual(['Folder can\'t contain "." or ".." segments.']);
  });

  it('checks repository and base branch', () => {
    expect(validateSettings({ repository: 'acme', base: ' ', folder: 'tokens' })).toEqual([
      'Repository must look like owner/repo.',
      'Base branch is required.',
    ]);
  });

  it('normalizes before saving', () => {
    expect(normalizeSettings({ repository: ' acme/ui ', base: ' main ', folder: '/tokens/' })).toEqual(valid);
  });
});

describe('checkSettings', () => {
  const clientFor = (routes: Record<string, [number, unknown]>) =>
    createClient('t', async (url) => {
      const [status, body] = routes[String(url).replace('https://api.github.com', '')] ?? [404, {}];
      return new Response(JSON.stringify(body), { status });
    });

  it('passes when the token can push and the base branch exists', async () => {
    const client = clientFor({ '/repos/acme/ui': [200, { permissions: { push: true } }], '/repos/acme/ui/branches/main': [200, {}] });

    await expect(checkSettings(client, valid)).resolves.toBeUndefined();
  });

  it('fails when the token cannot push', async () => {
    const client = clientFor({ '/repos/acme/ui': [200, { permissions: { push: false } }] });

    await expect(checkSettings(client, valid)).rejects.toThrow("The token can't push to acme/ui.");
  });

  it('fails when the base branch is missing', async () => {
    const client = clientFor({ '/repos/acme/ui': [200, { permissions: { push: true } }] });

    await expect(checkSettings(client, valid)).rejects.toThrow('Repository or branch not found.');
  });
});
```

`packages/figma-plugin/test/publish.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { createClient } from '../src/github/client';
import { branchName, prBody, publish, type PublishStep } from '../src/github/publish';

type Route = (body: any) => [number, unknown];

function fakeGitHub(routes: Record<string, Route>) {
  const calls: { method: string; path: string; body?: any }[] = [];
  const client = createClient('t', async (url, init) => {
    const path = String(url).replace('https://api.github.com', '');
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, path, body });
    const route = routes[`${method} ${path}`];
    const [status, json] = route ? route(body) : [404, { message: 'Not Found' }];
    return new Response(JSON.stringify(json), { status });
  });
  return { client, calls };
}

const R = '/repos/acme/ui';
const now = new Date(Date.UTC(2026, 8, 23, 14, 30, 12));
const settings = { repository: 'acme/ui', base: 'main', folder: 'tokens' };
const files = [
  { path: 'primitives.json', json: '{}\n' },
  { path: '$themes.json', json: '[]\n' },
];
const input = { files, fileName: 'Design System', userName: 'Ada', now };

const baseRoutes = (overrides: Record<string, Route> = {}): Record<string, Route> => ({
  [`GET ${R}/git/ref/heads/main`]: () => [200, { object: { sha: 'base-commit' } }],
  [`GET ${R}/git/commits/base-commit`]: () => [200, { tree: { sha: 'root-tree' } }],
  [`GET ${R}/git/trees/root-tree`]: () => [
    200,
    { tree: [{ path: 'tokens', type: 'tree', sha: 'tokens-tree' }, { path: 'README.md', type: 'blob', sha: 'r' }] },
  ],
  [`GET ${R}/git/trees/tokens-tree?recursive=1`]: () => [
    200,
    {
      truncated: false,
      tree: [
        { path: 'primitives.json', type: 'blob', sha: 'a' },
        { path: 'old.json', type: 'blob', sha: 'b' },
        { path: 'nested', type: 'tree', sha: 'c' },
        { path: 'nested/x.json', type: 'blob', sha: 'd' },
        { path: 'vendored', type: 'commit', sha: 'e' },
      ],
    },
  ],
  [`POST ${R}/git/trees`]: () => [201, { sha: 'new-tree' }],
  [`POST ${R}/git/commits`]: () => [201, { sha: 'new-commit' }],
  [`POST ${R}/git/refs`]: () => [201, {}],
  [`GET ${R}/compare/main...new-commit`]: () => [
    200,
    {
      files: [
        { filename: 'tokens/$themes.json', status: 'added' },
        { filename: 'tokens/primitives.json', status: 'modified' },
        { filename: 'tokens/old.json', status: 'removed' },
      ],
    },
  ],
  [`POST ${R}/pulls`]: () => [201, { number: 42, html_url: 'https://github.com/acme/ui/pull/42' }],
  ...overrides,
});

describe('branchName', () => {
  it('uses a UTC timestamp without colons', () => {
    expect(branchName(now)).toBe('styles/figma-export-20260923-143012');
  });
});

describe('publish', () => {
  it('replaces the folder in one commit and opens a PR', async () => {
    const { client, calls } = fakeGitHub(baseRoutes());
    const steps: PublishStep[] = [];

    const result = await publish(client, settings, input, (step) => steps.push(step));

    expect(result).toEqual({
      kind: 'opened',
      number: 42,
      url: 'https://github.com/acme/ui/pull/42',
      branch: 'styles/figma-export-20260923-143012',
    });
    expect(steps).toEqual(['reading', 'committing', 'branching', 'opening']);

    const tree = calls.find((call) => call.method === 'POST' && call.path === `${R}/git/trees`)!.body;
    expect(tree).toEqual({
      base_tree: 'root-tree',
      tree: [
        { path: 'tokens/primitives.json', mode: '100644', type: 'blob', content: '{}\n' },
        { path: 'tokens/$themes.json', mode: '100644', type: 'blob', content: '[]\n' },
        { path: 'tokens/old.json', mode: '100644', type: 'blob', sha: null },
        { path: 'tokens/nested/x.json', mode: '100644', type: 'blob', sha: null },
      ],
    });

    expect(calls.find((call) => call.path === `${R}/git/commits` && call.method === 'POST')!.body).toEqual({
      message: 'chore(tokens): export from Figma',
      tree: 'new-tree',
      parents: ['base-commit'],
    });
    expect(calls.find((call) => call.path === `${R}/git/refs`)!.body).toEqual({
      ref: 'refs/heads/styles/figma-export-20260923-143012',
      sha: 'new-commit',
    });
    expect(calls.find((call) => call.path === `${R}/pulls`)!.body).toMatchObject({
      title: 'chore(tokens): export from Figma',
      head: 'styles/figma-export-20260923-143012',
      base: 'main',
    });
  });

  it('stops without creating anything when nothing changed', async () => {
    const { client, calls } = fakeGitHub(baseRoutes({ [`POST ${R}/git/trees`]: () => [201, { sha: 'root-tree' }] }));

    await expect(publish(client, settings, input)).resolves.toEqual({ kind: 'no-changes', base: 'main' });
    expect(calls.some((call) => call.path === `${R}/git/commits` && call.method === 'POST')).toBe(false);
    expect(calls.some((call) => call.path === `${R}/git/refs`)).toBe(false);
  });

  it('handles a folder that does not exist yet', async () => {
    const { client, calls } = fakeGitHub(
      baseRoutes({ [`GET ${R}/git/trees/root-tree`]: () => [200, { tree: [{ path: 'README.md', type: 'blob', sha: 'r' }] }] }),
    );

    await publish(client, settings, input);

    const tree = calls.find((call) => call.method === 'POST' && call.path === `${R}/git/trees`)!.body.tree;
    expect(tree.every((entry: { sha?: null }) => entry.sha === undefined)).toBe(true);
    expect(calls.filter((call) => call.path.startsWith(`${R}/git/trees/`))).toHaveLength(1);
  });

  it('walks a nested folder', async () => {
    const { client, calls } = fakeGitHub(
      baseRoutes({
        [`GET ${R}/git/trees/root-tree`]: () => [200, { tree: [{ path: 'design', type: 'tree', sha: 'design-tree' }] }],
        [`GET ${R}/git/trees/design-tree`]: () => [200, { tree: [{ path: 'tokens', type: 'tree', sha: 'tokens-tree' }] }],
      }),
    );

    await publish(client, { ...settings, folder: 'design/tokens' }, input);

    const tree = calls.find((call) => call.method === 'POST' && call.path === `${R}/git/trees`)!.body.tree;
    expect(tree[0].path).toBe('design/tokens/primitives.json');
    expect(tree).toContainEqual({ path: 'design/tokens/old.json', mode: '100644', type: 'blob', sha: null });
  });

  it('refuses to list a truncated folder', async () => {
    const { client } = fakeGitHub(
      baseRoutes({ [`GET ${R}/git/trees/tokens-tree?recursive=1`]: () => [200, { truncated: true, tree: [] }] }),
    );

    await expect(publish(client, settings, input)).rejects.toThrow('The folder tokens has too many files to list.');
  });

  it('refuses a folder that would replace the repository root', async () => {
    const { client, calls } = fakeGitHub(baseRoutes());

    await expect(publish(client, { ...settings, folder: '/' }, input)).rejects.toThrow("Folder can't be the repository root.");
    expect(calls).toHaveLength(0);
  });

  it('explains an existing branch', async () => {
    const { client } = fakeGitHub(baseRoutes({ [`POST ${R}/git/refs`]: () => [422, { message: 'Reference already exists' }] }));

    await expect(publish(client, settings, input)).rejects.toThrow('Branch already exists.');
  });

  it('names the branch when opening the PR fails', async () => {
    const { client } = fakeGitHub(baseRoutes({ [`POST ${R}/pulls`]: () => [500, { message: 'Boom' }] }));

    await expect(publish(client, settings, input)).rejects.toThrow(
      'Branch styles/figma-export-20260923-143012 was created, but opening the pull request failed: GitHub error 500: Boom',
    );
  });
});

describe('prBody', () => {
  it('names the file, the exporter and the changes', () => {
    expect(
      prBody(input, [
        { filename: 'tokens/a.json', status: 'added' },
        { filename: 'tokens/b.json', status: 'modified' },
        { filename: 'tokens/c.json', status: 'removed' },
      ]),
    ).toBe(
      [
        'Exported from the Figma file **Design System** by Ada with Export Design Tokens.',
        '',
        '**Added**',
        '- `tokens/a.json`',
        '',
        '**Modified**',
        '- `tokens/b.json`',
        '',
        '**Removed**',
        '- `tokens/c.json`',
        '',
      ].join('\n'),
    );
  });

  it('handles an unknown exporter', () => {
    expect(prBody({ ...input, userName: null }, [])).toBe(
      'Exported from the Figma file **Design System** by an unknown user with Export Design Tokens.\n',
    );
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter export-design-tokens test settings publish`
Expected: FAIL — missing exports.

- [ ] **Step 3: Implement `settings.ts`**

`packages/figma-plugin/src/github/settings.ts` (replace):

```ts
import { encodePath, GitHubError, type GitHubClient } from './client';

export type RepoSettings = { repository: string; base: string; folder: string };

export function parseRepository(value: string): { owner: string; repo: string } | null {
  const match = /^\s*([\w.-]+)\/([\w.-]+)\s*$/.exec(value);
  return match ? { owner: match[1], repo: match[2] } : null;
}

export const normalizeFolder = (folder: string) => folder.trim().replace(/^\/+|\/+$/g, '');

export const normalizeSettings = (settings: RepoSettings): RepoSettings => ({
  repository: settings.repository.trim(),
  base: settings.base.trim(),
  folder: normalizeFolder(settings.folder),
});

export function validateSettings(settings: RepoSettings): string[] {
  const problems: string[] = [];
  const folder = normalizeFolder(settings.folder);

  if (!parseRepository(settings.repository)) {
    problems.push('Repository must look like owner/repo.');
  }
  if (settings.base.trim() === '') {
    problems.push('Base branch is required.');
  }
  if (folder === '') {
    problems.push("Folder can't be the repository root.");
  } else if (folder.split('/').some((segment) => segment === '' || segment === '.' || segment === '..')) {
    problems.push('Folder can\'t contain "." or ".." segments.');
  }
  return problems;
}

/** Confirms the repository exists, the token can push, and the base branch exists. */
export async function checkSettings(client: GitHubClient, settings: RepoSettings): Promise<void> {
  const { owner, repo } = parseRepository(settings.repository)!;
  const info = await client.request<{ permissions?: { push?: boolean } }>('GET', `/repos/${owner}/${repo}`);

  if (!info.permissions?.push) {
    throw new GitHubError(`The token can't push to ${owner}/${repo}.`, null);
  }
  await client.request('GET', `/repos/${owner}/${repo}/branches/${encodePath(settings.base.trim())}`);
}
```

- [ ] **Step 4: Implement `publish.ts`**

`packages/figma-plugin/src/github/publish.ts`:

```ts
import type { ExportFile } from '../core/files';
import { encodePath, GitHubError, type GitHubClient } from './client';
import { normalizeSettings, parseRepository, validateSettings, type RepoSettings } from './settings';

export type PublishStep = 'reading' | 'committing' | 'branching' | 'opening';
export type PublishInput = { files: ExportFile[]; fileName: string; userName: string | null; now: Date };
export type PublishResult =
  | { kind: 'no-changes'; base: string }
  | { kind: 'opened'; number: number; url: string; branch: string };

type TreeEntry = { path: string; type: 'blob' | 'tree' | 'commit'; sha: string };

const MESSAGE = 'chore(tokens): export from Figma';

export function branchName(now: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  const date = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}`;
  const time = `${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
  return `styles/figma-export-${date}-${time}`;
}

export function prBody(input: Pick<PublishInput, 'fileName' | 'userName'>, files: { filename: string; status: string }[]): string {
  const lines = [
    `Exported from the Figma file **${input.fileName}** by ${input.userName ?? 'an unknown user'} with Export Design Tokens.`,
    '',
  ];
  const section = (label: string, statuses: string[]) => {
    const names = files.filter((file) => statuses.includes(file.status)).map((file) => `- \`${file.filename}\``);
    if (names.length > 0) {
      lines.push(`**${label}**`, ...names, '');
    }
  };
  section('Added', ['added']);
  section('Modified', ['modified', 'changed', 'renamed']);
  section('Removed', ['removed']);
  return `${lines.join('\n').trimEnd()}\n`;
}

async function listFolder(client: GitHubClient, repo: string, rootTree: string, folder: string): Promise<string[]> {
  let sha = rootTree;
  for (const segment of folder.split('/')) {
    const tree = await client.request<{ tree: TreeEntry[] }>('GET', `${repo}/git/trees/${sha}`);
    const entry = tree.tree.find((candidate) => candidate.path === segment && candidate.type === 'tree');
    if (!entry) {
      return [];
    }
    sha = entry.sha;
  }

  const listing = await client.request<{ tree: TreeEntry[]; truncated: boolean }>('GET', `${repo}/git/trees/${sha}?recursive=1`);
  if (listing.truncated) {
    throw new GitHubError(`The folder ${folder} has too many files to list.`, null);
  }
  return listing.tree.filter((entry) => entry.type === 'blob').map((entry) => `${folder}/${entry.path}`);
}

/**
 * Replaces the configured folder with the exported files in one commit on a new
 * branch and opens a pull request. Never deletes anything remote: if a later
 * step fails, the branch stays and the error names it.
 */
export async function publish(
  client: GitHubClient,
  rawSettings: RepoSettings,
  input: PublishInput,
  onStep: (step: PublishStep) => void = () => {},
): Promise<PublishResult> {
  const problems = validateSettings(rawSettings);
  if (problems.length > 0) {
    throw new GitHubError(problems[0], null);
  }
  const settings = normalizeSettings(rawSettings);
  const { owner, repo } = parseRepository(settings.repository)!;
  const r = `/repos/${owner}/${repo}`;
  const base = encodePath(settings.base);

  onStep('reading');
  const ref = await client.request<{ object: { sha: string } }>('GET', `${r}/git/ref/heads/${base}`);
  const baseCommit = await client.request<{ tree: { sha: string } }>('GET', `${r}/git/commits/${ref.object.sha}`);
  const existing = await listFolder(client, r, baseCommit.tree.sha, settings.folder);

  const exported = new Set(input.files.map((file) => `${settings.folder}/${file.path}`));
  const tree = [
    ...input.files.map((file) => ({ path: `${settings.folder}/${file.path}`, mode: '100644', type: 'blob', content: file.json })),
    ...existing.filter((path) => !exported.has(path)).map((path) => ({ path, mode: '100644', type: 'blob', sha: null })),
  ];

  onStep('committing');
  const newTree = await client.request<{ sha: string }>('POST', `${r}/git/trees`, { base_tree: baseCommit.tree.sha, tree });
  if (newTree.sha === baseCommit.tree.sha) {
    return { kind: 'no-changes', base: settings.base };
  }
  const commit = await client.request<{ sha: string }>('POST', `${r}/git/commits`, {
    message: MESSAGE,
    tree: newTree.sha,
    parents: [ref.object.sha],
  });

  onStep('branching');
  const branch = branchName(input.now);
  try {
    await client.request('POST', `${r}/git/refs`, { ref: `refs/heads/${branch}`, sha: commit.sha });
  } catch (error) {
    if (error instanceof GitHubError && error.status === 422) {
      throw new GitHubError('Branch already exists.', 422);
    }
    throw error;
  }

  onStep('opening');
  try {
    const compare = await client.request<{ files?: { filename: string; status: string }[] }>(
      'GET',
      `${r}/compare/${base}...${commit.sha}`,
    );
    const pr = await client.request<{ number: number; html_url: string }>('POST', `${r}/pulls`, {
      title: MESSAGE,
      head: branch,
      base: settings.base,
      body: prBody(input, compare.files ?? []),
    });
    return { kind: 'opened', number: pr.number, url: pr.html_url, branch };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new GitHubError(
      `Branch ${branch} was created, but opening the pull request failed: ${reason}`,
      error instanceof GitHubError ? error.status : null,
    );
  }
}
```

- [ ] **Step 5: Run them to verify they pass**

Run: `pnpm --filter export-design-tokens test settings publish`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/figma-plugin/src/github packages/figma-plugin/test/settings.test.ts packages/figma-plugin/test/publish.test.ts
git commit -m "feat(plugin): validate settings and publish exports as pull requests"
```

---

### Task 11: UI state and downloads

**Files:**
- Create: `packages/figma-plugin/src/ui/state.ts`, `packages/figma-plugin/src/ui/download.ts`
- Test: `packages/figma-plugin/test/state.test.ts`, `packages/figma-plugin/test/download.test.ts`

**Interfaces:**
- Consumes: `BuildResult`, `ExportError` (Task 6), `multipleFiles`, `singleFile`, `ExportFile` (Task 6), `PublishResult`, `PublishStep` (Task 10), `Destination` (Task 8), `RepoSettings` (Task 10).
- Produces:
  - `Format = 'multiple' | 'single'`
  - `Build = { status: 'loading' } | { status: 'ready'; result: BuildResult } | { status: 'failed'; message: string }`
  - `Banner = { kind: 'success'; text: string; url: string } | { kind: 'info'; text: string } | { kind: 'error'; text: string }`
  - `previewFiles(result, format): ExportFile[]`
  - `Blocker = 'loading' | 'failed' | 'errors' | 'empty' | 'publishing'`, `exportBlocker(build: Build, publishing: boolean): Blocker | null`
  - `ExportAction = { kind: 'open-settings' } | { kind: 'download-zip'; files: ExportFile[] } | { kind: 'download-file'; file: ExportFile } | { kind: 'publish'; files: ExportFile[] }`
  - `exportAction(input: { destination; format; result; settings: RepoSettings | null; hasToken: boolean }): ExportAction`
  - `destinationLabel(destination: Destination, format: Format): string`
  - `STEP_TEXT: Record<PublishStep, string>`, `resultBanner(result: PublishResult): Banner`, `errorBanner(error: unknown): Banner`
  - `groupErrors(errors: ExportError[]): { collection: string; items: string[] }[]`
  - `TokenField = { mode: 'saved' } | { mode: 'entering'; draft: string; canCancel: boolean }`, `initialTokenField(hasToken)`, `startReplace()`, `cancelReplace()`, `tokenToSave(field): string | null`
  - `zipFiles(files: ExportFile[]): Uint8Array`, `downloadFile(file)`, `downloadZip(files)`, `downloadText(name, text)`

- [ ] **Step 1: Write the failing tests**

`packages/figma-plugin/test/state.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { buildExport } from '../src/core/build-export';
import {
  cancelReplace,
  destinationLabel,
  errorBanner,
  exportAction,
  exportBlocker,
  groupErrors,
  initialTokenField,
  previewFiles,
  resultBanner,
  startReplace,
  STEP_TEXT,
  tokenToSave,
} from '../src/ui/state';
import { collection, rgba, snapshot, variable } from './helpers';

const result = buildExport(
  snapshot([collection('primitives', ['Mode 1'])], [variable('primitives', 'gray/900', 'COLOR', { 'Mode 1': rgba(0, 0, 0) })]),
);
const settings = { repository: 'acme/ui', base: 'main', folder: 'tokens' };

describe('previewFiles', () => {
  it('lists the files of the chosen format', () => {
    expect(previewFiles(result, 'multiple').map((file) => file.path)).toEqual(['primitives.json', '$themes.json']);
    expect(previewFiles(result, 'single').map((file) => file.path)).toEqual(['tokens.json']);
  });
});

describe('exportBlocker', () => {
  it('blocks while loading, publishing, on errors and when empty', () => {
    expect(exportBlocker({ status: 'loading' }, false)).toBe('loading');
    expect(exportBlocker({ status: 'failed', message: 'x' }, false)).toBe('failed');
    expect(exportBlocker({ status: 'ready', result }, true)).toBe('publishing');
    expect(exportBlocker({ status: 'ready', result: { ...result, errors: [{ collection: 'a', reason: 'b' }] } }, false)).toBe('errors');
    expect(exportBlocker({ status: 'ready', result: { sets: [], themes: [], errors: [] } }, false)).toBe('empty');
    expect(exportBlocker({ status: 'ready', result }, false)).toBeNull();
  });
});

describe('exportAction', () => {
  it('opens settings when GitHub is not configured', () => {
    expect(exportAction({ destination: 'github', format: 'multiple', result, settings: null, hasToken: true })).toEqual({ kind: 'open-settings' });
    expect(exportAction({ destination: 'github', format: 'multiple', result, settings, hasToken: false })).toEqual({ kind: 'open-settings' });
  });

  it('always publishes multiple files, whatever the toggle says', () => {
    const action = exportAction({ destination: 'github', format: 'single', result, settings, hasToken: true });

    expect(action.kind).toBe('publish');
    expect(action.kind === 'publish' && action.files.map((file) => file.path)).toEqual(['primitives.json', '$themes.json']);
  });

  it('downloads a zip or a single file for this computer', () => {
    expect(exportAction({ destination: 'computer', format: 'multiple', result, settings: null, hasToken: false }).kind).toBe('download-zip');
    expect(exportAction({ destination: 'computer', format: 'single', result, settings: null, hasToken: false })).toMatchObject({
      kind: 'download-file',
      file: { path: 'tokens.json' },
    });
  });
});

describe('labels and banners', () => {
  it('labels destinations, noting multiple files for GitHub in single-file mode', () => {
    expect(destinationLabel('github', 'multiple')).toBe('Export to GitHub repo');
    expect(destinationLabel('github', 'single')).toBe('Export to GitHub repo (multiple files)');
    expect(destinationLabel('computer', 'single')).toBe('Export to this computer');
  });

  it('describes each publish step', () => {
    expect(STEP_TEXT).toEqual({
      reading: 'Reading repository…',
      committing: 'Committing…',
      branching: 'Creating branch…',
      opening: 'Opening PR…',
    });
  });

  it('turns results and errors into banners', () => {
    expect(resultBanner({ kind: 'opened', number: 42, url: 'u', branch: 'b' })).toEqual({ kind: 'success', text: 'PR #42 opened', url: 'u' });
    expect(resultBanner({ kind: 'no-changes', base: 'main' })).toEqual({ kind: 'info', text: 'No changes vs main' });
    expect(errorBanner(new Error('GitHub rejected the token.'))).toEqual({ kind: 'error', text: 'GitHub rejected the token.' });
  });
});

describe('groupErrors', () => {
  it('groups by collection in first-seen order', () => {
    expect(
      groupErrors([
        { collection: 'b', variable: 'x', reason: 'r1' },
        { collection: 'a', variable: 'y', mode: 'dark', reason: 'r2' },
        { collection: 'b', mode: '..', reason: 'r3' },
      ]),
    ).toEqual([
      { collection: 'b', items: ['x — r1', '(mode ..) — r3'] },
      { collection: 'a', items: ['y (dark) — r2'] },
    ]);
  });
});

describe('token field', () => {
  it('shows "saved" when a token exists and an input otherwise', () => {
    expect(initialTokenField(true)).toEqual({ mode: 'saved' });
    expect(initialTokenField(false)).toEqual({ mode: 'entering', draft: '', canCancel: false });
  });

  it('replacing starts empty, can be cancelled, and only a non-empty draft is saved', () => {
    expect(startReplace()).toEqual({ mode: 'entering', draft: '', canCancel: true });
    expect(cancelReplace()).toEqual({ mode: 'saved' });
    expect(tokenToSave({ mode: 'saved' })).toBeNull();
    expect(tokenToSave({ mode: 'entering', draft: '   ', canCancel: true })).toBeNull();
    expect(tokenToSave({ mode: 'entering', draft: ' github_pat_x ', canCancel: true })).toBe('github_pat_x');
  });
});
```

`packages/figma-plugin/test/download.test.ts`:

```ts
import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';

import { zipFiles } from '../src/ui/download';

describe('zipFiles', () => {
  it('puts every file under tokens/', () => {
    const zip = unzipSync(
      zipFiles([
        { path: 'primitives.json', json: '{}\n' },
        { path: 'semantic/theme/light.json', json: '[]\n' },
      ]),
    );

    expect(Object.keys(zip)).toEqual(['tokens/primitives.json', 'tokens/semantic/theme/light.json']);
    expect(strFromU8(zip['tokens/semantic/theme/light.json'])).toBe('[]\n');
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter export-design-tokens test state download`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `state.ts`**

`packages/figma-plugin/src/ui/state.ts`:

```ts
import type { BuildResult, ExportError } from '../core/build-export';
import { multipleFiles, singleFile, type ExportFile } from '../core/files';
import type { PublishResult, PublishStep } from '../github/publish';
import type { RepoSettings } from '../github/settings';
import type { Destination } from '../shared/messages';

export type Format = 'multiple' | 'single';
export type Build = { status: 'loading' } | { status: 'ready'; result: BuildResult } | { status: 'failed'; message: string };
export type Banner = { kind: 'success'; text: string; url: string } | { kind: 'info'; text: string } | { kind: 'error'; text: string };

export const previewFiles = (result: BuildResult, format: Format): ExportFile[] =>
  format === 'single' ? [singleFile(result)] : multipleFiles(result);

export type Blocker = 'loading' | 'failed' | 'errors' | 'empty' | 'publishing';

export function exportBlocker(build: Build, publishing: boolean): Blocker | null {
  if (publishing) return 'publishing';
  if (build.status === 'loading') return 'loading';
  if (build.status === 'failed') return 'failed';
  if (build.result.errors.length > 0) return 'errors';
  if (build.result.sets.length === 0) return 'empty';
  return null;
}

export type ExportAction =
  | { kind: 'open-settings' }
  | { kind: 'download-zip'; files: ExportFile[] }
  | { kind: 'download-file'; file: ExportFile }
  | { kind: 'publish'; files: ExportFile[] };

export function exportAction(input: {
  destination: Destination;
  format: Format;
  result: BuildResult;
  settings: RepoSettings | null;
  hasToken: boolean;
}): ExportAction {
  if (input.destination === 'github') {
    if (!input.settings || !input.hasToken) {
      return { kind: 'open-settings' };
    }
    return { kind: 'publish', files: multipleFiles(input.result) };
  }
  return input.format === 'single'
    ? { kind: 'download-file', file: singleFile(input.result) }
    : { kind: 'download-zip', files: multipleFiles(input.result) };
}

export function destinationLabel(destination: Destination, format: Format): string {
  if (destination === 'computer') {
    return 'Export to this computer';
  }
  return format === 'single' ? 'Export to GitHub repo (multiple files)' : 'Export to GitHub repo';
}

export const STEP_TEXT: Record<PublishStep, string> = {
  reading: 'Reading repository…',
  committing: 'Committing…',
  branching: 'Creating branch…',
  opening: 'Opening PR…',
};

export const resultBanner = (result: PublishResult): Banner =>
  result.kind === 'opened'
    ? { kind: 'success', text: `PR #${result.number} opened`, url: result.url }
    : { kind: 'info', text: `No changes vs ${result.base}` };

export const errorBanner = (error: unknown): Banner => ({
  kind: 'error',
  text: error instanceof Error ? error.message : String(error),
});

export function groupErrors(errors: ExportError[]): { collection: string; items: string[] }[] {
  const groups = new Map<string, string[]>();
  for (const error of errors) {
    const subject = error.variable
      ? `${error.variable}${error.mode ? ` (${error.mode})` : ''}`
      : error.mode
        ? `(mode ${error.mode})`
        : '(collection)';
    groups.set(error.collection, [...(groups.get(error.collection) ?? []), `${subject} — ${error.reason}`]);
  }
  return [...groups].map(([collection, items]) => ({ collection, items }));
}

export type TokenField = { mode: 'saved' } | { mode: 'entering'; draft: string; canCancel: boolean };

export const initialTokenField = (hasToken: boolean): TokenField =>
  hasToken ? { mode: 'saved' } : { mode: 'entering', draft: '', canCancel: false };

/** Replacing shows an empty field; the saved token stays until a new one is submitted. */
export const startReplace = (): TokenField => ({ mode: 'entering', draft: '', canCancel: true });

export const cancelReplace = (): TokenField => ({ mode: 'saved' });

export const tokenToSave = (field: TokenField): string | null =>
  field.mode === 'entering' && field.draft.trim() !== '' ? field.draft.trim() : null;
```

- [ ] **Step 4: Implement `download.ts`**

`packages/figma-plugin/src/ui/download.ts`:

```ts
import { strToU8, zipSync } from 'fflate';

import type { ExportFile } from '../core/files';

export const zipFiles = (files: ExportFile[]): Uint8Array =>
  zipSync(Object.fromEntries(files.map((file) => [`tokens/${file.path}`, strToU8(file.json)])));

function downloadBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const downloadText = (name: string, text: string) =>
  downloadBlob(name, new Blob([text], { type: 'application/json' }));

/** Browsers cannot create folders, so a single file downloads under its own name. */
export const downloadFile = (file: ExportFile) => downloadText(file.path.split('/').at(-1) ?? file.path, file.json);

export const downloadZip = (files: ExportFile[]) =>
  downloadBlob('tokens.zip', new Blob([new Uint8Array(zipFiles(files))], { type: 'application/zip' }));
```

- [ ] **Step 5: Run them to verify they pass**

Run: `pnpm --filter export-design-tokens test state download`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/figma-plugin/src/ui/state.ts packages/figma-plugin/src/ui/download.ts packages/figma-plugin/test/state.test.ts packages/figma-plugin/test/download.test.ts
git commit -m "feat(plugin): add tested screen logic and downloads"
```

---

### Task 12: The UI

**Files:**
- Create: `packages/figma-plugin/src/ui/icons.tsx`, `FileList.tsx`, `ErrorList.tsx`, `ResultBanner.tsx`, `ExportButton.tsx`, `ExportView.tsx`, `SettingsView.tsx`, `App.tsx`, `styles.css`
- Modify: `packages/figma-plugin/src/ui/main.tsx` (replace)

**Interfaces:**
- Consumes: `call` (Task 8), `buildExport` (Task 6), `state.ts` + `download.ts` (Task 11), `createClient` (Task 9), `publish`, `checkSettings`, `validateSettings`, `normalizeSettings` (Task 10), `serialize` from `css-to-dtcg/serialize`.
- Produces: the plugin window. Verified by typecheck, build and the manual checklist (Task 13).

- [ ] **Step 1: Icons and small components**

`packages/figma-plugin/src/ui/icons.tsx`:

```tsx
const Svg = ({ children, size = 16 }: { children: preact.ComponentChildren; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
    {children}
  </svg>
);

export const FileIcon = () => (
  <Svg>
    <path d="M4 1.5h5L12.5 5v9.5h-8.5z" stroke="currentColor" />
    <path d="M9 1.5V5h3.5" stroke="currentColor" />
  </Svg>
);

export const DownloadIcon = () => (
  <Svg>
    <path d="M8 2v8M4.5 6.5 8 10l3.5-3.5M3 13.5h10" stroke="currentColor" stroke-linecap="round" />
  </Svg>
);

export const ChevronIcon = () => (
  <Svg>
    <path d="m4.5 6.5 3.5 3.5 3.5-3.5" stroke="currentColor" stroke-linecap="round" />
  </Svg>
);

export const CheckIcon = () => (
  <Svg>
    <path d="m3.5 8.5 3 3 6-7" stroke="currentColor" stroke-linecap="round" />
  </Svg>
);

export const GearIcon = () => (
  <Svg>
    <circle cx="8" cy="8" r="2" stroke="currentColor" />
    <path
      d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4"
      stroke="currentColor"
      stroke-linecap="round"
    />
  </Svg>
);

export const RefreshIcon = () => (
  <Svg>
    <path d="M13 8a5 5 0 1 1-1.5-3.5M13 2.5v2.5h-2.5" stroke="currentColor" stroke-linecap="round" />
  </Svg>
);

/** Octicons "mark-github" (MIT). */
export const GitHubIcon = () => (
  <Svg>
    <path
      fill="currentColor"
      d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"
    />
  </Svg>
);

export const Spinner = () => <span class="spinner" aria-hidden="true" />;
```

`packages/figma-plugin/src/ui/FileList.tsx`:

```tsx
import type { ExportFile } from '../core/files';
import { DownloadIcon, FileIcon } from './icons';

export function FileList({ files, onDownload }: { files: ExportFile[]; onDownload: (file: ExportFile) => void }) {
  return (
    <ul class="files">
      {files.map((file) => (
        <li key={file.path}>
          <button class="file" title={`Download ${file.path}`} onClick={() => onDownload(file)}>
            <FileIcon />
            <span class="file__name">{file.path}</span>
            <span class="file__download">
              <DownloadIcon />
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
```

`packages/figma-plugin/src/ui/ErrorList.tsx`:

```tsx
import type { ExportError } from '../core/build-export';
import { groupErrors } from './state';

export function ErrorList({ errors }: { errors: ExportError[] }) {
  return (
    <div class="errors" role="alert">
      <p class="errors__title">
        {errors.length} {errors.length === 1 ? 'token' : 'tokens'} can't be exported. Fix them in Figma, then refresh.
      </p>
      {groupErrors(errors).map((group) => (
        <section key={group.collection}>
          <h3 class="errors__collection">{group.collection}</h3>
          <ul>
            {group.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
```

`packages/figma-plugin/src/ui/ResultBanner.tsx`:

```tsx
import type { Banner } from './state';

export function ResultBanner({ banner, onOpen }: { banner: Banner; onOpen: (url: string) => void }) {
  return (
    <div class={`banner banner--${banner.kind}`} role="status">
      <span>{banner.text}</span>
      {banner.kind === 'success' && (
        <button class="link" onClick={() => onOpen(banner.url)}>
          Open
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: The split Export button**

`packages/figma-plugin/src/ui/ExportButton.tsx`:

```tsx
import { useEffect, useRef, useState } from 'preact/hooks';

import type { Destination } from '../shared/messages';
import { CheckIcon, ChevronIcon, DownloadIcon, GitHubIcon, Spinner } from './icons';
import { destinationLabel, type Format } from './state';

type Props = {
  destination: Destination;
  format: Format;
  disabled: boolean;
  busyText: string | null;
  onExport: () => void;
  onDestination: (destination: Destination) => void;
};

const DESTINATIONS: Destination[] = ['github', 'computer'];

export function ExportButton({ destination, format, disabled, busyText, onExport, onDestination }: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [open]);

  const github = destination === 'github';

  return (
    <div ref={root} class={`split ${github ? 'split--github' : 'split--brand'}`}>
      <button class="split__main" disabled={disabled} onClick={onExport}>
        {busyText ? (
          <>
            <Spinner /> {busyText}
          </>
        ) : (
          <>
            {github ? <GitHubIcon /> : <DownloadIcon />} Export
          </>
        )}
      </button>
      <button
        class="split__toggle"
        aria-label="Choose export destination"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={busyText !== null}
        onClick={() => setOpen(!open)}
      >
        <ChevronIcon />
      </button>
      {open && (
        <ul class="menu" role="menu">
          {DESTINATIONS.map((value) => (
            <li key={value}>
              <button
                class="menu__item"
                role="menuitemradio"
                aria-checked={destination === value}
                onClick={() => {
                  onDestination(value);
                  setOpen(false);
                }}
              >
                <span class="menu__check">{destination === value && <CheckIcon />}</span>
                {value === 'github' ? <GitHubIcon /> : <DownloadIcon />}
                {destinationLabel(value, format)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 3: The export view**

`packages/figma-plugin/src/ui/ExportView.tsx`:

```tsx
import { useState } from 'preact/hooks';

import type { BuildResult } from '../core/build-export';
import type { Snapshot } from '../core/snapshot';
import { createClient } from '../github/client';
import { publish, type PublishStep } from '../github/publish';
import type { Destination, Prefs } from '../shared/messages';
import { downloadFile, downloadZip } from './download';
import { ErrorList } from './ErrorList';
import { ExportButton } from './ExportButton';
import { FileList } from './FileList';
import { GearIcon, RefreshIcon, Spinner } from './icons';
import { ResultBanner } from './ResultBanner';
import { call } from './rpc';
import {
  errorBanner,
  exportAction,
  exportBlocker,
  previewFiles,
  resultBanner,
  STEP_TEXT,
  type Banner,
  type Build,
  type Format,
} from './state';

type Props = {
  build: Build;
  prefs: Prefs;
  refresh: () => Promise<{ snapshot: Snapshot; result: BuildResult } | null>;
  onPrefs: (prefs: Prefs) => void;
  openSettings: () => void;
};

export function ExportView({ build, prefs, refresh, onPrefs, openSettings }: Props) {
  const [format, setFormat] = useState<Format>('multiple');
  const [step, setStep] = useState<PublishStep | null>(null);
  const [banner, setBanner] = useState<Banner | null>(null);

  const blocker = exportBlocker(build, step !== null);

  async function onExport() {
    setBanner(null);
    const fresh = await refresh();
    if (!fresh || exportBlocker({ status: 'ready', result: fresh.result }, false)) {
      return;
    }

    const action = exportAction({
      destination: prefs.destination,
      format,
      result: fresh.result,
      settings: prefs.settings,
      hasToken: prefs.hasToken,
    });

    if (action.kind === 'open-settings') return openSettings();
    if (action.kind === 'download-zip') return downloadZip(action.files);
    if (action.kind === 'download-file') return downloadFile(action.file);

    setStep('reading');
    try {
      const token = await call('getToken');
      if (!token || !prefs.settings) {
        openSettings();
        return;
      }
      const result = await publish(
        createClient(token),
        prefs.settings,
        { files: action.files, fileName: fresh.snapshot.fileName, userName: fresh.snapshot.userName, now: new Date() },
        setStep,
      );
      setBanner(resultBanner(result));
    } catch (error) {
      setBanner(errorBanner(error));
    } finally {
      setStep(null);
    }
  }

  function onDestination(destination: Destination) {
    onPrefs({ ...prefs, destination });
    void call('saveDestination', destination);
  }

  return (
    <div class="view">
      <header class="header">
        <h1 class="header__title">Export tokens</h1>
        <button class="icon-button" aria-label="GitHub settings" title="GitHub settings" onClick={openSettings}>
          <GearIcon />
        </button>
      </header>

      <div class="segmented" role="radiogroup" aria-label="Format">
        {(['single', 'multiple'] as const).map((value) => (
          <button
            key={value}
            role="radio"
            aria-checked={format === value}
            class={`segmented__option ${format === value ? 'is-selected' : ''}`}
            onClick={() => setFormat(value)}
          >
            {value === 'single' ? 'Single file' : 'Multiple files'}
          </button>
        ))}
      </div>

      <div class="preview-header">
        <h2 class="preview-header__title">Preview</h2>
        <button class="icon-button" aria-label="Refresh" title="Refresh" onClick={() => void refresh()}>
          <RefreshIcon />
        </button>
      </div>

      <div class="preview">
        {build.status === 'loading' && (
          <p class="muted">
            <Spinner /> Reading variables…
          </p>
        )}
        {build.status === 'failed' && <p class="danger">Couldn't read variables: {build.message}</p>}
        {build.status === 'ready' && build.result.errors.length > 0 && <ErrorList errors={build.result.errors} />}
        {build.status === 'ready' && build.result.errors.length === 0 && build.result.sets.length === 0 && (
          <p class="muted">No local variables in this file.</p>
        )}
        {build.status === 'ready' && build.result.errors.length === 0 && build.result.sets.length > 0 && (
          <FileList files={previewFiles(build.result, format)} onDownload={downloadFile} />
        )}
      </div>

      {banner && <ResultBanner banner={banner} onOpen={(url) => void call('openUrl', url)} />}

      <footer class="footer">
        <button class="button button--secondary" onClick={() => void call('close')}>
          Cancel
        </button>
        <ExportButton
          destination={prefs.destination}
          format={format}
          disabled={blocker !== null}
          busyText={step ? STEP_TEXT[step] : null}
          onExport={() => void onExport()}
          onDestination={onDestination}
        />
      </footer>
    </div>
  );
}
```

- [ ] **Step 4: The settings view**

`packages/figma-plugin/src/ui/SettingsView.tsx`:

```tsx
import { useState } from 'preact/hooks';

import { createClient } from '../github/client';
import { checkSettings, normalizeSettings, validateSettings, type RepoSettings } from '../github/settings';
import type { Prefs } from '../shared/messages';
import { call } from './rpc';
import { cancelReplace, errorBanner, initialTokenField, startReplace, tokenToSave, type TokenField } from './state';

const TOKEN_HELP_URL = 'https://github.com/settings/personal-access-tokens/new';
const DEFAULTS: RepoSettings = { repository: '', base: 'main', folder: 'tokens' };

type Props = { prefs: Prefs; onPrefs: (prefs: Prefs) => void; onDone: () => void };
type Status = { kind: 'idle' } | { kind: 'checking' } | { kind: 'error'; messages: string[] };

export function SettingsView({ prefs, onPrefs, onDone }: Props) {
  const [form, setForm] = useState<RepoSettings>(prefs.settings ?? DEFAULTS);
  const [token, setToken] = useState<TokenField>(initialTokenField(prefs.hasToken));
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const update = (key: keyof RepoSettings) => (event: Event) =>
    setForm({ ...form, [key]: (event.currentTarget as HTMLInputElement).value });

  async function onSave(event: Event) {
    event.preventDefault();
    const problems = validateSettings(form);
    const newToken = tokenToSave(token);
    if (!newToken && !prefs.hasToken) {
      problems.push('Enter a token.');
    }
    if (problems.length > 0) {
      setStatus({ kind: 'error', messages: problems });
      return;
    }

    setStatus({ kind: 'checking' });
    const settings = normalizeSettings(form);
    await call('saveSettings', settings);
    if (newToken) {
      await call('saveToken', newToken);
      setToken({ mode: 'saved' });
    }
    const next: Prefs = { ...prefs, settings, hasToken: true };
    onPrefs(next);

    try {
      const stored = await call('getToken');
      await checkSettings(createClient(stored ?? ''), settings);
      onDone();
    } catch (error) {
      setStatus({ kind: 'error', messages: [errorBanner(error).text] });
    }
  }

  return (
    <form class="view" onSubmit={(event) => void onSave(event)}>
      <header class="header">
        <h1 class="header__title">GitHub settings</h1>
      </header>

      <label class="field">
        <span>Repository</span>
        <input value={form.repository} placeholder="owner/repo" onInput={update('repository')} />
      </label>
      <label class="field">
        <span>Base branch</span>
        <input value={form.base} onInput={update('base')} />
      </label>
      <label class="field">
        <span>Folder</span>
        <input value={form.folder} onInput={update('folder')} />
      </label>

      <div class="field">
        <span>Token</span>
        {token.mode === 'saved' ? (
          <div class="token-saved">
            <span class="muted">Token saved</span>
            <button type="button" class="button button--secondary" onClick={() => setToken(startReplace())}>
              Replace token
            </button>
          </div>
        ) : (
          <>
            <input
              type="password"
              autocomplete="off"
              value={token.draft}
              placeholder="github_pat_…"
              onInput={(event) => setToken({ ...token, draft: (event.currentTarget as HTMLInputElement).value })}
            />
            <p class="hint">
              Create a fine-grained token with <b>Contents</b> and <b>Pull requests</b> set to read and write for this
              repository.{' '}
              <button type="button" class="link" onClick={() => void call('openUrl', TOKEN_HELP_URL)}>
                Create a token
              </button>
            </p>
            {token.canCancel && (
              <button type="button" class="link" onClick={() => setToken(cancelReplace())}>
                Keep the saved token
              </button>
            )}
          </>
        )}
      </div>

      {status.kind === 'error' && (
        <ul class="banner banner--error" role="alert">
          {status.messages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}

      <footer class="footer">
        <button type="button" class="button button--secondary" onClick={onDone}>
          Back
        </button>
        <button type="submit" class="button button--primary" disabled={status.kind === 'checking'}>
          {status.kind === 'checking' ? 'Checking…' : 'Save'}
        </button>
      </footer>
    </form>
  );
}
```

- [ ] **Step 5: App, entry point and styles**

`packages/figma-plugin/src/ui/App.tsx`:

```tsx
import { serialize } from 'css-to-dtcg/serialize';
import { useCallback, useEffect, useState } from 'preact/hooks';

import { buildExport } from '../core/build-export';
import type { Prefs } from '../shared/messages';
import { downloadText } from './download';
import { ExportView } from './ExportView';
import { call } from './rpc';
import { SettingsView } from './SettingsView';
import type { Build } from './state';

export function App() {
  const [build, setBuild] = useState<Build>({ status: 'loading' });
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [view, setView] = useState<'export' | 'settings'>('export');

  const refresh = useCallback(async () => {
    setBuild({ status: 'loading' });
    try {
      const snapshot = await call('getSnapshot');
      const result = buildExport(snapshot);
      setBuild({ status: 'ready', result });
      return { snapshot, result };
    } catch (error) {
      setBuild({ status: 'failed', message: error instanceof Error ? error.message : String(error) });
      return null;
    }
  }, []);

  useEffect(() => {
    void refresh();
    void call('getPrefs').then(setPrefs);
  }, [refresh]);

  // Hidden developer shortcut: Alt+Shift+S downloads the raw snapshot, so a
  // team can run the build against their real file without committing it.
  useEffect(() => {
    const onKey = async (event: KeyboardEvent) => {
      if (event.altKey && event.shiftKey && event.code === 'KeyS') {
        const snapshot = await call('getSnapshot');
        console.log(snapshot);
        downloadText('snapshot.json', serialize(snapshot));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!prefs) {
    return <p class="muted view">Loading…</p>;
  }

  return view === 'settings' ? (
    <SettingsView prefs={prefs} onPrefs={setPrefs} onDone={() => setView('export')} />
  ) : (
    <ExportView build={build} prefs={prefs} refresh={refresh} onPrefs={setPrefs} openSettings={() => setView('settings')} />
  );
}
```

`packages/figma-plugin/src/ui/main.tsx` (replace):

```tsx
import './styles.css';

import { render } from 'preact';

import { App } from './App';

render(<App />, document.getElementById('root')!);
```

`packages/figma-plugin/src/ui/styles.css`:

```css
:root {
  --github: #1f2328;
  --github-hover: #32383f;
  font-family: Inter, system-ui, sans-serif;
  font-size: 11px;
  color: var(--figma-color-text);
  background: var(--figma-color-bg);
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
}

button {
  font: inherit;
  color: inherit;
}

.view {
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100vh;
  padding: 12px;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header__title,
.preview-header__title {
  margin: 0;
  font-size: 11px;
  font-weight: 600;
}

.icon-button {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--figma-color-icon);
  cursor: pointer;
}

.icon-button:hover {
  background: var(--figma-color-bg-hover);
}

.segmented {
  display: flex;
  gap: 4px;
  padding: 2px;
  border-radius: 6px;
  background: var(--figma-color-bg-secondary);
  align-self: flex-start;
}

.segmented__option {
  padding: 4px 8px;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
}

.segmented__option.is-selected {
  border-color: var(--figma-color-border-selected);
  background: var(--figma-color-bg);
  color: var(--figma-color-text-brand);
}

.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.preview {
  flex: 1;
  overflow: auto;
  padding: 4px;
  border: 1px solid var(--figma-color-border);
  border-radius: 6px;
}

.files {
  margin: 0;
  padding: 0;
  list-style: none;
}

.file {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.file:hover {
  background: var(--figma-color-bg-hover);
}

.file__name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file__download {
  display: flex;
  visibility: hidden;
  color: var(--figma-color-icon-secondary);
}

.file:hover .file__download {
  visibility: visible;
}

.errors {
  padding: 4px;
  color: var(--figma-color-text-danger);
}

.errors__title {
  margin: 0 0 8px;
  font-weight: 600;
}

.errors__collection {
  margin: 8px 0 4px;
  font-size: 11px;
}

.errors ul {
  margin: 0;
  padding-left: 16px;
}

.muted {
  color: var(--figma-color-text-secondary);
}

.danger {
  color: var(--figma-color-text-danger);
}

.banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 0;
  padding: 8px;
  border-radius: 6px;
  list-style: none;
}

.banner--success {
  background: var(--figma-color-bg-success-tertiary);
}

.banner--info {
  background: var(--figma-color-bg-secondary);
}

.banner--error {
  flex-direction: column;
  align-items: flex-start;
  background: var(--figma-color-bg-danger-tertiary);
  color: var(--figma-color-text-danger);
}

.link {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--figma-color-text-brand);
  cursor: pointer;
}

.footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.button {
  padding: 6px 12px;
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
}

.button--secondary {
  border-color: var(--figma-color-border);
  background: var(--figma-color-bg);
}

.button--primary {
  background: var(--figma-color-bg-brand);
  color: var(--figma-color-text-onbrand);
}

.button:disabled,
.split button:disabled {
  opacity: 0.5;
  cursor: default;
}

.split {
  position: relative;
  display: flex;
}

.split > button {
  display: flex;
  align-items: center;
  gap: 6px;
  border: 0;
  cursor: pointer;
}

.split__main {
  padding: 6px 12px;
  border-radius: 6px 0 0 6px;
}

.split__toggle {
  padding: 6px;
  border-left: 1px solid rgba(255, 255, 255, 0.25) !important;
  border-radius: 0 6px 6px 0;
}

.split--brand > button {
  background: var(--figma-color-bg-brand);
  color: var(--figma-color-text-onbrand);
}

.split--brand > button:hover:not(:disabled) {
  background: var(--figma-color-bg-brand-hover);
}

.split--github > button {
  background: var(--github);
  color: #ffffff;
}

.split--github > button:hover:not(:disabled) {
  background: var(--github-hover);
}

.menu {
  position: absolute;
  right: 0;
  bottom: calc(100% + 4px);
  z-index: 1;
  min-width: 220px;
  margin: 0;
  padding: 4px;
  border-radius: 6px;
  background: var(--figma-color-bg);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.2);
  list-style: none;
}

.menu__item {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 6px 8px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.menu__item:hover {
  background: var(--figma-color-bg-hover);
}

.menu__check {
  display: inline-flex;
  width: 16px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field input {
  padding: 6px 8px;
  border: 1px solid var(--figma-color-border);
  border-radius: 4px;
  background: var(--figma-color-bg);
  color: var(--figma-color-text);
  font: inherit;
}

.hint {
  margin: 0;
  color: var(--figma-color-text-secondary);
}

.token-saved {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.spinner {
  display: inline-block;
  width: 10px;
  height: 10px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
```

- [ ] **Step 6: Typecheck, test and build**

Run: `pnpm --filter css-to-dtcg build && pnpm --filter export-design-tokens typecheck && pnpm --filter export-design-tokens test && pnpm --filter export-design-tokens build`
Expected: no type errors; all tests PASS; `dist/index.html` and `dist/code.js` rebuilt.

- [ ] **Step 7: Commit**

```bash
git add packages/figma-plugin/src/ui
git commit -m "feat(plugin): add the export and GitHub settings UI"
```

---

### Task 13: Manual verification in Figma, README

**Files:**
- Create: `packages/figma-plugin/docs/manual-test.md`, `packages/figma-plugin/README.md`

**Interfaces:**
- Consumes: the built plugin; the Lumen Academy example (`examples/lumen-academy/figma/` and its README).

- [ ] **Step 1: Write the checklist**

`packages/figma-plugin/docs/manual-test.md`:

```markdown
# Manual test — Export Design Tokens

Run in Figma desktop after `pnpm --filter export-design-tokens build`, with the plugin imported
from `packages/figma-plugin/manifest.json`.

## Setup

- [ ] Import the Lumen Academy collections as described in `examples/lumen-academy/README.md`
      (including Web code syntax for the three font families and the Font weight / Font family scopes).

## Normal editor

- [ ] The window opens with "Multiple files" selected and lists `primitives.json`,
      `semantic/brand/{nova,orbit,ember}.json`, `semantic/theme/{light,dark}.json`,
      `typography.json`, `$themes.json`.
- [ ] "Single file" lists only `tokens.json`.
- [ ] Clicking a row downloads that file alone.
- [ ] Destination menu: "Export to GitHub repo" is checked on first run; the button is black with the GitHub logo.
- [ ] Choose "Export to this computer": the button turns blue with a download icon. Export downloads
      `tokens.zip`; unzipped, `tokens/` equals `examples/lumen-academy/tokens/` (`diff -r`).
- [ ] Close and reopen the plugin: "Export to this computer" is still selected.
- [ ] Add a BOOLEAN variable to `semantic/theme`, refresh: the error list shows it once, Export is disabled.
      Delete it, refresh: the file list is back.
- [ ] A file with no local variables shows "No local variables in this file." and Export is disabled.

## GitHub

- [ ] With GitHub selected and nothing configured, Export opens GitHub settings.
- [ ] A wrong repository shows "Repository or branch not found." inline; nothing suggests replacing the token.
- [ ] Valid settings + a fine-grained token (Contents + Pull requests read/write) return to the export view.
- [ ] Settings now show "Token saved" and "Replace token"; the token is not visible anywhere.
- [ ] "Replace token" shows an empty field; "Keep the saved token" restores "Token saved"; exporting still works.
- [ ] Export: the button shows the steps, then "PR #N opened" with Open. The PR is on
      `styles/figma-export-<UTC timestamp>`, titled `chore(tokens): export from Figma`, the target folder
      contains exactly the exported files (stale files deleted), and the body names the file and you.
- [ ] Export again without changes: "No changes vs main", and no new branch appears on GitHub.

## Dev Mode

- [ ] Switch to Dev Mode, run the plugin from the Plugins tab: the same window, file list and downloads work.
- [ ] Publishing a PR from Dev Mode works.

## Developer shortcut

- [ ] Alt+Shift+S downloads `snapshot.json` and logs it to the console.
```

- [ ] **Step 2: Write the README**

`packages/figma-plugin/README.md`:

```markdown
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
```

- [ ] **Step 3: Run the checklist**

Build, import and walk through `docs/manual-test.md`. Any failure is a bug: fix it with a failing test first where the logic lives in `core/`, `github/` or `ui/state.ts`. Record in the commit message which items were checked.

- [ ] **Step 4: Full workspace verification**

Run: `pnpm build && pnpm typecheck && pnpm test`
Expected: every package builds, type-checks and passes.

- [ ] **Step 5: Commit**

```bash
git add packages/figma-plugin/docs packages/figma-plugin/README.md
git commit -m "docs(plugin): add README and manual Figma checklist"
```
