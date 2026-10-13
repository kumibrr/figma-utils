import { SIZE_SCOPES } from '../scopes.js';
import { serialize } from '../serialize.js';
import { nest } from '../tree.js';
import { DEFAULT_BASE_FONT_SIZE, remToPx } from '../units.js';

/**
 * @typedef {import('../model.js').Model} Model
 * @typedef {import('../values.js').Token} Token
 * @typedef {import('./dtcg.js').OutputFile} OutputFile
 */

const FIGMA_TYPE = { color: 'color', dimension: 'number', fontWeight: 'number', fontFamily: 'string' };
const SCOPES = { dimension: SIZE_SCOPES, fontWeight: ['FONT_WEIGHT'], fontFamily: ['FONT_FAMILY'] };

/**
 * The colour object Figma's own "Export modes" writes.
 * @param {string} hex normalized #rrggbb or #rrggbbaa
 */
export function figmaColor(hex) {
  const digits = hex.slice(1);
  const channel = (offset) => parseInt(digits.slice(offset, offset + 2), 16);

  return {
    colorSpace: 'srgb',
    components: [channel(0) / 255, channel(2) / 255, channel(4) / 255],
    alpha: digits.length === 8 ? channel(6) / 255 : 1,
    hex: `#${digits.slice(0, 6).toUpperCase()}`,
  };
}

/**
 * @param {Token} token
 * @param {number} baseFontSize
 */
function figmaValue(token, baseFontSize) {
  switch (token.$type) {
    case 'color':
      return figmaColor(/** @type {string} */ (token.$value));
    case 'dimension':
      return remToPx(/** @type {{ value: number }} */ (token.$value).value, baseFontSize);
    case 'fontWeight':
      return token.$value;
    case 'fontFamily':
      return /** @type {string[]} */ (token.$value)[0];
    default:
      throw new Error(`no Figma mapping for $type ${token.$type}`);
  }
}

/**
 * One file per collection mode, shaped for Figma's "Import mode". Sizes are
 * written in px, `baseFontSize` px to the rem.
 * @param {Model} model
 * @param {{ baseFontSize?: number }} [options]
 * @returns {OutputFile[]}
 */
export function toFigmaFiles(model, { baseFontSize = DEFAULT_BASE_FONT_SIZE } = {}) {
  const files = [];

  for (const collection of model.importOrder) {
    for (const set of model.sets.filter((candidate) => candidate.collection === collection)) {
      const tree = {};

      for (const modelToken of set.tokens) {
        const { $type } = modelToken.token;
        const extensions = { 'com.figma.scopes': SCOPES[$type] ?? ['ALL_SCOPES'] };
        if (FIGMA_TYPE[$type] === 'string') {
          extensions['com.figma.type'] = 'string';
        }

        let $value;
        if (!modelToken.target) {
          $value = figmaValue(modelToken.token, baseFontSize);
        } else if (model.collectionOf(modelToken.target) === set.collection) {
          $value = `{${model.pathOf(modelToken.target).slice(1).join('.')}}`;
        } else {
          $value = figmaValue(model.resolveLiteral(modelToken.target), baseFontSize);
          extensions['com.figma.aliasData'] = {
            targetVariableName: model.pathOf(modelToken.target).slice(1).join('/'),
            targetVariableSetName: model.collectionOf(modelToken.target),
          };
        }

        nest(tree, modelToken.path.slice(1), { $type: FIGMA_TYPE[$type], $value, $extensions: extensions });
      }

      tree.$extensions = { 'com.figma.modeName': set.mode };
      files.push({ path: `${set.collection}/${set.mode}.tokens.json`, json: serialize(tree) });
    }
  }

  return files;
}
