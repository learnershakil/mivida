// Full WatermelonDB sync engine (server side). See ARCHITECTURE.md §3.
//
// Design: a DMMF-driven generic mapper converts between device rows (snake_case, numeric millis, JSON
// strings) and Prisma rows (camelCase, BigInt/DateTime/Json). Device columns that don't map to a Prisma
// field are dropped, so schema divergence (settings extras, local file URIs) is handled gracefully.
// Per-table config supplies aliases + append/ledger/vault semantics.
import { Prisma } from '@prisma/client'
import type { PrismaClient } from '@prisma/client'

type TxClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>

// ── field-type map from Prisma DMMF (model → field → scalar type) ─────────────
type ScalarType = 'BigInt' | 'Boolean' | 'Int' | 'Float' | 'String' | 'Json' | 'DateTime' | string
const FIELD_TYPES: Record<string, Record<string, ScalarType>> = {}
for (const model of Prisma.dmmf.datamodel.models) {
  const map: Record<string, ScalarType> = {}
  for (const f of model.fields) {
    if (f.kind === 'scalar') map[f.name] = f.type
  }
  FIELD_TYPES[model.name] = map
}

const MANAGED = new Set(['id', 'userId', 'serverUpdatedAt'])

const snake = (s: string) => s.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase())
const camel = (s: string) => s.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase())

export interface SyncTableConfig {
  table: string // WatermelonDB table name
  model: keyof PrismaClient & string // Prisma delegate name (lowercased model)
  modelName: string // Prisma model name (for DMMF lookup)
  softDelete?: boolean
  append?: boolean // insert-or-ignore, never update (event_logs)
  ledger?: boolean // immutable ledger: keep existing row on conflict (finance_logs)
  aliases?: Record<string, string> // device column → prisma field
  vault?: boolean // ciphertext-only sanitizer
}

// Order matters for FK integrity on push (parents before children).
export const SYNC_TABLES: SyncTableConfig[] = [
  { table: 'users', model: 'profile', modelName: 'Profile' },
  { table: 'settings', model: 'setting', modelName: 'Setting' },
  { table: 'categories', model: 'category', modelName: 'Category', softDelete: true },
  { table: 'contacts', model: 'contact', modelName: 'Contact', softDelete: true },
  {
    table: 'tasks',
    model: 'task',
    modelName: 'Task',
    softDelete: true,
    aliases: { category: 'categoryName' },
  },
  { table: 'finance_logs', model: 'financeLog', modelName: 'FinanceLog', softDelete: true, ledger: true },
  { table: 'mood_logs', model: 'moodLog', modelName: 'MoodLog', softDelete: true },
  {
    table: 'music_tracks',
    model: 'musicTrack',
    modelName: 'MusicTrack',
    aliases: { file_uri: 'localPathHint' },
  },
  { table: 'music_categories', model: 'musicCategory', modelName: 'MusicCategory' },
  { table: 'notification_logs', model: 'notificationLog', modelName: 'NotificationLog' },
  { table: 'vault_media', model: 'vaultItem', modelName: 'VaultItem', softDelete: true, vault: true },
  { table: 'event_logs', model: 'eventLog', modelName: 'EventLog', append: true },
  { table: 'coding_logs', model: 'codingLog', modelName: 'CodingLog', softDelete: true },
]

const byTable = new Map(SYNC_TABLES.map((c) => [c.table, c]))

// ── vault sanitizer: only encrypted content + safe metadata may reach the server ──
// Device vault_media: { media_type, uri, filename, title(enc for notes), content(enc for notes), duration }.
// We map to VaultItem ciphertext columns and DROP plaintext (uri/filename) entirely.
export function sanitizeVaultRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    kind: row.media_type ?? 'note',
    ciphertextRef: typeof row.content === 'string' ? row.content : null, // AES ciphertext for notes
    encTitle: typeof row.title === 'string' ? row.title : null, // encrypted title for notes
    duration: typeof row.duration === 'number' ? row.duration : null,
    createdAt: toBigInt(row.created_at) ?? BigInt(Date.now()),
    updatedAt: toBigInt(row.updated_at) ?? BigInt(Date.now()),
    deletedAt: toBigInt(row.deleted_at),
    // r2Key / encMeta are set by the R2 upload flow, not the sync payload.
  }
}

function toBigInt(v: unknown): bigint | null {
  if (v === null || v === undefined) return null
  return BigInt(v as number)
}

/** Device row (snake, millis, json-strings) → Prisma create/update data (excl. id/userId). */
export function deviceToPrisma(cfg: SyncTableConfig, row: Record<string, unknown>): Record<string, unknown> {
  if (cfg.vault) return sanitizeVaultRow(row)
  const types = FIELD_TYPES[cfg.modelName]
  const data: Record<string, unknown> = {}
  for (const [rawKey, value] of Object.entries(row)) {
    if (rawKey.startsWith('_')) continue // WatermelonDB internal (_status/_changed)
    const field = cfg.aliases?.[rawKey] ?? camel(rawKey)
    if (MANAGED.has(field)) continue
    const t = types[field]
    if (!t) continue // no such Prisma field → drop
    data[field] = convertToPrisma(t, value)
  }
  return data
}

