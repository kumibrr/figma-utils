import type { ScopeFix } from '../core/infer-scopes';
import { Spinner } from './icons';
import { fixText } from './state';

type Props = {
  fixes: ScopeFix[];
  /** Variable ids the user unticked; kept by the parent so they survive a refresh. */
  unticked: Set<string>;
  canEdit: boolean;
  applying: boolean;
  onToggle: (variableId: string) => void;
  onApply: (fixes: ScopeFix[]) => void;
};

/** Suggested scopes for variables that block the export, each one ticked until the user says otherwise. */
export function ScopeFixes({ fixes, unticked, canEdit, applying, onToggle, onApply }: Props) {
  const selected = fixes.filter((fix) => !unticked.has(fix.variableId));

  const collections = new Map<string, ScopeFix[]>();
  for (const fix of fixes) {
    collections.set(fix.collection, [...(collections.get(fix.collection) ?? []), fix]);
  }

  return (
    <div class="fixes">
      <p class="fixes__title">
        {fixes.length} {fixes.length === 1 ? 'variable has' : 'variables have'} no scope, so the export is blocked.
      </p>
      <p class="hint">Suggested scopes. Untick any that look wrong and set those in Figma.</p>
      {[...collections].map(([collection, items]) => (
        <section key={collection}>
          <h3 class="fixes__collection">{collection}</h3>
          <ul>
            {items.map((fix) => (
              <li key={fix.variableId}>
                <label class="fixes__item">
                  <input
                    type="checkbox"
                    checked={!unticked.has(fix.variableId)}
                    disabled={!canEdit || applying}
                    onChange={() => onToggle(fix.variableId)}
                  />
                  {fixText(fix)}
                </label>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <div class="fixes__actions">
        <button
          class="button button--primary"
          disabled={!canEdit || applying || selected.length === 0}
          onClick={() => onApply(selected)}
        >
          {applying ? (
            <>
              <Spinner /> Applying…
            </>
          ) : (
            `Apply ${selected.length} ${selected.length === 1 ? 'scope' : 'scopes'}`
          )}
        </button>
      </div>
      {!canEdit && <p class="hint">Dev Mode can't change variables. Open the file in the editor to apply these.</p>}
    </div>
  );
}
