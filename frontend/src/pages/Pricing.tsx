import { useEffect, useState, useCallback } from 'react'
import api from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import {
  Save, RefreshCw, Loader2, CheckCircle, Plus, Trash2,
  DollarSign, Wrench, Layers, Flame, Database, AlertCircle, X, CreditCard, Edit2, Download
} from 'lucide-react'
import { PaymentTermsEditor } from '@/components/PaymentTermsEditor'
import { cn } from '@/lib/utils'

interface PricingItem {
  id: string; key: string; label: string; value: number; unit: string; updatedAt: string
}

// ─── Catálogo Polimold (estático — norma do fabricante) ───────────────
const POLIMOLD_CATALOG = [
  { series: '15', w: 150, l: 150 }, { series: '15', w: 150, l: 200 }, { series: '15', w: 150, l: 250 },
  { series: '20', w: 200, l: 200 }, { series: '20', w: 200, l: 250 }, { series: '20', w: 200, l: 300 },
  { series: '20', w: 200, l: 350 }, { series: '20', w: 200, l: 400 },
  { series: '25', w: 250, l: 250 }, { series: '25', w: 250, l: 300 }, { series: '25', w: 250, l: 350 },
  { series: '25', w: 250, l: 400 }, { series: '25', w: 250, l: 450 }, { series: '25', w: 250, l: 500 },
  { series: '30', w: 300, l: 300 }, { series: '30', w: 300, l: 350 }, { series: '30', w: 300, l: 400 },
  { series: '30', w: 300, l: 450 }, { series: '30', w: 300, l: 500 }, { series: '30', w: 300, l: 600 },
  { series: '35', w: 350, l: 350 }, { series: '35', w: 350, l: 400 }, { series: '35', w: 350, l: 450 },
  { series: '35', w: 350, l: 500 }, { series: '35', w: 350, l: 600 },
  { series: '40', w: 400, l: 400 }, { series: '40', w: 400, l: 450 }, { series: '40', w: 400, l: 500 },
  { series: '40', w: 400, l: 600 },
  { series: '45', w: 450, l: 450 }, { series: '45', w: 450, l: 500 }, { series: '45', w: 450, l: 600 },
  { series: '50', w: 500, l: 500 }, { series: '50', w: 500, l: 600 },
  { series: '60', w: 600, l: 600 },
]

const SERIES_GROUPS = ['15', '20', '25', '30', '35', '40', '45', '50', '60']

function getCategory(key: string): string {
  if (key.startsWith('RATE_') || key === 'HOURLY_RATE') return 'rates'
  if (key.startsWith('STEEL_')) return 'steel'
  if (key.startsWith('COMP_') || key.startsWith('COMPONENT_')) return 'components'
  if (key.startsWith('HR_') || key === 'COMPONENT_MANIFOLD') return 'hot_runner'
  return 'other'
}

const SYSTEM_KEYS = new Set([
  'STEEL_S1045', 'STEEL_P20', 'STEEL_H13',
  'HOURLY_RATE', 'COMPONENT_PINS', 'COMPONENT_SPRINGS',
  'COMPONENT_COLUMNS', 'COMPONENT_MANIFOLD',
])

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

// ─── Preços câmara quente calculados ─────────────────────────────────
function calcHotRunnerCost(nozzles: number, items: PricingItem[]) {
  const map: Record<string, number> = {}
  items.forEach(i => (map[i.key] = i.value))
  const nozzlePrice  = map['HR_NOZZLE'] ?? 2800
  const manifoldBase = map['HR_MANIFOLD'] ?? 4500
  const extraDrop    = map['HR_EXTRA_DROP'] ?? 800
  return nozzlePrice * nozzles + manifoldBase + Math.max(0, nozzles - 1) * extraDrop
}

