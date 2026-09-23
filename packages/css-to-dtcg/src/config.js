import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * @typedef {{ name: string, file: string, selector: string }} SetConfig
 * @typedef {{ name: string, declarations: Map<string, string> }} CustomSet
 * @typedef {{
 *   outDir?: string,
 *   figmaOutDir?: string,
 *   sets: SetConfig[],
 *   themes?: Record<string, string[]>,
 *   overrides?: Record<string, string[]>,
 *   path?: (cssName: string, setName: string) => string[],
 *   customSets?: (context: { blocks: (file: string) => import('./parse-css.js').Block[] }) => { sets: CustomSet[], consumes?: string[] },
 * }} Config
 */

const isNonEmptyString = (value) => typeof value === 'string' && value.trim() !== '';

/** @param {string} name */
const unsafeSetName = (name) =>
  name.includes('\\') || name.split('/').some((segment) => segment === '' || segment === '.' || segment === '..');

/**
 * Checks the config's shape only; anything that needs the CSS files is
 * checked while building the model.
 * @param {any} config
 * @returns {string[]}
 */
export function checkConfigShape(config) {
  const errors = [];

  if (!config || !Array.isArray(config.sets) || config.sets.length === 0) {
    return ['config.sets must be a non-empty array'];
  }

  config.sets.forEach((set, index) => {
    for (const key of ['name', 'file', 'selector']) {
      if (!isNonEmptyString(set?.[key])) {
        errors.push(`config.sets[${index}].${key} must be a non-empty string`);
      }
    }
    if (isNonEmptyString(set?.name) && unsafeSetName(set.name)) {
      errors.push(`config.sets[${index}].name "${set.name}" has an empty, "." or ".." segment or a backslash`);
    }
  });

  for (const [group, names] of Object.entries(config.themes ?? {})) {
    if (!Array.isArray(names) || !names.every(isNonEmptyString)) {
      errors.push(`config.themes.${group} must be an array of set names`);
    }
  }

  for (const [name, path] of Object.entries(config.overrides ?? {})) {
    if (!Array.isArray(path) || !path.every(isNonEmptyString)) {
      errors.push(`config.overrides["${name}"] must be an array of strings`);
    }
  }

  if (config.path !== undefined && typeof config.path !== 'function') {
    errors.push('config.path must be a function');
  }
  if (config.customSets !== undefined && typeof config.customSets !== 'function') {
    errors.push('config.customSets must be a function');
  }
  for (const key of ['outDir', 'figmaOutDir']) {
    if (config[key] !== undefined && typeof config[key] !== 'string') {
      errors.push(`config.${key} must be a string`);
    }
  }

  return errors;
}

/**
 * @param {string} configPath
 * @returns {Promise<{ config: Config, root: string }>}
 */
export async function loadConfig(configPath) {
  const absolute = resolve(configPath);

  if (!existsSync(absolute)) {
    throw new Error(`config file not found: ${absolute}`);
  }

  const module = await import(pathToFileURL(absolute).href);
  return { config: module.default, root: dirname(absolute) };
}
