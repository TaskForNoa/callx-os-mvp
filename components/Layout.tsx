import Link from 'next/link';
import { useRouter } from 'next/router';
import { ReactNode } from 'react';

const nav = [
  { href: '/', label: 'Dashboard', icon: '📊' },
  { href: '/leads', label: 'Leady', icon: '📞' },
  { href: '/calls', label: 'Połączenia', icon: '📋' },
  { href: '/scenarios', label: 'Scenariusze', icon: '🎬' },
  { href: '/products', label: 'Produkty', icon: '🏷️' },
];

export default function Layout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const current = router.pathname;

  return (
    <div className="min-h-screen bg-av-blue-bg flex">
      {/* Sidebar */}
      <aside className="w-56 bg-av-navy text-white flex flex-col shrink-0 min-h-screen">
        <div className="p-5 flex items-center gap-3 border-b border-white/10">
          <div className="w-9 h-9 bg-av-orange rounded-lg flex items-center justify-center text-lg font-bold">C</div>
          <div>
            <div className="text-base font-bold leading-tight">CallX OS</div>
            <div className="text-blue-300 text-[10px]">by Angloville</div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {nav.map(n => {
            const active = n.href === '/' ? current === '/' : current.startsWith(n.href);
            return (
              <Link key={n.href} href={n.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active ? 'bg-white/15 text-white' : 'text-blue-200 hover:bg-white/10 hover:text-white'
                }`}>
                <span className="text-base">{n.icon}</span>
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-white/10">
          <span className="px-2 py-1 bg-green-500/20 text-green-300 rounded-full text-xs font-medium">● Live</span>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-h-screen overflow-auto">
        {children}
      </div>
    </div>
  );
}