function convertToPrisma(type: ScalarType, value: unknown): unknown {
  if (value === null || value === undefined) return null
  switch (type) {
    case 'BigInt':
      return BigInt(value as number)
    case 'Int':
    case 'Float':
      return Number(value)
    case 'Boolean':
      return Boolean(value)
    case 'Json':
      if (typeof value === 'string') {
        try {
          return JSON.parse(value)
        } catch {
          return value
        }
      }
      return value
    case 'DateTime':
      return null // device never authoritative over server DateTime columns
    default:
      return value
  }
}

/** Prisma record → device row (snake, millis, json-strings) for pull. */
export function prismaToDevice(cfg: SyncTableConfig, rec: Record<string, unknown>): Record<string, unknown> {
  const types = FIELD_TYPES[cfg.modelName]
  const reverseAlias = new Map(Object.entries(cfg.aliases ?? {}).map(([dev, pr]) => [pr, dev]))
  const out: Record<string, unknown> = {}
  for (const [field, value] of Object.entries(rec)) {
    if (field === 'serverUpdatedAt') continue
    const t = types[field]
    if (t === 'DateTime') continue
    const deviceKey = reverseAlias.get(field) ?? snake(field)
    out[deviceKey] = convertToDevice(t, value)
  }
  return out
}

function convertToDevice(type: ScalarType, value: unknown): unknown {
  if (value === null || value === undefined) return null
  if (type === 'BigInt') return Number(value)
  if (type === 'Json') return value === null ? null : JSON.stringify(value)
  return value
}

// ── push: idempotent, atomic (call inside prisma.$transaction) ──
export async function applyPush(
  tx: TxClient,
  userId: string,
  changes: Record<string, { created?: any[]; updated?: any[]; deleted?: string[] }>,
): Promise<void> {
  for (const cfg of SYNC_TABLES) {
    const bucket = changes[cfg.table]
    if (!bucket) continue
    const delegate = (tx as any)[cfg.model]

    const upserts = [...(bucket.created ?? []), ...(bucket.updated ?? [])]
    for (const row of upserts) {
      const data = deviceToPrisma(cfg, row)
      const createData = { id: row.id, userId, ...data }

      if (cfg.append || cfg.ledger) {
        // event_logs: insert-or-ignore (replay-safe). finance: immutable ledger, create-if-absent only.
        await delegate.upsert({ where: { id: row.id }, update: {}, create: createData })
        continue
      }

      // Last-write-wins on updated_at: update only when the incoming row is at least as new as the stored
      // one; create when absent; no-op when the stored row is newer. Idempotent under replay.
      const incomingUpdatedAt = data.updatedAt as bigint | null | undefined
      if (incomingUpdatedAt !== undefined && incomingUpdatedAt !== null) {
        const res = await delegate.updateMany({
          where: { id: row.id, updatedAt: { lte: incomingUpdatedAt } },
          data,
        })
        if (res.count === 0) {
          await delegate.upsert({ where: { id: row.id }, update: {}, create: createData })
        }
      } else {
        await delegate.upsert({ where: { id: row.id }, update: data, create: createData })
      }
    }

    if (cfg.softDelete) {
      for (const id of bucket.deleted ?? []) {
        await delegate.updateMany({ where: { id }, data: { deletedAt: BigInt(Date.now()) } })
      }
    }
  }
}

// ── pull: everything changed server-side since `since` ──
export async function buildPull(
  prisma: TxClient,
  userId: string,
  since: Date,
): Promise<{ changes: Record<string, { created: any[]; updated: any[]; deleted: string[] }>; }> {
  const changes: Record<string, { created: any[]; updated: any[]; deleted: string[] }> = {}
  for (const cfg of SYNC_TABLES) {
    const delegate = (prisma as any)[cfg.model]
    const rows: any[] = await delegate.findMany({
      where: { userId, serverUpdatedAt: { gt: since } },
    })
    const created: any[] = []
    const updated: any[] = []
    const deleted: string[] = []
    for (const rec of rows) {
      if (cfg.softDelete && rec.deletedAt) {
        deleted.push(rec.id)
        continue
      }
      const deviceRow = prismaToDevice(cfg, rec)
      // Bucket by created-vs-updated using createdAt vs since (best-effort; either bucket applies fine).
      const createdAt = rec.createdAt ? Number(rec.createdAt) : 0
      if (createdAt > since.getTime()) created.push(deviceRow)
      else updated.push(deviceRow)
    }
    changes[cfg.table] = { created, updated, deleted }
  }
  return { changes }
}

export function isSyncTable(table: string): boolean {
  return byTable.has(table)
}
