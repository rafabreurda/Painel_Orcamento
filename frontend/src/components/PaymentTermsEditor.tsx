import { useEffect, useState } from 'react'
import { Plus, Trash2, Save, AlertCircle } from 'lucide-react'
import api from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'

interface PaymentTerm {
  label: string
  pct: number
}

export function PaymentTermsEditor() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  const [terms, setTerms] = useState<PaymentTerm[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/config/PAYMENT_TERMS')
      .then((r: any) => setTerms(r.data.value))
      .catch(() => {
        setTerms([
          { label: '40% na assinatura do contrato', pct: 0.4 },
          { label: '30% na entrega das primeiras amostras (T1)', pct: 0.3 },
          { label: '30% na aprovação final e entrega', pct: 0.3 },
        ])
      })
      .finally(() => setLoading(false))
  }, [])

  const totalPct = terms.reduce((s, t) => s + t.pct, 0)
  const totalOk = Math.abs(totalPct - 1) < 0.001

  const update = (idx: number, field: keyof PaymentTerm, val: string) => {
    setTerms(prev => prev.map((t, i) =>
      i === idx ? { ...t, [field]: field === 'pct' ? parseFloat(val) / 100 : val } : t
    ))
  }

  const add = () => setTerms(prev => [...prev, { label: 'Nova parcela', pct: 0 }])
  const remove = (idx: number) => setTerms(prev => prev.filter((_, i) => i !== idx))

  const save = async () => {
    if (!totalOk) { setError('A soma das parcelas deve ser 100%'); return }
    setSaving(true); setError('')
    try {
      await api.put('/config/PAYMENT_TERMS', { value: terms })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setError('Erro ao salvar. Verifique suas permissões.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-8">
      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-white font-semibold">Parcelas de Pagamento</h3>
          <p className="text-slate-400 text-sm mt-0.5">
            Define como o valor é parcelado nas propostas PDF
          </p>
        </div>
        <div className={`text-sm font-medium px-3 py-1 rounded-full ${
          totalOk ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
        }`}>
          {(totalPct * 100).toFixed(0)}% total
        </div>
      </div>

      <div className="space-y-2">
        {terms.map((term, idx) => (
          <div key={idx} className="flex items-center gap-3 bg-slate-800/50 border border-slate-700/50
                                    rounded-xl p-3">
            <div className="flex-1">
              <input
                type="text"
                value={term.label}
                onChange={e => update(idx, 'label', e.target.value)}
                disabled={!isAdmin}
                className="w-full bg-transparent text-white text-sm outline-none
                           disabled:text-slate-400 placeholder-slate-500"
                placeholder="Descrição da parcela"
              />
            </div>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={(term.pct * 100).toFixed(0)}
                onChange={e => update(idx, 'pct', e.target.value)}
                disabled={!isAdmin}
                min="0" max="100"
                className="w-16 bg-slate-700/50 border border-slate-600/50 rounded-lg
                           text-white text-sm text-right px-2 py-1 outline-none
                           focus:border-blue-500 disabled:text-slate-400"
              />
              <span className="text-slate-400 text-sm">%</span>
            </div>
            {isAdmin && (
              <button
                onClick={() => remove(idx)}
                className="text-slate-500 hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
      </div>

      {isAdmin && (
        <div className="flex items-center gap-3">
          <button
            onClick={add}
            className="flex items-center gap-2 text-blue-400 hover:text-blue-300
                       text-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            Adicionar parcela
          </button>
          <button
            onClick={save}
            disabled={saving || !totalOk}
            className="ml-auto flex items-center gap-2 bg-blue-600 hover:bg-blue-500
                       disabled:opacity-50 text-white text-sm font-medium
                       px-4 py-2 rounded-xl transition-colors"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Salvando…' : saved ? 'Salvo!' : 'Salvar'}
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {!totalOk && !error && (
        <div className="flex items-center gap-2 text-amber-400 text-sm">
          <AlertCircle className="w-4 h-4" />
          A soma deve ser exatamente 100% (atual: {(totalPct * 100).toFixed(1)}%)
        </div>
      )}
    </div>
  )
}
