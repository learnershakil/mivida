'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/w/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Login failed')
        return
      }
      router.replace('/')
      router.refresh()
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center p-6 font-sans">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm bg-[#141414] p-8 rounded-[32px] border border-white/5 shadow-2xl space-y-5"
      >
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
            mi vida
          </h1>
          <p className="text-zinc-500 text-sm mt-1">Control panel sign-in</p>
        </div>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          className="w-full bg-[#1E1E1E] border border-white/10 rounded-2xl px-4 py-3 text-white outline-none focus:border-[#C0F67F]"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          className="w-full bg-[#1E1E1E] border border-white/10 rounded-2xl px-4 py-3 text-white outline-none focus:border-[#C0F67F]"
          required
        />

        {error && <p className="text-[#FF6B6B] text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#C0F67F] text-black font-bold rounded-2xl py-3 disabled:opacity-50"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
