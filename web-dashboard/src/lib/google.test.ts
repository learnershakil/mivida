import { describe, it, expect, beforeAll } from 'vitest'

describe('google token encryption', () => {
  beforeAll(() => {
    process.env.TOKEN_ENC_KEY = 'test-token-encryption-key-please-change'
  })

  it('round-trips a token through AES-256-GCM', async () => {
    const { encryptToken, decryptToken } = await import('./google')
    const secret = 'ya29.some-access-token-value'
    const enc = encryptToken(secret)
    expect(enc).not.toContain(secret)
    expect(enc.split('.')).toHaveLength(3) // iv.tag.ciphertext
    expect(decryptToken(enc)).toBe(secret)
  })

  it('produces different ciphertext each time (random IV)', async () => {
    const { encryptToken } = await import('./google')
    expect(encryptToken('same')).not.toBe(encryptToken('same'))
  })
})
