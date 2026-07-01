#!/usr/bin/env node
// Generate a scrypt password hash in the format expected by src/lib/auth.ts: scrypt:<saltHex>:<hashHex>.
// Usage: node scripts/hash-password.js '<password>'   → prints the hash
//        const { hashPassword } = require('./scripts/hash-password.js')
const { scryptSync, randomBytes } = require('node:crypto')

const KEYLEN = 64

function hashPassword(password) {
  const salt = randomBytes(16)
  const hash = scryptSync(password, salt, KEYLEN)
  return `scrypt:${salt.toString('hex')}:${hash.toString('hex')}`
}

module.exports = { hashPassword }

if (require.main === module) {
  const pw = process.argv[2]
  if (!pw) {
    console.error("Usage: node scripts/hash-password.js '<password>'")
    process.exit(1)
  }
  console.log(hashPassword(pw))
}
