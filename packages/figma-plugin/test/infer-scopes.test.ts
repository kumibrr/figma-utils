import { SIZE_SCOPES } from 'css-to-dtcg/scopes';
import { describe, expect, it } from 'vitest';

import { inferScopes } from '../src/core/infer-scopes';
import { alias, collection, rgba, snapshot, variable } from './helpers';

const one = (...variables: ReturnType<typeof variable>[]) => inferScopes(snapshot([collection('p', ['Mode 1'])], variables));
const summary = (fixes: ReturnType<typeof inferScopes>) => fixes.map((fix) => [fix.variable, fix.kind, fix.because]);

describe('inferScopes', () => {
  it('only suggests scopes for numbers and strings that have no usable scope', () => {
    expect(
      one(
        variable('p', 'c', 'COLOR', { 'Mode 1': rgba(0, 0, 0) }),
        variable('p', 'gap', 'FLOAT', { 'Mode 1': 1 }, { scopes: ['GAP'] }),
        variable('p', 'bold', 'FLOAT', { 'Mode 1': 700 }, { scopes: ['FONT_WEIGHT'] }),
        variable('p', 'family', 'STRING', { 'Mode 1': 'Inter' }, { scopes: ['FONT_FAMILY'] }),
        variable('p', 'style', 'STRING', { 'Mode 1': 'Bold' }, { scopes: ['FONT_STYLE'] }),
        variable('p', 'flag', 'BOOLEAN', { 'Mode 1': true }),
      ),
    ).toEqual([]);
  });

  it('gives the scopes, collection and variable of each fix', () => {
    expect(one(variable('p', 'size/m', 'FLOAT', { 'Mode 1': 1 }))).toEqual([
      { variableId: 'v:p/size/m', collection: 'p', variable: 'size/m', kind: 'size', scopes: SIZE_SCOPES, because: 'no weight hint' },
    ]);
    expect(one(variable('p', 'weight/bold', 'FLOAT', { 'Mode 1': 700 }, { scopes: [] }))[0].scopes).toEqual(['FONT_WEIGHT']);
    expect(one(variable('p', 'family/body', 'STRING', { 'Mode 1': 'Inter' }))[0].scopes).toEqual(['FONT_FAMILY']);
  });

  it('reads weights from the name, then Web code syntax, then aliases, then values', () => {
    expect(
      summary(
        one(
          variable('p', 'font-weight/body', 'FLOAT', { 'Mode 1': 1 }),
          variable('p', 'text/strong', 'FLOAT', { 'Mode 1': 2 }, { codeSyntax: { WEB: 'var(--weight-strong)' } }),
          variable('p', 'text/title', 'FLOAT', { 'Mode 1': alias('p', 'font-weight/body') }),
          variable('p', 'text/heavy', 'FLOAT', { 'Mode 1': 800 }),
          variable('p', 'text/pad', 'FLOAT', { 'Mode 1': alias('p', 'gap') }),
          variable('p', 'gap', 'FLOAT', { 'Mode 1': 1 }, { scopes: ['GAP'] }),
        ),
      ),
    ).toEqual([
      ['font-weight/body', 'fontWeight', 'name'],
      ['text/strong', 'fontWeight', 'Web code syntax'],
      ['text/title', 'fontWeight', 'aliases font-weight/body'],
      ['text/heavy', 'fontWeight', 'value 800'],
      ['text/pad', 'size', 'aliases gap'],
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

    expect(summary(themed)).toEqual([
      ['a', 'fontWeight', 'value 400'],
      ['b', 'size', 'no weight hint'],
      ['c', 'size', 'no weight hint'],
      ['d', 'size', 'no weight hint'],
    ]);
  });

  it('follows aliases across collections and through other unscoped variables', () => {
    const fixes = inferScopes(
      snapshot(
        [collection('primitives', ['Mode 1']), collection('semantic', ['Mode 1'])],
        [
          variable('primitives', 'weight/bold', 'FLOAT', { 'Mode 1': 700 }),
          variable('semantic', 'title', 'FLOAT', { 'Mode 1': alias('semantic', 'strong') }),
          variable('semantic', 'strong', 'FLOAT', { 'Mode 1': alias('primitives', 'weight/bold') }),
        ],
      ),
    );

    expect(summary(fixes)).toEqual([
      ['weight/bold', 'fontWeight', 'name'],
      ['title', 'fontWeight', 'aliases strong'],
      ['strong', 'fontWeight', 'aliases weight/bold'],
    ]);
  });

  it('makes no suggestion when the modes alias different kinds', () => {
    const fixes = inferScopes(
      snapshot(
        [collection('t', ['light', 'dark'])],
        [
          variable('t', 'mixed', 'FLOAT', { light: alias('t', 'bold'), dark: alias('t', 'gap') }),
          variable('t', 'bold', 'FLOAT', { light: 700, dark: 700 }, { scopes: ['FONT_WEIGHT'] }),
          variable('t', 'gap', 'FLOAT', { light: 1, dark: 1 }, { scopes: ['GAP'] }),
        ],
      ),
    );

    expect(fixes).toEqual([]);
  });

  it('does not loop on alias cycles', () => {
    const fixes = one(
      variable('p', 'a', 'FLOAT', { 'Mode 1': alias('p', 'b') }),
      variable('p', 'b', 'FLOAT', { 'Mode 1': alias('p', 'a') }),
    );

    expect(fixes.map((fix) => [fix.variable, fix.kind])).toEqual([
      ['a', 'size'],
      ['b', 'size'],
    ]);
  });

  it('suggests Font family only when something says the string is a font', () => {
    expect(
      summary(
        one(
          variable('p', 'family/body', 'STRING', { 'Mode 1': 'Inter' }),
          variable('p', 'font/mono', 'STRING', { 'Mode 1': 'Menlo' }, { scopes: [] }),
          variable('p', 'text/display', 'STRING', { 'Mode 1': 'Fraunces' }, { codeSyntax: { WEB: 'Fraunces, serif' } }),
          variable('p', 'text/heading', 'STRING', { 'Mode 1': alias('p', 'family/body') }),
          variable('p', 'label', 'STRING', { 'Mode 1': 'Hello' }),
          variable('p', 'label/copy', 'STRING', { 'Mode 1': alias('p', 'label') }),
        ),
      ),
    ).toEqual([
      ['family/body', 'fontFamily', 'name'],
      ['font/mono', 'fontFamily', 'name'],
      ['text/display', 'fontFamily', 'Web code syntax'],
      ['text/heading', 'fontFamily', 'aliases family/body'],
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
