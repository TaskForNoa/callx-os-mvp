import Link from 'next/link';
import { useRouter } from 'next/router';
import { ReactNode, useState } from 'react';

const nav = [
  { href: '/', label: 'Dashboard', icon: '📊' },
  { href: '/leads', label: 'Leady', icon: '📞' },
  { href: '/calls', label: 'Połączenia', icon: '📋' },
  { href: '/scenarios', label: 'Scenariusze', icon: '🎬' },
  { href: '/products', label: 'Produkty', icon: '🏷️' },
  { href: '/training', label: 'Trening', icon: '🎓' },
];

export default function Layout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const current = router.pathname;
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-av-blue-bg flex">
      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-av-navy text-white flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-av-orange rounded-lg flex items-center justify-center text-sm font-bold">C</div>
          <span className="font-bold text-sm">CallX OS</span>
        </div>
        <button onClick={() => setMenuOpen(!menuOpen)} className="p-2 rounded-lg hover:bg-white/10">
          {menuOpen ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          )}
        </button>
      </div>

      {/* Mobile menu overlay */}
      {menuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setMenuOpen(false)}>
          <aside className="w-64 bg-av-navy text-white h-full pt-16 flex flex-col" onClick={e => e.stopPropagation()}>
            <nav className="flex-1 p-3 space-y-1">
              {nav.map(n => {
                const active = n.href === '/' ? current === '/' : current.startsWith(n.href);
                return (
                  <Link key={n.href} href={n.href} onClick={() => setMenuOpen(false)}
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
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 bg-av-navy text-white flex-col shrink-0 min-h-screen">
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
      <div className="flex-1 min-h-screen overflow-auto pt-14 md:pt-0">
        {children}
      </div>
    </div>
  );
}
