# Lumen Academy Example Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `examples/lumen-academy`, a fictitious three-brand app whose CSS custom properties are converted by `css-to-dtcg` into committed `tokens/`, `figma/` and a simulated Figma `figma-snapshot.json` that the Figma plugin (plan 3) uses as its golden test input.

**Architecture:** Plain CSS atom files are the source. `css-to-dtcg.config.js` maps them to sets. `pnpm tokens` generates both targets, then `scripts/make-snapshot.js` simulates Figma's import of `figma/` into the plugin's `Snapshot` shape. A Vitest suite fails whenever any committed output is stale. A small Vite page consumes the same CSS.

**Tech Stack:** Vite, plain HTML/CSS/TypeScript, Vitest, `css-to-dtcg` (workspace).

**Spec:** `docs/superpowers/specs/2026-09-23-css-to-dtcg-and-example-design.md` (section `examples/lumen-academy`), plus the `Snapshot` type in `docs/superpowers/specs/2026-09-23-figma-plugin-token-export-design.md`.

**Prerequisite:** Plan 1 (`2026-09-23-01-monorepo-and-css-to-dtcg.md`) is complete.

## Global Constraints

- Made-up data only: brands `nova` (violet), `orbit` (teal), `ember` (amber); app name "Lumen Academy". No real team names or colours.
- `figma-utils` is the only project name used anywhere.
- Custom property names fit the default hyphen rule with no token/group collisions (never `--text` next to `--text-muted`).
- Fonts: Inter (body), Fraunces (titles), JetBrains Mono (legends).
- Generated files (`tokens/`, `figma/`, `figma-snapshot.json`) are committed and must match a fresh generation byte for byte.
- JSON is written with `serialize` from `css-to-dtcg` (2-space + trailing newline).
- `Snapshot` shape (must match plan 3 exactly):
  `{ fileName: string, userName: string | null, collections: { id, name, modes: { id, name }[], variableIds: string[] }[], variables: { id, name, collectionId, resolvedType: 'COLOR'|'FLOAT'|'STRING'|'BOOLEAN', scopes: string[], description: string, codeSyntax: { WEB?: string }, valuesByMode: Record<modeId, {r,g,b,a} | number | string | boolean | { aliasId: string }> }[] }`.

## Review Focus

- Someone edits a CSS file but forgets `pnpm tokens`: the test suite must fail and name the stale file — pinned in Task 1 and Task 2.
- A multi-line selector list (`:root,\n[data-brand='nova']`) must match the config's single-line selector — exercised by `brands.css` in Task 1.
- A colour with alpha (`--base-overlay`) must survive CSS → Figma → snapshot as 8-digit hex — pinned in Task 2.
- A dimension that float32 cannot represent exactly (`--leading-display: 3.6rem`) must appear in the snapshot at Figma's precision, so the plugin's number recovery is really tested — pinned in Task 2.
- References whose `$type` is not colour (`--weight-title`, `--family-heading`) must keep their own type across both targets — pinned in Task 1.

---

## File Structure

```
examples/lumen-academy/
  package.json
  tsconfig.json
  index.html                 page shell with brand/theme switchers
  src/main.ts                imports CSS, wires the switchers
  src/css/colors.css         :root — ramps, gray, base, status
  src/css/brands.css         :root + [data-brand] blocks — --brand-* rebinding
  src/css/theme.css          :root (light) + [data-mode='dark'] — semantic layer
  src/css/typography.css     :root — size, leading, weight, family
  src/css/components.css     consumers only (not a token source)
  css-to-dtcg.config.js
  scripts/make-snapshot.js   makeSnapshot() + CLI that writes figma-snapshot.json
  tokens/                    generated (dtcg)
  figma/                     generated (figma)
  figma-snapshot.json        generated (simulated import)
  test/generated.test.js     staleness + shape checks
  README.md
```

---

### Task 1: Token source CSS, config and generated targets

