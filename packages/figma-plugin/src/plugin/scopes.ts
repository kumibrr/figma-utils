import type { ScopeChange } from '../shared/messages';

export const canEdit = () => figma.editorType !== 'dev';

/** Sets the scopes of local variables as one undo step. The only place that writes to the file. */
export async function applyScopes(changes: ScopeChange[]): Promise<number> {
  if (!canEdit()) {
    throw new Error('Scopes can only be set in the Figma editor, not in Dev Mode.');
  }

  let count = 0;
  try {
    for (const change of changes) {
      const variable = await figma.variables.getVariableByIdAsync(change.variableId);
      if (!variable || variable.remote) {
        continue;
      }
      variable.scopes = change.scopes as VariableScope[];
      count += 1;
    }
  } finally {
    figma.commitUndo();
  }
  return count;
}
