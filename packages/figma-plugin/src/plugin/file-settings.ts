import { DEFAULT_BASE_FONT_SIZE, isBaseFontSize } from 'css-to-dtcg/units';

import { isSizeUnit, type SizeUnit } from '../core/tokens';
import { canEdit } from './scopes';

/**
 * Settings that belong to the design system rather than the person exporting live
 * in the Figma file, so everyone exporting it gets the same output. Shared plugin
 * data is used because its namespace survives the plugin id changing on publish.
 */
const NAMESPACE = 'export_design_tokens';
const KEYS = { sizeUnit: 'size-unit', baseFontSize: 'base-font-size' } as const;

export function loadSizeUnit(): SizeUnit {
  const stored = figma.root.getSharedPluginData(NAMESPACE, KEYS.sizeUnit);
  return isSizeUnit(stored) ? stored : 'rem';
}

export function saveSizeUnit(sizeUnit: SizeUnit): void {
  if (!canEdit()) {
    throw new Error('The size unit can only be changed in the Figma editor, not in Dev Mode.');
  }
  if (!isSizeUnit(sizeUnit)) {
    throw new Error('The size unit must be rem or px.');
  }
  figma.root.setSharedPluginData(NAMESPACE, KEYS.sizeUnit, sizeUnit);
}

export function loadBaseFontSize(): number {
  const stored = Number(figma.root.getSharedPluginData(NAMESPACE, KEYS.baseFontSize) || NaN);
  return isBaseFontSize(stored) ? stored : DEFAULT_BASE_FONT_SIZE;
}

export function saveBaseFontSize(baseFontSize: number): void {
  if (!canEdit()) {
    throw new Error('The base font size can only be changed in the Figma editor, not in Dev Mode.');
  }
  if (!isBaseFontSize(baseFontSize)) {
    throw new Error('The base font size must be a number of pixels greater than 0.');
  }
  figma.root.setSharedPluginData(NAMESPACE, KEYS.baseFontSize, String(baseFontSize));
}
