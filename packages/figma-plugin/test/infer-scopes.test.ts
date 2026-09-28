import { SIZE_SCOPES } from 'css-to-dtcg/scopes';
import { describe, expect, it } from 'vitest';

import { inferScopes, words } from '../src/core/infer-scopes';
import { alias, collection, rgba, snapshot, variable } from './helpers';

type Variable = ReturnType<typeof variable>;

const inCollection = (name: string, ...variables: Variable[]) => inferScopes(snapshot([collection(name, ['Mode 1'])], variables));
const one = (...variables: Variable[]) => inCollection('p', ...variables);
const summary = (fixes: ReturnType<typeof inferScopes>) => fixes.map((fix) => [fix.variable, fix.scopes, fix.because]);

/** The scopes suggested for one unscoped variable in collection `p`. */
const scopesFor = (name: string, type: 'FLOAT' | 'STRING' = 'FLOAT', extra: Partial<Variable> = {}) =>
  one(variable('p', name, type, { 'Mode 1': type === 'FLOAT' ? 1 : 'x' }, extra))[0]?.scopes ?? null;

describe('words', () => {
  it('splits on separators and camelCase, lowercased', () => {
    expect(words('Font/lineHeight-XL_2 body')).toEqual(['font', 'line', 'height', 'xl', '2', 'body']);
    expect(words('var(--font-weight-bold)')).toEqual(['var', 'font', 'weight', 'bold']);
  });
});

