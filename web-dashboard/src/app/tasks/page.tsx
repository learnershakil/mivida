import { redirect } from 'next/navigation'
import { getWebSessionUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PageShell } from '@/components/PageShell'

export const dynamic = 'force-dynamic'

const STATUS_COLOR: Record<string, string> = {
  completed: 'text-green-400',
  failed: 'text-[#FF6B6B]',
  cancelled: 'text-zinc-500',
  active: 'text-[#4AC3FF]',
  pending: 'text-yellow-400',
}

export default async function TasksPage() {
  const user = await getWebSessionUser()
  if (!user) redirect('/login')
  const tasks = await prisma.task.findMany({
    where: { userId: user.id, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  return (
    <PageShell title="Tasks" subtitle={`${tasks.length} task(s)`}>
      <div className="grid gap-3">
        {tasks.length === 0 && <p className="text-zinc-500">No tasks synced yet.</p>}
        {tasks.map((t) => (
          <div key={t.id} className="bg-[#1A1A1A] border border-white/5 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="font-semibold">{t.title}</p>
              <p className="text-xs text-zinc-500">
                {t.type} · {t.categoryName || 'Uncategorized'}
                {t.contactId ? ' · assigned' : ''}
              </p>
            </div>
            <span className={`text-sm font-semibold ${STATUS_COLOR[t.status ?? 'pending'] ?? 'text-zinc-400'}`}>
              {t.isCompleted ? 'completed' : (t.status ?? 'pending')}
            </span>
          </div>
        ))}
      </div>
    </PageShell>
  )
}
