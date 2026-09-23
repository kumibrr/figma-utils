import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';

import { zipFiles } from '../src/ui/download';

describe('zipFiles', () => {
  it('puts every file under tokens/', () => {
    const zip = unzipSync(
      zipFiles([
        { path: 'primitives.json', json: '{}\n' },
        { path: 'semantic/theme/light.json', json: '[]\n' },
      ]),
    );

    expect(Object.keys(zip)).toEqual(['tokens/primitives.json', 'tokens/semantic/theme/light.json']);
    expect(strFromU8(zip['tokens/semantic/theme/light.json'])).toBe('[]\n');
  });
});
