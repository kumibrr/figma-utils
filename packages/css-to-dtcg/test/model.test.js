import { describe, expect, it } from 'vitest';

import { TokenBuildError } from '../src/errors.js';
import { buildModel } from '../src/model.js';

const files = {
  'colors.css': ':root {\n  --nova-700: #6038c4;\n  --orbit-700: #0f7a71;\n  --gray-100: #f7f7f8;\n  --gray-900: #2a2a2e;\n}',
  'brands.css':
    ":root,\n[data-brand='nova'] {\n  --brand-700: var(--nova-700);\n}\n[data-brand='orbit'] {\n  --brand-700: var(--orbit-700);\n}",
  'theme.css':
    ":root {\n  --text-default: var(--gray-900);\n  --primary-default: var(--brand-700);\n}\n[data-mode='dark'] {\n  --text-default: var(--gray-100);\n  --primary-default: var(--brand-700);\n}",
  'typography.css': ":root {\n  --weight-bold: 700;\n  --weight-title: var(--weight-bold);\n  --family-title: 'Fraunces', serif;\n}",
};

const config = {
  sets: [
    { name: 'primitives', file: 'colors.css', selector: ':root' },
    { name: 'semantic/brand/nova', file: 'brands.css', selector: ":root, [data-brand='nova']" },
    { name: 'semantic/brand/orbit', file: 'brands.css', selector: "[data-brand='orbit']" },
    { name: 'semantic/theme/light', file: 'theme.css', selector: ':root' },
    { name: 'semantic/theme/dark', file: 'theme.css', selector: "[data-mode='dark']" },
    { name: 'typography', file: 'typography.css', selector: ':root' },
  ],
  themes: {
    Brand: ['semantic/brand/nova', 'semantic/brand/orbit'],
    Theme: ['semantic/theme/light', 'semantic/theme/dark'],
  },
};

const readFrom = (map) => (file) => {
  if (!(file in map)) {
    throw new Error(`ENOENT: ${file}`);
  }
  return map[file];
};

const build = (overrides = {}, map = files) => buildModel({ ...config, ...overrides }, { readFile: readFrom(map) });

const errorsOf = (fn) => {
  try {
    fn();
  } catch (error) {
    if (error instanceof TokenBuildError) {
      return error.errors;
    }
    throw error;
  }
  throw new Error('expected a TokenBuildError');
};

