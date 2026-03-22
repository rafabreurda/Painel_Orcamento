import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import api from '@/lib/api'
import { BRL, NUM } from '@/lib/utils'
import { Download, ArrowLeft, Factory, Loader2, CheckCircle, Trash2, Box, Layers, Pencil, History } from 'lucide-react'
import { ProjectHistory } from '@/components/ProjectHistory'
import { calculateMoldDimensions } from '@/lib/moldCalc'
import MoldDiagram from '@/components/MoldDiagram'
import { lazy, Suspense } from 'react'
import { useToast } from '@/hooks/useToast'
const MoldViewer3D = lazy(() => import('@/components/MoldViewer3D'))

interface Project {
  id: string; name: string; clientName: string; status: string
  pieceX: number; pieceY: number; pieceZ: number
  cavities: number; steelType: string; polishLevel: string
  hasDrawers: boolean; drawerCount: number
  heatTreatment: string; surfaceTexture: string
  injectionType: string; nozzleCount: number
  riskMargin: number; profitMargin: number; taxRate: number
  totalMaterial: number; totalLabor: number; totalProject: number
  laborBreakdown?: string; imageUrl?: string
  createdAt: string; updatedAt: string
  createdBy: { name: string; username: string }
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
  const { toast } = useToast()
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [statusSaving, setStatusSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [view, setView] = useState<'diagram' | '3d'>('diagram')
  const [paymentTerms, setPaymentTerms] = useState<Array<{ label: string; pct: number }>>([
    { label: '40% — Assinatura', pct: 0.4 },
    { label: '30% — 1ª Amostra (T1)', pct: 0.3 },
    { label: '30% — Entrega Final', pct: 0.3 },
  ])

  useEffect(() => {
    api.get(`/projects/${id}`).then(({ data }) => setProject(data)).finally(() => setLoading(false))
    api.get('/config/PAYMENT_TERMS').then(({ data }) => {
      if (Array.isArray(data.value) && data.value.length > 0) setPaymentTerms(data.value)
    }).catch(() => {/* use defaults */})
  }, [id])

  async function changeStatus(status: string) {
    if (!project) return
    setStatusSaving(true)
    try {
      await api.patch(`/projects/${project.id}/status`, { status })
      setProject({ ...project, status })
      const label = STATUS_OPTIONS.find(s => s.value === status)?.label ?? status
      toast('success', `Status atualizado`, `Projeto marcado como "${label}"`)
    } catch {
      toast('error', 'Erro ao atualizar status', 'Tente novamente.')
    } finally {
      setStatusSaving(false)
    }
  }

  async function downloadPDF() {
    if (!project) return
    setExporting(true)
    try {
      const response = await api.get(`/exports/${project.id}/pdf`, { responseType: 'blob' })
      const url = URL.createObjectURL(response.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `proposta-${project.clientName.toLowerCase().replace(/\s+/g, '-')}-${project.id.slice(-6)}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      toast('success', 'PDF gerado com sucesso', `Proposta para ${project.clientName}`)
    } catch {
      toast('error', 'Erro ao gerar PDF', 'Verifique sua conexão e tente novamente.')
    } finally {
      setExporting(false)
    }
  }

  async function handleDelete() {
    if (!project) return
    setDeleting(true)
    try {
      await api.delete(`/projects/${project.id}`)
      toast('success', 'Projeto excluído')
      navigate('/projects')
    } catch {
      toast('error', 'Erro ao excluir projeto')
      setDeleting(false)
      setConfirmDelete(false)
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
  const heatLabels: Record<string, string> = {
    NONE: 'Sem tratamento', NITRIDE: 'Nitretação',
    QUENCH_TEMPER: 'Têmpera + Revenido', THROUGH_HARDEN: 'Endurecimento Total',
  }
  const textureLabels: Record<string, string> = {
    POLISHED: 'Polida', TEXTURED_VDI12: 'Textura VDI-12', TEXTURED_VDI18: 'Textura VDI-18',
    TEXTURED_VDI24: 'Textura VDI-24', SANDBLASTED: 'Jateada',
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
          <button
            onClick={() => setConfirmDelete(true)}
            className="btn-ghost p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10"
            title="Excluir projeto"
          >
            <Trash2 size={15} />
          </button>
          <Link
            to={`/projects/${project.id}/edit`}
            className="btn-ghost flex items-center gap-2 text-sm text-slate-300"
          >
            <Pencil size={14} />
            Editar
          </Link>
          <button onClick={downloadPDF} disabled={exporting} className="btn-primary">
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            Exportar PDF
          </button>
        </div>
      </div>

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="card border border-red-500/40 bg-red-500/5">
          <p className="text-white text-sm font-medium mb-3">Tem certeza que deseja excluir este projeto?</p>
          <p className="text-slate-400 text-xs mb-3">Esta ação não pode ser desfeita. Todos os dados do orçamento serão perdidos.</p>
          <div className="flex gap-2">
            <button onClick={handleDelete} disabled={deleting} className="btn-primary bg-red-600 hover:bg-red-500 border-red-600">
              {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              Excluir permanentemente
            </button>
            <button onClick={() => setConfirmDelete(false)} className="btn-ghost">Cancelar</button>
          </div>
        </div>
      )}

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
                disabled={statusSaving}
              >
                {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              {statusSaving && <Loader2 size={14} className="animate-spin text-primary-400 shrink-0" />}
            </div>
          </div>

          {/* Viewer switcher */}
          <div className="flex items-center gap-2">
            <div className="flex bg-dark-900 rounded-xl p-1 border border-slate-800 gap-1 flex-1">
              {([
                { id: '3d',      label: 'Viewer 3D',      icon: Box },
                { id: 'diagram', label: 'Vista Explodida', icon: Layers },
              ] as const).map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => setView(id)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
                    view === id
                      ? 'bg-primary-600/20 text-primary-300 border border-primary-600/30'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}>
                  <Icon size={13} />
                  {label}
                </button>
              ))}
            </div>
            {project.imageUrl && (
              <div className="card p-0 overflow-hidden w-16 h-11 shrink-0">
                <img src={project.imageUrl} className="w-full h-full object-cover" alt="Peça" />
              </div>
            )}
          </div>

          {/* 3D Viewer */}
          {view === '3d' && (
            <Suspense fallback={<div className="flex items-center justify-center h-64 text-slate-400 text-sm"><span className="animate-pulse">Carregando viewer 3D...</span></div>}>
            <MoldViewer3D
              plates={plates as any}
              pieceX={project.pieceX} pieceY={project.pieceY} pieceZ={project.pieceZ}
              cavities={project.cavities}
              steelType={project.steelType}
              calculation={{
                totalProject: project.totalProject,
                totalMaterial: project.totalMaterial,
                totalLabor: project.totalLabor,
              }}
              projectName={project.name}
            />
            </Suspense>
          )}

          {/* Vista Explodida */}
          {view === 'diagram' && (
            <div className="card p-0 overflow-hidden">
              <MoldDiagram
                plates={plates as any}
                pieceX={project.pieceX}
                pieceY={project.pieceY}
                pieceZ={project.pieceZ}
                cavities={project.cavities}
                steelType={project.steelType}
                projectName={project.name}
              />
            </div>
          )}

          {/* Specs */}
          <div className="card">
            <h2 className="font-semibold text-white text-sm mb-3">Especificações Técnicas</h2>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              {[
                ['Dimensões da peça', `${NUM.format(project.pieceX)} × ${NUM.format(project.pieceY)} × ${NUM.format(project.pieceZ)} mm`],
                ['Cavidades', project.cavities],
                ['Material', project.steelType === 'S1045' ? 'Aço 1045' : project.steelType === 'P20' ? 'Aço P20' : 'Aço H13'],
                ['Polimento', polishLabels[project.polishLevel] ?? project.polishLevel],
                ['Tratamento Térmico', heatLabels[project.heatTreatment] ?? project.heatTreatment],
                ['Textura Superficial', textureLabels[project.surfaceTexture] ?? project.surfaceTexture],
                ['Tipo de Injeção', project.injectionType === 'camera_quente' ? `Câmara Quente (${project.nozzleCount} bicos)` : 'Canal Frio'],
                ['Gavetas', project.hasDrawers ? `${project.drawerCount} gaveta(s)` : 'Não'],
                ['Criado em', new Date(project.createdAt).toLocaleDateString('pt-BR')],
                ['Atualizado em', new Date(project.updatedAt).toLocaleDateString('pt-BR')],
                ['Largura placa', `${Math.round(plates.topPlate.width)} mm`],
                ['Comprimento placa', `${Math.round(plates.topPlate.length)} mm`],
              ].map(([label, value]) => (
                <div key={String(label)} className="flex justify-between border-b border-slate-800/60 py-1.5">
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
              <div className="space-y-1">
                {[
                  ['Usinagem CNC', labor.machining],
                  ['Eletroerosão / EDM', labor.erosion],
                  ['Bancada / Ajustagem', labor.bench],
                  ['Retífica e Polimento', labor.grinding],
                ].map(([name, l]: any) => (
                  <div key={name} className="flex items-center justify-between py-1.5 border-b border-slate-800/60 text-sm last:border-0">
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
                {paymentTerms.map(({ label, pct }) => (
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
            <div className="space-y-1 text-sm">
              {[
                ['Risco / Gordura', `${project.riskMargin}%`],
                ['Margem de Lucro', `${project.profitMargin}%`],
                ['Impostos', `${project.taxRate}%`],
              ].map(([l, v]) => (
                <div key={String(l)} className="flex justify-between py-1 border-b border-slate-800/60 last:border-0">
                  <span className="text-slate-400">{l}</span>
                  <span className="text-slate-200">{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Plate dimensions quick ref */}
          <div className="card">
            <h2 className="font-semibold text-white text-sm mb-3">Dimensionamento (Estimado)</h2>
            <div className="space-y-1 text-xs">
              {[
                ['Placa Superior', `${Math.round(plates.topPlate.height)}mm · 1045`],
                ['Cavidade (XPM)', `${Math.round(plates.cavityPlate.height)}mm · XPM`],
                ['Macho (XPM)', `${Math.round(plates.punchPlate.height)}mm · XPM`],
                ['Espaçadores', `${Math.round(plates.spacerBlocks.height)}mm · 1045`],
                ['Base Inf.', `${Math.round(plates.bottomPlate.height)}mm · 1045`],
              ].map(([l, v]) => (
                <div key={String(l)} className="flex justify-between py-1 border-b border-slate-800/60 last:border-0">
                  <span className="text-slate-500">{l}</span>
                  <span className="text-slate-300 font-mono">{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Edit shortcut */}
          <Link
            to={`/projects/${project.id}/edit`}
            className="card flex items-center gap-3 hover:border-primary-600/40 transition-colors group cursor-pointer"
          >
            <div className="w-8 h-8 rounded-lg bg-primary-600/10 border border-primary-600/20 flex items-center justify-center shrink-0">
              <Pencil size={14} className="text-primary-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">Editar este projeto</p>
              <p className="text-xs text-slate-500">Alterar dimensões, config ou margens</p>
            </div>
            <CheckCircle size={13} className="text-slate-600 group-hover:text-primary-400 transition-colors" />
          </Link>
        </div>
      </div>

      {/* Version History */}
      <div className="card">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <History size={14} className="text-blue-400" />
          </div>
          <h2 className="font-semibold text-white">Histórico de Revisões</h2>
        </div>
        <ProjectHistory projectId={project.id} />
      </div>
    </div>
  )
}
