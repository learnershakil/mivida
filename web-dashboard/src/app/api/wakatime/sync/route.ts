import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import * as cheerio from 'cheerio';
import { requireMobileUser, AuthError } from '@/lib/auth';
import { env } from '@/lib/env';

export async function POST(request: NextRequest) {
  try {
    const user = await requireMobileUser(request);

    const wakatimeUsername = env.wakatimeUsername();
    const wakatimeApiKey = env.wakatimeApiKey();

    if (!wakatimeUsername) {
      return NextResponse.json({ error: 'No WakaTime username configured' }, { status: 400 });
    }

    let stats = null;

    // Primary: official WakaTime API with the API KEY (Basic auth = base64 of the key). AUDIT §7 fix:
    // the old code base64-encoded the login password, which WakaTime rejects.
    if (wakatimeApiKey) {
      try {
        const response = await fetch('https://wakatime.com/api/v1/users/current/stats/last_7_days', {
          headers: {
            Authorization: `Basic ${Buffer.from(wakatimeApiKey).toString('base64')}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          stats = {
            duration: data.data.total_seconds,
            languages: data.data.languages.map((l: any) => l.name).join(', '),
            project: data.data.projects[0]?.name || 'Unknown',
          };
        }
      } catch (err) {
        console.warn('WakaTime API failed, falling back to public scrape', err);
      }
    }

    // Fallback: scrape the public profile (fragile — 2FA/layout changes break it).
    if (!stats) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
        const response = await fetch(`https://wakatime.com/@${wakatimeUsername}`, {
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const html = await response.text();
          const $ = cheerio.load(html);

          // This is a simplified extraction since Wakatime's DOM might change
          // Usually, there's a strong/span tag containing "X hrs Y mins"
          const totalTimeText = $('h2').first().text().trim();
          let totalSeconds = 0;

          const hrsMatch = totalTimeText.match(/(\d+)\s*hrs/i);
          const minsMatch = totalTimeText.match(/(\d+)\s*mins/i);

          if (hrsMatch) totalSeconds += parseInt(hrsMatch[1]) * 3600;
          if (minsMatch) totalSeconds += parseInt(minsMatch[1]) * 60;

          stats = {
            duration: totalSeconds,
            languages: 'Scraped (Unknown)',
            project: 'Unknown'
          };
        }
      } catch (err) {
        console.warn('WakaTime scrape failed or timed out:', err);
      }
    }

    if (!stats) {
      // If everything failed, default to 0 so we don't crash
      stats = {
        duration: 0,
        languages: 'Unknown',
        project: 'Unknown'
      };
    }

    // Store the daily coding log. Upsert on the (userId, date, project, language) unique key so repeated
    // syncs update the day's row instead of inserting duplicates (AUDIT §7).
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const now = BigInt(Date.now());

    const log = await prisma.codingLog.upsert({
      where: {
        userId_date_project_language: {
          userId: user.id,
          date: BigInt(today.getTime()),
          project: stats.project,
          language: stats.languages,
        },
      },
      update: { duration: stats.duration, updatedAt: now },
      create: {
        userId: user.id,
        date: BigInt(today.getTime()),
        duration: stats.duration,
        project: stats.project,
        language: stats.languages,
        createdAt: now,
        updatedAt: now,
      },
    });

    // Serialize without BigInt (createdAt/updatedAt are BigInt and would break JSON).
    const logObj = {
      id: log.id,
      date: Number(log.date),
      duration: log.duration,
      project: log.project,
      language: log.language,
    };

    return NextResponse.json({ success: true, data: logObj });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('WakaTime Sync Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
