import type { Banner } from './state';

export function ResultBanner({ banner, onOpen }: { banner: Banner; onOpen: (url: string) => void }) {
  return (
    <div class={`banner banner--${banner.kind}`} role="status">
      <span>{banner.text}</span>
      {banner.kind === 'success' && (
        <button class="link" onClick={() => onOpen(banner.url)}>
          Open
        </button>
      )}
    </div>
  );
}
