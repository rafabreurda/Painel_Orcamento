import { useEffect, useState } from 'react'
import { History, User, ChevronRight, Clock } from 'lucide-react'
import api from '@/lib/api'

interface HistoryEntry {
  id: string
  version: number
  totalProject: number
  changedBy: string
  notes: string | null
  createdAt: string
}

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'agora mesmo'
  if (m < 60) return `${m}min atrás`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h atrás`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d atrás`
  return new Date(dateStr).toLocaleDateString('pt-BR')
}

export function ProjectHistory({ projectId }: { projectId: string }) {
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/projects/${projectId}/history`)
      .then((r: any) => setEntries(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [projectId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-12">
        <History className="w-10 h-10 text-slate-600 mx-auto mb-3" />
        <p className="text-slate-400 text-sm">Nenhuma revisão registrada ainda.</p>
        <p className="text-slate-500 text-xs mt-1">O histórico é criado automaticamente ao editar o orçamento.</p>
      </div>
    )
  }

  return (
    <div className="space-y-0">
      {entries.map((entry, idx) => (
        <div key={entry.id} className="flex gap-4 group">
          {/* Timeline line + dot */}
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/30
                            flex items-center justify-center flex-shrink-0 mt-1
                            group-hover:border-blue-400 transition-colors">
              <span className="text-blue-400 text-xs font-bold">v{entry.version}</span>
            </div>
            {idx < entries.length - 1 && (
              <div className="w-px flex-1 bg-slate-700/50 mt-1 mb-1" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 pb-5">
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4
                            hover:border-slate-600 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-slate-300 text-sm font-medium">{entry.changedBy}</span>
                  </div>
                  {entry.notes && (
                    <p className="text-slate-400 text-xs mt-1 italic">"{entry.notes}"</p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-blue-400 font-semibold text-sm">
                    {BRL.format(entry.totalProject)}
                  </p>
                  <div className="flex items-center gap-1 text-slate-500 text-xs mt-0.5 justify-end">
                    <Clock className="w-3 h-3" />
                    <span>{timeAgo(entry.createdAt)}</span>
                  </div>
                </div>
              </div>
              <div className="mt-2 text-slate-500 text-xs">
                {new Date(entry.createdAt).toLocaleString('pt-BR')}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
