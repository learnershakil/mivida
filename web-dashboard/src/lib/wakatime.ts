import * as cheerio from 'cheerio'
import type { PrismaClient } from '@prisma/client'
import { env } from '@/lib/env'

export interface WakatimeStats {
  duration: number
  languages: string
  project: string
}

/**
 * Fetch WakaTime stats (API key primary, public-profile scrape fallback) and upsert today's CodingLog.
 * Reusable by /api/wakatime/sync (on-demand) and the cron. Returns the stats, or null if unconfigured.
 */
export async function fetchAndStoreWakatime(
  db: Pick<PrismaClient, 'codingLog'>,
  userId: string,
): Promise<WakatimeStats | null> {
  const username = env.wakatimeUsername()
  const apiKey = env.wakatimeApiKey()
  if (!username) return null

  let stats: WakatimeStats | null = null

  // Primary: official API with the API key (Basic auth = base64 of the key).
  if (apiKey) {
    try {
      const res = await fetch('https://wakatime.com/api/v1/users/current/stats/last_7_days', {
        headers: { Authorization: `Basic ${Buffer.from(apiKey).toString('base64')}` },
      })
      if (res.ok) {
        const data = await res.json()
        stats = {
          duration: data.data.total_seconds,
          languages: data.data.languages.map((l: { name: string }) => l.name).join(', '),
          project: data.data.projects[0]?.name || 'Unknown',
        }
      }
    } catch (err) {
      console.warn('[wakatime] API failed, falling back to scrape', err)
    }
  }

  // Fallback: scrape the public profile (fragile).
  if (!stats) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)
      const res = await fetch(`https://wakatime.com/@${username}`, { signal: controller.signal })
      clearTimeout(timeout)
      if (res.ok) {
        const $ = cheerio.load(await res.text())
        const text = $('h2').first().text().trim()
        let seconds = 0
        const hrs = text.match(/(\d+)\s*hrs/i)
        const mins = text.match(/(\d+)\s*mins/i)
        if (hrs) seconds += parseInt(hrs[1]) * 3600
        if (mins) seconds += parseInt(mins[1]) * 60
        stats = { duration: seconds, languages: 'Scraped (Unknown)', project: 'Unknown' }
      }
    } catch (err) {
      console.warn('[wakatime] scrape failed', err)
    }
  }

  if (!stats) stats = { duration: 0, languages: 'Unknown', project: 'Unknown' }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const now = BigInt(Date.now())
  await db.codingLog.upsert({
    where: {
      userId_date_project_language: {
        userId,
        date: BigInt(today.getTime()),
        project: stats.project,
        language: stats.languages,
      },
    },
    update: { duration: stats.duration, updatedAt: now },
    create: {
      userId,
      date: BigInt(today.getTime()),
      duration: stats.duration,
      project: stats.project,
      language: stats.languages,
      createdAt: now,
      updatedAt: now,
    },
  })

  return stats
}
