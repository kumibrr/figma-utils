/**
 * Figma stores numbers as 32-bit floats, so a typed 0.2 reads back as
 * 0.20000000298023224. This returns the shortest decimal that maps back to the
 * same stored value — what the designer typed. A value that is not a float32
 * (a full double) is returned untouched, so no typed digit is ever lost.
 */
export function recoverNumber(value: number): number {
  if (!Number.isFinite(value)) {
    return value;
  }

  const isFloat32 = Math.fround(value) === value;

  for (let precision = 1; precision <= 17; precision++) {
    const candidate = Number(value.toPrecision(precision));
    if (isFloat32 ? Math.fround(candidate) === value : candidate === value) {
      return candidate;
    }
  }

  return value;
}
