import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

// Aiven presents a self-signed CA. Verify it properly when DATABASE_CA_CERT is provided (the secure path);
// otherwise fall back to an UNVERIFIED-but-encrypted TLS connection SCOPED TO THIS POOL ONLY.
//
// This is a deliberate improvement over the previous `process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'`, which
// disabled certificate verification process-wide — including outbound HTTPS to Google, R2, and WakaTime.
// Use the CA only if it's a COMPLETE PEM (guards against a truncated/mis-pasted .env value, which would
// otherwise break TLS entirely). Supports both `\n`-escaped single-line and real multi-line values.
const rawCa = process.env.DATABASE_CA_CERT?.replace(/\\n/g, '\n')
const ca = rawCa && rawCa.includes('BEGIN CERTIFICATE') && rawCa.includes('END CERTIFICATE') ? rawCa : undefined
const ssl = ca ? { ca } : { rejectUnauthorized: false }

// Strip `sslmode` from the URL so our explicit `ssl` config is authoritative — otherwise pg derives its own
// TLS settings from the connection string and rejects Aiven's self-signed CA.
const connectionString = `${process.env.DATABASE_URL}`
  .replace(/([?&])sslmode=[^&]*/i, '$1')
  .replace(/[?&]$/, '')

const pool = new Pool({ connectionString, ssl })
const adapter = new PrismaPg(pool)

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
