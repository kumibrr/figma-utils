import type { ExportError } from '../core/build-export';
import { groupErrors } from './state';

export function ErrorList({ errors }: { errors: ExportError[] }) {
  return (
    <div class="errors" role="alert">
      <p class="errors__title">
        {errors.length} {errors.length === 1 ? 'token' : 'tokens'} can't be exported. Fix them in Figma, then refresh.
      </p>
      {groupErrors(errors).map((group) => (
        <section key={group.collection}>
          <h3 class="errors__collection">{group.collection}</h3>
          <ul>
            {group.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
