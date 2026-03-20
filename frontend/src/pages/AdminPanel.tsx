import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import {
  Users, UserPlus, Edit2, Trash2, Shield, Wrench, TrendingUp,
  CheckCircle, XCircle, Loader2, X, Eye, EyeOff, Factory
} from 'lucide-react'
import { BRL } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface AdminUser {
  id: string; username: string; name: string; role: string
  isActive: boolean; avatarColor: string; createdAt: string
  _count: { projects: number }
  defaultRiskMargin: number; defaultProfitMargin: number; defaultTaxRate: number
  defaultSteelType: string; defaultPolishLevel: string; defaultCavities: number
}

interface Stats {
  users: number; activeUsers: number
  totalProjects: number; totalValue: number
  byRole: { role: string; count: number }[]
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrador', ENGINEER: 'Engenheiro', SALESPERSON: 'Vendedor'
}
const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'text-primary-400 bg-primary-500/10 border-primary-500/30',
  ENGINEER: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
  SALESPERSON: 'text-green-400 bg-green-500/10 border-green-500/30',
}
const AVATAR_COLORS = [
  '#3b82f6', '#8b5cf6', '#06b6d4', '#10b981',
  '#f59e0b', '#ef4444', '#ec4899', '#14b8a6',
]

function Avatar({ name, color, size = 9 }: { name: string; color: string; size?: number }) {
  return (
    <div
      className={`w-${size} h-${size} rounded-full flex items-center justify-center text-white font-bold shrink-0`}
      style={{ backgroundColor: color, fontSize: size * 1.5 + 'px' }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

export default function AdminPanel() {
  const { user: me } = useAuth()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<'create' | 'edit' | 'config' | null>(null)
  const [selected, setSelected] = useState<AdminUser | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  async function load() {
    const [u, s] = await Promise.all([api.get('/admin/users'), api.get('/admin/stats')])
    setUsers(u.data)
    setStats(s.data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function toggleActive(u: AdminUser) {
    await api.patch(`/admin/users/${u.id}`, { isActive: !u.isActive })
    setUsers(prev => prev.map(x => x.id === u.id ? { ...x, isActive: !u.isActive } : x))
  }

  async function handleDelete(u: AdminUser) {
    if (!confirm(`Remover "${u.name}"? Se tiver projetos, será apenas desativado.`)) return
    setDeleting(u.id)
    await api.delete(`/admin/users/${u.id}`)
    await load()
    setDeleting(null)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-primary-500" size={32} />
    </div>
  )

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield size={22} className="text-primary-400" />
            Painel de Administração
          </h1>
          <p className="text-slate-400 text-sm mt-1">Gerencie usuários e configure o sistema</p>
        </div>
        <button onClick={() => { setSelected(null); setModal('create') }} className="btn-primary">
          <UserPlus size={16} />
          Novo Usuário
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total de Usuários" value={String(stats.users)} icon={Users} color="blue" />
          <StatCard label="Usuários Ativos" value={String(stats.activeUsers)} icon={CheckCircle} color="green" />
          <StatCard label="Projetos no Sistema" value={String(stats.totalProjects)} icon={Factory} color="purple" />
          <StatCard label="Valor Total" value={BRL.format(stats.totalValue)} icon={TrendingUp} color="amber" small />
        </div>
      )}

      {/* Users table */}
      <div className="card space-y-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-white">Membros do Sistema</h2>
          <span className="text-xs text-slate-500">{users.length} usuários</span>
        </div>

        <div className="space-y-2">
          {users.map((u) => (
            <div key={u.id}
              className={cn('flex items-center gap-4 p-3 rounded-xl border transition-all',
                u.isActive
                  ? 'bg-dark-900 border-slate-800 hover:border-slate-700'
                  : 'bg-dark-950 border-slate-800/50 opacity-60'
              )}>
              {/* Avatar */}
              <Avatar name={u.name} color={u.avatarColor} size={10} />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-white text-sm">{u.name}</p>
                  {u.id === me?.id && (
                    <span className="text-[10px] bg-primary-500/20 text-primary-400 border border-primary-500/30 px-1.5 py-0.5 rounded-full">você</span>
                  )}
                </div>
                <p className="text-xs text-slate-500">@{u.username} · {u._count.projects} projeto(s)</p>
              </div>

              {/* Role badge */}
              <span className={cn('text-xs px-2.5 py-1 rounded-full border font-medium hidden sm:block', ROLE_COLORS[u.role])}>
                {ROLE_LABELS[u.role]}
              </span>

              {/* Status */}
              <span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium hidden md:block',
                u.isActive
                  ? 'text-green-400 bg-green-500/10 border-green-500/30'
                  : 'text-slate-500 bg-slate-800 border-slate-700')}>
                {u.isActive ? 'Ativo' : 'Inativo'}
              </span>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => { setSelected(u); setModal('config') }}
                  title="Configurações padrão"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors">
                  <Wrench size={14} />
                </button>
                <button onClick={() => { setSelected(u); setModal('edit') }}
                  title="Editar"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-primary-400 hover:bg-primary-500/10 transition-colors">
                  <Edit2 size={14} />
                </button>
                <button onClick={() => toggleActive(u)}
                  title={u.isActive ? 'Desativar' : 'Ativar'}
                  className={cn('p-1.5 rounded-lg transition-colors',
                    u.isActive
                      ? 'text-slate-400 hover:text-amber-400 hover:bg-amber-500/10'
                      : 'text-slate-500 hover:text-green-400 hover:bg-green-500/10')}>
                  {u.isActive ? <XCircle size={14} /> : <CheckCircle size={14} />}
                </button>
                {u.id !== me?.id && (
                  <button onClick={() => handleDelete(u)}
                    title="Remover"
                    disabled={deleting === u.id}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                    {deleting === u.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modals */}
      {modal === 'create' && (
        <UserModal
          mode="create"
          onClose={() => setModal(null)}
          onSave={async () => { await load(); setModal(null) }}
        />
      )}
      {modal === 'edit' && selected && (
        <UserModal
          mode="edit"
          user={selected}
          onClose={() => setModal(null)}
          onSave={async () => { await load(); setModal(null) }}
        />
      )}
      {modal === 'config' && selected && (
        <UserConfigModal
          user={selected}
          onClose={() => setModal(null)}
          onSave={async () => { await load(); setModal(null) }}
        />
      )}
    </div>
  )
}

/* ─── Modals ─── */

function UserModal({ mode, user, onClose, onSave }: {
  mode: 'create' | 'edit'
  user?: AdminUser
  onClose: () => void
  onSave: () => void
}) {
  const [name, setName] = useState(user?.name ?? '')
  const [username, setUsername] = useState(user?.username ?? '')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState(user?.role ?? 'ENGINEER')
  const [color, setColor] = useState(user?.avatarColor ?? '#3b82f6')
  const [showPass, setShowPass] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    setError('')
    if (!name.trim()) return setError('Nome obrigatório')
    if (mode === 'create' && !username.trim()) return setError('Usuário obrigatório')
    if (mode === 'create' && !password.trim()) return setError('Senha obrigatória')

    setSaving(true)
    try {
      if (mode === 'create') {
        await api.post('/admin/users', { username, name, password, role, avatarColor: color })
      } else {
        const data: any = { name, role, avatarColor: color }
        if (password) data.password = password
        await api.patch(`/admin/users/${user!.id}`, data)
      }
      onSave()
    } catch (e: any) {
      setError(e.response?.data?.error || 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={mode === 'create' ? 'Novo Usuário' : 'Editar Usuário'} onClose={onClose}>
      <div className="space-y-4">
        {/* Preview avatar */}
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-lg"
            style={{ backgroundColor: color }}>
            {(name || '?').charAt(0).toUpperCase()}
          </div>
        </div>

        {/* Cor do avatar */}
        <div>
          <label className="label">Cor do Avatar</label>
          <div className="flex gap-2 flex-wrap">
            {AVATAR_COLORS.map(c => (
              <button key={c} onClick={() => setColor(c)}
                className={cn('w-8 h-8 rounded-lg transition-all', color === c ? 'ring-2 ring-white scale-110' : 'opacity-70 hover:opacity-100')}
                style={{ backgroundColor: c }} />
            ))}
          </div>
        </div>

        <div>
          <label className="label">Nome completo</label>
          <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: João Silva" />
        </div>

        {mode === 'create' && (
          <div>
            <label className="label">Usuário (login)</label>
            <input className="input" value={username} onChange={e => setUsername(e.target.value.toLowerCase())}
              placeholder="ex: joao_silva" />
            <p className="text-[11px] text-slate-500 mt-1">Apenas letras minúsculas, números e _</p>
          </div>
        )}

        <div>
          <label className="label">{mode === 'create' ? 'Senha' : 'Nova Senha (deixe em branco para não alterar)'}</label>
          <div className="relative">
            <input type={showPass ? 'text' : 'password'} className="input pr-10"
              value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••" />
            <button type="button" onClick={() => setShowPass(!showPass)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
              {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>

        <div>
          <label className="label">Nível de Acesso</label>
          <select className="input" value={role} onChange={e => setRole(e.target.value)}>
            <option value="ENGINEER">Engenheiro — Cria e edita projetos</option>
            <option value="SALESPERSON">Vendedor — Visualiza e exporta</option>
            <option value="ADMIN">Administrador — Acesso total</option>
          </select>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="btn-ghost flex-1 justify-center">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 justify-center">
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function UserConfigModal({ user, onClose, onSave }: { user: AdminUser; onClose: () => void; onSave: () => void }) {
  const [config, setConfig] = useState({
    defaultRiskMargin:   user.defaultRiskMargin,
    defaultProfitMargin: user.defaultProfitMargin,
    defaultTaxRate:      user.defaultTaxRate,
    defaultSteelType:    user.defaultSteelType,
    defaultPolishLevel:  user.defaultPolishLevel,
    defaultCavities:     user.defaultCavities,
  })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    await api.patch(`/admin/users/${user.id}`, config)
    onSave()
    setSaving(false)
  }

  return (
    <Modal title={`Configurações de ${user.name}`} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-xs text-slate-400">
          Estes valores serão pré-preenchidos automaticamente quando <strong className="text-white">{user.name}</strong> criar um novo orçamento.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Margem de Risco (%)</label>
            <input type="number" className="input" value={config.defaultRiskMargin}
              onChange={e => setConfig({ ...config, defaultRiskMargin: Number(e.target.value) })} min={0} max={100} />
          </div>
          <div>
            <label className="label">Margem de Lucro (%)</label>
            <input type="number" className="input" value={config.defaultProfitMargin}
              onChange={e => setConfig({ ...config, defaultProfitMargin: Number(e.target.value) })} min={0} max={100} />
          </div>
          <div>
            <label className="label">Impostos (%)</label>
            <input type="number" className="input" value={config.defaultTaxRate}
              onChange={e => setConfig({ ...config, defaultTaxRate: Number(e.target.value) })} min={0} max={100} />
          </div>
          <div>
            <label className="label">Cavidades padrão</label>
            <input type="number" className="input" value={config.defaultCavities}
              onChange={e => setConfig({ ...config, defaultCavities: Number(e.target.value) })} min={1} max={64} />
          </div>
          <div>
            <label className="label">Aço padrão</label>
            <select className="input" value={config.defaultSteelType}
              onChange={e => setConfig({ ...config, defaultSteelType: e.target.value })}>
              <option value="S1045">Aço 1045</option>
              <option value="P20">Aço P20</option>
              <option value="H13">Aço H13</option>
            </select>
          </div>
          <div>
            <label className="label">Polimento padrão</label>
            <select className="input" value={config.defaultPolishLevel}
              onChange={e => setConfig({ ...config, defaultPolishLevel: e.target.value })}>
              <option value="STANDARD">Padrão</option>
              <option value="SEMI_GLOSS">Semi-brilho</option>
              <option value="MIRROR">Espelho</option>
            </select>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="btn-ghost flex-1 justify-center">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 justify-center">
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            Salvar Configurações
          </button>
        </div>
      </div>
    </Modal>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-dark-800 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-white text-lg">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function StatCard({ label, value, icon: Icon, color, small }: {
  label: string; value: string; icon: any; color: string; small?: boolean
}) {
  const cls: Record<string, string> = {
    blue: 'text-blue-400 bg-blue-500/10',
    green: 'text-green-400 bg-green-500/10',
    purple: 'text-purple-400 bg-purple-500/10',
    amber: 'text-amber-400 bg-amber-500/10',
  }
  return (
    <div className="card">
      <div className={`inline-flex p-2.5 rounded-lg ${cls[color]} mb-3`}>
        <Icon size={16} className={cls[color].split(' ')[0]} />
      </div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`font-bold text-white mt-1 ${small ? 'text-base' : 'text-2xl'}`}>{value}</p>
    </div>
  )
}
