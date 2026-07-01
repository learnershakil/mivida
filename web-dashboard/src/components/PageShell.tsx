import { Nav } from '@/components/Nav'

export function PageShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white p-8 font-sans">
      <div className="max-w-5xl mx-auto">
        <Nav />
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="text-zinc-500 mt-1">{subtitle}</p>}
        </header>
        {children}
      </div>
    </div>
  )
}
