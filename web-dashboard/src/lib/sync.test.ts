import { describe, it, expect } from 'vitest'
import { deviceToPrisma, prismaToDevice, sanitizeVaultRow, SYNC_TABLES } from './sync'

const taskCfg = SYNC_TABLES.find((c) => c.table === 'tasks')!
const vaultCfg = SYNC_TABLES.find((c) => c.table === 'vault_media')!

describe('deviceToPrisma (task)', () => {
  const row = {
    id: 't1',
    user_id: 'should-be-ignored',
    title: 'Test',
    category: 'Work', // aliased → categoryName
    type: 'custom',
    is_completed: 1, // numeric → boolean
    completion_percent: 50,
    created_at: 1000,
    updated_at: 2000,
    assigned_persons: '["Alice","Bob"]', // JSON string → array
    some_unknown_column: 'dropped',
    _status: 'created', // internal → dropped
  }
  const data = deviceToPrisma(taskCfg, row) as Record<string, unknown>

  it('aliases category → categoryName', () => {
    expect(data.categoryName).toBe('Work')
    expect(data.category).toBeUndefined()
  })
  it('coerces numeric booleans', () => {
    expect(data.isCompleted).toBe(true)
  })
  it('converts millis to BigInt', () => {
    expect(data.createdAt).toBe(BigInt(1000))
    expect(data.updatedAt).toBe(BigInt(2000))
  })
  it('parses JSON-string columns', () => {
    expect(data.assignedPersons).toEqual(['Alice', 'Bob'])
  })
  it('drops id, user_id, and unknown columns', () => {
    expect(data.id).toBeUndefined()
    expect(data.userId).toBeUndefined()
    expect((data as any).someUnknownColumn).toBeUndefined()
    expect((data as any).some_unknown_column).toBeUndefined()
  })
})

describe('sanitizeVaultRow — NO plaintext leaves the device', () => {
  const row = {
    id: 'v1',
    media_type: 'note',
    uri: '/data/user/0/app/vault/secret.jpg', // plaintext path — must NOT appear
    filename: 'my-secret-photo.jpg', // plaintext — must NOT appear
    title: 'ENC:abc123', // encrypted title
    content: 'ENC:def456', // AES ciphertext
    duration: 12,
    updated_at: 5000,
  }
  const out = sanitizeVaultRow(row) as Record<string, unknown>

  it('keeps only ciphertext + safe metadata', () => {
    expect(out.kind).toBe('note')
    expect(out.ciphertextRef).toBe('ENC:def456')
    expect(out.encTitle).toBe('ENC:abc123')
    expect(out.duration).toBe(12)
  })
  it('never includes uri or filename (plaintext)', () => {
    const serialized = JSON.stringify(out, (_k, v) => (typeof v === 'bigint' ? Number(v) : v))
    expect(serialized).not.toContain('secret.jpg')
    expect(serialized).not.toContain('my-secret-photo')
    expect(out.uri).toBeUndefined()
    expect(out.filename).toBeUndefined()
  })
})

describe('prismaToDevice (task round-trip)', () => {
  const rec = {
    id: 't1',
    userId: 'u1',
    title: 'Test',
    categoryName: 'Work',
    isCompleted: true,
    createdAt: BigInt(1000),
    updatedAt: BigInt(2000),
    assignedPersons: ['Alice'],
    serverUpdatedAt: new Date(),
  }
  const dev = prismaToDevice(taskCfg, rec) as Record<string, unknown>

  it('reverses categoryName → category', () => {
    expect(dev.category).toBe('Work')
  })
  it('BigInt → number, Json → string, drops serverUpdatedAt', () => {
    expect(dev.created_at).toBe(1000)
    expect(dev.assigned_persons).toBe('["Alice"]')
    expect(dev.server_updated_at).toBeUndefined()
  })
})