describe('inferScopes', () => {
  it('only suggests scopes for numbers and strings on All scopes or none', () => {
    expect(
      one(
        variable('p', 'c', 'COLOR', { 'Mode 1': rgba(0, 0, 0) }),
        variable('p', 'gap', 'FLOAT', { 'Mode 1': 1 }, { scopes: ['GAP'] }),
        variable('p', 'bold', 'FLOAT', { 'Mode 1': 700 }, { scopes: ['FONT_WEIGHT'] }),
        variable('p', 'family', 'STRING', { 'Mode 1': 'Inter' }, { scopes: ['FONT_FAMILY'] }),
        variable('p', 'label', 'STRING', { 'Mode 1': 'Hi' }, { scopes: ['TEXT_CONTENT'] }),
        variable('p', 'flag', 'BOOLEAN', { 'Mode 1': true }),
      ),
    ).toEqual([]);
  });

  it('describes each fix', () => {
    expect(one(variable('p', 'radius/m', 'FLOAT', { 'Mode 1': 0.5 }, { scopes: [] }))).toEqual([
      { variableId: 'v:p/radius/m', collection: 'p', variable: 'radius/m', scopes: ['CORNER_RADIUS'], because: 'name', stillBlocked: null },
    ]);
  });

  it.each([
    ['weight/bold', 'FONT_WEIGHT'],
    ['font-weight/body', 'FONT_WEIGHT'],
    ['line-height/m', 'LINE_HEIGHT'],
    ['lineHeight/m', 'LINE_HEIGHT'],
    ['leading/m', 'LINE_HEIGHT'],
    ['letter-spacing/wide', 'LETTER_SPACING'],
    ['tracking/tight', 'LETTER_SPACING'],
    ['kerning/s', 'LETTER_SPACING'],
    ['paragraph-spacing/m', 'PARAGRAPH_SPACING'],
    ['paragraph/indent', 'PARAGRAPH_INDENT'],
    ['indent/l', 'PARAGRAPH_INDENT'],
    ['font-size/m', 'FONT_SIZE'],
    ['text/size/m', 'FONT_SIZE'],
    ['typography/heading/size', 'FONT_SIZE'],
    ['radius/m', 'CORNER_RADIUS'],
    ['radii/s', 'CORNER_RADIUS'],
    ['border-radius/card', 'CORNER_RADIUS'],
    ['rounded/full', 'CORNER_RADIUS'],
    ['corner/s', 'CORNER_RADIUS'],
    ['opacity/50', 'OPACITY'],
    ['alpha/disabled', 'OPACITY'],
    ['border/width/thin', 'STROKE_FLOAT'],
    ['borders/s', 'STROKE_FLOAT'],
    ['stroke/m', 'STROKE_FLOAT'],
    ['blur/l', 'EFFECT_FLOAT'],
    ['shadow/spread', 'EFFECT_FLOAT'],
    ['elevation/2', 'EFFECT_FLOAT'],
    ['gap/m', 'GAP'],
    ['space/4', 'GAP'],
    ['spacing/xl', 'GAP'],
    ['padding/card', 'GAP'],
    ['margin/s', 'GAP'],
    ['inset/m', 'GAP'],
    ['gutter/grid', 'GAP'],
    ['icon/gap', 'GAP'],
    ['width/sidebar', 'WIDTH_HEIGHT'],
    ['height/button', 'WIDTH_HEIGHT'],
    ['size/m', 'WIDTH_HEIGHT'],
    ['icon/size', 'WIDTH_HEIGHT'],
    ['avatar/l', 'WIDTH_HEIGHT'],
  ])('reads the scope of the number %s from its name', (name, scope) => {
    expect(scopesFor(name)).toEqual([scope]);
  });

  it.each([
    ['font-style/italic', 'FONT_STYLE'],
    ['style/heading', 'FONT_STYLE'],
    ['family/body', 'FONT_FAMILY'],
    ['font/mono', 'FONT_FAMILY'],
    ['fonts/body', 'FONT_FAMILY'],
    ['typeface/display', 'FONT_FAMILY'],
    ['text/font', 'FONT_FAMILY'],
    ['content/title', 'TEXT_CONTENT'],
    ['copy/cta', 'TEXT_CONTENT'],
    ['label/submit', 'TEXT_CONTENT'],
    ['text/greeting', 'TEXT_CONTENT'],
    ['message/error', 'TEXT_CONTENT'],
    ['placeholder/search', 'TEXT_CONTENT'],
  ])('reads the scope of the string %s from its name', (name, scope) => {
    expect(scopesFor(name, 'STRING')).toEqual([scope]);
  });

  it('reads Web code syntax when the name says nothing', () => {
    expect(scopesFor('a', 'FLOAT', { codeSyntax: { WEB: 'var(--radius-m)' } })).toEqual(['CORNER_RADIUS']);
    expect(scopesFor('b', 'STRING', { codeSyntax: { WEB: "'Roboto Slab', serif" } })).toEqual(['FONT_FAMILY']);
    expect(scopesFor('radius', 'FLOAT', { codeSyntax: { WEB: 'var(--gap)' } })).toEqual(['CORNER_RADIUS']);
  });

  it('takes the scopes of aliased variables, then the collection name, then weight-like values', () => {
    expect(
      summary(
        inCollection(
          'spacing',
          variable('spacing', 'card', 'FLOAT', { 'Mode 1': alias('spacing', 'r') }),
          variable('spacing', 'r', 'FLOAT', { 'Mode 1': 1 }, { scopes: ['CORNER_RADIUS'] }),
          variable('spacing', 'm', 'FLOAT', { 'Mode 1': 400 }),
        ),
      ),
    ).toEqual([
      ['card', ['CORNER_RADIUS'], 'aliases r'],
      ['m', ['GAP'], 'collection name'],
    ]);

    expect(summary(one(variable('p', 'heavy', 'FLOAT', { 'Mode 1': 800 })))).toEqual([['heavy', ['FONT_WEIGHT'], 'value 800']]);
  });

  it('uses the collection name as context for sizes', () => {
    expect(summary(inCollection('typography', variable('typography', 'size/m', 'FLOAT', { 'Mode 1': 1 })))).toEqual([
      ['size/m', ['FONT_SIZE'], 'name'],
    ]);
  });

  it('falls back to every size scope for numbers and to nothing for strings', () => {
    expect(summary(one(variable('p', 'misc', 'FLOAT', { 'Mode 1': 3 }), variable('p', 'misc/s', 'STRING', { 'Mode 1': 'x' })))).toEqual([
      ['misc', SIZE_SCOPES, 'no hint'],
    ]);
  });

  it('only treats values as weights when every mode is 100–900 in steps of 100', () => {
    const themed = inferScopes(
      snapshot(
        [collection('t', ['light', 'dark'])],
        [
          variable('t', 'a', 'FLOAT', { light: 400, dark: 700 }),
          variable('t', 'b', 'FLOAT', { light: 400, dark: 16 }),
          variable('t', 'c', 'FLOAT', { light: 450, dark: 450 }),
          variable('t', 'd', 'FLOAT', { light: 1000, dark: 1000 }),
        ],
      ),
    );

    expect(themed.map((fix) => [fix.variable, fix.because])).toEqual([
      ['a', 'value 400'],
      ['b', 'no hint'],
      ['c', 'no hint'],
      ['d', 'no hint'],
    ]);
  });

  it('follows aliases across collections and through other unscoped variables', () => {
    const fixes = inferScopes(
      snapshot(
        [collection('primitives', ['Mode 1']), collection('semantic', ['Mode 1'])],
        [
          variable('primitives', 'radius/m', 'FLOAT', { 'Mode 1': 0.5 }),
          variable('semantic', 'card', 'FLOAT', { 'Mode 1': alias('semantic', 'surface') }),
          variable('semantic', 'surface', 'FLOAT', { 'Mode 1': alias('primitives', 'radius/m') }),
        ],
      ),
    );

    expect(summary(fixes)).toEqual([
      ['radius/m', ['CORNER_RADIUS'], 'name'],
      ['card', ['CORNER_RADIUS'], 'aliases surface'],
      ['surface', ['CORNER_RADIUS'], 'aliases radius/m'],
    ]);
  });

  it('combines the scopes of modes that alias different sizes, but never mixes weights with sizes', () => {
    const fixes = inferScopes(
      snapshot(
        [collection('t', ['light', 'dark'])],
        [
          variable('t', 'combined', 'FLOAT', { light: alias('t', 'gap'), dark: alias('t', 'radius') }),
          variable('t', 'mixed', 'FLOAT', { light: alias('t', 'bold'), dark: alias('t', 'gap') }),
          variable('t', 'bold', 'FLOAT', { light: 700, dark: 700 }, { scopes: ['FONT_WEIGHT'] }),
          variable('t', 'gap', 'FLOAT', { light: 1, dark: 1 }, { scopes: ['GAP'] }),
          variable('t', 'radius', 'FLOAT', { light: 1, dark: 1 }, { scopes: ['CORNER_RADIUS'] }),
        ],
      ),
    );

    expect(summary(fixes)).toEqual([['combined', ['GAP', 'CORNER_RADIUS'], 'aliases gap']]);
  });

  it('does not loop on alias cycles', () => {
    const fixes = one(
      variable('p', 'a', 'FLOAT', { 'Mode 1': alias('p', 'b') }),
      variable('p', 'b', 'FLOAT', { 'Mode 1': alias('p', 'a') }),
    );

    expect(fixes.map((fix) => [fix.variable, fix.scopes])).toEqual([
      ['a', SIZE_SCOPES],
      ['b', SIZE_SCOPES],
    ]);
  });

  it('says when the variable still cannot be exported once scoped', () => {
    const fixes = one(
      variable('p', 'opacity/50', 'FLOAT', { 'Mode 1': 0.5 }),
      variable('p', 'label/cta', 'STRING', { 'Mode 1': 'Go' }),
      variable('p', 'style/body', 'STRING', { 'Mode 1': 'Bold' }),
      variable('p', 'gap/m', 'FLOAT', { 'Mode 1': 1 }),
    );

    expect(fixes.map((fix) => [fix.variable, fix.stillBlocked])).toEqual([
      ['opacity/50', 'opacity variables are not supported'],
      ['label/cta', 'string variables need the Font family scope'],
      ['style/body', 'font style strings are not supported; use a number variable with the Font weight scope'],
      ['gap/m', null],
    ]);
  });

  it('lists fixes in Figma order', () => {
    const fixes = inferScopes(
      snapshot(
        [collection('b', ['Mode 1'], ['v:b/y', 'v:b/x']), collection('a', ['Mode 1'])],
        [
          variable('a', 'z', 'FLOAT', { 'Mode 1': 1 }),
          variable('b', 'x', 'FLOAT', { 'Mode 1': 1 }),
          variable('b', 'y', 'FLOAT', { 'Mode 1': 1 }),
        ],
      ),
    );

    expect(fixes.map((fix) => `${fix.collection} ${fix.variable}`)).toEqual(['b y', 'b x', 'a z']);
  });
});
