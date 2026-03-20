import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import api from '@/lib/api'
import { BRL, NUM } from '@/lib/utils'
import { Download, ArrowLeft, Edit3, Factory, Loader2, CheckCircle } from 'lucide-react'
import { calculateMoldDimensions } from '@/lib/moldCalc'
import MoldSketch from '@/components/MoldSketch'

interface Project {
  id: string; name: string; clientName: string; status: string
  pieceX: number; pieceY: number; pieceZ: number
  cavities: number; steelType: string; polishLevel: string
  hasDrawers: boolean; drawerCount: number
  riskMargin: number; profitMargin: number; taxRate: number
  totalMaterial: number; totalLabor: number; totalProject: number
  laborBreakdown?: string; imageUrl?: string
  createdAt: string; updatedAt: string
  createdBy: { name: string; email: string }
}

const STATUS_OPTIONS = [
  { value: 'PENDING',       label: 'Pendente' },
  { value: 'IN_PRODUCTION', label: 'Em Produção' },
  { value: 'DELIVERED',     label: 'Entregue' },
  { value: 'CANCELLED',     label: 'Cancelado' },
]

const STATUS_CLS: Record<string, string> = {
  PENDING: 'badge-pending', IN_PRODUCTION: 'badge-production',
  DELIVERED: 'badge-delivered', CANCELLED: 'badge-cancelled',
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [statusSaved, setStatusSaved] = useState(false)

  useEffect(() => {
    api.get(`/projects/${id}`).then(({ data }) => setProject(data)).finally(() => setLoading(false))
  }, [id])

  async function changeStatus(status: string) {
    if (!project) return
    await api.patch(`/projects/${project.id}/status`, { status })
    setProject({ ...project, status })
    setStatusSaved(true)
    setTimeout(() => setStatusSaved(false), 2000)
  }

  async function downloadPDF() {
    if (!project) return
    setExporting(true)
    try {
      const response = await api.get(`/exports/${project.id}/pdf`, { responseType: 'blob' })
      const url = URL.createObjectURL(response.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `orcamento-${project.id.slice(-8)}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-primary-500" size={32} /></div>
  }

  if (!project) {
    return <div className="text-center py-20 text-slate-500">Projeto não encontrado. <Link to="/projects" className="text-primary-400">Voltar</Link></div>
  }

  const labor = project.laborBreakdown ? JSON.parse(project.laborBreakdown) : null
  const plates = calculateMoldDimensions({ x: project.pieceX, y: project.pieceY, z: project.pieceZ }, project.cavities)

  const polishLabels: Record<string, string> = {
    STANDARD: 'Padrão', SEMI_GLOSS: 'Semi-brilho', MIRROR: 'Espelho'
  }

  return (
    <div className="max-w-5xl space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to="/projects" className="btn-ghost p-2">
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white">{project.name}</h1>
            <p className="text-slate-400 text-sm">{project.clientName} · por {project.createdBy.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={downloadPDF} disabled={exporting} className="btn-primary">
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            Exportar PDF
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Left — info */}
        <div className="lg:col-span-2 space-y-4">
          {/* Status */}
          <div className="card flex items-center justify-between gap-4">
            <div>
              <p className="text-xs text-slate-400 mb-1">Status do Projeto</p>
              <span className={`text-sm px-3 py-1 rounded-full font-semibold ${STATUS_CLS[project.status]}`}>
                {STATUS_OPTIONS.find(s => s.value === project.status)?.label}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <select
                className="input w-44 text-sm"
                value={project.status}
                onChange={(e) => changeStatus(e.target.value)}
              >
                {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              {statusSaved && <CheckCircle size={16} className="text-green-400 shrink-0" />}
            </div>
          </div>

          {/* Piece image + sketch */}
          <div className="grid grid-cols-2 gap-4">
            {project.imageUrl ? (
              <div className="card p-0 overflow-hidden h-44">
                <img src={project.imageUrl} className="w-full h-full object-cover" alt="Peça" />
              </div>
            ) : (
              <div className="card flex items-center justify-center h-44 text-slate-600">
                <Factory size={32} className="opacity-30" />
              </div>
            )}
            <div className="card">
              <MoldSketch
                pieceX={project.pieceX} pieceY={project.pieceY} pieceZ={project.pieceZ}
                cavities={project.cavities} plates={plates as any}
              />
            </div>
          </div>

          {/* Specs */}
          <div className="card">
            <h2 className="font-semibold text-white text-sm mb-3">Especificações Técnicas</h2>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              {[
                ['Dimensões da peça', `${NUM.format(project.pieceX)} × ${NUM.format(project.pieceY)} × ${NUM.format(project.pieceZ)} mm`],
                ['Cavidades', project.cavities],
                ['Material', project.steelType === 'S1045' ? 'Aço 1045' : project.steelType === 'P20' ? 'Aço P20' : 'Aço H13'],
                ['Polimento', polishLabels[project.polishLevel]],
                ['Gavetas', project.hasDrawers ? `${project.drawerCount} gaveta(s)` : 'Não'],
                ['Criado em', new Date(project.createdAt).toLocaleDateString('pt-BR')],
              ].map(([label, value]) => (
                <div key={String(label)} className="flex justify-between border-b border-slate-800 py-1.5">
                  <span className="text-slate-400">{label}</span>
                  <span className="text-slate-200 font-medium">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Labor */}
          {labor && (
            <div className="card">
              <h2 className="font-semibold text-white text-sm mb-3">Detalhamento de Mão de Obra</h2>
              <div className="space-y-1.5">
                {[
                  ['Usinagem CNC', labor.machining],
                  ['Eletroerosão / EDM', labor.erosion],
                  ['Bancada / Ajustagem', labor.bench],
                  ['Retífica e Polimento', labor.grinding],
                ].map(([name, l]: any) => (
                  <div key={name} className="flex items-center justify-between py-1.5 border-b border-slate-800 text-sm last:border-0">
                    <span className="text-slate-400">{name}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-slate-500 text-xs">{NUM.format(l.hours)}h</span>
                      <span className="text-slate-200 font-medium w-24 text-right">{BRL.format(l.cost)}</span>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2 font-semibold text-sm">
                  <span className="text-white">Total MO</span>
                  <span className="text-primary-400">{BRL.format(labor.total)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right — financial */}
        <div className="space-y-4">
          <div className="card bg-gradient-to-b from-dark-800 to-dark-900">
            <h2 className="font-semibold text-white text-sm mb-4">Resumo Financeiro</h2>
            <div className="space-y-2.5">
              {[
                { label: 'Materiais', value: project.totalMaterial },
                { label: 'Mão de Obra', value: project.totalLabor },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-slate-400">{label}</span>
                  <span className="text-slate-200">{BRL.format(value ?? 0)}</span>
                </div>
              ))}

              <div className="border-t border-slate-700 pt-2.5 mt-2">
                <div className="flex justify-between text-xl font-bold">
                  <span className="text-white">Total</span>
                  <span className="text-primary-400">{BRL.format(project.totalProject ?? 0)}</span>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Condições de Pagamento</p>
                {[
                  { label: '50% — Assinatura', pct: 0.5 },
                  { label: '30% — 1ª Amostra', pct: 0.3 },
                  { label: '20% — Aprovação', pct: 0.2 },
                ].map(({ label, pct }) => (
                  <div key={label} className="flex justify-between text-sm bg-dark-900 rounded-lg px-3 py-2 border border-slate-800">
                    <span className="text-slate-400">{label}</span>
                    <span className="font-semibold text-primary-400">{BRL.format((project.totalProject ?? 0) * pct)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Margins */}
          <div className="card">
            <h2 className="font-semibold text-white text-sm mb-3">Margens Aplicadas</h2>
            <div className="space-y-1.5 text-sm">
              {[
                ['Risco / Gordura', `${project.riskMargin}%`],
                ['Margem de Lucro', `${project.profitMargin}%`],
                ['Impostos', `${project.taxRate}%`],
              ].map(([l, v]) => (
                <div key={String(l)} className="flex justify-between py-1 border-b border-slate-800 last:border-0">
                  <span className="text-slate-400">{l}</span>
                  <span className="text-slate-200">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
