import { serialize } from 'css-to-dtcg/serialize';

import type { BuildResult } from './build-export';

export type ExportFile = { path: string; json: string };

export function multipleFiles(result: BuildResult): ExportFile[] {
  return [
    ...result.sets.map((set) => ({ path: `${set.name}.json`, json: serialize(set.tree) })),
    { path: '$themes.json', json: serialize(result.themes) },
  ];
}

export function singleFile(result: BuildResult): ExportFile {
  const all: Record<string, unknown> = {};
  for (const set of result.sets) {
    all[set.name] = set.tree;
  }
  all.$themes = result.themes;
  return { path: 'tokens.json', json: serialize(all) };
}
