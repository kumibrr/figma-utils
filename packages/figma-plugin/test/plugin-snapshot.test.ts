import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildExport } from '../src/core/build-export';
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