**Files:**
- Create: `examples/lumen-academy/package.json`, `examples/lumen-academy/css-to-dtcg.config.js`
- Create: `examples/lumen-academy/src/css/colors.css`, `brands.css`, `theme.css`, `typography.css`
- Create (generated): `examples/lumen-academy/tokens/**`, `examples/lumen-academy/figma/**`
- Test: `examples/lumen-academy/test/generated.test.js`

**Interfaces:**
- Consumes: `buildTokens(config, { target, root })`, `serialize` from `css-to-dtcg` (plan 1).
- Produces: `css-to-dtcg.config.js` default export (used by Task 2 and by plan 3 only through the generated files); `tokens/` layout `primitives.json`, `semantic/brand/{nova,orbit,ember}.json`, `semantic/theme/{light,dark}.json`, `typography.json`, `$themes.json`.

- [ ] **Step 1: Create the package**

`examples/lumen-academy/package.json`:

```json
{
  "name": "lumen-academy",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "tokens": "css-to-dtcg && css-to-dtcg --target figma && node scripts/make-snapshot.js",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  }
}
```

Run: `pnpm --filter lumen-academy add -D css-to-dtcg@workspace:* vite vitest typescript`
Expected: devDependencies added; `css-to-dtcg` linked from the workspace.

- [ ] **Step 2: Write the token source CSS**

`examples/lumen-academy/src/css/colors.css`:

```css
/* Lumen Academy — a made-up palette for the figma-utils example. */
:root {
  --nova-100: #f3f0ff;
  --nova-200: #e4dcff;
  --nova-300: #cbbcff;
  --nova-400: #ab94fb;
  --nova-500: #8f6ef2;
  --nova-600: #7650e0;
  --nova-700: #6038c4;
  --nova-800: #4b2a9c;
  --nova-900: #361e72;
  --nova-1000: #22124a;

  --orbit-100: #e6fbf8;
  --orbit-200: #c2f3ec;
  --orbit-300: #8fe6da;
  --orbit-400: #56d3c3;
  --orbit-500: #2bb8a8;
  --orbit-600: #17998c;
  --orbit-700: #0f7a71;
  --orbit-800: #0c5e57;
  --orbit-900: #09433e;
  --orbit-1000: #052a27;

  --ember-100: #fff6e5;
  --ember-200: #ffe8bf;
  --ember-300: #ffd48a;
  --ember-400: #ffbb4d;
  --ember-500: #f7a01f;
  --ember-600: #e0850b;
  --ember-700: #b86806;
  --ember-800: #8f4f06;
  --ember-900: #663806;
  --ember-1000: #402304;

  --gray-100: #f7f7f8;
  --gray-200: #ececef;
  --gray-300: #d9d9de;
  --gray-400: #bdbdc4;
  --gray-500: #9a9aa3;
  --gray-600: #77777f;
  --gray-700: #5a5a61;
  --gray-800: #404046;
  --gray-900: #2a2a2e;
  --gray-1000: #151517;

  --base-white: #ffffff;
  --base-black: #000000;
  --base-overlay: #1515178c;

  --info-default: #2f6fed;
  --info-light: #e3ecfd;
  --success-default: #1f9d55;
  --success-light: #e2f5ea;
  --warning-default: #d98a00;
  --warning-light: #fdf1dc;
  --error-default: #d6343c;
  --error-light: #fbe5e6;
}
```

`examples/lumen-academy/src/css/brands.css`:

```css
/* Each brand rebinds the --brand-* ramp. nova is the default. */
:root,
[data-brand='nova'] {
  --brand-100: var(--nova-100);
  --brand-200: var(--nova-200);
  --brand-300: var(--nova-300);
  --brand-400: var(--nova-400);
  --brand-500: var(--nova-500);
  --brand-600: var(--nova-600);
  --brand-700: var(--nova-700);
  --brand-800: var(--nova-800);
  --brand-900: var(--nova-900);
  --brand-1000: var(--nova-1000);
}

[data-brand='orbit'] {
  --brand-100: var(--orbit-100);
  --brand-200: var(--orbit-200);
  --brand-300: var(--orbit-300);
  --brand-400: var(--orbit-400);
  --brand-500: var(--orbit-500);
  --brand-600: var(--orbit-600);
  --brand-700: var(--orbit-700);
  --brand-800: var(--orbit-800);
  --brand-900: var(--orbit-900);
  --brand-1000: var(--orbit-1000);
}

[data-brand='ember'] {
  --brand-100: var(--ember-100);
  --brand-200: var(--ember-200);
  --brand-300: var(--ember-300);
  --brand-400: var(--ember-400);
  --brand-500: var(--ember-500);
  --brand-600: var(--ember-600);
  --brand-700: var(--ember-700);
  --brand-800: var(--ember-800);
  --brand-900: var(--ember-900);
  --brand-1000: var(--ember-1000);
}
```

`examples/lumen-academy/src/css/theme.css`:

```css
/* The semantic layer. Light is the default; dark overrides it. */
:root {
  --surface-default: var(--base-white);
  --surface-muted: var(--gray-100);
  --surface-overlay: var(--base-overlay);
  --text-default: var(--gray-1000);
  --text-muted: var(--gray-600);
  --text-inverse: var(--base-white);
  --border-default: var(--gray-200);
  --primary-default: var(--brand-700);
  --primary-hover: var(--brand-800);
  --primary-contrast: var(--base-white);
  --primary-subtle: var(--brand-100);
  --danger-default: var(--error-default);
  --danger-subtle: var(--error-light);
  --ring-default: var(--brand-500);
}

[data-mode='dark'] {
  --surface-default: var(--gray-1000);
  --surface-muted: var(--gray-900);
  --surface-overlay: var(--base-overlay);
  --text-default: var(--gray-100);
  --text-muted: var(--gray-400);
  --text-inverse: var(--gray-1000);
  --border-default: var(--gray-800);
  --primary-default: var(--brand-400);
  --primary-hover: var(--brand-300);
  --primary-contrast: var(--gray-1000);
  --primary-subtle: var(--brand-900);
  --danger-default: var(--error-default);
  --danger-subtle: var(--gray-900);
  --ring-default: var(--brand-400);
}
```

`examples/lumen-academy/src/css/typography.css`:

```css
:root {
  --size-xs: 0.75rem;
  --size-s: 0.875rem;
  --size-m: 1rem;
  --size-l: 1.25rem;
  --size-xl: 1.5rem;
  --size-xxl: 2rem;
  --size-display: 3rem;

  --leading-xs: 1rem;
  --leading-s: 1.25rem;
  --leading-m: 1.5rem;
  --leading-l: 1.75rem;
  --leading-xl: 2rem;
  --leading-xxl: 2.5rem;
  --leading-display: 3.6rem;

  --weight-regular: 400;
  --weight-medium: 500;
  --weight-bold: 700;
  --weight-title: var(--weight-bold);

  --family-body: 'Inter', sans-serif;
  --family-title: 'Fraunces', serif;
  --family-legend: 'JetBrains Mono', monospace;
  --family-heading: var(--family-title);
}
```

- [ ] **Step 3: Write the config**

`examples/lumen-academy/css-to-dtcg.config.js`:

```js
export default {
  outDir: 'tokens',
  figmaOutDir: 'figma',
  sets: [
    { name: 'primitives', file: 'src/css/colors.css', selector: ':root' },
    { name: 'semantic/brand/nova', file: 'src/css/brands.css', selector: ":root, [data-brand='nova']" },
    { name: 'semantic/brand/orbit', file: 'src/css/brands.css', selector: "[data-brand='orbit']" },
    { name: 'semantic/brand/ember', file: 'src/css/brands.css', selector: "[data-brand='ember']" },
    { name: 'semantic/theme/light', file: 'src/css/theme.css', selector: ':root' },
    { name: 'semantic/theme/dark', file: 'src/css/theme.css', selector: "[data-mode='dark']" },
    { name: 'typography', file: 'src/css/typography.css', selector: ':root' },
  ],
  themes: {
    Brand: ['semantic/brand/nova', 'semantic/brand/orbit', 'semantic/brand/ember'],
    Theme: ['semantic/theme/light', 'semantic/theme/dark'],
  },
};
```

