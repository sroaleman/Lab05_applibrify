'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AdminNav() {
  const pathname = usePathname();

  const links = [
    { href: '/admin/libros', label: 'Gestión de Libros' },
    { href: '/admin/categorias', label: 'Categorías' },
    { href: '/admin/pedidos', label: 'Órdenes & Pedidos' },
    { href: '/admin/envios', label: 'Envíos Físicos' },
  ];

  return (
    <div className="bg-card rounded-2xl border border-border-paper p-4 shadow-sm mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-leather block">
            Panel de Control
          </span>
          <span className="font-serif text-lg font-bold text-coffee">Administración Librify</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {links.map((link) => {
            const isActive = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-leather text-paper shadow-sm'
                    : 'bg-paper text-coffee hover:bg-border-paper border border-border-paper'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
