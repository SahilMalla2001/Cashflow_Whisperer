/** Accept decoded route params and encoded card links without double-decoding names. */
export function resolveCardName(slug: string, names: Array<string | null>): string | null {
  if (names.includes(slug)) return slug;
  try {
    const decoded = decodeURIComponent(slug);
    return names.includes(decoded) ? decoded : null;
  } catch {
    return null;
  }
}