- [ ] **Step 4: Write the failing test**

`examples/lumen-academy/test/generated.test.js`:

```js
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildTokens } from 'css-to-dtcg';
import { describe, expect, it } from 'vitest';

import config from '../css-to-dtcg.config.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** @returns {Map<string, string>} relative path → contents */
function readTree(dir) {
  const files = new Map();
  if (!existsSync(dir)) {
    return files;
  }
  const walk = (current) => {
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

const generated = (target) => new Map(buildTokens(config, { target, root }).files.map((file) => [file.path, file.json]));

describe.each([
  ['dtcg', 'tokens'],
  ['figma', 'figma'],
])('committed %s output', (target, folder) => {
  it(`${folder}/ matches a fresh generation (run "pnpm tokens" if this fails)`, () => {
    const expected = generated(target);
    const actual = readTree(join(root, folder));

    expect([...actual.keys()].sort()).toEqual([...expected.keys()].sort());
    for (const [path, json] of expected) {
      expect(actual.get(path), path).toBe(json);
    }
  });
});

describe('dtcg output', () => {
  const files = generated('dtcg');
  const read = (path) => JSON.parse(files.get(path));

  it('has one file per set plus $themes.json', () => {
    expect([...files.keys()]).toEqual([
      'primitives.json',
      'semantic/brand/nova.json',
      'semantic/brand/orbit.json',
      'semantic/brand/ember.json',
      'semantic/theme/light.json',
      'semantic/theme/dark.json',
      'typography.json',
      '$themes.json',
    ]);
  });

  it('describes both theme axes', () => {
    expect(read('$themes.json')).toEqual([
      { name: 'nova', group: 'Brand', selectedTokenSets: { primitives: 'source', 'semantic/brand/nova': 'enabled' } },
      { name: 'orbit', group: 'Brand', selectedTokenSets: { primitives: 'source', 'semantic/brand/orbit': 'enabled' } },
      { name: 'ember', group: 'Brand', selectedTokenSets: { primitives: 'source', 'semantic/brand/ember': 'enabled' } },
      { name: 'light', group: 'Theme', selectedTokenSets: { primitives: 'source', 'semantic/theme/light': 'enabled' } },
      { name: 'dark', group: 'Theme', selectedTokenSets: { primitives: 'source', 'semantic/theme/dark': 'enabled' } },
    ]);
  });

  it('keeps the $type of non-colour references', () => {
    const { typography } = read('typography.json');

    expect(typography.weight.title).toEqual({ $type: 'fontWeight', $value: '{typography.weight.bold}' });
    expect(typography.family.heading).toEqual({ $type: 'fontFamily', $value: '{typography.family.title}' });
  });

  it('keeps the alpha channel of the overlay', () => {
    expect(read('primitives.json').primitives.base.overlay).toEqual({ $type: 'color', $value: '#1515178c' });
  });
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `pnpm --filter lumen-academy test`
Expected: FAIL in "committed dtcg output" and "committed figma output" — the folders don't exist yet (`actual` keys are `[]`). The "dtcg output" tests PASS (they only use the generator).

- [ ] **Step 6: Generate the targets**

Run: `cd examples/lumen-academy && pnpm exec css-to-dtcg && pnpm exec css-to-dtcg --target figma && cd ../..`
Expected:

```
Wrote 8 files to tokens
Wrote 7 files to figma
Import collections in this order: primitives, semantic/brand, semantic/theme, typography
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `pnpm --filter lumen-academy test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add examples/lumen-academy pnpm-lock.yaml
git commit -m "feat(example): add Lumen Academy token sources and generated tokens"
```

---

