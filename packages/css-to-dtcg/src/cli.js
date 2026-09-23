import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { loadConfig } from './config.js';
import { buildTokens, TokenBuildError } from './index.js';

const USAGE = 'Usage: css-to-dtcg [--config css-to-dtcg.config.js] [--target dtcg|figma]';

/**
 * @param {string[]} argv
 * @param {{ log?: (text: string) => void, error?: (text: string) => void }} [io]
 * @returns {Promise<number>} exit code
 */
export async function run(argv, { log = console.log, error = console.error } = {}) {
  let values;
  try {
    ({ values } = parseArgs({
      args: argv,
      options: {
        config: { type: 'string', default: 'css-to-dtcg.config.js' },
        target: { type: 'string', default: 'dtcg' },
      },
    }));
  } catch (problem) {
    error(`${problem.message}\n${USAGE}`);
    return 1;
  }

  try {
    const { config, root } = await loadConfig(values.config);
    const target = /** @type {'dtcg' | 'figma'} */ (values.target);
    const { files, importOrder } = buildTokens(config, { target, root });

    const outDir = resolve(root, target === 'figma' ? (config.figmaOutDir ?? 'figma') : (config.outDir ?? 'tokens'));
    const fromRoot = relative(root, outDir);
    if (fromRoot === '' || fromRoot.startsWith('..') || isAbsolute(fromRoot)) {
      throw new TokenBuildError([`output directory ${outDir} must be inside ${root} and not the project root itself`]);
    }

    rmSync(outDir, { recursive: true, force: true });
    for (const file of files) {
      const destination = resolve(outDir, file.path);
      mkdirSync(dirname(destination), { recursive: true });
      writeFileSync(destination, file.json);
    }

    log(`Wrote ${files.length} files to ${relative(process.cwd(), outDir) || '.'}`);
    if (target === 'figma') {
      log(`Import collections in this order: ${importOrder.join(', ')}`);
    }
    return 0;
  } catch (problem) {
    if (problem instanceof TokenBuildError || problem.message?.startsWith('config file not found')) {
      error(problem.message);
      return 1;
    }
    throw problem;
  }
}
