import { describe, expect, it } from 'vitest';

import { buildModel } from '../src/model.js';
import { figmaColor, toFigmaFiles } from '../src/targets/figma.js';

const files = {
  'colors.css': ':root { --gray-900: #2a2a2e; --nova-700: #6038c4; --base-overlay: #1515178c; }',
  'brands.css': ":root, [data-brand='nova'] { --brand-700: var(--nova-700); }\n[data-brand='orbit'] { --brand-700: var(--gray-900); }",
  'theme.css':
    ":root { --text-default: var(--gray-900); --text-muted: var(--text-default); --primary-default: var(--brand-700); }\n[data-mode='dark'] { --text-default: var(--nova-700); --text-muted: var(--text-default); --primary-default: var(--brand-700); }",
  'typography.css': ":root { --size-s: 0.875rem; --weight-bold: 700; --family-title: 'Fraunces', serif; --weight-title: var(--weight-bold); }",
};

const model = buildModel(
  {
    sets: [
      { name: 'primitives', file: 'colors.css', selector: ':root' },
      { name: 'semantic/brand/nova', file: 'brands.css', selector: ":root, [data-brand='nova']" },
      { name: 'semantic/brand/orbit', file: 'brands.css', selector: "[data-brand='orbit']" },
      { name: 'semantic/theme/light', file: 'theme.css', selector: ':root' },
      { name: 'semantic/theme/dark', file: 'theme.css', selector: "[data-mode='dark']" },
      { name: 'typography', file: 'typography.css', selector: ':root' },
    ],
    themes: { Brand: ['semantic/brand/nova', 'semantic/brand/orbit'], Theme: ['semantic/theme/light', 'semantic/theme/dark'] },
  },
  { readFile: (file) => files[file] },
);

const output = toFigmaFiles(model);
const fileAt = (path) => JSON.parse(output.find((file) => file.path === path).json);

describe('figmaColor', () => {
  it('matches the shape Figma exports', () => {
    expect(figmaColor('#6038c4')).toEqual({
      colorSpace: 'srgb',
      components: [0x60 / 255, 0x38 / 255, 0xc4 / 255],
      alpha: 1,
      hex: '#6038C4',
    });
  });

  it('moves the alpha channel into alpha', () => {
    expect(figmaColor('#1515178c')).toMatchObject({ alpha: 0x8c / 255, hex: '#151517' });
  });
});

describe('toFigmaFiles', () => {
  it('writes one file per collection mode, in import order', () => {
    expect(output.map((file) => file.path)).toEqual([
      'primitives/default.tokens.json',
      'semantic/brand/nova.tokens.json',
      'semantic/brand/orbit.tokens.json',
      'semantic/theme/light.tokens.json',
      'semantic/theme/dark.tokens.json',
      'typography/default.tokens.json',
    ]);
  });

  it('drops the root segment and records the mode name', () => {
    const primitives = fileAt('primitives/default.tokens.json');

    expect(Object.keys(primitives)).toEqual(['gray', 'nova', 'base', '$extensions']);
    expect(primitives.$extensions).toEqual({ 'com.figma.modeName': 'default' });
    expect(primitives.gray['900']).toEqual({
      $type: 'color',
      $value: figmaColor('#2a2a2e'),
      $extensions: { 'com.figma.scopes': ['ALL_SCOPES'] },
    });
  });

  it('maps dimensions, weights and families with scopes', () => {
    const typography = fileAt('typography/default.tokens.json');

    expect(typography.size.s).toEqual({ $type: 'number', $value: 0.875, $extensions: { 'com.figma.scopes': ['ALL_SCOPES'] } });
    expect(typography.weight.bold).toEqual({ $type: 'number', $value: 700, $extensions: { 'com.figma.scopes': ['FONT_WEIGHT'] } });
    expect(typography.family.title).toEqual({
      $type: 'string',
      $value: 'Fraunces',
      $extensions: { 'com.figma.scopes': ['FONT_FAMILY'], 'com.figma.type': 'string' },
    });
  });

  it('writes same-collection aliases as references without the root', () => {
    expect(fileAt('typography/default.tokens.json').weight.title).toEqual({
      $type: 'number',
      $value: '{weight.bold}',
      $extensions: { 'com.figma.scopes': ['FONT_WEIGHT'] },
    });
    expect(fileAt('semantic/theme/light.tokens.json').text.muted.$value).toBe('{text.default}');
  });

  it('writes cross-collection aliases as the resolved value plus aliasData', () => {
    expect(fileAt('semantic/theme/light.tokens.json').text.default).toEqual({
      $type: 'color',
      $value: figmaColor('#2a2a2e'),
      $extensions: {
        'com.figma.scopes': ['ALL_SCOPES'],
        'com.figma.aliasData': { targetVariableName: 'gray/900', targetVariableSetName: 'primitives' },
      },
    });
  });

  it('resolves aliases into a multi-mode collection through its first set', () => {
    expect(fileAt('semantic/theme/light.tokens.json').primary.default).toEqual({
      $type: 'color',
      $value: figmaColor('#6038c4'),
      $extensions: {
        'com.figma.scopes': ['ALL_SCOPES'],
        'com.figma.aliasData': { targetVariableName: 'brand/700', targetVariableSetName: 'semantic/brand' },
      },
    });
  });
});
