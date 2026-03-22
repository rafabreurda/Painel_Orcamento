import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '@/lib/api'
import { BRL } from '@/lib/utils'
import { FolderOpen, Clock, Factory, TrendingUp, Plus, ArrowRight, Loader2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

interface Stats {
  total: number
  pending: number
  inProduction: number
  totalValue: number
}

interface Project {
  id: string
  name: string
  clientName: string
  status: string
  totalProject: number
  cavities: number
  steelType: string
  createdAt: string
}

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  PENDING:       { label: 'Pendente',    cls: 'badge-pending' },
  IN_PRODUCTION: { label: 'Produção',    cls: 'badge-production' },
  DELIVERED:     { label: 'Entregue',    cls: 'badge-delivered' },
  CANCELLED:     { label: 'Cancelado',   cls: 'badge-cancelled' },
}

export default function Dashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState<Stats | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/projects/stats'),
      api.get('/projects?limit=5'),
    ]).then(([s, p]) => {
      setStats(s.data)
      setProjects(p.data.projects ?? p.data.slice?.(0, 5) ?? [])
    }).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-primary-500" size={32} />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">Olá, {user?.name?.split(' ')[0]} — visão geral dos projetos</p>
        </div>
        <Link to="/new" className="btn-primary shrink-0">
          <Plus size={16} />
          Novo Orçamento
        </Link>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={FolderOpen}
          label="Total de Projetos"
          value={String(stats?.total ?? 0)}
          accent="text-blue-400"
          bg="bg-blue-500/10"
        />
        <StatCard
          icon={Clock}
          label="Pendentes"
          value={String(stats?.pending ?? 0)}
          accent="text-amber-400"
          bg="bg-amber-500/10"
        />
        <StatCard
          icon={Factory}
          label="Em Produção"
          value={String(stats?.inProduction ?? 0)}
          accent="text-green-400"
          bg="bg-green-500/10"
        />
        <StatCard
          icon={TrendingUp}
          label="Valor em Orçamentos"
          value={BRL.format(stats?.totalValue ?? 0)}
          accent="text-primary-400"
          bg="bg-primary-500/10"
          small
        />
      </div>

      {/* Recent projects */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-white">Projetos Recentes</h2>
          <Link to="/projects" className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1">
            Ver todos <ArrowRight size={12} />
          </Link>
        </div>

        {projects.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <Factory size={40} className="mx-auto mb-3 opacity-30" />
            <p>Nenhum projeto ainda</p>
            <Link to="/new" className="text-primary-400 text-sm hover:underline mt-2 inline-block">
              Criar primeiro orçamento
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {projects.map((p) => {
              const s = STATUS_MAP[p.status] ?? STATUS_MAP.PENDING
              return (
                <Link
                  key={p.id}
                  to={`/projects/${p.id}`}
                  className="flex items-center justify-between p-3 rounded-lg bg-dark-900 hover:bg-dark-800 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white text-sm truncate">{p.name}</p>
                    <p className="text-xs text-slate-500">{p.clientName} · {p.cavities}x cav · {p.steelType}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.cls}`}>{s.label}</span>
                    <span className="text-sm font-bold text-primary-400">{BRL.format(p.totalProject ?? 0)}</span>
                    <ArrowRight size={14} className="text-slate-600 group-hover:text-slate-400 transition-colors" />
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, accent, bg, small }: {
  icon: any; label: string; value: string; accent: string; bg: string; small?: boolean
}) {
  return (
    <div className="card">
      <div className={`inline-flex p-2.5 rounded-lg ${bg} mb-3`}>
        <Icon size={18} className={accent} />
      </div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`font-bold text-white mt-1 ${small ? 'text-base' : 'text-2xl'}`}>{value}</p>
    </div>
  )
}
