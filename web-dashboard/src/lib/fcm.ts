// FCM push via firebase-admin (server). Credentials from FIREBASE_* env. See ARCHITECTURE §7 (mood pings).
import { initializeApp, cert, getApps, type App } from 'firebase-admin/app'
import { getMessaging } from 'firebase-admin/messaging'
import { prisma } from '@/lib/prisma'

/** Parse a service-account private key from env, tolerating wrapping quotes + escaped newlines. */
function parsePrivateKey(raw: string | undefined): string {
  let k = (raw || '').trim()
  // Strip any stray leading/trailing quote characters (mis-pasted .env values).
  k = k.replace(/^["']+/, '').replace(/["']+$/, '')
  return k.replace(/\\n/g, '\n')
}

let app: App | null = null
function fcmApp(): App {
  if (app) return app
  const existing = getApps()
  if (existing.length) {
    app = existing[0]
    return app
  }
  app = initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: parsePrivateKey(process.env.FIREBASE_PRIVATE_KEY),
    }),
  })
  return app
}

/** Send a notification to explicit tokens. Prunes tokens FCM reports as unregistered. Returns success count. */
export async function sendToTokens(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<number> {
  if (tokens.length === 0) return 0
  const messaging = getMessaging(fcmApp())
  const res = await messaging.sendEachForMulticast({ tokens, notification: { title, body }, data })
  // Prune dead tokens.
  const dead: string[] = []
  res.responses.forEach((r, i) => {
    const code = r.error?.code
    if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-argument') {
      dead.push(tokens[i])
    }
  })
  if (dead.length) await prisma.pushToken.deleteMany({ where: { token: { in: dead } } }).catch(() => {})
  return res.successCount
}

/** Send to all of a user's registered devices. */
export async function sendToUser(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<number> {
  const rows = await prisma.pushToken.findMany({ where: { userId } })
  return sendToTokens(rows.map((r) => r.token), title, body, data)
}
