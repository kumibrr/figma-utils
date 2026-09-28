import { afterEach, describe, expect, it, vi } from 'vitest';

import { applyScopes } from '../src/plugin/scopes';

function stubFigma(editorType: string, ids: string[]) {
  const variables = new Map(ids.map((id) => [id, { id, remote: false, scopes: ['ALL_SCOPES'] }]));
  const commitUndo = vi.fn();
  vi.stubGlobal('figma', {
    editorType,
    commitUndo,
    variables: { getVariableByIdAsync: async (id: string) => variables.get(id) ?? null },
  });
  return { variables, commitUndo };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('applyScopes', () => {
  it('sets each variable\'s scopes as one undo step and counts them', async () => {
    const { variables, commitUndo } = stubFigma('figma', ['a', 'b']);

    const count = await applyScopes([
      { variableId: 'a', scopes: ['FONT_WEIGHT'] },
      { variableId: 'b', scopes: ['GAP', 'FONT_SIZE'] },
    ]);

    expect(count).toBe(2);
    expect(variables.get('a')!.scopes).toEqual(['FONT_WEIGHT']);
    expect(variables.get('b')!.scopes).toEqual(['GAP', 'FONT_SIZE']);
    expect(commitUndo).toHaveBeenCalledOnce();
  });

  it('skips variables deleted since the preview was read', async () => {
    stubFigma('figma', ['a']);

    expect(await applyScopes([{ variableId: 'gone', scopes: ['GAP'] }, { variableId: 'a', scopes: ['GAP'] }])).toBe(1);
  });

  it('refuses in Dev Mode, which cannot edit the file', async () => {
    const { variables } = stubFigma('dev', ['a']);

    await expect(applyScopes([{ variableId: 'a', scopes: ['GAP'] }])).rejects.toThrow(
      'Scopes can only be set in the Figma editor, not in Dev Mode.',
    );
    expect(variables.get('a')!.scopes).toEqual(['ALL_SCOPES']);
  });
});
