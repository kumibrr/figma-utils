import { serialize } from '../serialize.js';
import { nest } from '../tree.js';

/**
 * @typedef {import('../model.js').Model} Model
 * @typedef {import('../values.js').Token} Token
 * @typedef {import('./dtcg.js').OutputFile} OutputFile
 */

const FIGMA_TYPE = { color: 'color', dimension: 'number', fontWeight: 'number', fontFamily: 'string' };
// Every number scope except Opacity and Font weight. Import mode keeps these but drops
// FONT_WEIGHT, so weights still need their scope set by hand after importing.
const SIZE_SCOPES = [
  'CORNER_RADIUS',
  'WIDTH_HEIGHT',
  'GAP',
  'STROKE_FLOAT',
  'EFFECT_FLOAT',
  'FONT_SIZE',
  'LINE_HEIGHT',
  'LETTER_SPACING',
  'PARAGRAPH_SPACING',
  'PARAGRAPH_INDENT',
];
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

/** @param {Token} token */
function figmaValue(token) {
  switch (token.$type) {
    case 'color':
      return figmaColor(/** @type {string} */ (token.$value));
    case 'dimension':
      return /** @type {{ value: number }} */ (token.$value).value;
    case 'fontWeight':
      return token.$value;
    case 'fontFamily':
      return /** @type {string[]} */ (token.$value)[0];
    default:
      throw new Error(`no Figma mapping for $type ${token.$type}`);
  }
}

/**
 * One file per collection mode, shaped for Figma's "Import mode".
 * @param {Model} model
 * @returns {OutputFile[]}
 */
export function toFigmaFiles(model) {
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
          $value = figmaValue(modelToken.token);
        } else if (model.collectionOf(modelToken.target) === set.collection) {
          $value = `{${model.pathOf(modelToken.target).slice(1).join('.')}}`;
        } else {
          $value = figmaValue(model.resolveLiteral(modelToken.target));
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
