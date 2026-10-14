import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadBaseFontSize, loadSizeUnit, saveBaseFontSize, saveSizeUnit } from '../src/plugin/file-settings';

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

describe('size unit', () => {
  it('defaults to rem when the file has none or an invalid one', () => {
    stubFigma('figma');
    expect(loadSizeUnit()).toBe('rem');

    stubFigma('figma', { 'export_design_tokens/size-unit': 'em' });
    expect(loadSizeUnit()).toBe('rem');
  });

  it('is saved in the file', () => {
    const data = stubFigma('figma');

    saveSizeUnit('px');

    expect(data.get('export_design_tokens/size-unit')).toBe('px');
    expect(loadSizeUnit()).toBe('px');
  });

  it("can't be changed in Dev Mode or set to another unit", () => {
    stubFigma('dev');
    expect(() => saveSizeUnit('px')).toThrow('not in Dev Mode');

    stubFigma('figma');
    expect(() => saveSizeUnit('em' as 'px')).toThrow('rem or px');
  });
});
