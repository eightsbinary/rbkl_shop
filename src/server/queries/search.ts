import 'server-only';

/** Turn a raw search term into a `%…%` ilike pattern safe to embed in a
 *  PostgREST `or()` filter: strips or() metacharacters (`,()"\`) and escapes
 *  ilike wildcards so input matches literally. Null when nothing searchable. */
export function searchPattern(raw: string): string | null {
  const cleaned = raw
    .trim()
    .replace(/[,()"\\]/g, '')
    .replace(/[%_]/g, (c) => `\\${c}`);
  return cleaned ? `%${cleaned}%` : null;
}
