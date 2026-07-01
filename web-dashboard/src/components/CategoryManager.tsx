'use client'

import { useState } from 'react'

interface Category {
  id: string
  name: string
  color?: string | null
  source?: string | null
}

export function CategoryManager({ initial }: { initial: Category[] }) {
  const [cats, setCats] = useState<Category[]>(initial)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    try {
      const res = await fetch('/api/w/categories', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (res.ok) {
        const row = (await res.json()) as Category
        setCats((c) => [...c.filter((x) => x.id !== row.id), row].sort((a, b) => a.name.localeCompare(b.name)))
        setName('')
      }
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    const res = await fetch(`/api/w/categories/${id}`, { method: 'DELETE' })
    if (res.ok) setCats((c) => c.filter((x) => x.id !== id))
  }

  return (
    <div className="space-y-6">
      <form onSubmit={add} className="flex gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New category (e.g. Deep Work)"
          className="flex-1 bg-[#1E1E1E] border border-white/10 rounded-2xl px-4 py-3 outline-none focus:border-[#C0F67F]"
        />
        <button
          disabled={busy}
          className="bg-[#C0F67F] text-black font-bold rounded-2xl px-6 disabled:opacity-50"
        >
          Add
        </button>
      </form>

      <div className="grid gap-3">
        {cats.length === 0 && <p className="text-zinc-500">No categories yet.</p>}
        {cats.map((c) => (
          <div
            key={c.id}
            className="bg-[#1A1A1A] border border-white/5 rounded-2xl p-4 flex items-center justify-between"
          >
            <div>
              <p className="font-semibold">{c.name}</p>
              <p className="text-xs text-zinc-500">{c.source === 'web' ? 'web' : 'mobile'}</p>
            </div>
            <button onClick={() => remove(c.id)} className="text-[#FF6B6B] text-sm hover:underline">
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
