// Walks a drizzle SQL/where object collecting interpolated string params, for
// tenant-scope tests that assert which IDs flow into the where-clause.
// Skips drizzle internal back-refs (column.table) to avoid circular traversal.

export function collectStringParams(node: unknown, seen: Set<unknown> = new Set()): string[] {
  if (node === null || node === undefined) return [];
  if (typeof node === "string") return [node];
  if (typeof node !== "object") return [];
  if (seen.has(node)) return [];
  seen.add(node);
  const out: string[] = [];
  const SKIP = new Set(["table", "_", "schema"]);
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    if (SKIP.has(k)) continue;
    if (Array.isArray(v)) {
      for (const item of v) out.push(...collectStringParams(item, seen));
    } else {
      out.push(...collectStringParams(v, seen));
    }
  }
  return out;
}
