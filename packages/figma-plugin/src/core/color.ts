import type { RGBA } from './snapshot';

export function isRgba(value: unknown): value is RGBA {
  return typeof value === 'object' && value !== null
    && 'r' in value && Number.isFinite(value.r)
    && 'g' in value && Number.isFinite(value.g)
    && 'b' in value && Number.isFinite(value.b)
    && 'a' in value && Number.isFinite(value.a);
}

/** One byte, from a Figma 0..1 channel. */
const byte = (channel: number) =>
  Math.round(Math.min(1, Math.max(0, channel)) * 255)
    .toString(16)
    .padStart(2, '0');

/**
 * The only place that knows how a colour is written. Migrating to oklch means
 * changing this function (and its tests) alone.
 */
export function toHex(value: unknown): string | undefined {
  if (!isRgba(value)) return;
  const { r, g, b, a } = value;
  const rgb = `#${byte(r)}${byte(g)}${byte(b)}`;
  const alpha = byte(a);
  return alpha === 'ff' ? rgb : `${rgb}${alpha}`;
}
