import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import {
  LayoutDashboard, FolderOpen, Plus, Settings, LogOut,
  Factory, Shield, UserCircle, Menu, DollarSign
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const NAV = [
    { to: '/',         label: 'Dashboard',      icon: LayoutDashboard, end: true },
    { to: '/projects', label: 'Projetos',        icon: FolderOpen },
    { to: '/new',      label: 'Novo Orçamento',  icon: Plus },
    { to: '/pricing',  label: 'Tabela de Preços', icon: DollarSign },
    ...(user?.role === 'ADMIN'
      ? [{ to: '/admin', label: 'Administração', icon: Shield }]
      : []),
    { to: '/settings', label: 'Minhas Config.', icon: Settings },
  ]

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const roleLabel: Record<string, string> = {
    ADMIN: 'Administrador', ENGINEER: 'Engenheiro', SALESPERSON: 'Vendedor'
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-60 bg-dark-900 border-r border-slate-800 shrink-0">
        <SidebarContent
          user={user} nav={NAV} roleLabel={roleLabel} onLogout={handleLogout}
        />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="w-64 bg-dark-900 border-r border-slate-800 flex flex-col">
            <SidebarContent
              user={user} nav={NAV} roleLabel={roleLabel}
              onLogout={handleLogout} onNavClick={() => setMobileOpen(false)}
            />
          </div>
          <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile topbar */}
        <header className="lg:hidden flex items-center justify-between px-4 h-14 bg-dark-900 border-b border-slate-800 shrink-0">
          <button onClick={() => setMobileOpen(true)} className="btn-ghost p-2">
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-primary-600 rounded-md flex items-center justify-center">
              <Factory size={12} className="text-white" />
            </div>
            <span className="font-bold text-sm text-white">EUROMOLDES</span>
          </div>
          <div className="w-9" />
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function SidebarContent({ user, nav, roleLabel, onLogout, onNavClick }: any) {
  return (
    <>
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-16 border-b border-slate-800 shrink-0">
        <div className="w-9 h-9 bg-primary-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary-600/30">
          <Factory size={18} className="text-white" />
        </div>
        <div>
          <p className="font-bold text-sm text-white">EUROMOLDES</p>
          <p className="text-[10px] text-slate-500">Mold Enterprise</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {nav.map((item: any) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavClick}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                isActive
                  ? 'bg-primary-600/15 text-primary-300 border border-primary-600/25'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon size={15} className={isActive ? 'text-primary-400' : ''} />
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User footer */}
      <div className="px-3 pb-4 pt-3 border-t border-slate-800 shrink-0 space-y-2">
        <div className="flex items-center gap-3 px-2 py-2">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0 shadow-md"
            style={{ backgroundColor: user?.avatarColor || '#3b82f6' }}
          >
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
            <p className="text-[11px] text-slate-500">{roleLabel[user?.role] || user?.role}</p>
          </div>
        </div>
        <button onClick={onLogout} className="w-full btn-ghost text-sm justify-start text-slate-400 hover:text-red-400 hover:bg-red-500/5">
          <LogOut size={14} />
          Sair do Sistema
        </button>
      </div>
    </>
  )
}