### Task 2: Simulated Figma snapshot

**Files:**
- Create: `examples/lumen-academy/scripts/make-snapshot.js`
- Create (generated): `examples/lumen-academy/figma-snapshot.json`
- Modify: `examples/lumen-academy/test/generated.test.js` (append a `describe`)

**Interfaces:**
- Consumes: `buildTokens`, `serialize` from `css-to-dtcg`; `css-to-dtcg.config.js` (Task 1).
- Produces: `makeSnapshot(): Snapshot` (shape in Global Constraints) and `figma-snapshot.json`, consumed by plan 3's round-trip test. Ids are deterministic: collection `VariableCollectionId:<collection>`, mode `<collection>:<mode>`, variable `VariableID:<collection>/<variable name>`.

- [ ] **Step 1: Write the failing test**

Append to `examples/lumen-academy/test/generated.test.js`:

```js
import { serialize } from 'css-to-dtcg';

import { makeSnapshot } from '../scripts/make-snapshot.js';

describe('figma-snapshot.json', () => {
  const snapshot = makeSnapshot();
  const variable = (collection, name) => snapshot.variables.find((v) => v.id === `VariableID:${collection}/${name}`);

  it('matches a fresh simulation (run "pnpm tokens" if this fails)', () => {
    expect(readFileSync(join(root, 'figma-snapshot.json'), 'utf8')).toBe(serialize(snapshot));
  });

  it('creates collections in import order with their modes', () => {
    expect(snapshot.collections.map((c) => [c.name, c.modes.map((m) => m.name)])).toEqual([
      ['primitives', ['default']],
      ['semantic/brand', ['nova', 'orbit', 'ember']],
      ['semantic/theme', ['light', 'dark']],
      ['typography', ['default']],
    ]);
  });

  it('stores numbers and colours at Figma precision', () => {
    const leading = variable('typography', 'leading/display');

    expect(leading.resolvedType).toBe('FLOAT');
    expect(leading.valuesByMode['typography:default']).toBe(Math.fround(3.6));
    expect(leading.valuesByMode['typography:default']).not.toBe(3.6);
    expect(variable('primitives', 'base/overlay').valuesByMode['primitives:default']).toEqual({
      r: Math.fround(0x15 / 255),
      g: Math.fround(0x15 / 255),
      b: Math.fround(0x17 / 255),
      a: Math.fround(0x8c / 255),
    });
  });

  it('turns aliasData and same-collection references into aliases', () => {
    expect(variable('semantic/theme', 'primary/default').valuesByMode['semantic/theme:light']).toEqual({
      aliasId: 'VariableID:semantic/brand/brand/700',
    });
    expect(variable('typography', 'weight/title').valuesByMode['typography:default']).toEqual({
      aliasId: 'VariableID:typography/weight/bold',
    });
  });

  it('carries scopes and the Web code syntax a designer adds after import', () => {
    expect(variable('typography', 'weight/bold').scopes).toEqual(['FONT_WEIGHT']);
    expect(variable('typography', 'family/legend')).toMatchObject({
      resolvedType: 'STRING',
      scopes: ['FONT_FAMILY'],
      codeSyntax: { WEB: "'JetBrains Mono', monospace" },
      valuesByMode: { 'typography:default': 'JetBrains Mono' },
    });
    expect(variable('typography', 'family/heading').codeSyntax).toEqual({});
  });
});
```

Move the new `import` lines to the top of the file with the other imports.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter lumen-academy test`
Expected: FAIL — cannot resolve `../scripts/make-snapshot.js`.

- [ ] **Step 3: Implement `make-snapshot.js`**

`examples/lumen-academy/scripts/make-snapshot.js`:

```js
/**
 * Simulates what Figma's "Import mode" does with figma/, producing the Snapshot
 * the Export Design Tokens plugin reads. Numbers and colours pass through
 * Math.fround because Figma stores them as 32-bit floats. Web code syntax for
 * font stacks is the manual step the README asks designers to do after import.
 */
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildTokens, serialize } from 'css-to-dtcg';

