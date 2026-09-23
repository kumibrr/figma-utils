import type { RGBA } from './snapshot';

/** One byte, from a Figma 0..1 channel. */
const byte = (channel: number) =>
  Math.round(Math.min(1, Math.max(0, channel)) * 255)
    .toString(16)
    .padStart(2, '0');

/**
 * The only place that knows how a colour is written. Migrating to oklch means
 * changing this function (and its tests) alone.
 */
export function toHex({ r, g, b, a }: RGBA): string {
  const rgb = `#${byte(r)}${byte(g)}${byte(b)}`;
  const alpha = byte(a);
  return alpha === 'ff' ? rgb : `${rgb}${alpha}`;
}
