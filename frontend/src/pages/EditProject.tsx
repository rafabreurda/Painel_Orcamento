import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import api from '@/lib/api'
import { BRL, NUM } from '@/lib/utils'
import { useToast } from '@/hooks/useToast'
import { calculateMoldDimensions } from '@/lib/moldCalc'
import MoldDiagram from '@/components/MoldDiagram'
import { lazy, Suspense } from 'react'
const MoldViewer3D = lazy(() => import('@/components/MoldViewer3D'))
import {
  Save, Loader2, ChevronDown, ChevronUp,
  DollarSign, Layers, Box, ArrowLeft, RefreshCw
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface FormData {
  name: string; clientName: string
  pieceX: number; pieceY: number; pieceZ: number
  cavities: number; hasDrawers: boolean; drawerCount: number
  polishLevel: string; steelType: string
  steelCavity: string; steelPunch: string
  steelP1: string; steelP2: string
  heatTreatment: string; surfaceTexture: string
  riskMargin: number; profitMargin: number; taxRate: number
  injectionType: string; nozzleCount: number
}

const TABS = [
  { id: 'diagram', label: 'Vista Explodida', icon: Layers },
  { id: '3d',      label: 'Viewer 3D',       icon: Box },
  { id: 'calc',    label: 'Valores',         icon: DollarSign },
] as const

export default function EditProject() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [loadingProject, setLoadingProject] = useState(true)
  const [form, setForm] = useState<FormData | null>(null)
  const [calculation, setCalculation] = useState<any>(null)
  const [calculating, setCalculating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [activeTab, setActiveTab] = useState<'diagram' | '3d' | 'calc'>('3d')
  const debounce = useRef<any>(null)

  // Load existing project
  useEffect(() => {
    if (!id) return
    api.get(`/projects/${id}`).then(({ data }) => {
      setForm({
        name: data.name,
        clientName: data.clientName,
        pieceX: data.pieceX,
        pieceY: data.pieceY,
        pieceZ: data.pieceZ,
        cavities: data.cavities,
        hasDrawers: data.hasDrawers,
        drawerCount: data.drawerCount,
        polishLevel: data.polishLevel,
        steelType: data.steelType,
        steelCavity: data.steelCavity ?? 'P20',
        steelPunch: data.steelPunch ?? 'P20',
        steelP1: data.steelP1 ?? 'S1045',
        steelP2: data.steelP2 ?? 'S1045',
        heatTreatment: data.heatTreatment ?? 'NONE',
        surfaceTexture: data.surfaceTexture ?? 'POLISHED',
        injectionType: data.injectionType ?? 'camera_fria',
        nozzleCount: data.nozzleCount ?? 0,
        riskMargin: data.riskMargin,
        profitMargin: data.profitMargin,
        taxRate: data.taxRate,
      })
      // Recalc on load
      runCalcWith({
        pieceX: data.pieceX, pieceY: data.pieceY, pieceZ: data.pieceZ,
        cavities: data.cavities, hasDrawers: data.hasDrawers, drawerCount: data.drawerCount,
        polishLevel: data.polishLevel, steelType: data.steelType,
        steelCavity: data.steelCavity ?? 'P20', steelPunch: data.steelPunch ?? 'P20',
        steelP1: data.steelP1 ?? 'S1045', steelP2: data.steelP2 ?? 'S1045',
        riskMargin: data.riskMargin, profitMargin: data.profitMargin, taxRate: data.taxRate,
        heatTreatment: data.heatTreatment ?? 'NONE', surfaceTexture: data.surfaceTexture ?? 'POLISHED',
        injectionType: data.injectionType ?? 'camera_fria', nozzleCount: data.nozzleCount ?? 0,
        name: data.name, clientName: data.clientName,
      })
    }).catch(() => {
      toast('error', 'Projeto não encontrado')
      navigate('/projects')
    }).finally(() => setLoadingProject(false))
  }, [id])

  async function runCalcWith(data: FormData) {
    if (!data.pieceX || !data.pieceY || !data.pieceZ) return
    setCalculating(true)
    try {
      const { data: result } = await api.post('/projects/calculate', data)
      setCalculation(result)
    } finally {
      setCalculating(false)
    }
  }

  function set(key: keyof FormData, value: any) {
    if (!form) return
    const next = { ...form, [key]: value }
    setForm(next)
    clearTimeout(debounce.current)
    if (next.pieceX > 0 && next.pieceY > 0 && next.pieceZ > 0) {
      debounce.current = setTimeout(() => runCalcWith(next), 700)
    }
  }

  async function handleSave() {
    if (!form || !id) return
    setSaving(true)
    try {
      await api.put(`/projects/${id}`, form)
      toast('success', 'Projeto atualizado!', `"${form.name}" salvo com os novos valores.`)
      navigate(`/projects/${id}`)
    } catch (e: any) {
      toast('error', 'Erro ao salvar', e?.response?.data?.error ?? 'Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  if (loadingProject || !form) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-primary-500" size={32} />
      </div>
    )
  }

  const plates = form.pieceX && form.pieceY && form.pieceZ
    ? calculateMoldDimensions({ x: form.pieceX, y: form.pieceY, z: form.pieceZ }, form.cavities)
    : null

  const p = calculation

  return (
    <div className="max-w-6xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to={`/projects/${id}`} className="btn-ghost p-2">
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <RefreshCw size={20} className="text-primary-400" />
              Editar Orçamento
            </h1>
            <p className="text-slate-400 text-sm mt-0.5">Altere os dados e salve para recalcular</p>
          </div>
        </div>
        <button onClick={handleSave} disabled={saving || !form.name} className="btn-primary">
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          Salvar Alterações
        </button>
      </div>

      <div className="grid lg:grid-cols-5 gap-5">
        {/* ── LEFT: Form ── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Project names */}
          <div className="card space-y-3">
            <div>
              <label className="label">Nome do Projeto</label>
              <input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ex: Tampa Frasco 12 cav" />
            </div>
            <div>
              <label className="label">Cliente</label>
              <input className="input" value={form.clientName} onChange={e => set('clientName', e.target.value)} placeholder="Nome do cliente" />
            </div>
          </div>

          {/* Dimensions */}
          <div className="card space-y-3">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Dimensões da Peça (mm)</h2>
            <div className="grid grid-cols-3 gap-2">
              {[['pieceX', 'Largura X'], ['pieceY', 'Comp. Y'], ['pieceZ', 'Altura Z']].map(([k, lbl]) => (
                <div key={k}>
                  <label className="label">{lbl}</label>
                  <input type="number" className="input text-center" value={(form as any)[k] || ''}
                    onChange={e => set(k as any, parseFloat(e.target.value) || 0)} min={1} />
                </div>
              ))}
            </div>
          </div>

          {/* Mold config */}
          <div className="card space-y-3">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Configuração do Molde</h2>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Cavidades</label>
                <select className="input" value={form.cavities} onChange={e => set('cavities', Number(e.target.value))}>
                  {[1,2,4,6,8,12,16,24,32].map(n => <option key={n} value={n}>{n}×</option>)}
                </select>
              </div>
              <div>
                <label className="label">Tipo de Injeção</label>
                <select className="input" value={form.injectionType} onChange={e => set('injectionType', e.target.value)}>
                  <option value="camera_fria">Canal Frio</option>
                  <option value="camera_quente">Câmara Quente</option>
                </select>
              </div>
              {form.injectionType === 'camera_quente' && (
                <div>
                  <label className="label">Nº de Bicos</label>
                  <input type="number" className="input" value={form.nozzleCount}
                    onChange={e => set('nozzleCount', Number(e.target.value))} min={1} max={32} />
                </div>
              )}
              <div className="col-span-2">
                <label className="label mb-1">Material por Placa</label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    ['steelCavity', 'Cavidade (Fêmea)', ['S1045','P20','H13']],
                    ['steelPunch',  'Macho (Punção)',   ['S1045','P20','H13']],
                    ['steelP1',    'P1 (Fix. Superior)',['S1045','P20']],
                    ['steelP2',    'P2 (Fix. Inferior)',['S1045','P20']],
                  ] as [keyof FormData, string, string[]][]).map(([key, lbl, opts]) => (
                    <div key={key}>
                      <label className="label text-[10px]">{lbl}</label>
                      <select className="input" value={form[key] as string} onChange={e => set(key, e.target.value)}>
                        {opts.map(o => <option key={o} value={o}>{o === 'S1045' ? 'Aço 1045' : o === 'P20' ? 'Aço P20' : 'Aço H13'}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Polimento</label>
                <select className="input" value={form.polishLevel} onChange={e => set('polishLevel', e.target.value)}>
                  <option value="STANDARD">Padrão</option>
                  <option value="SEMI_GLOSS">Semi-brilho</option>
                  <option value="MIRROR">Espelho</option>
                </select>
              </div>
              <div>
                <label className="label">Tratamento Térmico</label>
                <select className="input" value={form.heatTreatment} onChange={e => set('heatTreatment', e.target.value)}>
                  <option value="NONE">Sem tratamento</option>
                  <option value="NITRIDE">Nitretação</option>
                  <option value="QUENCH_TEMPER">Têmpera + Revenido</option>
                  <option value="THROUGH_HARDEN">Endurecimento Total</option>
                </select>
              </div>
              <div>
                <label className="label">Textura Superficial</label>
                <select className="input" value={form.surfaceTexture} onChange={e => set('surfaceTexture', e.target.value)}>
                  <option value="POLISHED">Polida</option>
                  <option value="TEXTURED_VDI12">Textura VDI-12 (Fina)</option>
                  <option value="TEXTURED_VDI18">Textura VDI-18 (Média)</option>
                  <option value="TEXTURED_VDI24">Textura VDI-24 (Grossa)</option>
                  <option value="SANDBLASTED">Jateada</option>
                </select>
              </div>
              <div>
                <label className="label">Gavetas</label>
                <select className="input" value={form.hasDrawers ? form.drawerCount : 0}
                  onChange={e => { const n = Number(e.target.value); set('hasDrawers', n > 0); set('drawerCount', n) }}>
                  <option value={0}>Sem gavetas</option>
                  {[1,2,3,4].map(n => <option key={n} value={n}>{n}×</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Advanced margins */}
          <button onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-dark-900 border border-slate-800 rounded-lg text-slate-400 text-sm hover:text-white transition-colors">
            <span className="flex items-center gap-2"><DollarSign size={13} /> Margens Financeiras</span>
            {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showAdvanced && (
            <div className="card grid grid-cols-3 gap-3">
              {[['riskMargin','Risco %'],['profitMargin','Lucro %'],['taxRate','Impostos %']].map(([k,lbl]) => (
                <div key={k}>
                  <label className="label">{lbl}</label>
                  <input type="number" className="input" value={(form as any)[k]}
                    onChange={e => set(k as any, parseFloat(e.target.value) || 0)} min={0} max={100} step={0.5} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── RIGHT: Tabs ── */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex bg-dark-900 rounded-xl p-1 border border-slate-800 gap-1">
            {TABS.map(({ id: tid, label, icon: Icon }) => (
              <button key={tid} onClick={() => setActiveTab(tid)}
                className={cn('flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all',
                  activeTab === tid
                    ? 'bg-primary-600/20 text-primary-300 border border-primary-600/30'
                    : 'text-slate-500 hover:text-slate-300')}>
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>

          {/* Vista Explodida */}
          {activeTab === 'diagram' && (
            <MoldDiagram
              plates={plates as any}
              pieceX={form.pieceX} pieceY={form.pieceY} pieceZ={form.pieceZ}
              cavities={form.cavities}
              steelType={form.steelType}
            />
          )}

          {/* Viewer 3D */}
          {activeTab === '3d' && (
            <div className="space-y-3">
              {plates ? (
                <Suspense fallback={<div className="flex items-center justify-center h-64 text-slate-400 text-sm"><span className="animate-pulse">Carregando viewer 3D...</span></div>}>
                  <MoldViewer3D
                    plates={plates as any}
                    pieceX={form.pieceX} pieceY={form.pieceY} pieceZ={form.pieceZ}
                    cavities={form.cavities}
                    steelType={form.steelType}
                    calculation={calculation}
                    projectName={form.name || undefined}
                  />
                </Suspense>
              ) : (
                <div className="card text-center py-10 text-slate-500">
                  <Box size={32} className="mx-auto mb-3 opacity-20" />
                  <p className="text-sm">Preencha as dimensões para carregar o modelo 3D</p>
                </div>
              )}
            </div>
          )}

          {/* Valores */}
          {activeTab === 'calc' && (
            <div className="space-y-3">
              {calculating && (
                <div className="flex items-center gap-2 text-sm text-primary-400 bg-primary-500/5 border border-primary-500/20 px-3 py-2 rounded-lg">
                  <Loader2 size={13} className="animate-spin" />
                  Recalculando...
                </div>
              )}
              {p && !calculating && (
                <>
                  <div className="card">
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Mão de Obra</h3>
                    {[
                      ['Usinagem CNC', p.labor.machining],
                      ['Eletroerosão / EDM', p.labor.erosion],
                      ['Bancada / Ajustagem', p.labor.bench],
                      ['Retífica e Polimento', p.labor.grinding],
                    ].map(([n, l]: any) => (
                      <div key={n} className="flex justify-between text-xs py-1 border-b border-slate-800/60 last:border-0">
                        <span className="text-slate-400">{n} ({NUM.format(l.hours)}h)</span>
                        <span className="text-slate-200">{BRL.format(l.cost)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-xs font-semibold pt-2">
                      <span className="text-white">Total MO</span>
                      <span className="text-primary-400">{BRL.format(p.labor.total)}</span>
                    </div>
                  </div>

                  <div className="card bg-gradient-to-br from-dark-800 to-dark-900 border-primary-600/20">
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Resumo Financeiro</h3>
                    {[
                      ['Subtotal (MO + Materiais)', p.subtotal],
                      [`Margem de Risco (${form.riskMargin}%)`, p.riskValue],
                      [`Margem de Lucro (${form.profitMargin}%)`, p.profitValue],
                      [`Impostos / ISS (${form.taxRate}%)`, p.taxValue],
                    ].map(([n, v]: any) => (
                      <div key={n} className="flex justify-between text-xs py-1.5 border-b border-slate-800/40 last:border-0">
                        <span className="text-slate-400">{n}</span>
                        <span className="text-slate-300">{BRL.format(v)}</span>
                      </div>
                    ))}
                    <div className="border-t border-primary-600/30 pt-3 mt-2 flex items-center justify-between">
                      <span className="font-bold text-white text-sm">TOTAL DO MOLDE</span>
                      <span className="text-2xl font-bold text-primary-400">{BRL.format(p.total)}</span>
                    </div>
                    <div className="mt-4 space-y-1.5">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wide font-medium">Condições de Pagamento</p>
                      {[
                        ['40% — Assinatura', 0.4],
                        ['30% — 1ª Amostra (T1)', 0.3],
                        ['30% — Entrega Final', 0.3],
                      ].map(([lbl, pct]: any) => (
                        <div key={lbl} className="flex justify-between bg-dark-950/60 rounded-lg px-3 py-2 border border-slate-800 text-sm">
                          <span className="text-slate-400">{lbl}</span>
                          <span className="font-semibold text-primary-400">{BRL.format(p.total * pct)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
              {!p && !calculating && (
                <div className="card text-center py-12 text-slate-500">
                  <DollarSign size={32} className="mx-auto mb-3 opacity-20" />
                  <p className="text-sm">Preencha as dimensões para calcular</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