import config from '../css-to-dtcg.config.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RESOLVED_TYPE = { color: 'COLOR', number: 'FLOAT', string: 'STRING' };

const variableId = (collection, name) => `VariableID:${collection}/${name}`;
const isLeaf = (node) => node !== null && typeof node === 'object' && '$type' in node;

function* leaves(node, path = []) {
  for (const [key, child] of Object.entries(node)) {
    if (key === '$extensions') {
      continue;
    }
    if (isLeaf(child)) {
      yield [[...path, key], child];
    } else if (child && typeof child === 'object') {
      yield* leaves(child, [...path, key]);
    }
  }
}

const quoteFamily = (family) => (/^[A-Za-z_-][\w-]*$/.test(family) ? family : `'${family}'`);

function snapshotValue(token, collection) {
  const alias = token.$extensions?.['com.figma.aliasData'];
  if (alias) {
    return { aliasId: variableId(alias.targetVariableSetName, alias.targetVariableName) };
  }
  if (typeof token.$value === 'string' && /^\{.+\}$/.test(token.$value)) {
    return { aliasId: variableId(collection, token.$value.slice(1, -1).split('.').join('/')) };
  }
  if (token.$type === 'color') {
    const [r, g, b] = token.$value.components.map(Math.fround);
    return { r, g, b, a: Math.fround(token.$value.alpha) };
  }
  if (token.$type === 'number') {
    return Math.fround(token.$value);
  }
  return token.$value;
}

