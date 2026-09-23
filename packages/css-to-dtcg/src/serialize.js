/**
 * The one JSON style every file uses, shared with the Figma plugin so both
 * tools write byte-identical files.
 * @param {unknown} value
 * @returns {string}
 */
export const serialize = (value) => `${JSON.stringify(value, null, 2)}\n`;
