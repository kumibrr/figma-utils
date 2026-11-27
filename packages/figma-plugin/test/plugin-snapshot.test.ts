import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildExport } from '../src/core/build-export';
import { multipleFiles } from '../src/core/files';
import { readSnapshot, toSnapshotValue } from '../src/plugin/snapshot';

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

const alias = (id: string): VariableAlias => ({ type: 'VARIABLE_ALIAS', id });

type TestVariable = Pick<Variable, 'id' | 'name' | 'variableCollectionId' | 'resolvedType' | 'scopes' | 'description' | 'codeSyntax' | 'valuesByMode'>;

const collection = {
  id: 'local',
  name: 'semantic',
  modes: [{ modeId: 'local-mode', name: 'Default' }],
  defaultModeId: 'local-mode',
  variableIds: ['surface'],
};

const surface: TestVariable = {
  id: 'surface',
  name: 'surface',
  variableCollectionId: collection.id,
  resolvedType: 'COLOR',
  scopes: [],
  description: '',
  codeSyntax: {},
  valuesByMode: { 'local-mode': alias('library-surface') },
};

function stubFigma(localVariables: TestVariable[], localCollection = collection) {
  const api = {
    getLocalVariableCollectionsAsync: vi.fn().mockResolvedValue([localCollection]),
    getLocalVariablesAsync: vi.fn().mockResolvedValue(localVariables),
    getVariableByIdAsync: vi.fn<(id: string) => Promise<unknown>>(),
    getVariableCollectionByIdAsync: vi.fn<(id: string) => Promise<unknown>>(),
  };
  vi.stubGlobal('figma', { root: { name: 'Test file' }, variables: api });
  return api;
}

describe('library aliases in exports', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('exports a local variable that aliases a library variable using the library default mode', async () => {
    const api = stubFigma([surface]);
    api.getVariableByIdAsync.mockResolvedValue({
      variableCollectionId: 'library',
      codeSyntax: {},
      valuesByMode: { dark: { r: 0, g: 0, b: 0 }, light: { r: 1, g: 1, b: 1 } },
    });
    api.getVariableCollectionByIdAsync.mockResolvedValue({ defaultModeId: 'light' });

    const result = buildExport(await readSnapshot());

    expect(result.errors).toEqual([]);
    expect(result.sets).toEqual([
      { name: 'semantic', tree: { semantic: { surface: { $type: 'color', $value: '#ffffff' } } } },
    ]);
  });

  it('follows library alias chains and keeps references between local tokens', async () => {
    const localReference = { ...surface, id: 'card', name: 'card', valuesByMode: { 'local-mode': alias(surface.id) } };
    const secondLibraryReference = { ...surface, id: 'overlay', name: 'overlay' };
    const api = stubFigma([surface, localReference, secondLibraryReference], {
      ...collection,
      variableIds: ['surface', 'card', 'overlay'],
    });
    api.getVariableByIdAsync.mockImplementation(async (id) => {
      if (id === 'library-surface') {
        return { variableCollectionId: 'library', codeSyntax: {}, valuesByMode: { light: alias('library-black') } };
      }
      if (id === 'library-black') {
        return { variableCollectionId: 'palette', codeSyntax: {}, valuesByMode: { base: { r: 0, g: 0, b: 0, a: 0 } } };
      }
      return null;
    });
    api.getVariableCollectionByIdAsync.mockImplementation(async (id) => ({ defaultModeId: id === 'library' ? 'light' : 'base' }));

    const result = buildExport(await readSnapshot());

    expect(result.errors).toEqual([]);
    expect(result.sets[0].tree).toEqual({
      semantic: {
        surface: { $type: 'color', $value: '#00000000' },
        card: { $type: 'color', $value: '{semantic.surface}' },
        overlay: { $type: 'color', $value: '#00000000' },
      },
    });
    expect(api.getVariableByIdAsync.mock.calls).toEqual([['library-surface'], ['library-black']]);
  });

  it('exports each local mode using its own alias and applies the selected size unit', async () => {
    const size: TestVariable = {
      ...surface,
      name: 'gap',
      resolvedType: 'FLOAT',
      scopes: ['GAP'],
      valuesByMode: { compact: alias('library-gap-none'), spacious: alias('library-gap-large') },
    };
    const api = stubFigma([size], {
      ...collection,
      modes: [{ modeId: 'compact', name: 'compact' }, { modeId: 'spacious', name: 'spacious' }],
      defaultModeId: 'compact',
    });
    api.getVariableByIdAsync.mockImplementation(async (id) => ({
      variableCollectionId: 'library',
      codeSyntax: {},
      valuesByMode: { standard: id === 'library-gap-none' ? 0 : 15 },
    }));
    api.getVariableCollectionByIdAsync.mockResolvedValue({ defaultModeId: 'standard' });

    const snapshot = await readSnapshot();
    const remExport = buildExport(snapshot, { baseFontSize: 10 });
    const pxExport = buildExport(snapshot, { sizeUnit: 'px' });

    expect(remExport.errors).toEqual([]);
    expect(remExport.sets.map((set) => set.tree)).toEqual([
      { semantic: { gap: { $type: 'dimension', $value: { value: 0, unit: 'rem' } } } },
      { semantic: { gap: { $type: 'dimension', $value: { value: 1.5, unit: 'rem' } } } },
    ]);
    expect(pxExport.errors).toEqual([]);
    expect(pxExport.sets[1].tree).toEqual({ semantic: { gap: { $type: 'dimension', $value: { value: 15, unit: 'px' } } } });
    expect(api.getVariableCollectionByIdAsync.mock.calls).toEqual([['library']]);
  });

  it.each(['missing', 'unavailable', 'cyclic'])('reports %s library aliases on the local variable and mode', async (problem) => {
    const api = stubFigma([surface]);
    if (problem === 'cyclic') {
      api.getVariableByIdAsync.mockResolvedValue({
        variableCollectionId: 'library',
        codeSyntax: {},
        valuesByMode: { light: alias('library-surface') },
      });
      api.getVariableCollectionByIdAsync.mockResolvedValue({ defaultModeId: 'light' });
    } else if (problem === 'unavailable') {
      api.getVariableByIdAsync.mockRejectedValue(new Error('Variable is unavailable'));
    } else {
      api.getVariableByIdAsync.mockResolvedValue(null);
    }

    const result = buildExport(await readSnapshot());

    expect(result.errors).toEqual([
      { collection: 'semantic', variable: 'surface', mode: 'Default', reason: 'aliases a variable whose value could not be resolved in Figma' },
    ]);
  });
});

