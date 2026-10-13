import { DEFAULT_BASE_FONT_SIZE, isBaseFontSize } from 'css-to-dtcg/units';

import { canEdit } from './scopes';

/**
 * Settings that belong to the design system rather than the person exporting live
 * in the Figma file, so everyone exporting it gets the same output. Shared plugin
 * data is used because its namespace survives the plugin id changing on publish.
 */
const NAMESPACE = 'export_design_tokens';
const KEYS = { baseFontSize: 'base-font-size' } as const;

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
