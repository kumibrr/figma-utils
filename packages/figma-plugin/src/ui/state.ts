import type { BuildResult, ExportError } from '../core/build-export';
import { multipleFiles, singleFile, type ExportFile } from '../core/files';
import { SIZE_SCOPES } from 'css-to-dtcg/scopes';

import type { ScopeFix } from '../core/infer-scopes';
import { NUMBER_SCOPE_REASON, STRING_SCOPE_REASON } from '../core/tokens';
import type { PublishResult, PublishStep } from '../github/publish';
import type { RepoSettings } from '../github/settings';
import type { Destination } from '../shared/messages';

export type Format = 'multiple' | 'single';
export type Build =
  | { status: 'loading' }
  | { status: 'ready'; result: BuildResult; fixes: ScopeFix[] }
  | { status: 'failed'; message: string };
export type Banner = { kind: 'success'; text: string; url: string } | { kind: 'info'; text: string } | { kind: 'error'; text: string };

export const previewFiles = (result: BuildResult, format: Format): ExportFile[] =>
  format === 'single' ? [singleFile(result)] : multipleFiles(result);

/** The file with this path in a freshly built result, or null if it is no longer exported. */
export const freshFile = (result: BuildResult, format: Format, path: string): ExportFile | null =>
  previewFiles(result, format).find((file) => file.path === path) ?? null;

export type Blocker = 'loading' | 'failed' | 'errors' | 'empty' | 'publishing';

export function exportBlocker(build: Build, publishing: boolean): Blocker | null {
  if (publishing) return 'publishing';
  if (build.status === 'loading') return 'loading';
  if (build.status === 'failed') return 'failed';
  if (build.result.errors.length > 0) return 'errors';
  if (build.result.sets.length === 0) return 'empty';
  return null;
}

export type ExportAction =
  | { kind: 'open-settings' }
  | { kind: 'download-zip'; files: ExportFile[] }
  | { kind: 'download-file'; file: ExportFile }
  | { kind: 'publish'; files: ExportFile[] };

export function exportAction(input: {
  destination: Destination;
  format: Format;
  result: BuildResult;
  settings: RepoSettings | null;
  hasToken: boolean;
}): ExportAction {
  if (input.destination === 'github') {
    if (!input.settings || !input.hasToken) {
      return { kind: 'open-settings' };
    }
    return { kind: 'publish', files: multipleFiles(input.result) };
  }
  return input.format === 'single'
    ? { kind: 'download-file', file: singleFile(input.result) }
    : { kind: 'download-zip', files: multipleFiles(input.result) };
}

export function destinationLabel(destination: Destination, format: Format): string {
  if (destination === 'computer') {
    return 'Export to this computer';
  }
  return format === 'single' ? 'Export to GitHub repo (multiple files)' : 'Export to GitHub repo';
}

export const STEP_TEXT: Record<PublishStep, string> = {
  reading: 'Reading repository…',
  committing: 'Committing…',
  branching: 'Creating branch…',
  opening: 'Opening PR…',
};

export const resultBanner = (result: PublishResult): Banner =>
  result.kind === 'opened'
    ? { kind: 'success', text: `PR #${result.number} opened`, url: result.url }
    : { kind: 'info', text: `No changes vs ${result.base}` };

export const errorBanner = (error: unknown): Banner => ({
  kind: 'error',
  text: error instanceof Error ? error.message : String(error),
});

const SCOPE_REASONS = [NUMBER_SCOPE_REASON, STRING_SCOPE_REASON];

/** The errors not already listed as a scope fix, so each problem is shown once. */
export const uncoveredErrors = (errors: ExportError[], fixes: ScopeFix[]): ExportError[] =>
  errors.filter(
    (error) =>
      !SCOPE_REASONS.includes(error.reason) ||
      !fixes.some((fix) => fix.collection === error.collection && fix.variable === error.variable),
  );

/** Figma's own names for the scopes the plugin suggests. */
const SCOPE_TEXT: Record<string, string> = {
  CORNER_RADIUS: 'Corner radius',
  WIDTH_HEIGHT: 'Width and height',
  GAP: 'Gap',
  OPACITY: 'Opacity',
  STROKE_FLOAT: 'Stroke',
  EFFECT_FLOAT: 'Effects',
  FONT_WEIGHT: 'Font weight',
  FONT_SIZE: 'Font size',
  LINE_HEIGHT: 'Line height',
  LETTER_SPACING: 'Letter spacing',
  PARAGRAPH_SPACING: 'Paragraph spacing',
  PARAGRAPH_INDENT: 'Paragraph indent',
  FONT_FAMILY: 'Font family',
  FONT_STYLE: 'Font style',
  TEXT_CONTENT: 'Text content',
};

const scopesText = (scopes: string[]) =>
  scopes.length === SIZE_SCOPES.length && SIZE_SCOPES.every((scope) => scopes.includes(scope))
    ? 'All size scopes'
    : scopes.map((scope) => SCOPE_TEXT[scope] ?? scope).join(', ');

export const fixText = (fix: ScopeFix): string =>
  `${fix.variable} → ${scopesText(fix.scopes)} (${fix.because}${fix.stillBlocked ? "; can't be exported" : ''})`;

export const appliedBanner = (count: number): Banner => ({
  kind: 'info',
  text: `Set the ${count === 1 ? 'scope of 1 variable' : `scopes of ${count} variables`}. Undo in Figma to revert.`,
});

export function groupErrors(errors: ExportError[]): { collection: string; items: string[] }[] {
  const groups = new Map<string, string[]>();
  for (const error of errors) {
    const subject = error.variable
      ? `${error.variable}${error.mode ? ` (${error.mode})` : ''}`
      : error.mode
        ? `(mode ${error.mode})`
        : '(collection)';
    groups.set(error.collection, [...(groups.get(error.collection) ?? []), `${subject} — ${error.reason}`]);
  }
  return [...groups].map(([collection, items]) => ({ collection, items }));
}

export type TokenField = { mode: 'saved' } | { mode: 'entering'; draft: string; canCancel: boolean };

export const initialTokenField = (hasToken: boolean): TokenField =>
  hasToken ? { mode: 'saved' } : { mode: 'entering', draft: '', canCancel: false };

/** Replacing shows an empty field; the saved token stays until a new one is submitted. */
export const startReplace = (): TokenField => ({ mode: 'entering', draft: '', canCancel: true });

export const cancelReplace = (): TokenField => ({ mode: 'saved' });

export const tokenToSave = (field: TokenField): string | null =>
  field.mode === 'entering' && field.draft.trim() !== '' ? field.draft.trim() : null;
