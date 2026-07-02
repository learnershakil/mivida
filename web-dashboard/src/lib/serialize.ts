// Recursively convert BigInt → number so Prisma rows survive NextResponse.json / JSON.stringify.
export function jsonSafe<T>(value: T): T {
  if (typeof value === 'bigint') return Number(value) as unknown as T
  if (Array.isArray(value)) return value.map(jsonSafe) as unknown as T
  if (value && typeof value === 'object') {
    if (value instanceof Date) return value as T
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = jsonSafe(v)
    return out as T
  }
  return value
}
