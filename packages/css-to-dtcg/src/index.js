import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { checkConfigShape } from './config.js';
import { TokenBuildError } from './errors.js';
import { buildModel } from './model.js';
import { toDtcgFiles } from './targets/dtcg.js';
import { toFigmaFiles } from './targets/figma.js';

export { deriveThemes } from './themes.js';
export { serialize } from './serialize.js';
export { TokenBuildError } from './errors.js';

const TARGETS = { dtcg: toDtcgFiles, figma: toFigmaFiles };

/**
 * @param {import('./config.js').Config} config
 * @param {{ target?: 'dtcg' | 'figma', root?: string, readFile?: (file: string) => string }} [options]
 * @returns {{ files: import('./targets/dtcg.js').OutputFile[], importOrder: string[] }}
 */
export function buildTokens(config, { target = 'dtcg', root = process.cwd(), readFile } = {}) {
  const toFiles = TARGETS[target];
  if (!toFiles) {
    throw new TokenBuildError([`unknown target "${target}" (expected dtcg or figma)`]);
  }

  const shapeErrors = checkConfigShape(config);
  if (shapeErrors.length > 0) {
    throw new TokenBuildError(shapeErrors);
  }

  const read = readFile ?? ((file) => readFileSync(resolve(root, file), 'utf8'));
  const model = buildModel(config, { readFile: read });

  return { files: toFiles(model), importOrder: model.importOrder };
}
