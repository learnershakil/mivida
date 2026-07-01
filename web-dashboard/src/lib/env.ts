// Typed, validated access to server env. Never import this into client components.

function required(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing required env var: ${name}`)
  return v
}

function optional(name: string): string | undefined {
  return process.env[name] || undefined
}

export const env = {
  // DB
  databaseUrl: () => required('DATABASE_URL'),
  databaseCaCert: () => optional('DATABASE_CA_CERT'),

  // Auth
  mobileHttpKey: () => required('MOBILE_HTTP_KEY'),
  sessionSecret: () => required('SESSION_SECRET'),
  webAdminEmail: () => optional('WEB_ADMIN_EMAIL'),
  webAdminPasswordHash: () => optional('WEB_ADMIN_PASSWORD_HASH'),

  // R2 / object storage
  r2Endpoint: () => required('R2_ENDPOINT'),
  r2Bucket: () => required('R2_BUCKET'),
  r2AccessKeyId: () => required('R2_ACCESS_KEY_ID'),
  r2SecretAccessKey: () => required('R2_SECRET_ACCESS_KEY'),

  // Google Calendar OAuth
  googleClientId: () => optional('GOOGLE_CLIENT_ID'),
  googleClientSecret: () => optional('GOOGLE_CLIENT_SECRET'),
  googleRedirectUri: () => optional('GOOGLE_REDIRECT_URI'),
  tokenEncKey: () => optional('TOKEN_ENC_KEY'),

  // WakaTime
  wakatimeApiKey: () => optional('WAKATIME_API_KEY'),
  wakatimeUsername: () => optional('WAKATIME_USERNAME'),
  wakatimePassword: () => optional('WAKATIME_PASSWORD'),

  // Cron
  cronSecret: () => optional('CRON_SECRET'),
}