export function makeSnapshot() {
  const figmaFiles = buildTokens(config, { target: 'figma', root }).files;
  const dtcgFiles = buildTokens(config, { target: 'dtcg', root }).files;

  const stacks = new Map();
  for (const file of dtcgFiles) {
    if (file.path === '$themes.json') {
      continue;
    }
    for (const [path, token] of leaves(JSON.parse(file.json))) {
      if (token.$type === 'fontFamily' && Array.isArray(token.$value) && token.$value.length > 1) {
        stacks.set(path.join('.'), token.$value.map(quoteFamily).join(', '));
      }
    }
  }

  const collections = new Map();
  const variables = new Map();

  for (const file of figmaFiles) {
    const segments = file.path.split('/');
    const collectionName = segments.slice(0, -1).join('/');
    const modeName = segments.at(-1).replace(/\.tokens\.json$/, '');

    if (!collections.has(collectionName)) {
      collections.set(collectionName, {
        id: `VariableCollectionId:${collectionName}`,
        name: collectionName,
        modes: [],
        variableIds: [],
      });
    }
    const collection = collections.get(collectionName);
    const modeId = `${collectionName}:${modeName}`;
    collection.modes.push({ id: modeId, name: modeName });

    for (const [path, token] of leaves(JSON.parse(file.json))) {
      const name = path.join('/');
      const id = variableId(collectionName, name);

      if (!variables.has(id)) {
        const web = stacks.get([collectionName.split('/')[0], ...path].join('.'));
        variables.set(id, {
          id,
          name,
          collectionId: collection.id,
          resolvedType: RESOLVED_TYPE[token.$type],
          scopes: token.$extensions['com.figma.scopes'],
          description: '',
          codeSyntax: web ? { WEB: web } : {},
          valuesByMode: {},
        });
        collection.variableIds.push(id);
      }

      variables.get(id).valuesByMode[modeId] = snapshotValue(token, collectionName);
    }
  }

  return {
    fileName: 'Lumen Academy',
    userName: null,
    collections: [...collections.values()],
    variables: [...variables.values()],
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(resolve(root, 'figma-snapshot.json'), serialize(makeSnapshot()));
  console.log('Wrote figma-snapshot.json');
}
```

- [ ] **Step 4: Generate the snapshot**

Run: `cd examples/lumen-academy && node scripts/make-snapshot.js && cd ../..`
Expected: `Wrote figma-snapshot.json`.

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter lumen-academy test`
Expected: PASS.

- [ ] **Step 6: Check the whole generator end to end**

Run: `pnpm --filter lumen-academy tokens && git status --short examples/lumen-academy`
Expected: only `figma-snapshot.json`, `scripts/make-snapshot.js` and the test file are new/modified — regenerating `tokens/` and `figma/` changes nothing.

- [ ] **Step 7: Commit**

```bash
git add examples/lumen-academy
git commit -m "feat(example): simulate Figma's import as the plugin's golden snapshot"
```

---

### Task 3: The page

**Files:**
- Create: `examples/lumen-academy/index.html`, `examples/lumen-academy/src/main.ts`, `examples/lumen-academy/src/css/components.css`, `examples/lumen-academy/tsconfig.json`

**Interfaces:**
- Consumes: the CSS custom properties from Task 1.
- Produces: a static page; no exports.

- [ ] **Step 1: Write the HTML**

`examples/lumen-academy/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Lumen Academy</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Fraunces:wght@400;700&family=Inter:wght@400;500;700&family=JetBrains+Mono&display=swap"
    />
  </head>
  <body>
    <header class="header">
      <span class="logo">Lumen Academy</span>
      <label class="switch">
        Brand
        <select id="brand">
          <option value="nova">Nova</option>
          <option value="orbit">Orbit</option>
          <option value="ember">Ember</option>
        </select>
      </label>
      <label class="switch">
        Theme
        <select id="mode">
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </label>
    </header>

    <main class="page">
      <section>
        <h1 class="display">Learn something bright</h1>
        <p class="lead">Every colour, size and font on this page comes from a design token.</p>
        <div class="actions">
          <button class="button button--primary">Start a course</button>
          <button class="button button--subtle">Browse catalogue</button>
          <button class="button button--danger">Leave class</button>
        </div>
      </section>

      <section class="cards">
        <article class="card">
          <span class="legend">Course · 12 lessons</span>
          <h2 class="title">Colour theory</h2>
          <p>How hue, value and contrast shape an interface.</p>
        </article>
        <article class="card">
          <span class="legend">Course · 8 lessons</span>
          <h2 class="title">Type on screen</h2>
          <p>Scales, leading and weights that stay readable.</p>
        </article>
        <article class="card">
          <span class="legend">Workshop · 1 day</span>
          <h2 class="title">Tokens in practice</h2>
          <p>From CSS custom properties to Figma variables and back.</p>
        </article>
      </section>

      <section class="scale">
        <p style="font-size: var(--size-display); line-height: var(--leading-display)">Display</p>
        <p style="font-size: var(--size-xxl); line-height: var(--leading-xxl)">Extra extra large</p>
        <p style="font-size: var(--size-xl); line-height: var(--leading-xl)">Extra large</p>
        <p style="font-size: var(--size-l); line-height: var(--leading-l)">Large</p>
        <p style="font-size: var(--size-m); line-height: var(--leading-m)">Medium</p>
        <p style="font-size: var(--size-s); line-height: var(--leading-s)">Small</p>
        <p style="font-size: var(--size-xs); line-height: var(--leading-xs)">Extra small</p>
      </section>
    </main>

    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 2: Write the components CSS**

`examples/lumen-academy/src/css/components.css`:

```css
*,
*::before,
*::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: var(--family-body);
  font-size: var(--size-m);
  line-height: var(--leading-m);
  font-weight: var(--weight-regular);
  color: var(--text-default);
  background: var(--surface-default);
}

.header {
  display: flex;
  gap: 1.5rem;
  align-items: center;
  padding: 1rem 2rem;
  border-bottom: 1px solid var(--border-default);
  background: var(--surface-muted);
}

.logo {
  margin-right: auto;
  font-family: var(--family-heading);
  font-weight: var(--weight-title);
  font-size: var(--size-l);
  color: var(--primary-default);
}

.switch {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  font-size: var(--size-s);
  color: var(--text-muted);
}

