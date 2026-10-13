/**
 * Figma has no rem: designers work in pixels. Sizes are rem in CSS and DTCG and
 * px in Figma, converted with the root font size. Shared with the Figma plugin,
 * which converts back on export.
 */
export const DEFAULT_BASE_FONT_SIZE = 16;

/** @param {unknown} value @returns {value is number} */
export const isBaseFontSize = (value) => typeof value === 'number' && Number.isFinite(value) && value > 0;

// Drops float noise such as 1.1 * 10 = 11.000000000000002.
const clean = (value) => Number(value.toPrecision(12));

/** @param {number} rem @param {number} [baseFontSize] */
export const remToPx = (rem, baseFontSize = DEFAULT_BASE_FONT_SIZE) => clean(rem * baseFontSize);

/** @param {number} px @param {number} [baseFontSize] */
export const pxToRem = (px, baseFontSize = DEFAULT_BASE_FONT_SIZE) => clean(px / baseFontSize);
