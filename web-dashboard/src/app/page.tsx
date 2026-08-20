import { prisma } from "@/lib/prisma";
import { getWebSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Nav } from "@/components/Nav";

// Live data + auth-gated; never prerender at build time (would hit the DB).
export const dynamic = "force-dynamic";

export default async function Home() {
  // Gate the control panel behind the web session (ARCHITECTURE §1).
  const session = await getWebSessionUser();
  if (!session) redirect("/login");

  const users = await prisma.user.findMany({
    include: {
      profile: true,
      tasks: true,
      codingLogs: {
        orderBy: { date: 'desc' },
        take: 5
      }
    }
  });

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white p-8 font-sans">
      <div className="max-w-5xl mx-auto"><Nav /></div>
      <header className="mb-12 border-b border-white/10 pb-6 max-w-5xl mx-auto">
        <h1 className="text-4xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
          Mi Vida
        </h1>
        <p className="text-zinc-400 mt-2 text-lg">Central Control Panel</p>
      </header>

      <main className="max-w-6xl mx-auto space-y-8">
        {users.length === 0 ? (
          <div className="bg-[#1A1A1A] p-8 rounded-2xl border border-white/5 text-center">
            <h2 className="text-2xl font-semibold mb-2">No Users Found</h2>
            <p className="text-zinc-400">Please sync from your mobile client to initialize the database.</p>
          </div>
        ) : (
          users.map(user => (
            <div key={user.id} className="bg-[#141414] p-8 rounded-[32px] border border-white/5 shadow-2xl">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-3xl font-bold">{user.name || "Anonymous User"}</h2>
                  <p className="text-zinc-500 text-sm mt-1">ID: {user.id}</p>
                </div>
                <div className="bg-[#C0F67F] text-black px-4 py-2 rounded-full font-bold text-sm">
                  {user.profile?.isAwake ? "Awake" : "Sleeping"}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-[#1E1E1E] p-6 rounded-2xl border border-white/5">
                  <h3 className="text-zinc-400 text-sm font-semibold mb-2">Total Tasks</h3>
                  <p className="text-3xl font-bold text-white">{user.tasks.length}</p>
                </div>
                <div className="bg-[#1E1E1E] p-6 rounded-2xl border border-white/5">
                  <h3 className="text-zinc-400 text-sm font-semibold mb-2">Completed Tasks</h3>
                  <p className="text-3xl font-bold text-green-400">
                    {user.tasks.filter(t => t.isCompleted).length}
                  </p>
                </div>
                <div className="bg-[#1E1E1E] p-6 rounded-2xl border border-white/5">
                  <h3 className="text-zinc-400 text-sm font-semibold mb-2">WakaTime Syncs</h3>
                  <p className="text-3xl font-bold text-blue-400">{user.codingLogs.length}</p>
                </div>
              </div>

              {user.codingLogs.length > 0 && (
                <div>
                  <h3 className="text-xl font-bold mb-4 text-zinc-200">Recent Coding Activity</h3>
                  <div className="space-y-3">
                    {user.codingLogs.map(log => (
                      <div key={log.id} className="bg-[#1A1A1A] p-4 rounded-xl flex justify-between items-center border border-white/5">
                        <div>
                          <p className="font-semibold">{log.project || "Unknown Project"}</p>
                          <p className="text-sm text-zinc-500">{log.language}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-blue-400">
                            {Math.floor(log.duration / 3600)}h {Math.floor((log.duration % 3600) / 60)}m
                          </p>
                          <p className="text-xs text-zinc-500">
                            {new Date(Number(log.date)).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </main>
    </div>
  );
}