describe('composed colors in exports', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('exports the Aula Virtual navigation color in each Theme file', async () => {
    const background = {
      ...surface,
      id: 'background',
      name: 'background',
      valuesByMode: { light: alias('white'), dark: alias('base-950') },
    };
    const navigation = {
      ...surface,
      id: 'navigation',
      name: 'alpha/background-navigation',
      valuesByMode: {
        light: { color: alias(background.id), opacity: 60 },
        dark: { color: alias(background.id), opacity: 60 },
      },
    };
    const api = stubFigma([background, navigation], {
      ...collection,
      name: 'Theme',
      modes: [{ modeId: 'light', name: 'Light' }, { modeId: 'dark', name: 'Dark' }],
      defaultModeId: 'light',
      variableIds: [background.id, navigation.id],
    });
    api.getVariableByIdAsync.mockImplementation(async (id) => {
      if (id === 'white') {
        return { variableCollectionId: 'tailwind', codeSyntax: {}, valuesByMode: { palette: { r: 1, g: 1, b: 1 } } };
      }
      if (id === 'base-950') {
        return { variableCollectionId: 'base-color', codeSyntax: {}, valuesByMode: { base: alias('neutral-950') } };
      }
      if (id === 'neutral-950') {
        const channel = Math.fround(10 / 255);
        return { variableCollectionId: 'tailwind', codeSyntax: {}, valuesByMode: { palette: { r: channel, g: channel, b: channel } } };
      }
      return null;
    });
    api.getVariableCollectionByIdAsync.mockImplementation(async (id) => ({ defaultModeId: id === 'tailwind' ? 'palette' : 'base' }));

    const result = buildExport(await readSnapshot());
    const files = multipleFiles(result);

    expect(result.errors).toEqual([]);
    expect(files.slice(0, 2).map(({ path, json }) => [path, JSON.parse(json).Theme.alpha['background-navigation'].$value])).toEqual([
      ['Theme/Light.json', '#ffffff99'],
      ['Theme/Dark.json', '#0a0a0a99'],
    ]);
  });

  it.each([
    { opacity: 0, expected: '#ff000000' },
    { opacity: 100, expected: '#ff0000' },
  ])('uses a mode-specific opacity alias of $opacity% as the alpha channel', async ({ opacity, expected }) => {
    const alpha: TestVariable = {
      ...surface,
      id: 'alpha',
      resolvedType: 'FLOAT',
      valuesByMode: { light: 60, dark: alias('library-alpha') },
    };
    const composed = { color: { r: 1, g: 0, b: 0, a: 0.25 }, opacity: alias(alpha.id) };
    const variable = { ...surface, valuesByMode: { light: composed, dark: composed } };
    const api = stubFigma([variable, alpha], {
      ...collection,
      modes: [{ modeId: 'light', name: 'Light' }, { modeId: 'dark', name: 'Dark' }],
      defaultModeId: 'light',
    });
    api.getVariableByIdAsync.mockResolvedValue({
      variableCollectionId: 'opacity-library',
      codeSyntax: {},
      valuesByMode: { default: opacity, other: 25 },
    });
    api.getVariableCollectionByIdAsync.mockResolvedValue({ defaultModeId: 'default' });

    const result = buildExport(await readSnapshot());

    expect(result.errors).toEqual([]);
    expect(result.sets.map(({ tree }) => tree)).toEqual([
      { semantic: { surface: { $type: 'color', $value: '#ff000099' } } },
      { semantic: { surface: { $type: 'color', $value: expected } } },
    ]);
  });

  it('flattens a composed library color reached by a plain alias', async () => {
    const api = stubFigma([surface]);
    api.getVariableByIdAsync.mockImplementation(async (id) => ({
      variableCollectionId: 'library',
      codeSyntax: {},
      valuesByMode: {
        default: id === 'library-surface'
          ? { color: alias('library-blue'), opacity: alias('library-alpha') }
          : id === 'library-blue' ? { r: 0, g: 0, b: 1 } : 50,
      },
    }));
    api.getVariableCollectionByIdAsync.mockResolvedValue({ defaultModeId: 'default' });

    const result = buildExport(await readSnapshot());

    expect(result.errors).toEqual([]);
    expect(result.sets[0].tree).toEqual({ semantic: { surface: { $type: 'color', $value: '#0000ff80' } } });
  });

  it.each([
    {
      problem: 'missing color alias',
      value: { color: alias('missing'), opacity: 60 },
      reason: 'composed color alias could not be resolved in Figma',
    },
    {
      problem: 'cyclic color alias',
      value: { color: alias(surface.id), opacity: 60 },
      reason: 'composed color alias could not be resolved in Figma',
    },
    {
      problem: 'wrong color type',
      value: { color: alias('wrong-type'), opacity: 60 },
      reason: 'composed color requires valid RGB channels',
    },
    {
      problem: 'out-of-range opacity',
      value: { color: alias('white'), opacity: -1 },
      reason: 'composed color opacity must be a percentage from 0 to 100',
    },
    {
      problem: 'missing opacity alias',
      value: { color: { r: 1, g: 1, b: 1 }, opacity: alias('missing') },
      reason: 'composed color opacity alias could not be resolved in Figma',
    },
    {
      problem: 'wrong opacity type',
      value: { color: { r: 1, g: 1, b: 1 }, opacity: alias('wrong-type') },
      reason: 'composed color opacity must be a percentage from 0 to 100',
    },
  ])('reports a $problem on the token and mode', async ({ value, reason }) => {
    const api = stubFigma([{ ...surface, valuesByMode: { 'local-mode': value } }]);
    api.getVariableByIdAsync.mockImplementation(async (id) => id === 'missing' ? null : {
      variableCollectionId: 'library',
      codeSyntax: {},
      valuesByMode: { default: id === 'white' ? { r: 1, g: 1, b: 1 } : 'invalid' },
    });
    api.getVariableCollectionByIdAsync.mockResolvedValue({ defaultModeId: 'default' });

    const result = buildExport(await readSnapshot());

    expect(result.errors).toEqual([{ collection: 'semantic', variable: 'surface', mode: 'Default', reason }]);
    expect(result.sets[0].tree).toEqual({});
  });
});
