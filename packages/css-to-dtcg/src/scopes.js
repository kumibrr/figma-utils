/**
 * Every number scope except Opacity and Font weight. Import mode keeps these but drops
 * FONT_WEIGHT, so weights still need their scope set in Figma after importing.
 * Shared with the Figma plugin, which gives these scopes to the sizes it infers.
 */
export const SIZE_SCOPES = [
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
