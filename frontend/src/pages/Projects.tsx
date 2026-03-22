import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import api from '@/lib/api'
import { BRL } from '@/lib/utils'
import { Plus, Search, Loader2, ArrowRight, Factory, ChevronLeft, ChevronRight } from 'lucide-react'

interface Project {
  id: string; name: string; clientName: string; status: string
  totalProject: number; cavities: number; steelType: string
  createdAt: string; imageUrl?: string
  createdBy: { name: string }
}

interface PagedResponse {
  projects: Project[]
  total: number
  page: number
  pages: number
  limit: number
}

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  PENDING:       { label: 'Pendente',  cls: 'badge-pending' },
  IN_PRODUCTION: { label: 'Produção',  cls: 'badge-production' },
  DELIVERED:     { label: 'Entregue', cls: 'badge-delivered' },
  CANCELLED:     { label: 'Cancelado', cls: 'badge-cancelled' },
}

export default function Projects() {
  const [data, setData] = useState<PagedResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [searchDebounced, setSearchDebounced] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 350)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => { setPage(1) }, [searchDebounced, statusFilter])

  const load = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: '15' })
    if (searchDebounced) params.set('search', searchDebounced)
    if (statusFilter) params.set('status', statusFilter)
    api.get(`/projects?${params}`)
      .then(({ data }) => setData(data))
      .finally(() => setLoading(false))
  }, [page, searchDebounced, statusFilter])

  useEffect(() => { load() }, [load])

  const projects = data?.projects ?? []

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Projetos</h1>
          <p className="text-slate-400 text-sm mt-1">
            {data ? `${data.total} orçamento${data.total !== 1 ? 's' : ''} cadastrado${data.total !== 1 ? 's' : ''}` : '—'}
          </p>
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
        <select className="input w-44" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Todos os status</option>
          <option value="PENDING">Pendente</option>
          <option value="IN_PRODUCTION">Em Produção</option>
          <option value="DELIVERED">Entregue</option>
          <option value="CANCELLED">Cancelado</option>
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="animate-spin text-primary-500" size={28} />
        </div>
      ) : projects.length === 0 ? (
        <div className="card text-center py-16 text-slate-500">
          <Factory size={40} className="mx-auto mb-3 opacity-30" />
          <p>{search || statusFilter ? 'Nenhum projeto encontrado com esses filtros' : 'Nenhum projeto cadastrado'}</p>
          {!search && !statusFilter && (
            <Link to="/new" className="text-primary-400 text-sm hover:underline mt-2 inline-block">
              Criar primeiro orçamento
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {projects.map((p) => {
            const s = STATUS_MAP[p.status] ?? STATUS_MAP.PENDING
            return (
              <Link key={p.id} to={`/projects/${p.id}`}
                className="card flex items-center gap-4 hover:border-slate-600 transition-colors group">
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

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-slate-500">
            Página {data.page} de {data.pages} · {data.total} registros
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn-ghost p-2 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={15} />
            </button>
            {Array.from({ length: Math.min(5, data.pages) }, (_, i) => {
              const offset = Math.max(0, Math.min(data.pages - 5, page - 3))
              const num = i + 1 + offset
              return (
                <button
                  key={num}
                  onClick={() => setPage(num)}
                  className={`w-8 h-8 rounded-lg text-xs font-medium transition-all ${
                    num === page
                      ? 'bg-primary-600/20 text-primary-300 border border-primary-600/30'
                      : 'text-slate-500 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {num}
                </button>
              )
            })}
            <button
              onClick={() => setPage(p => Math.min(data.pages, p + 1))}
              disabled={page === data.pages}
              className="btn-ghost p-2 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
