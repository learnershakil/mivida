'use client'

import { useState } from 'react'

interface Contact {
  id: string
  name: string
  email?: string | null
  phone?: string | null
}

export function ContactManager({ initial }: { initial: Contact[] }) {
  const [contacts, setContacts] = useState<Contact[]>(initial)
  const [form, setForm] = useState({ name: '', email: '', phone: '' })
  const [busy, setBusy] = useState(false)

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    setBusy(true)
    try {
      const res = await fetch('/api/w/contacts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        const row = (await res.json()) as Contact
        setContacts((c) => [...c, row].sort((a, b) => a.name.localeCompare(b.name)))
        setForm({ name: '', email: '', phone: '' })
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={add} className="grid gap-3 sm:grid-cols-4">
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Name *"
          className="bg-[#1E1E1E] border border-white/10 rounded-2xl px-4 py-3 outline-none focus:border-[#C0F67F]"
        />
        <input
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          placeholder="Email"
          className="bg-[#1E1E1E] border border-white/10 rounded-2xl px-4 py-3 outline-none focus:border-[#C0F67F]"
        />
        <input
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          placeholder="Phone"
          className="bg-[#1E1E1E] border border-white/10 rounded-2xl px-4 py-3 outline-none focus:border-[#C0F67F]"
        />
        <button disabled={busy} className="bg-[#C0F67F] text-black font-bold rounded-2xl disabled:opacity-50">
          Add
        </button>
      </form>

      <div className="grid gap-3">
        {contacts.length === 0 && <p className="text-zinc-500">No contacts yet.</p>}
        {contacts.map((c) => (
          <div key={c.id} className="bg-[#1A1A1A] border border-white/5 rounded-2xl p-4">
            <p className="font-semibold">{c.name}</p>
            <p className="text-xs text-zinc-500">
              {[c.email, c.phone].filter(Boolean).join(' · ') || '—'}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
