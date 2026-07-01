import { redirect } from 'next/navigation'
import { getWebSessionUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PageShell } from '@/components/PageShell'

export const dynamic = 'force-dynamic'

const fmtDuration = (ms: number) => {
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export default async function InsightsPage() {
  const user = await getWebSessionUser()
  if (!user) redirect('/login')

  const [tasks, moods, finance, focus, coding] = await Promise.all([
    prisma.task.findMany({ where: { userId: user.id, deletedAt: null } }),
    prisma.moodLog.findMany({ where: { userId: user.id, deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 30 }),
    prisma.financeLog.findMany({ where: { userId: user.id, deletedAt: null, isTriggered: true, isCancelled: false } }),
    prisma.focusSession.findMany({ where: { userId: user.id, kind: 'focus' } }),
    prisma.codingLog.findMany({ where: { userId: user.id } }),
  ])

  // Task Velocity — avg (completedAt - createdAt) by category, slowest first.
  const byCat = new Map<string, number[]>()
  for (const t of tasks) {
    if (t.completedAt == null) continue
    const dur = Number(t.completedAt) - Number(t.createdAt)
    if (dur < 0) continue
    const cat = t.categoryName || 'Uncategorized'
    byCat.set(cat, [...(byCat.get(cat) ?? []), dur])
  }
  const velocity = [...byCat.entries()]
    .map(([category, ds]) => ({ category, avgMs: ds.reduce((a, b) => a + b, 0) / ds.length, count: ds.length }))
    .sort((a, b) => b.avgMs - a.avgMs)

  // Burn Rate — total spend / focus hours.
  const spend = finance.filter((f) => f.type === 'EXPENSE' || f.type === 'debit').reduce((a, f) => a + f.amount, 0)
  const focusMs = focus.reduce((a, f) => a + (f.startedAt && f.endedAt ? Number(f.endedAt) - Number(f.startedAt) : 0), 0)
  const focusHours = focusMs / 3_600_000
  const perHour = focusHours > 0 ? spend / focusHours : null

  // Mood
  const moodAvg = moods.length ? moods.reduce((a, m) => a + m.moodValue, 0) / moods.length : null

  // Coding (WakaTime) last 7 days
  const weekAgo = Date.now() - 7 * 86_400_000
  const codingSec = coding.filter((c) => Number(c.date) >= weekAgo).reduce((a, c) => a + c.duration, 0)

  return (
    <PageShell title="Insights" subtitle="Computed from your synced data.">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="Burn Rate (cost per focus hour)">
          {perHour == null ? (
            <Empty note="Needs focus sessions + spend" />
          ) : (
            <p className="text-3xl font-bold">
              ₹{perHour.toFixed(0)}
              <span className="text-base text-zinc-500"> /focus-hr</span>
            </p>
          )}
          <p className="text-xs text-zinc-500 mt-2">₹{spend.toLocaleString('en-IN')} spend · {fmtDuration(focusMs)} focus</p>
        </Card>

        <Card title="Mood (recent average)">
          {moodAvg == null ? <Empty note="No mood logs yet" /> : (
            <p className="text-3xl font-bold">{moodAvg.toFixed(1)}<span className="text-base text-zinc-500"> / 5</span></p>
          )}
          <p className="text-xs text-zinc-500 mt-2">{moods.length} recent entries</p>
        </Card>

        <Card title="Coding (last 7 days)">
          <p className="text-3xl font-bold">{fmtDuration(codingSec * 1000)}</p>
          <p className="text-xs text-zinc-500 mt-2">via WakaTime</p>
        </Card>

        <Card title="Task Velocity (slowest categories)">
          {velocity.length === 0 ? <Empty note="No completed tasks yet" /> : (
            <div className="space-y-2">
              {velocity.slice(0, 5).map((v) => (
                <div key={v.category} className="flex justify-between text-sm">
                  <span className="text-zinc-300">{v.category}</span>
                  <span className="text-zinc-500">{fmtDuration(v.avgMs)} · {v.count}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </PageShell>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#141414] border border-white/5 rounded-[24px] p-6">
      <h3 className="text-zinc-400 text-sm font-semibold mb-3">{title}</h3>
      {children}
    </div>
  )
}
function Empty({ note }: { note: string }) {
  return <p className="text-zinc-600 text-sm italic">{note}</p>
}
