import { redirect } from 'next/navigation'
import { getWebSessionUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PageShell } from '@/components/PageShell'

export const dynamic = 'force-dynamic'

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`

export default async function FinancePage() {
  const user = await getWebSessionUser()
  if (!user) redirect('/login')
  const logs = await prisma.financeLog.findMany({
    where: { userId: user.id, deletedAt: null },
    orderBy: { transactionDate: 'desc' },
    take: 200,
  })

  // Balance = computed, never stored: sum triggered, non-cancelled transactions.
  let income = 0
  let expense = 0
  for (const l of logs) {
    if (l.isCancelled || !l.isTriggered) continue
    if (l.type === 'INCOME' || l.type === 'credit') income += l.amount
    else expense += l.amount
  }
  const balance = income - expense
  const scheduled = logs.filter((l) => l.isScheduled && !l.isTriggered && !l.isCancelled)

  return (
    <PageShell title="Finance" subtitle="Balance is computed from the ledger, never stored.">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Stat label="Balance" value={inr(balance)} color="text-white" />
        <Stat label="Income" value={inr(income)} color="text-green-400" />
        <Stat label="Expense" value={inr(expense)} color="text-[#FF6B6B]" />
      </div>

      {scheduled.length > 0 && (
        <p className="text-zinc-400 text-sm mb-4">{scheduled.length} scheduled transaction(s) pending trigger.</p>
      )}

      <div className="grid gap-3">
        {logs.length === 0 && <p className="text-zinc-500">No transactions synced yet.</p>}
        {logs.map((l) => {
          const isIncome = l.type === 'INCOME' || l.type === 'credit'
          return (
            <div key={l.id} className="bg-[#1A1A1A] border border-white/5 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold">{l.description || l.category || (isIncome ? 'Income' : 'Expense')}</p>
                <p className="text-xs text-zinc-500">
                  {new Date(Number(l.transactionDate)).toLocaleDateString()}
                  {l.isScheduled && !l.isTriggered ? ' · scheduled' : ''}
                </p>
              </div>
              <span className={`font-bold ${isIncome ? 'text-green-400' : 'text-[#FF6B6B]'}`}>
                {isIncome ? '+' : '−'}
                {inr(l.amount)}
              </span>
            </div>
          )
        })}
      </div>
    </PageShell>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-[#141414] border border-white/5 rounded-2xl p-6">
      <p className="text-zinc-400 text-sm mb-2">{label}</p>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
    </div>
  )
}