describe('buildModel', () => {
  it('builds one model set per configured set, in config order', () => {
    expect(build().sets.map((set) => set.name)).toEqual(config.sets.map((set) => set.name));
  });

  it('assigns collections and modes', () => {
    const sets = build().sets;

    expect(sets[0]).toMatchObject({ collection: 'primitives', mode: 'default', group: undefined });
    expect(sets[1]).toMatchObject({ collection: 'semantic/brand', mode: 'nova', group: 'Brand' });
    expect(sets[4]).toMatchObject({ collection: 'semantic/theme', mode: 'dark', group: 'Theme' });
  });

  it('keeps literals and turns references into {path} with the target $type', () => {
    const [primitives, nova, , light, , typography] = build().sets;

    expect(primitives.tokens[0]).toEqual({
      cssName: '--nova-700',
      path: ['primitives', 'nova', '700'],
      token: { $type: 'color', $value: '#6038c4' },
    });
    expect(nova.tokens[0]).toEqual({
      cssName: '--brand-700',
      path: ['semantic', 'brand', '700'],
      target: '--nova-700',
      token: { $type: 'color', $value: '{primitives.nova.700}' },
    });
    expect(light.tokens[1].token).toEqual({ $type: 'color', $value: '{semantic.brand.700}' });
    expect(typography.tokens[1].token).toEqual({ $type: 'fontWeight', $value: '{typography.weight.bold}' });
  });

  it('records which sets each set references', () => {
    const sets = build().sets;

    expect(sets[1].references).toEqual(['primitives']);
    expect(sets[3].references).toEqual(['primitives', 'semantic/brand/nova', 'semantic/brand/orbit']);
    expect(sets[5].references).toEqual([]);
  });

  it('orders collections so alias targets come first, ties in config order', () => {
    expect(build().importOrder).toEqual(['primitives', 'semantic/brand', 'semantic/theme', 'typography']);
  });

  it('resolves a reference chain to its literal', () => {
    const model = build();

    expect(model.resolveLiteral('--primary-default')).toEqual({ $type: 'color', $value: '#6038c4' });
    expect(model.pathOf('--brand-700')).toEqual(['semantic', 'brand', '700']);
    expect(model.collectionOf('--brand-700')).toBe('semantic/brand');
  });

  it('merges two blocks with the same selector and rejects a name declared twice', () => {
    const map = { ...files, 'colors.css': `${files['colors.css']}\n:root { --gray-100: #ffffff; --gray-200: #eeeeee; }` };
    const errors = errorsOf(() => build({}, map));

    expect(errors).toEqual(['set primitives: --gray-100 is declared twice in ":root" in colors.css']);
  });

  it('rejects a name declared twice inside one block', () => {
    const map = { ...files, 'typography.css': ':root { --weight-bold: 700; --weight-bold: 600; }' };

    expect(errorsOf(() => build({}, map))).toContain('set typography: --weight-bold is declared twice in ":root" in typography.css');
  });

  it('collects every problem before failing', () => {
    const map = {
      ...files,
      'theme.css': ":root {\n  --text-default: var(--ghost);\n  --shadow-default: 0 1px red;\n}\n[data-mode='dark'] {\n  --text-default: var(--gray-100);\n}",
    };
    const errors = errorsOf(() => build({}, map));

    expect(errors).toEqual([
      'semantic/theme/light --shadow-default: unsupported value shape: 0 1px red',
      'semantic/theme/light --text-default: var(--ghost) does not match any custom property in the configured sets',
    ]);
  });

  it('reports missing files and blocks', () => {
    const errors = errorsOf(() =>
      build({
        sets: [
          ...config.sets,
          { name: 'extra', file: 'missing.css', selector: ':root' },
          { name: 'extra2', file: 'colors.css', selector: '.nope' },
        ],
      }),
    );

    expect(errors).toEqual([
      'set extra: cannot read missing.css: ENOENT: missing.css',
      'set extra2: no ".nope" block with custom properties in colors.css',
    ]);
  });

  it('reports reference cycles', () => {
    const map = { ...files, 'typography.css': ':root { --a-x: var(--b-x); --b-x: var(--a-x); }' };
    const errors = errorsOf(() => build({}, map));

    expect(errors).toContain('typography --a-x: reference cycle: --a-x → --b-x → --a-x');
  });

  it('rejects a name that maps to different paths in different sets', () => {
    const path = (name, setName) => [setName.split('/')[0], setName.split('/').at(-1), name.slice(2)];
    const errors = errorsOf(() => build({ path }));

    expect(errors).toContain('--brand-700 maps to semantic.nova.brand-700 in semantic/brand/nova but to semantic.orbit.brand-700 in semantic/brand/orbit');
  });

  it('rejects a path whose root is not the set root', () => {
    const errors = errorsOf(() => build({ path: (name) => ['other', name.slice(2)] }));

    expect(errors[0]).toBe('primitives --nova-700: the token path must start with "primitives", got "other"');
  });

  it('rejects token/group collisions inside a set', () => {
    const map = { ...files, 'typography.css': ':root { --weight: 700; --weight-bold: 600; }' };

    expect(errorsOf(() => build({}, map))).toContain('typography --weight-bold: typography.weight.bold collides with another token or group');
  });

  it('validates theme groups', () => {
    const errors = errorsOf(() =>
      build({
        themes: {
          Brands: ['semantic/brand/nova', 'semantic/brand/orbit'],
          Theme: ['semantic/theme/light', 'typography'],
          Other: ['nope'],
        },
      }),
    );

    expect(errors).toEqual([
      'themes.Brands: group key must be "Brand" to match its collection "semantic/brand"',
      'themes.Theme: sets must share one parent path, got semantic/theme, (none)',
      'themes.Other: unknown set nope',
    ]);
  });

  it('rejects a set in two groups', () => {
    const errors = errorsOf(() =>
      build({ themes: { Brand: ['semantic/brand/nova', 'semantic/brand/orbit'], Other: ['semantic/brand/nova'] } }),
    );

    expect(errors).toContain('set semantic/brand/nova is in two theme groups (Brand and Other)');
  });

  it('rejects an ungrouped set named like a grouped collection', () => {
    const map = { ...files, 'extra.css': ':root { --x-y: #000000; }' };
    const errors = errorsOf(() =>
      build({ sets: [...config.sets, { name: 'semantic/brand', file: 'extra.css', selector: ':root' }] }, map),
    );

    expect(errors).toContain('set semantic/brand has the same name as the collection of theme group Brand');
  });

  it('lets customSets add sets and consume names from declared sets', () => {
    const customSets = ({ blocks }) => {
      const nova = blocks('colors.css')[0].declarations.get('--nova-700');
      return {
        sets: [
          {
            name: 'semantic/accent/nova',
            declarations: new Map([
              ['--accent-700', nova],
              ['--gray-100', '#f7f7f8'],
            ]),
          },
        ],
        consumes: ['--gray-100'],
      };
    };
    const map = { ...files, 'theme.css': ":root { --text-default: var(--gray-900); }\n[data-mode='dark'] { --text-default: var(--gray-900); }" };
    const model = build(
      { customSets, themes: { ...config.themes, Accent: ['semantic/accent/nova'] } },
      map,
    );

    expect(model.sets.at(-1)).toMatchObject({ name: 'semantic/accent/nova', group: 'Accent', collection: 'semantic/accent' });
    expect(model.sets[0].tokens.map((token) => token.cssName)).not.toContain('--gray-100');
    expect(model.pathOf('--gray-100')).toEqual(['semantic', 'gray', '100']);
  });

  it('requires every consumed name to be declared by a custom set', () => {
    const customSets = () => ({ sets: [], consumes: ['--gray-900'] });

    expect(errorsOf(() => build({ customSets }))).toContain('customSets consumes --gray-900 but no custom set declares it');
  });

  it('rejects collection cycles', () => {
    const map = {
      'a.css': ':root { --a-x: var(--b-y); }',
      'b.css': ':root { --b-y: #000000; --b-z: var(--a-x); }',
    };
    const errors = errorsOf(() =>
      buildModel(
        {
          sets: [
            { name: 'a', file: 'a.css', selector: ':root' },
            { name: 'b', file: 'b.css', selector: ':root' },
          ],
        },
        { readFile: readFrom(map) },
      ),
    );

    expect(errors).toEqual(['collections reference each other in a cycle: a, b']);
  });
});
