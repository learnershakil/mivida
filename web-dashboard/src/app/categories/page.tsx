import { redirect } from 'next/navigation'
import { getWebSessionUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { jsonSafe } from '@/lib/serialize'
import { PageShell } from '@/components/PageShell'
import { CategoryManager } from '@/components/CategoryManager'

export const dynamic = 'force-dynamic'

export default async function CategoriesPage() {
  const user = await getWebSessionUser()
  if (!user) redirect('/login')
  const cats = jsonSafe(
    await prisma.category.findMany({ where: { userId: user.id, deletedAt: null }, orderBy: { name: 'asc' } }),
  )
  return (
    <PageShell title="Categories" subtitle="The master list — categories added here sync to the phone.">
      <CategoryManager initial={cats} />
    </PageShell>
  )
}
