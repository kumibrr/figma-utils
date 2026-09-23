import { describe, expect, it } from 'vitest';

import { normalizeSelector, parseBlocks } from '../src/parse-css.js';

describe('parseBlocks', () => {
  it('extracts custom properties from a :root block', () => {
    const blocks = parseBlocks(':root {\n  --gray-100: #f5f5f5;\n  --gray-200: #e6e6e6;\n}');

    expect(blocks).toHaveLength(1);
    expect(blocks[0].selector).toBe(':root');
    expect([...blocks[0].declarations]).toEqual([
      ['--gray-100', '#f5f5f5'],
      ['--gray-200', '#e6e6e6'],
    ]);
    expect(blocks[0].duplicates).toEqual([]);
  });

  it('keeps each selector separate so dark mode stays distinguishable', () => {
    const css = ":root {\n  --primary: #aaa;\n}\n[data-mode='dark'] {\n  --primary: #bbb;\n}";
    const blocks = parseBlocks(css);

    expect(blocks.map((block) => block.selector)).toEqual([':root', "[data-mode='dark']"]);
    expect(blocks[1].declarations.get('--primary')).toBe('#bbb');
  });

  it('ignores blocks with no custom properties, such as utility classes', () => {
    const css = ':root {\n  --font-size-s: 0.875rem;\n}\n.text--s {\n  font-size: var(--font-size-s);\n}';

    expect(parseBlocks(css).map((block) => block.selector)).toEqual([':root']);
  });

  it('strips comments so trailing annotations do not leak into values', () => {
    const css = ':root {\n  /* Default */\n  --font-size-xxs: 0.625rem; /* 10px */\n}';

    expect(parseBlocks(css)[0].declarations.get('--font-size-xxs')).toBe('0.625rem');
  });

  it('ignores plain declarations that are not custom properties', () => {
    const css = ":root {\n  --default-font-family: 'Roboto', sans-serif;\n  font-family: 'Roboto', sans-serif;\n}";

    expect([...parseBlocks(css)[0].declarations.keys()]).toEqual(['--default-font-family']);
  });

  it('reads a last declaration that has no trailing semicolon', () => {
    const blocks = parseBlocks(':root { --a: 1rem; --b: 2rem }');

    expect([...blocks[0].declarations]).toEqual([
      ['--a', '1rem'],
      ['--b', '2rem'],
    ]);
  });

  it('records names declared twice in one block', () => {
    const blocks = parseBlocks(':root { --a: 1rem; --a: 2rem; }');

    expect(blocks[0].duplicates).toEqual(['--a']);
    expect(blocks[0].declarations.get('--a')).toBe('2rem');
  });

  it('normalizes multi-line selector lists', () => {
    const blocks = parseBlocks(":root,\n[data-brand='nova'] { --a: #fff; }");

    expect(blocks[0].selector).toBe(":root, [data-brand='nova']");
  });

  it('fails loudly on nested blocks instead of misreading them', () => {
    const css = '@media (min-width: 40rem) {\n  :root { --a: 1rem; }\n}';

    expect(() => parseBlocks(css)).toThrow(/nested/i);
  });
});

describe('normalizeSelector', () => {
  it('collapses whitespace and formats commas', () => {
    expect(normalizeSelector("  :root ,\n\t[data-brand='nova']  ")).toBe(":root, [data-brand='nova']");
  });
});
