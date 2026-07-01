'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

const LINKS = [
  { href: '/', label: 'Dashboard' },
  { href: '/tasks', label: 'Tasks' },
  { href: '/finance', label: 'Finance' },
  { href: '/categories', label: 'Categories' },
  { href: '/contacts', label: 'Contacts' },
  { href: '/insights', label: 'Insights' },
]

export function Nav() {
  const pathname = usePathname()
  const router = useRouter()

  async function logout() {
    await fetch('/api/w/auth/logout', { method: 'POST' })
    router.replace('/login')
    router.refresh()
  }

  return (
    <nav className="flex items-center gap-1 flex-wrap mb-10 border-b border-white/10 pb-4">
      <span className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 mr-4">
        mi vida
      </span>
      {LINKS.map((l) => {
        const active = pathname === l.href
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`px-3 py-1.5 rounded-full text-sm ${
              active ? 'bg-[#C0F67F] text-black font-semibold' : 'text-zinc-400 hover:text-white'
            }`}
          >
            {l.label}
          </Link>
        )
      })}
      <button onClick={logout} className="ml-auto px-3 py-1.5 rounded-full text-sm text-zinc-400 hover:text-[#FF6B6B]">
        Sign out
      </button>
    </nav>
  )
}