// ─── AddItemModal ─────────────────────────────────────────────────────
function AddItemModal({
  category, onAdd, onClose,
}: { category: string; onAdd: (item: Omit<PricingItem, 'id' | 'updatedAt'>) => void; onClose: () => void }) {
  const [key, setKey] = useState('')
  const [label, setLabel] = useState('')
  const [value, setValue] = useState('')
  const [unit, setUnit] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const defaultUnit = category === 'rates' ? 'R$/h'
    : category === 'steel' ? 'R$/kg'
    : 'R$/jg'

  const prefixMap: Record<string, string> = {
    rates: 'RATE_', steel: 'STEEL_', components: 'COMP_', hot_runner: 'HR_', other: ''
  }
  const prefix = prefixMap[category] ?? ''

  async function handleAdd() {
    setError('')
    if (!label || !value || !unit) return setError('Preencha todos os campos')
    const fullKey = (prefix + key.toUpperCase().replace(/[^A-Z0-9_]/g, '_'))
    setSaving(true)
    try {
      const { data } = await api.post('/pricing', {
        key: fullKey || label.toUpperCase().replace(/\s+/g, '_').slice(0, 30),
        label, value: parseFloat(value), unit,
      })
      onAdd(data)
      onClose()
    } catch (e: any) {
      setError(e.response?.data?.error ?? 'Erro ao adicionar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-dark-800 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-700">
          <h3 className="font-semibold text-white">Adicionar Item</h3>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={15} /></button>
        </div>
        <div className="p-5 space-y-3">
          {prefix && (
            <div>
              <label className="label">Sufixo da Chave (ex: CUSTOM1)</label>
              <div className="flex items-center gap-1">
                <span className="text-xs text-slate-500 bg-dark-900 border border-slate-700 px-2 py-2 rounded-lg shrink-0">{prefix}</span>
                <input className="input flex-1" value={key} onChange={e => setKey(e.target.value.toUpperCase())}
                  placeholder="NOME_DA_CHAVE" />
              </div>
            </div>
          )}
          <div>
            <label className="label">Descrição</label>
            <input className="input" value={label} onChange={e => setLabel(e.target.value)}
              placeholder="Ex: Manifold Especial 8 Bicos" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Valor (R$)</label>
              <input type="number" className="input" value={value}
                onChange={e => setValue(e.target.value)} placeholder="0.00" step="0.01" />
            </div>
            <div>
              <label className="label">Unidade</label>
              <input className="input" value={unit || defaultUnit}
                onChange={e => setUnit(e.target.value)} placeholder={defaultUnit} />
            </div>
          </div>
          {error && (
            <p className="text-red-400 text-sm flex items-center gap-2">
              <AlertCircle size={13} />{error}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 p-5 border-t border-slate-700">
          <button onClick={onClose} className="btn-ghost">Cancelar</button>
          <button onClick={handleAdd} disabled={saving} className="btn-primary">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            Adicionar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── ItemRow ─────────────────────────────────────────────────────────
function ItemRow({
  item, isAdmin, edits, onChange, onSave, onDelete, saving, saved,
}: {
  item: PricingItem; isAdmin: boolean
  edits: Record<string, number>
  onChange: (key: string, v: number) => void
  onSave: (key: string) => void
  onDelete: (key: string) => void
  saving: string | null; saved: string | null
}) {
  const isSystem = SYSTEM_KEYS.has(item.key)
  const changed = edits[item.key] !== undefined && edits[item.key] !== item.value

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-slate-800/70 last:border-0 group">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-200">{item.label}</p>
        <p className="text-[11px] text-slate-500 font-mono">{item.key} · {item.unit}</p>
      </div>
      {isAdmin ? (
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">R$</span>
            <input
              type="number"
              className="input w-28 pl-6 text-right text-sm"
              value={edits[item.key] ?? item.value}
              onChange={e => onChange(item.key, parseFloat(e.target.value) || 0)}
              step={item.unit.includes('/kg') ? 0.01 : 1}
            />
          </div>
          <button
            onClick={() => onSave(item.key)}
            disabled={saving === item.key || !changed}
            className={cn('p-1.5 rounded-lg transition-colors', changed ? 'text-primary-400 hover:bg-primary-500/10' : 'text-slate-700')}
          >
            {saving === item.key
              ? <Loader2 size={13} className="animate-spin" />
              : saved === item.key ? <CheckCircle size={13} className="text-green-400" />
              : <Save size={13} />}
          </button>
          {!isSystem && (
            <button
              onClick={() => onDelete(item.key)}
              className="p-1.5 rounded-lg text-slate-700 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      ) : (
        <span className="text-primary-400 font-bold text-sm shrink-0">{BRL.format(item.value)}<span className="text-slate-500 font-normal text-xs ml-1">/{item.unit.replace('R$/', '')}</span></span>
      )}
    </div>
  )
}

// ─── PolimoldCatalogEditor ────────────────────────────────────────────
type PolimoldEntry = { series: string; w: number; l: number }

function PolimoldCatalogEditor({ isAdmin }: { isAdmin: boolean }) {
  const [catalog, setCatalog] = useState<PolimoldEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  // editingIdx = index in catalog array being edited inline
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [editW, setEditW] = useState('')
  const [editL, setEditL] = useState('')
  // adding a new entry
  const [addSeries, setAddSeries] = useState('')
  const [addW, setAddW] = useState('')
  const [addL, setAddL] = useState('')
  const [addingSeries, setAddingSeries] = useState<string | null>(null)

  useEffect(() => {
    api.get('/config/POLIMOLD_CATALOG')
      .then(({ data }) => {
        const val = data.value
        if (Array.isArray(val) && val.length > 0) setCatalog(val)
        else setCatalog(POLIMOLD_CATALOG)
      })
      .catch(() => setCatalog(POLIMOLD_CATALOG))
      .finally(() => setLoading(false))
  }, [])

  const seriesGroups = SERIES_GROUPS.filter(s => catalog.some(e => e.series === s))
  // Also include any series not in SERIES_GROUPS
  const extraSeries = [...new Set(catalog.map(e => e.series))].filter(s => !SERIES_GROUPS.includes(s))
  const allSeries = [...seriesGroups, ...extraSeries]

  async function saveCatalog(updated: PolimoldEntry[]) {
    setSaving(true)
    setError('')
    try {
      await api.put('/config/POLIMOLD_CATALOG', { value: updated })
      setCatalog(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e: any) {
      setError(e.response?.data?.error ?? 'Erro ao salvar catálogo')
    } finally {
      setSaving(false)
    }
  }

  function startEdit(idx: number) {
    setEditingIdx(idx)
    setEditW(String(catalog[idx].w))
    setEditL(String(catalog[idx].l))
  }

  function confirmEdit() {
    if (editingIdx === null) return
    const w = parseInt(editW)
    const l = parseInt(editL)
    if (!w || !l || w <= 0 || l <= 0) { setEditingIdx(null); return }
    const updated = catalog.map((e, i) => i === editingIdx ? { ...e, w, l } : e)
    setEditingIdx(null)
    setCatalog(updated)
  }

  function deleteEntry(idx: number) {
    const updated = catalog.filter((_, i) => i !== idx)
    setCatalog(updated)
  }

  function addEntry(series: string) {
    const w = parseInt(addW)
    const l = parseInt(addL)
    if (!w || !l || w <= 0 || l <= 0) return
    const updated = [...catalog, { series, w, l }]
    setCatalog(updated)
    setAddingSeries(null)
    setAddW('')
    setAddL('')
  }

  function addNewSeries() {
    const s = addSeries.trim()
    if (!s) return
    const w = parseInt(addW)
    const l = parseInt(addL)
    if (!w || !l) return
    const updated = [...catalog, { series: s, w, l }]
    setCatalog(updated)
    setAddSeries('')
    setAddW('')
    setAddL('')
  }

  if (loading) return (
    <div className="flex items-center justify-center py-10">
      <Loader2 className="animate-spin text-primary-500" size={24} />
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="font-semibold text-white">Catálogo Polimold — Porta-Moldes Padrão</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Dimensões normalizadas do catálogo Polimold 3 Placas · Seleção automática pelo motor de cálculo
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={() => saveCatalog(catalog)}
              disabled={saving}
              className={cn('btn-primary text-sm shrink-0', saved && 'bg-green-600/20 text-green-300 border-green-600/30')}
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : saved ? <CheckCircle size={13} /> : <Save size={13} />}
              {saved ? 'Salvo!' : 'Salvar Catálogo'}
            </button>
          )}
        </div>

        {error && (
          <p className="text-red-400 text-sm flex items-center gap-2 mb-3">
            <AlertCircle size={13} />{error}
          </p>
        )}

        {allSeries.map(series => {
          const seriesItems = catalog
            .map((e, idx) => ({ ...e, idx }))
            .filter(e => e.series === series)
          if (seriesItems.length === 0) return null
          return (
            <div key={series} className="mb-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-primary-600/15 border border-primary-600/25 px-3 py-1 rounded-lg">
                  <span className="text-primary-300 text-xs font-bold">SÉRIE {series}</span>
                </div>
                <div className="flex-1 h-px bg-slate-800" />
                <span className="text-xs text-slate-500">{seriesItems[0].w}mm base</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {seriesItems.map(p => (
                  editingIdx === p.idx && isAdmin ? (
                    <div key={`edit-${p.idx}`} className="bg-dark-900 border border-primary-500/50 rounded-lg px-2 py-1.5 flex items-center gap-1.5">
                      <input
                        type="number"
                        className="w-14 bg-dark-800 border border-slate-700 rounded px-1.5 py-1 text-xs text-white text-center"
                        value={editW}
                        onChange={e => setEditW(e.target.value)}
                        placeholder="W"
                      />
                      <span className="text-slate-500 text-xs">×</span>
                      <input
                        type="number"
                        className="w-14 bg-dark-800 border border-slate-700 rounded px-1.5 py-1 text-xs text-white text-center"
                        value={editL}
                        onChange={e => setEditL(e.target.value)}
                        placeholder="L"
                      />
                      <button onClick={confirmEdit} className="text-green-400 hover:text-green-300 p-0.5"><CheckCircle size={13} /></button>
                      <button onClick={() => setEditingIdx(null)} className="text-slate-500 hover:text-slate-300 p-0.5"><X size={12} /></button>
                    </div>
                  ) : (
                    <div key={`${p.w}x${p.l}`}
                      className={cn(
                        'bg-dark-900 border border-slate-800 rounded-lg px-3 py-2 text-center min-w-[90px] group relative',
                        isAdmin && 'hover:border-slate-600'
                      )}>
                      <p className="text-xs font-mono font-semibold text-slate-200">{p.w}×{p.l}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">mm</p>
                      {isAdmin && (
                        <div className="absolute -top-1.5 -right-1.5 hidden group-hover:flex gap-0.5">
                          <button onClick={() => startEdit(p.idx)} className="bg-dark-700 border border-slate-600 p-0.5 rounded text-primary-400 hover:text-primary-300"><Edit2 size={9} /></button>
                          <button onClick={() => deleteEntry(p.idx)} className="bg-dark-700 border border-slate-600 p-0.5 rounded text-red-500 hover:text-red-400"><X size={9} /></button>
                        </div>
                      )}
                    </div>
                  )
                ))}
                {/* Add size button for this series */}
                {isAdmin && addingSeries === series ? (
                  <div className="bg-dark-900 border border-primary-500/40 rounded-lg px-2 py-1.5 flex items-center gap-1.5">
                    <input
                      type="number"
                      className="w-14 bg-dark-800 border border-slate-700 rounded px-1.5 py-1 text-xs text-white text-center"
                      value={addW}
                      onChange={e => setAddW(e.target.value)}
                      placeholder="W"
                    />
                    <span className="text-slate-500 text-xs">×</span>
                    <input
                      type="number"
                      className="w-14 bg-dark-800 border border-slate-700 rounded px-1.5 py-1 text-xs text-white text-center"
                      value={addL}
                      onChange={e => setAddL(e.target.value)}
                      placeholder="L"
                    />
                    <button onClick={() => addEntry(series)} className="text-green-400 hover:text-green-300 p-0.5"><CheckCircle size={13} /></button>
                    <button onClick={() => { setAddingSeries(null); setAddW(''); setAddL('') }} className="text-slate-500 hover:text-slate-300 p-0.5"><X size={12} /></button>
                  </div>
                ) : isAdmin ? (
                  <button
                    onClick={() => { setAddingSeries(series); setAddW(''); setAddL('') }}
                    className="bg-dark-900 border border-dashed border-slate-700 rounded-lg px-3 py-2 text-slate-500 hover:border-primary-500/50 hover:text-primary-400 transition-colors min-w-[50px] flex items-center justify-center"
                  >
                    <Plus size={13} />
                  </button>
                ) : null}
              </div>
            </div>
          )
        })}

        {/* Add new series */}
        {isAdmin && (
          <div className="mt-4 border-t border-slate-800 pt-4">
            <p className="text-xs text-slate-500 mb-2">Adicionar nova série:</p>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                className="input w-20 text-sm"
                value={addSeries}
                onChange={e => setAddSeries(e.target.value)}
                placeholder="Série (ex: 70)"
              />
              <input
                type="number"
                className="input w-20 text-sm"
                value={addW}
                onChange={e => setAddW(e.target.value)}
                placeholder="W mm"
              />
              <input
                type="number"
                className="input w-20 text-sm"
                value={addL}
                onChange={e => setAddL(e.target.value)}
                placeholder="L mm"
              />
              <button onClick={addNewSeries} className="btn-primary text-sm">
                <Plus size={13} />
                Adicionar Série
              </button>
            </div>
          </div>
        )}

        <div className="mt-4 bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
          <p className="text-xs text-blue-300 font-semibold mb-2">Como o motor seleciona a série</p>
          <ol className="text-xs text-slate-400 space-y-1 list-decimal list-inside">
            <li>Calcula layout das cavidades (1×1, 2×2, 3×4, etc.)</li>
            <li>Determina footprint mínimo necessário (peça × cavidades + paredes + folgas)</li>
            <li>Seleciona o menor tamanho Polimold que comporta o layout</li>
            <li>Aplica espessuras padrão de placa por série (fixH, cavH, punchH, spacerH)</li>
            <li>Calcula peso real do aço e custo total</li>
          </ol>
        </div>
      </div>

      {/* Plate thickness reference */}
      <div className="card">
        <h3 className="font-semibold text-white text-sm mb-3">Espessura Padrão das Placas por Série</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-700">
                {['Série', 'Fix. Sup/Inf', 'Cavidade*', 'Macho*', 'Calços*', 'Extratora', 'Material'].map(h => (
                  <th key={h} className="text-left text-slate-400 py-2 pr-4 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { s: '15-20', fix: 25, cavBase: '+28', punchBase: '+22', spacerBase: '+40', ej: 20, mat: '1045 / P20' },
                { s: '25-30', fix: 28, cavBase: '+32', punchBase: '+26', spacerBase: '+42', ej: 22, mat: '1045 / P20' },
                { s: '35-40', fix: 32, cavBase: '+38', punchBase: '+32', spacerBase: '+45', ej: 22, mat: '1045 / P20 ou H13' },
                { s: '45-50', fix: 35, cavBase: '+45', punchBase: '+38', spacerBase: '+48', ej: 25, mat: '1045 / P20 ou H13' },
                { s: '60+',   fix: 35, cavBase: '+45', punchBase: '+38', spacerBase: '+50', ej: 25, mat: '1045 / P20 ou H13' },
              ].map(r => (
                <tr key={r.s} className="border-b border-slate-800/50 hover:bg-white/[0.02]">
                  <td className="py-2 pr-4 font-bold text-primary-300">Série {r.s}</td>
                  <td className="py-2 pr-4 text-slate-300">{r.fix}mm</td>
                  <td className="py-2 pr-4 text-slate-400">peça.Z{r.cavBase}mm</td>
                  <td className="py-2 pr-4 text-slate-400">peça.Z{r.punchBase}mm</td>
                  <td className="py-2 pr-4 text-slate-400">extração{r.spacerBase}mm</td>
                  <td className="py-2 pr-4 text-slate-300">{r.ej}mm</td>
                  <td className="py-2 text-slate-500">{r.mat}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[11px] text-slate-500 mt-2">* = adicionado ao valor da peça (dimensão Z)</p>
        </div>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────
export default function Pricing() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'

  const [items, setItems] = useState<PricingItem[]>([])
  const [edits, setEdits] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'rates' | 'steel' | 'components' | 'hot_runner' | 'polimold' | 'payments'>('steel')
  const [addModal, setAddModal] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')

  const loadPricing = useCallback(() => {
    api.get('/pricing').then(({ data }) => {
      setItems(data)
      const map: Record<string, number> = {}
      data.forEach((i: PricingItem) => (map[i.key] = i.value))
      setEdits(map)
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadPricing() }, [loadPricing])

  function onChange(key: string, v: number) { setEdits(prev => ({ ...prev, [key]: v })) }

  async function onSave(key: string) {
    setSaving(key)
    try {
      await api.put(`/pricing/${key}`, { value: edits[key] })
      setItems(prev => prev.map(i => i.key === key ? { ...i, value: edits[key] } : i))
      setSaved(key); setTimeout(() => setSaved(null), 2000)
    } finally { setSaving(null) }
  }

  async function onDelete(key: string) {
    if (!confirm(`Remover "${key}" da tabela?`)) return
    try {
      await api.delete(`/pricing/${key}`)
      setItems(prev => prev.filter(i => i.key !== key))
    } catch (e: any) {
      alert(e.response?.data?.error ?? 'Erro ao remover')
    }
  }

  async function seedPricing() {
    setSyncing(true)
    try {
      await api.post('/pricing/seed')
      loadPricing()
      setSyncMsg('Preços de mercado 2024/2025 restaurados com sucesso!')
    } finally {
      setSyncing(false)
      setTimeout(() => setSyncMsg(''), 4000)
    }
  }

  const filterItems = (cat: string) => items.filter(i => getCategory(i.key) === cat)

  const TABS = [
    { id: 'steel',      label: 'Materiais / Aços',  icon: Layers },
    { id: 'rates',      label: 'Hora-Máquina',       icon: Wrench },
    { id: 'components', label: 'Componentes',         icon: Database },
    { id: 'hot_runner', label: 'Câmara Quente',       icon: Flame },
    { id: 'polimold',   label: 'Catálogo Polimold',   icon: DollarSign },
    { id: 'payments',   label: 'Pagamentos',           icon: CreditCard },
  ] as const

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-primary-500" size={32} /></div>
  }

  const tabItems = (activeTab !== 'polimold' && activeTab !== 'payments') ? filterItems(activeTab) : []

  return (
    <div className="max-w-4xl space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Configurações do Sistema</h1>
          <p className="text-slate-400 text-sm mt-1">
            {isAdmin ? 'Edite preços, materiais e parâmetros de cálculo' : 'Referências de custo — somente leitura'}
          </p>
        </div>
        {isAdmin && (
          <button onClick={seedPricing} disabled={syncing} className="btn-ghost text-sm shrink-0">
            {syncing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            Restaurar Padrões
          </button>
        )}
      </div>

      {syncMsg && (
        <div className="bg-green-500/10 border border-green-500/30 text-green-300 text-sm px-4 py-2 rounded-xl">
          {syncMsg}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex bg-dark-900 rounded-xl p-1 border border-slate-800 gap-1 overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveTab(id as any)}
            className={cn(
              'flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap',
              activeTab === id
                ? 'bg-primary-600/20 text-primary-300 border border-primary-600/30'
                : 'text-slate-500 hover:text-slate-300'
            )}>
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'payments' && (
        <div className="card">
          <PaymentTermsEditor />
        </div>
      )}

      {activeTab !== 'polimold' && activeTab !== 'payments' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-white">
                {activeTab === 'steel' && 'Materiais e Aços'}
                {activeTab === 'rates' && 'Taxa Horária por Processo'}
                {activeTab === 'components' && 'Componentes Polimold'}
                {activeTab === 'hot_runner' && 'Câmara Quente'}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {activeTab === 'steel' && 'Preços de mercado por kg — fontes: Aços Nobre, GGD Metals (2024)'}
                {activeTab === 'rates' && 'Taxa horária por processo — pesquisa Usinagem Brasil / GRV 2024 · SP'}
                {activeTab === 'components' && 'Componentes padrão Polimold — preço por conjunto'}
                {activeTab === 'hot_runner' && 'Valores por bico, manifold e derivações — equivalente Synventive/Incoe 2024'}
              </p>
            </div>
            {isAdmin && (
              <button onClick={() => setAddModal(true)} className="btn-primary text-sm">
                <Plus size={13} />
                Adicionar
              </button>
            )}
          </div>

          {/* Hot runner preview */}
          {activeTab === 'hot_runner' && (
            <div className="mb-4 bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
              <p className="text-xs text-amber-400 font-semibold uppercase tracking-wide mb-3">Simulação de Custo por Nº de Bicos</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[1, 2, 4, 8, 12, 16, 24, 32].map(n => (
                  <div key={n} className="bg-dark-900 rounded-lg px-3 py-2 border border-slate-800">
                    <p className="text-xs text-slate-400">{n} {n === 1 ? 'bico' : 'bicos'}</p>
                    <p className="text-sm font-bold text-amber-400">{BRL.format(calcHotRunnerCost(n, items))}</p>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-slate-500 mt-2">Calculado automaticamente com os valores abaixo</p>
            </div>
          )}

          {tabItems.length === 0 && (
            <div className="text-center py-10 text-slate-500 text-sm">
              Nenhum item nesta categoria.
              {isAdmin && <span className="text-primary-400 ml-1 cursor-pointer" onClick={() => setAddModal(true)}>Adicionar →</span>}
            </div>
          )}

          {tabItems.map(item => (
            <ItemRow key={item.key} item={item} isAdmin={isAdmin}
              edits={edits} onChange={onChange} onSave={onSave} onDelete={onDelete}
              saving={saving} saved={saved} />
          ))}
        </div>
      )}

      {/* ── Catálogo Polimold ── */}
      {activeTab === 'polimold' && (
        <div className="card">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="font-semibold text-white">Catálogo Polimold — Porta-Moldes Padrão</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Dimensões normalizadas · Seleção automática pelo motor de cálculo
              </p>
            </div>
            <a
              href="/api/config/polimold/download"
              download="catalogo-polimold.csv"
              className="btn-primary text-sm shrink-0 flex items-center gap-2"
            >
              <Download size={13} />
              Baixar CSV
            </a>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 border-b border-slate-700">
                  <th className="text-left pb-2">Série</th>
                  <th className="text-right pb-2">Largura (mm)</th>
                  <th className="text-right pb-2">Comprimento (mm)</th>
                </tr>
              </thead>
              <tbody>
                {POLIMOLD_CATALOG.map((e, i) => (
                  <tr key={i} className="border-b border-slate-800 hover:bg-slate-800/30">
                    <td className="py-1.5 text-primary-400 font-medium">Série {e.series}</td>
                    <td className="py-1.5 text-right text-white">{e.w}</td>
                    <td className="py-1.5 text-right text-white">{e.l}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {addModal && (
        <AddItemModal
          category={activeTab === 'polimold' ? 'other' : activeTab}
          onAdd={(item) => { setItems(prev => [...prev, item as PricingItem]); setEdits(prev => ({ ...prev, [item.key]: item.value })) }}
          onClose={() => setAddModal(false)}
        />
      )}
    </div>
  )
}
