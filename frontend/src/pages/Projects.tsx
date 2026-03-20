import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '@/lib/api'
import { BRL } from '@/lib/utils'
import { Plus, Search, Loader2, ArrowRight, Factory } from 'lucide-react'

interface Project {
  id: string; name: string; clientName: string; status: string
  totalProject: number; cavities: number; steelType: string
  createdAt: string; imageUrl?: string
  createdBy: { name: string }
}

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  PENDING:       { label: 'Pendente',  cls: 'badge-pending' },
  IN_PRODUCTION: { label: 'Produção',  cls: 'badge-production' },
  DELIVERED:     { label: 'Entregue', cls: 'badge-delivered' },
  CANCELLED:     { label: 'Cancelado', cls: 'badge-cancelled' },
}

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [filtered, setFiltered] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    api.get('/projects').then(({ data }) => {
      setProjects(data)
      setFiltered(data)
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    let list = projects
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(p => p.name.toLowerCase().includes(q) || p.clientName.toLowerCase().includes(q))
    }
    if (statusFilter) list = list.filter(p => p.status === statusFilter)
    setFiltered(list)
  }, [search, statusFilter, projects])

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-primary-500" size={32} /></div>
  }

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Projetos</h1>
          <p className="text-slate-400 text-sm mt-1">{projects.length} orçamentos cadastrados</p>
        </div>
        <Link to="/new" className="btn-primary shrink-0">
          <Plus size={16} />
          Novo
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            className="input pl-8"
            placeholder="Buscar projeto ou cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="input w-40" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Todos status</option>
          <option value="PENDING">Pendente</option>
          <option value="IN_PRODUCTION">Em Produção</option>
          <option value="DELIVERED">Entregue</option>
          <option value="CANCELLED">Cancelado</option>
        </select>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="card text-center py-16 text-slate-500">
          <Factory size={40} className="mx-auto mb-3 opacity-30" />
          <p>Nenhum projeto encontrado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => {
            const s = STATUS_MAP[p.status] ?? STATUS_MAP.PENDING
            return (
              <Link key={p.id} to={`/projects/${p.id}`}
                className="card flex items-center gap-4 hover:border-slate-600 transition-colors group">
                {/* Image or placeholder */}
                <div className="w-12 h-12 rounded-lg bg-dark-900 border border-slate-700 shrink-0 overflow-hidden">
                  {p.imageUrl
                    ? <img src={p.imageUrl} className="w-full h-full object-cover" alt="" />
                    : <div className="w-full h-full flex items-center justify-center"><Factory size={18} className="text-slate-600" /></div>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white text-sm">{p.name}</p>
                  <p className="text-xs text-slate-500">
                    {p.clientName} · {p.cavities}×cav · {p.steelType} · {p.createdBy.name}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.cls}`}>{s.label}</span>
                  <span className="font-bold text-primary-400 text-sm">{BRL.format(p.totalProject ?? 0)}</span>
                  <ArrowRight size={14} className="text-slate-600 group-hover:text-slate-400 transition-colors" />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
