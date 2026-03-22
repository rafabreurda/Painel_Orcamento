import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { BRL, NUM } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import PhotoAnalyzer, { type MoldAnalysis } from '@/components/PhotoAnalyzer'
import MoldDiagram from '@/components/MoldDiagram'
import MoldOpen from '@/components/MoldOpen'
import { lazy, Suspense } from 'react'
const MoldViewer3D = lazy(() => import('@/components/MoldViewer3D'))
import { calculateMoldDimensions } from '@/lib/moldCalc'
import {
  Save, Loader2, Sparkles, ChevronDown, ChevronUp,
  DollarSign, Layers, Eye, Box
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface FormData {
  name: string; clientName: string
  pieceX: number; pieceY: number; pieceZ: number
  cavities: number; hasDrawers: boolean; drawerCount: number
  polishLevel: string; steelType: string
  heatTreatment: string; surfaceTexture: string
  riskMargin: number; profitMargin: number; taxRate: number
  injectionType: string; nozzleCount: number
}

export default function NewProject() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { toast } = useToast()

  const [form, setForm] = useState<FormData>({
    name: '', clientName: '',
    pieceX: 0, pieceY: 0, pieceZ: 0,
    cavities: user?.defaultCavities ?? 1,
    hasDrawers: false, drawerCount: 0,
    polishLevel: user?.defaultPolishLevel ?? 'STANDARD',
    steelType: user?.defaultSteelType ?? 'P20',
    heatTreatment: 'NONE',
    surfaceTexture: 'POLISHED',
    riskMargin: user?.defaultRiskMargin ?? 15,
    profitMargin: user?.defaultProfitMargin ?? 20,
    taxRate: user?.defaultTaxRate ?? 8,
    injectionType: 'camera_fria',
    nozzleCount: 0,
  })

  const [analysis, setAnalysis] = useState<MoldAnalysis | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [calculation, setCalculation] = useState<any>(null)
  const [calculating, setCalculating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [activeTab, setActiveTab] = useState<'diagram' | 'open' | '3d' | 'calc'>('diagram')
  const debounce = useRef<any>(null)

  // Memória 200%: Limpa URLs de Blob ao trocar imagem ou sair da página
  useEffect(() => {
    const current = imagePreview
    return () => {
      if (current && current.startsWith('blob:')) {
        URL.revokeObjectURL(current)
      }
    }
  }, [imagePreview])

  const plates = form.pieceX && form.pieceY && form.pieceZ
    ? calculateMoldDimensions({ x: form.pieceX, y: form.pieceY, z: form.pieceZ }, form.cavities)
    : null

  function set(key: keyof FormData, value: any) {
    const next = { ...form, [key]: value }
    setForm(next)
    clearTimeout(debounce.current)
    if (next.pieceX > 0 && next.pieceY > 0 && next.pieceZ > 0) {
      debounce.current = setTimeout(() => runCalc(next), 700)
    }
  }

  async function runCalc(data: FormData = form) {
    if (!data.pieceX || !data.pieceY || !data.pieceZ) return
    setCalculating(true)
    try {
      const { data: result } = await api.post('/projects/calculate', data)
      setCalculation(result)
    } finally {
      setCalculating(false)
    }
  }

  function applyAnalysis(a: MoldAnalysis, imgUrl: string) {
    if (!a) return
    console.log('[NeuroFlux] AI Analysis:', a)
    
    setAnalysis(a)
    setImagePreview(imgUrl)
    // REMOVIDO: setActiveTab('3d') — O usuário deve clicar manualmente para evitar travamentos
    
    setForm(prev => {
      const next: FormData = {
        ...prev,
        pieceX: a.estimatedDimensions?.x || prev.pieceX,
        pieceY: a.estimatedDimensions?.y || prev.pieceY,
        pieceZ: a.estimatedDimensions?.z || prev.pieceZ,
        cavities: a.suggestedCavities || prev.cavities,
        hasDrawers: !!a.needsDrawers,
        drawerCount: a.drawerCount || 0,
        steelType: a.suggestedSteel || prev.steelType,
        polishLevel: a.suggestedPolish || prev.polishLevel,
        injectionType: a.injectionType || prev.injectionType,
        nozzleCount: a.nozzleCount || 0,
      }
      // Garantir que não chamamos cálculo com dimensões zeradas (crash prevention)
      if (next.pieceX > 0 && next.pieceY > 0 && next.pieceZ > 0) {
        setTimeout(() => runCalc(next), 0)
      }
      return next
    })
  }

  async function handleSave() {
    if (!form.name || !form.clientName) {
      toast('warning', 'Campos obrigatórios', 'Preencha o nome do projeto e do cliente.')
      return
    }
    setSaving(true)
    try {
      const { data: res } = await api.post('/projects', form)
      
      // Upload image if present
      if (imagePreview && imagePreview !== 'pdf') {
        try {
          // fetch() works perfectly for both data: and blob: URLs
          const blob = await fetch(imagePreview).then(r => r.blob())
          const fd = new FormData()
          fd.append('file', blob, 'product.jpg')
          await api.post(`/projects/${res.project.id}/image`, fd)
        } catch (err) {
          console.error('Erro ao subir imagem:', err)
        }
      }
      
      toast('success', 'Orçamento criado!', `"${form.name}" salvo com sucesso.`)
      navigate(`/projects/${res.project.id}`)
    } catch (e: any) {
      toast('error', 'Erro ao salvar', e?.response?.data?.error ?? 'Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  const p = calculation

  const TABS = [
    { id: 'diagram', label: 'Vista Explodida', icon: Layers },
    { id: 'open',    label: 'Molde Aberto',    icon: Eye },
    { id: '3d',      label: 'Viewer 3D',        icon: Box },
    { id: 'calc',    label: 'Valores',          icon: DollarSign },
  ] as const

  return (
    <div className="max-w-6xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Sparkles size={22} className="text-primary-400" />
            NeuroFlux Orçamentos
            <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded ml-2 border border-red-500/30 font-black animate-pulse">v2.7-DEPLOY-FORCED</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Tire uma foto do produto — a IA detecta tudo automaticamente
          </p>
        </div>
        <button onClick={handleSave} disabled={saving || !form.name} className="btn-primary">
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          Salvar Projeto
        </button>
      </div>

      <div className="grid lg:grid-cols-5 gap-5">
        {/* ── LEFT: Photo + Form ── */}
        <div className="lg:col-span-2 space-y-4">

          {/* AI Photo Analyzer */}
          <div className="card border-primary-600/20 bg-gradient-to-b from-primary-900/10 to-dark-800">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={14} className="text-primary-400" />
              <h2 className="font-semibold text-white text-sm">Análise por Inteligência Artificial</h2>
            </div>
            <PhotoAnalyzer onAnalysis={applyAnalysis} />
          </div>

          {/* Analysis result */}
          {analysis && (
            <div className="card bg-gradient-to-r from-green-900/20 to-dark-800 border-green-500/20 space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-green-400" />
                <span className="text-green-300 text-sm font-semibold">IA detectou: {analysis.productDescription}</span>
              </div>
              <div className="grid grid-cols-2 gap-1 text-xs">
                {[
                  ['Complexidade', analysis.complexity],
                  ['Cavidades', String(analysis.suggestedCavities)],
                  ['Injeção', analysis.injectionType === 'camera_quente' ? 'Câmara Quente' : 'Canal Frio'],
                  ['Série', analysis.moldSeries],
                  ['Vida útil', `>${analysis.estimatedCycles} ciclos`],
                  ['Aço sugerido', analysis.suggestedSteel],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between bg-dark-900/50 px-2 py-1 rounded">
                    <span className="text-slate-500">{k}</span>
                    <span className="text-slate-300 font-medium">{v}</span>
                  </div>
                ))}
              </div>
              {analysis.technicalNotes?.length > 0 && (
                <div className="space-y-0.5 mt-1">
                  {analysis.technicalNotes.map((n, i) => (
                    <p key={i} className="text-[11px] text-slate-500 flex items-start gap-1">
                      <span className="text-primary-500 mt-0.5">›</span> {n}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

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
              <div>
                <label className="label">Material</label>
                <select className="input" value={form.steelType} onChange={e => set('steelType', e.target.value)}>
                  <option value="S1045">Aço 1045</option>
                  <option value="P20">Aço P20</option>
                  <option value="H13">Aço H13</option>
                </select>
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

        {/* ── RIGHT: Tabs + Views ── */}
        <div className="lg:col-span-3 space-y-4">
          {/* Tab switcher */}
          <div className="flex bg-dark-900 rounded-xl p-1 border border-slate-800 gap-1">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setActiveTab(id)}
                className={cn('flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all',
                  activeTab === id
                    ? 'bg-primary-600/20 text-primary-300 border border-primary-600/30'
                    : 'text-slate-500 hover:text-slate-300')}>
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>

          {/* ── TAB: Vista Explodida ── */}
          {activeTab === 'diagram' && (
            <MoldDiagram
              plates={plates as any}
              pieceX={form.pieceX} pieceY={form.pieceY} pieceZ={form.pieceZ}
              cavities={form.cavities}
              steelType={form.steelType}
              analysis={analysis ? {
                suggestedCavities: analysis.suggestedCavities,
                injectionType: form.injectionType,
                nozzleCount: form.nozzleCount,
                moldSeries: analysis.moldSeries,
                estimatedCycles: analysis.estimatedCycles,
                needsDrawers: analysis.needsDrawers,
                technicalNotes: analysis.technicalNotes,
                cavityLayout: analysis.cavityLayout,
              } : undefined}
            />
          )}

          {/* ── TAB: Molde Aberto ── */}
          {activeTab === 'open' && (
            <div className="space-y-4">
              <MoldOpen
                pieceX={form.pieceX || 40}
                pieceY={form.pieceY || 40}
                pieceZ={form.pieceZ || 30}
                cavities={form.cavities}
                steelType={form.steelType}
                injectionType={form.injectionType}
                nozzleCount={form.nozzleCount}
                productType={analysis?.productType}
                surfaceTexture={form.surfaceTexture}
                heatTreatment={form.heatTreatment}
              />
              {/* Spec chips */}
              <div className="flex flex-wrap gap-2">
                {[
                  { label: form.steelType === 'S1045' ? 'Aço 1045' : form.steelType === 'P20' ? 'Aço P20 (XPM)' : 'Aço H13', color: 'text-blue-300 bg-blue-500/10 border-blue-500/20' },
                  { label: form.injectionType === 'camera_quente' ? `Câmara Quente · ${form.nozzleCount} bicos` : 'Canal Frio Balanceado', color: 'text-purple-300 bg-purple-500/10 border-purple-500/20' },
                  { label: form.heatTreatment === 'NONE' ? 'Sem TT' : form.heatTreatment === 'NITRIDE' ? 'Nitretação' : form.heatTreatment === 'QUENCH_TEMPER' ? 'Têmpera+Revenido' : 'End. Total', color: 'text-orange-300 bg-orange-500/10 border-orange-500/20' },
                  { label: form.surfaceTexture === 'POLISHED' ? 'Polido' : form.surfaceTexture.replace('TEXTURED_','Textura ').replace('SANDBLASTED','Jateado'), color: 'text-green-300 bg-green-500/10 border-green-500/20' },
                  { label: `${form.cavities} Cavidades`, color: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/20' },
                ].map(({ label, color }) => (
                  <span key={label} className={`text-xs px-2.5 py-1 rounded-full border font-medium ${color}`}>{label}</span>
                ))}
              </div>
            </div>
          )}

          {/* ── TAB: Viewer 3D ── */}
          {activeTab === '3d' && (
            <div className="space-y-3">
              <Suspense fallback={<div className="flex items-center justify-center h-64 text-slate-400 text-sm"><span className="animate-pulse">Carregando viewer 3D...</span></div>}>
              <MoldViewer3D
                plates={plates as any}
                pieceX={form.pieceX || 50} pieceY={form.pieceY || 50} pieceZ={form.pieceZ || 30}
                cavities={form.cavities}
                steelType={form.steelType}
                analysis={analysis ? {
                  suggestedCavities: analysis.suggestedCavities,
                  injectionType: form.injectionType,
                  nozzleCount: form.nozzleCount,
                  moldSeries: analysis.moldSeries,
                  estimatedCycles: analysis.estimatedCycles,
                  needsDrawers: analysis.needsDrawers,
                  productType: analysis.productType,
                } : undefined}
                calculation={calculation}
                projectName={form.name || undefined}
              />
              </Suspense>
              {!plates && (
                <div className="card text-center py-10 text-slate-500">
                  <Box size={32} className="mx-auto mb-3 opacity-20" />
                  <p className="text-sm">Preencha as dimensões para carregar o modelo 3D</p>
                </div>
              )}
            </div>
          )}

          {/* ── TAB: Valores ── */}
          {activeTab === 'calc' && (
            <div className="space-y-3">
              {calculating && (
                <div className="flex items-center gap-2 text-sm text-primary-400 bg-primary-500/5 border border-primary-500/20 px-3 py-2 rounded-lg">
                  <Loader2 size={13} className="animate-spin" />
                  Calculando...
                </div>
              )}

              {p && !calculating && (
                <>
                  {/* Plates dimensions */}
                  <div className="card">
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Dimensões das Placas</h3>
                    {[
                      ['Placa Superior',         p.plates.topPlate],
                      ['Pavimento Fixo (Cav.)',   p.plates.cavityPlate],
                      ['Pavimento Móvel (Pun.)',  p.plates.punchPlate],
                      ['Calços (×2)',             p.plates.spacerBlocks],
                      ['Placa Extratora',         p.plates.ejectorPlate],
                      ['Placa Inferior',          p.plates.bottomPlate],
                    ].map(([name, plate]: any) => (
                      <div key={name} className="flex justify-between text-xs py-1.5 border-b border-slate-800/60 last:border-0">
                        <span className="text-slate-400">{name}</span>
                        <span className="text-slate-200 font-mono">{NUM.format(plate.width)}×{NUM.format(plate.length)}×{NUM.format(plate.height)}mm</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-xs pt-2 text-slate-400">
                      <span>Peso total estimado do aço</span>
                      <span className="text-slate-200 font-semibold">{NUM.format(p.steelWeight)} kg</span>
                    </div>
                  </div>

                  {/* Labor */}
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

                  {/* Materials */}
                  <div className="card">
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Materiais</h3>
                    {[
                      [`Aço ${form.steelType} (${NUM.format(p.steelWeight)} kg)`, p.materials.steel],
                      ['Pinos Extratores', p.materials.pins],
                      ['Conjunto de Molas', p.materials.springs],
                      ['Guias e Colunas', p.materials.columns],
                    ].map(([n, v]: any) => (
                      <div key={n} className="flex justify-between text-xs py-1 border-b border-slate-800/60 last:border-0">
                        <span className="text-slate-400">{n}</span>
                        <span className="text-slate-200">{BRL.format(v)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-xs font-semibold pt-2">
                      <span className="text-white">Total Materiais</span>
                      <span className="text-primary-400">{BRL.format(p.materials.total)}</span>
                    </div>
                  </div>

                  {/* Financial summary */}
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

                    {/* Payment conditions 40/30/30 */}
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
                  <Sparkles size={32} className="mx-auto mb-3 opacity-20" />
                  <p className="text-sm">Envie a foto do produto ou preencha as dimensões</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
