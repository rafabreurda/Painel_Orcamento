import { useEffect, useState, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import api from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Save, Upload, RefreshCw, Loader2, DollarSign, CheckCircle } from 'lucide-react'
import { BRL } from '@/lib/utils'

interface PricingItem {
  id: string; key: string; label: string; value: number; unit: string; updatedAt: string
}

export default function Pricing() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  const [items, setItems] = useState<PricingItem[]>([])
  const [edits, setEdits] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')

  useEffect(() => {
    api.get('/pricing').then(({ data }) => {
      setItems(data)
      const map: Record<string, number> = {}
      data.forEach((i: PricingItem) => (map[i.key] = i.value))
      setEdits(map)
    }).finally(() => setLoading(false))
  }, [])

  async function saveItem(key: string) {
    setSaving(key)
    try {
      await api.put(`/pricing/${key}`, { value: edits[key] })
      setItems(prev => prev.map(i => i.key === key ? { ...i, value: edits[key] } : i))
      setSaved(key)
      setTimeout(() => setSaved(null), 2000)
    } finally {
      setSaving(null)
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/vnd.ms-excel': ['.xls'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
    multiple: false,
    onDrop: async (files) => {
      if (!files[0]) return
      setSyncing(true)
      const fd = new FormData()
      fd.append('file', files[0])
      try {
        const { data } = await api.post('/pricing/sync', fd)
        setSyncMsg(`✅ ${data.message}`)
        const { data: refreshed } = await api.get('/pricing')
        setItems(refreshed)
        const map: Record<string, number> = {}
        refreshed.forEach((i: PricingItem) => (map[i.key] = i.value))
        setEdits(map)
      } catch {
        setSyncMsg('❌ Erro ao importar planilha')
      } finally {
        setSyncing(false)
        setTimeout(() => setSyncMsg(''), 5000)
      }
    },
  })

  async function seedPricing() {
    setSyncing(true)
    try {
      await api.post('/pricing/seed')
      const { data } = await api.get('/pricing')
      setItems(data)
      const map: Record<string, number> = {}
      data.forEach((i: PricingItem) => (map[i.key] = i.value))
      setEdits(map)
      setSyncMsg('✅ Tabela restaurada para valores padrão')
    } finally {
      setSyncing(false)
      setTimeout(() => setSyncMsg(''), 4000)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-primary-500" size={32} /></div>
  }

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Tabela de Preços</h1>
        <p className="text-slate-400 text-sm mt-1">
          {isAdmin ? 'Edite os valores que alimentam todos os cálculos' : 'Preços de referência — somente leitura'}
        </p>
      </div>

      {/* Import XLSX — admin only */}
      {isAdmin && (
        <div className="card space-y-3">
          <h2 className="font-semibold text-white text-sm">Sincronizar com Planilha Euromoldes</h2>
          <p className="text-xs text-slate-400">
            Importe o arquivo XLSX com colunas: <code className="bg-dark-900 px-1 py-0.5 rounded">CHAVE, VALOR, DESCRICAO, UNIDADE</code>
          </p>

          <div {...getRootProps()} className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-colors
            ${isDragActive ? 'border-primary-500 bg-primary-500/5' : 'border-slate-700 hover:border-slate-600'}`}>
            <input {...getInputProps()} />
            {syncing
              ? <Loader2 size={20} className="mx-auto animate-spin text-primary-400" />
              : <Upload size={20} className="mx-auto text-slate-500" />
            }
            <p className="text-sm text-slate-400 mt-2">
              {isDragActive ? 'Solte o arquivo aqui' : 'Arraste o XLSX da planilha Euromoldes'}
            </p>
          </div>

          {syncMsg && (
            <p className="text-sm text-center text-slate-300">{syncMsg}</p>
          )}

          <div className="flex justify-end">
            <button onClick={seedPricing} disabled={syncing} className="btn-ghost text-sm">
              <RefreshCw size={13} />
              Restaurar Padrões
            </button>
          </div>
        </div>
      )}

      {/* Pricing table */}
      <div className="card space-y-0 divide-y divide-slate-800">
        <h2 className="font-semibold text-white text-sm pb-3">Valores Atuais</h2>
        {items.map((item) => (
          <div key={item.key} className="flex items-center gap-3 py-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-200">{item.label}</p>
              <p className="text-xs text-slate-500 font-mono">{item.key} · {item.unit}</p>
            </div>
            {isAdmin ? (
              <div className="flex items-center gap-2 shrink-0">
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs">R$</span>
                  <input
                    type="number"
                    className="input w-28 pl-7 text-right"
                    value={edits[item.key] ?? item.value}
                    onChange={(e) => setEdits({ ...edits, [item.key]: parseFloat(e.target.value) || 0 })}
                    step={0.01}
                  />
                </div>
                <button
                  onClick={() => saveItem(item.key)}
                  disabled={saving === item.key || edits[item.key] === item.value}
                  className={`p-2 rounded-lg transition-colors ${
                    edits[item.key] !== item.value
                      ? 'text-primary-400 hover:bg-primary-500/10'
                      : 'text-slate-600'
                  }`}
                >
                  {saving === item.key
                    ? <Loader2 size={14} className="animate-spin" />
                    : saved === item.key
                      ? <CheckCircle size={14} className="text-green-400" />
                      : <Save size={14} />
                  }
                </button>
              </div>
            ) : (
              <span className="font-bold text-primary-400 text-sm shrink-0">
                {BRL.format(item.value)} <span className="text-slate-500 font-normal text-xs">/{item.unit.replace('R$/', '')}</span>
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