.page {
  max-width: 64rem;
  margin: 0 auto;
  padding: 3rem 2rem;
  display: grid;
  gap: 3rem;
}

.display {
  margin: 0;
  font-family: var(--family-title);
  font-size: var(--size-display);
  line-height: var(--leading-display);
  font-weight: var(--weight-title);
}

.lead {
  color: var(--text-muted);
  font-size: var(--size-l);
  line-height: var(--leading-l);
}

.actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.button {
  font: inherit;
  font-weight: var(--weight-medium);
  padding: 0.625rem 1.25rem;
  border-radius: 0.5rem;
  border: 1px solid transparent;
  cursor: pointer;
}

.button:focus-visible {
  outline: 2px solid var(--ring-default);
  outline-offset: 2px;
}

.button--primary {
  background: var(--primary-default);
  color: var(--primary-contrast);
}

.button--primary:hover {
  background: var(--primary-hover);
}

.button--subtle {
  background: var(--primary-subtle);
  color: var(--primary-default);
}

.button--danger {
  background: var(--danger-subtle);
  color: var(--danger-default);
  border-color: var(--danger-default);
}

.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
  gap: 1rem;
}

.card {
  padding: 1.5rem;
  border-radius: 0.75rem;
  border: 1px solid var(--border-default);
  background: var(--surface-muted);
}

.legend {
  font-family: var(--family-legend);
  font-size: var(--size-xs);
  line-height: var(--leading-xs);
  color: var(--text-muted);
}

.title {
  margin: 0.5rem 0;
  font-family: var(--family-title);
  font-size: var(--size-xl);
  line-height: var(--leading-xl);
  font-weight: var(--weight-bold);
}

.scale p {
  margin: 0;
}
```

- [ ] **Step 3: Write the script and tsconfig**

`examples/lumen-academy/src/main.ts`:

```ts
import './css/colors.css';
import './css/brands.css';
import './css/theme.css';
import './css/typography.css';
import './css/components.css';

const root = document.documentElement;
const brand = document.querySelector<HTMLSelectElement>('#brand');
const mode = document.querySelector<HTMLSelectElement>('#mode');

brand?.addEventListener('change', () => {
  root.dataset.brand = brand.value;
});

mode?.addEventListener('change', () => {
  if (mode.value === 'dark') {
    root.dataset.mode = 'dark';
  } else {
    delete root.dataset.mode;
  }
});
```

`examples/lumen-academy/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM"],
    "types": ["vite/client"],
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Verify the page builds and type-checks**

Run: `pnpm --filter lumen-academy typecheck && pnpm --filter lumen-academy build`
Expected: no type errors; `examples/lumen-academy/dist/index.html` produced (`dist/` is git-ignored).

- [ ] **Step 5: Look at it**

Run: `pnpm --filter lumen-academy dev` and open the printed URL. Switch each brand and both themes; the primary button, logo and focus ring must change colour with the brand, and the page background/text must flip with the theme. Stop the server.

- [ ] **Step 6: Commit**

```bash
git add examples/lumen-academy
git commit -m "feat(example): add the Lumen Academy page"
```

---

### Task 4: Example README

**Files:**
- Create: `examples/lumen-academy/README.md`

**Interfaces:**
- Consumes: the scripts from Tasks 1–3 and the plugin name "Export Design Tokens".
- Produces: documentation only.

- [ ] **Step 1: Write the README**

`examples/lumen-academy/README.md`:

````markdown
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
   `Fraunces, serif`, `family/legend` → `'JetBrains Mono', monospace`.
3. **Figma → tokens.** Run **Export Design Tokens** and download the files, or open a
   pull request. The result equals `tokens/` byte for byte.

## Tests

    pnpm --filter lumen-academy test

fails if any generated file is stale — run `pnpm --filter lumen-academy tokens` and
commit the result.
````

- [ ] **Step 2: Commit**

```bash
git add examples/lumen-academy/README.md
git commit -m "docs(example): explain the Lumen Academy token loop"
```
