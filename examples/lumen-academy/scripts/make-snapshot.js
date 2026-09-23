/**
 * Simulates what Figma's "Import mode" does with figma/, producing the Snapshot
 * the Export Design Tokens plugin reads. Numbers and colours pass through
 * Math.fround because Figma stores them as 32-bit floats. Web code syntax for
 * font stacks is the manual step the README asks designers to do after import.
 */
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildTokens, serialize } from 'css-to-dtcg';

import config from '../css-to-dtcg.config.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RESOLVED_TYPE = { color: 'COLOR', number: 'FLOAT', string: 'STRING' };

const variableId = (collection, name) => `VariableID:${collection}/${name}`;
const isLeaf = (node) => node !== null && typeof node === 'object' && '$type' in node;

function* leaves(node, path = []) {
  for (const [key, child] of Object.entries(node)) {
    if (key === '$extensions') {
      continue;
    }
    if (isLeaf(child)) {
      yield [[...path, key], child];
    } else if (child && typeof child === 'object') {
      yield* leaves(child, [...path, key]);
    }
  }
}

const quoteFamily = (family) => (/^[A-Za-z_-][\w-]*$/.test(family) ? family : `'${family}'`);

function snapshotValue(token, collection) {
  const alias = token.$extensions?.['com.figma.aliasData'];
  if (alias) {
    return { aliasId: variableId(alias.targetVariableSetName, alias.targetVariableName) };
  }
  if (typeof token.$value === 'string' && /^\{.+\}$/.test(token.$value)) {
    return { aliasId: variableId(collection, token.$value.slice(1, -1).split('.').join('/')) };
  }
  if (token.$type === 'color') {
    const [r, g, b] = token.$value.components.map(Math.fround);
    return { r, g, b, a: Math.fround(token.$value.alpha) };
  }
  if (token.$type === 'number') {
    return Math.fround(token.$value);
  }
  return token.$value;
}

export function makeSnapshot() {
  const figmaFiles = buildTokens(config, { target: 'figma', root }).files;
  const dtcgFiles = buildTokens(config, { target: 'dtcg', root }).files;

  const stacks = new Map();
  for (const file of dtcgFiles) {
    if (file.path === '$themes.json') {
      continue;
    }
    for (const [path, token] of leaves(JSON.parse(file.json))) {
      if (token.$type === 'fontFamily' && Array.isArray(token.$value) && token.$value.length > 1) {
        stacks.set(path.join('.'), token.$value.map(quoteFamily).join(', '));
      }
    }
  }

  const collections = new Map();
  const variables = new Map();

  for (const file of figmaFiles) {
    const segments = file.path.split('/');
    const collectionName = segments.slice(0, -1).join('/');
    const modeName = segments.at(-1).replace(/\.tokens\.json$/, '');

    if (!collections.has(collectionName)) {
      collections.set(collectionName, {
        id: `VariableCollectionId:${collectionName}`,
        name: collectionName,
        modes: [],
        variableIds: [],
      });
    }
    const collection = collections.get(collectionName);
    const modeId = `${collectionName}:${modeName}`;
    collection.modes.push({ id: modeId, name: modeName });

    for (const [path, token] of leaves(JSON.parse(file.json))) {
      const name = path.join('/');
      const id = variableId(collectionName, name);

      if (!variables.has(id)) {
        const web = stacks.get([collectionName.split('/')[0], ...path].join('.'));
        variables.set(id, {
          id,
          name,
          collectionId: collection.id,
          resolvedType: RESOLVED_TYPE[token.$type],
          scopes: token.$extensions['com.figma.scopes'],
          description: '',
          codeSyntax: web ? { WEB: web } : {},
          valuesByMode: {},
        });
        collection.variableIds.push(id);
      }

      variables.get(id).valuesByMode[modeId] = snapshotValue(token, collectionName);
    }
  }

  return {
    fileName: 'Lumen Academy',
    userName: null,
    collections: [...collections.values()],
    variables: [...variables.values()],
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(resolve(root, 'figma-snapshot.json'), serialize(makeSnapshot()));
  console.log('Wrote figma-snapshot.json');
}
