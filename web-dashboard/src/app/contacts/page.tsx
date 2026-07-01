import { redirect } from 'next/navigation'
import { getWebSessionUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { jsonSafe } from '@/lib/serialize'
import { PageShell } from '@/components/PageShell'
import { ContactManager } from '@/components/ContactManager'

export const dynamic = 'force-dynamic'

export default async function ContactsPage() {
  const user = await getWebSessionUser()
  if (!user) redirect('/login')
  const contacts = jsonSafe(
    await prisma.contact.findMany({ where: { userId: user.id, deletedAt: null }, orderBy: { name: 'asc' } }),
  )
  return (
    <PageShell title="Contacts" subtitle="Assignable people. Added here or on the phone; synced both ways.">
      <ContactManager initial={contacts} />
    </PageShell>
  )
}
