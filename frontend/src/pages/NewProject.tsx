import { useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import api from '@/lib/api'
import { BRL, NUM } from '@/lib/utils'
import { Upload, Calculator, Save, Loader2, ImageIcon, X, Layers } from 'lucide-react'
import MoldSketch from '@/components/MoldSketch'

interface FormData {
  name: string; clientName: string
  pieceX: number; pieceY: number; pieceZ: number
  cavities: number; hasDrawers: boolean; drawerCount: number
  polishLevel: string; steelType: string
  riskMargin: number; profitMargin: number; taxRate: number
}

const DEFAULTS: FormData = {
  name: '', clientName: '',
  pieceX: 100, pieceY: 100, pieceZ: 30,
  cavities: 1, hasDrawers: false, drawerCount: 0,
  polishLevel: 'STANDARD', steelType: 'P20',
  riskMargin: 15, profitMargin: 20, taxRate: 8,
}

export default function NewProject() {
  const navigate = useNavigate()
  const [form, setForm] = useState<FormData>(DEFAULTS)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [calculation, setCalculation] = useState<any>(null)
  const [calculating, setCalculating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'form' | 'sketch'>('form')
  const debounceRef = useRef<any>(null)

  const set = (key: keyof FormData, value: any) => {
    const next = { ...form, [key]: value }
    setForm(next)

    // Auto-calculate após 600ms de inatividade
    clearTimeout(debounceRef.current)
    if (next.pieceX && next.pieceY && next.pieceZ) {
      debounceRef.current = setTimeout(() => runCalculation(next), 600)
    }
  }

  const onDrop = useCallback((files: File[]) => {
    const file = files[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'image/*': [] }, multiple: false,
  })

  async function runCalculation(data: FormData = form) {
    if (!data.pieceX || !data.pieceY || !data.pieceZ) return
    setCalculating(true)
    try {
      const { data: result } = await api.post('/projects/calculate', data)
      setCalculation(result)
    } finally {
      setCalculating(false)
    }
  }

  async function handleSave() {
    if (!form.name || !form.clientName) {
      alert('Preencha o nome do projeto e do cliente')
      return
    }
    setSaving(true)
    try {
      const { data: res } = await api.post('/projects', form)
      if (imageFile) {
        const fd = new FormData()
        fd.append('file', imageFile)
        await api.post(`/projects/${res.project.id}/image`, fd)
      }
      navigate(`/projects/${res.project.id}`)
    } finally {
      setSaving(false)
    }
  }

  const p = calculation

  return (
    <div className="max-w-6xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Novo Orçamento</h1>
          <p className="text-slate-400 text-sm mt-1">Calcule o valor do molde em tempo real</p>
        </div>
        <button onClick={handleSave} disabled={saving || !form.name} className="btn-primary">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Salvar Projeto
        </button>
      </div>

      <div className="grid lg:grid-cols-5 gap-5">
        {/* Left — Form */}
        <div className="lg:col-span-3 space-y-4">
          {/* Project info */}
          <div className="card space-y-4">
            <h2 className="font-semibold text-white text-sm flex items-center gap-2">
              <div className="w-1.5 h-4 bg-primary-500 rounded-full" />
              Identificação
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="label">Nome do Projeto</label>
                <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)}
                  placeholder="Ex: Tampa Frasco 200ml" />
              </div>
              <div className="col-span-2">
                <label className="label">Cliente</label>
                <input className="input" value={form.clientName} onChange={(e) => set('clientName', e.target.value)}
                  placeholder="Nome do cliente" />
              </div>
            </div>
          </div>

          {/* Piece dimensions */}
          <div className="card space-y-4">
            <h2 className="font-semibold text-white text-sm flex items-center gap-2">
              <div className="w-1.5 h-4 bg-blue-500 rounded-full" />
              Dimensões da Peça (mm)
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {(['pieceX', 'pieceY', 'pieceZ'] as const).map((k, i) => (
                <div key={k}>
                  <label className="label">{['Largura X', 'Comprimento Y', 'Altura Z'][i]}</label>
                  <input type="number" className="input" value={form[k]}
                    onChange={(e) => set(k, parseFloat(e.target.value) || 0)} min={1} />
                </div>
              ))}
            </div>
          </div>

          {/* Mold config */}
          <div className="card space-y-4">
            <h2 className="font-semibold text-white text-sm flex items-center gap-2">
              <div className="w-1.5 h-4 bg-purple-500 rounded-full" />
              Configuração do Molde
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Nº de Cavidades</label>
                <select className="input" value={form.cavities}
                  onChange={(e) => set('cavities', Number(e.target.value))}>
                  {[1, 2, 4, 6, 8, 12, 16].map(n => (
                    <option key={n} value={n}>{n} {n > 1 ? 'cavidades' : 'cavidade'}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Material (Aço)</label>
                <select className="input" value={form.steelType}
                  onChange={(e) => set('steelType', e.target.value)}>
                  <option value="S1045">Aço 1045 — R$ 11,35/kg</option>
                  <option value="P20">Aço P20 — R$ 38,00/kg</option>
                  <option value="H13">Aço H13 — R$ 65,00/kg</option>
                </select>
              </div>
              <div>
                <label className="label">Polimento</label>
                <select className="input" value={form.polishLevel}
                  onChange={(e) => set('polishLevel', e.target.value)}>
                  <option value="STANDARD">Padrão</option>
                  <option value="SEMI_GLOSS">Semi-brilho</option>
                  <option value="MIRROR">Espelho</option>
                </select>
              </div>
              <div>
                <label className="label">Gavetas</label>
                <select className="input" value={form.hasDrawers ? form.drawerCount : 0}
                  onChange={(e) => {
                    const n = Number(e.target.value)
                    set('hasDrawers', n > 0)
                    set('drawerCount', n)
                  }}>
                  <option value={0}>Sem gavetas</option>
                  {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n} gaveta{n > 1 ? 's' : ''}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Margins */}
          <div className="card space-y-4">
            <h2 className="font-semibold text-white text-sm flex items-center gap-2">
              <div className="w-1.5 h-4 bg-green-500 rounded-full" />
              Margens Financeiras
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {[
                { key: 'riskMargin', label: 'Risco / Gordura (%)' },
                { key: 'profitMargin', label: 'Margem de Lucro (%)' },
                { key: 'taxRate', label: 'Impostos (%)' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="label">{label}</label>
                  <input type="number" className="input" value={(form as any)[key]}
                    onChange={(e) => set(key as any, parseFloat(e.target.value) || 0)}
                    min={0} max={100} step={0.5} />
                </div>
              ))}
            </div>
          </div>

          {/* Image upload */}
          <div className="card">
            <h2 className="font-semibold text-white text-sm flex items-center gap-2 mb-3">
              <div className="w-1.5 h-4 bg-orange-500 rounded-full" />
              Foto da Peça
            </h2>
            {imagePreview ? (
              <div className="relative">
                <img src={imagePreview} className="w-full h-40 object-cover rounded-lg" alt="Peça" />
                <button onClick={() => { setImageFile(null); setImagePreview(null) }}
                  className="absolute top-2 right-2 bg-dark-900/80 p-1.5 rounded-lg hover:bg-dark-800">
                  <X size={14} className="text-red-400" />
                </button>
              </div>
            ) : (
              <div {...getRootProps()} className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
                ${isDragActive ? 'border-primary-500 bg-primary-500/5' : 'border-slate-700 hover:border-slate-600'}`}>
                <input {...getInputProps()} />
                <ImageIcon size={24} className="mx-auto text-slate-500 mb-2" />
                <p className="text-sm text-slate-400">Arraste a foto da peça aqui</p>
                <p className="text-xs text-slate-600 mt-1">ou clique para selecionar</p>
              </div>
            )}
          </div>
        </div>

        {/* Right — Results */}
        <div className="lg:col-span-2 space-y-4">
          {/* Tabs */}
          <div className="flex bg-dark-900 rounded-lg p-1 border border-slate-800">
            {[
              { id: 'form', label: 'Resultado', icon: Calculator },
              { id: 'sketch', label: 'Esboço', icon: Layers },
            ].map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setActiveTab(id as any)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all
                  ${activeTab === id ? 'bg-dark-800 text-white border border-slate-700' : 'text-slate-500 hover:text-slate-300'}`}>
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>

          {activeTab === 'form' && (
            <div className="space-y-3">
              {calculating && (
                <div className="flex items-center gap-2 text-sm text-slate-400 bg-dark-900 px-3 py-2 rounded-lg border border-slate-800">
                  <Loader2 size={14} className="animate-spin text-primary-400" />
                  Calculando...
                </div>
              )}

              {p && !calculating && (
                <>
                  {/* Plates */}
                  <div className="card space-y-2">
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Placas do Porta-Molde</h3>
                    {[
                      ['Placa Superior', p.plates.topPlate],
                      ['Porta-Postiço Cavidade', p.plates.cavityPlate],
                      ['Porta-Postiço Punção', p.plates.punchPlate],
                      ['Calços (×2)', p.plates.spacerBlocks],
                      ['Placa Extratora', p.plates.ejectorPlate],
                      ['Placa Inferior', p.plates.bottomPlate],
                    ].map(([name, plate]: any) => (
                      <div key={name} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-800 last:border-0">
                        <span className="text-slate-400">{name}</span>
                        <span className="text-slate-200 font-mono">
                          {NUM.format(plate.width)}×{NUM.format(plate.length)}×{NUM.format(plate.height)} mm
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between text-xs pt-1 text-slate-400">
                      <span>Peso total do aço</span>
                      <span className="font-medium text-slate-200">{NUM.format(p.steelWeight)} kg</span>
                    </div>
                  </div>

                  {/* Labor */}
                  <div className="card space-y-2">
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Mão de Obra</h3>
                    {[
                      ['Usinagem CNC', p.labor.machining],
                      ['Eletroerosão', p.labor.erosion],
                      ['Bancada', p.labor.bench],
                      ['Retífica/Polimento', p.labor.grinding],
                    ].map(([name, l]: any) => (
                      <div key={name} className="flex items-center justify-between text-xs py-1 border-b border-slate-800 last:border-0">
                        <span className="text-slate-400">{name} ({NUM.format(l.hours)}h)</span>
                        <span className="text-slate-200">{BRL.format(l.cost)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-xs font-semibold pt-1">
                      <span className="text-slate-300">Total MO</span>
                      <span className="text-primary-400">{BRL.format(p.labor.total)}</span>
                    </div>
                  </div>

                  {/* Materials */}
                  <div className="card space-y-2">
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Materiais</h3>
                    {[
                      [`Aço ${form.steelType} (${NUM.format(p.steelWeight)}kg)`, p.materials.steel],
                      ['Pinos', p.materials.pins],
                      ['Molas', p.materials.springs],
                      ['Colunas', p.materials.columns],
                    ].map(([name, val]: any) => (
                      <div key={name} className="flex items-center justify-between text-xs py-1 border-b border-slate-800 last:border-0">
                        <span className="text-slate-400">{name}</span>
                        <span className="text-slate-200">{BRL.format(val)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-xs font-semibold pt-1">
                      <span className="text-slate-300">Total Mat.</span>
                      <span className="text-primary-400">{BRL.format(p.materials.total)}</span>
                    </div>
                  </div>

                  {/* Final */}
                  <div className="card bg-gradient-to-br from-dark-800 to-dark-900 space-y-2">
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Fechamento</h3>
                    {[
                      ['Subtotal', p.subtotal],
                      [`Risco (${form.riskMargin}%)`, p.riskValue],
                      [`Lucro (${form.profitMargin}%)`, p.profitValue],
                      [`Impostos (${form.taxRate}%)`, p.taxValue],
                    ].map(([name, val]: any) => (
                      <div key={name} className="flex justify-between text-xs py-0.5">
                        <span className="text-slate-400">{name}</span>
                        <span className="text-slate-300">{BRL.format(val)}</span>
                      </div>
                    ))}
                    <div className="border-t border-slate-700 pt-3 mt-2 flex items-center justify-between">
                      <span className="text-sm font-bold text-white">TOTAL DO MOLDE</span>
                      <span className="text-xl font-bold text-primary-400">{BRL.format(p.total)}</span>
                    </div>

                    {/* Payment split */}
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {[
                        { pct: 0.5, label: '50% Entrada' },
                        { pct: 0.3, label: '30% Amostra' },
                        { pct: 0.2, label: '20% Final' },
                      ].map(({ pct, label }) => (
                        <div key={label} className="bg-dark-900 rounded-lg p-2 text-center border border-slate-800">
                          <p className="text-[10px] text-slate-500">{label}</p>
                          <p className="text-xs font-bold text-primary-400 mt-0.5">{BRL.format(p.total * pct)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {!p && !calculating && (
                <div className="card text-center py-10 text-slate-500">
                  <Calculator size={32} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Preencha as dimensões da peça</p>
                  <p className="text-xs mt-1">O cálculo aparecerá automaticamente</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'sketch' && (
            <div className="card">
              <MoldSketch
                pieceX={form.pieceX}
                pieceY={form.pieceY}
                pieceZ={form.pieceZ}
                cavities={form.cavities}
                plates={calculation?.plates}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
