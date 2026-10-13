import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadBaseFontSize, saveBaseFontSize } from '../src/plugin/file-settings';

function stubFigma(editorType: string, stored: Record<string, string> = {}) {
  const data = new Map(Object.entries(stored));
  vi.stubGlobal('figma', {
    editorType,
    root: {
      getSharedPluginData: (namespace: string, key: string) => data.get(`${namespace}/${key}`) ?? '',
      setSharedPluginData: (namespace: string, key: string, value: string) => data.set(`${namespace}/${key}`, value),
    },
  });
  return data;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('base font size', () => {
  it('defaults to 16px when the file has none or an invalid one', () => {
    stubFigma('figma');
    expect(loadBaseFontSize()).toBe(16);

    stubFigma('figma', { 'export_design_tokens/base-font-size': '0' });
    expect(loadBaseFontSize()).toBe(16);
  });

  it('is saved in the file', () => {
    const data = stubFigma('figma');

    saveBaseFontSize(10);

    expect(data.get('export_design_tokens/base-font-size')).toBe('10');
    expect(loadBaseFontSize()).toBe(10);
  });

  it("can't be changed in Dev Mode or set to a non-positive size", () => {
    stubFigma('dev');
    expect(() => saveBaseFontSize(10)).toThrow('not in Dev Mode');

    stubFigma('figma');
    expect(() => saveBaseFontSize(0)).toThrow('greater than 0');
  });
});
