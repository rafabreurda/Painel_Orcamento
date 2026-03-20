import { useState } from 'react'
import api from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Save, Key, Sliders, Loader2, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

const AVATAR_COLORS = [
  '#3b82f6', '#8b5cf6', '#06b6d4', '#10b981',
  '#f59e0b', '#ef4444', '#ec4899', '#14b8a6',
]

export default function MySettings() {
  const { user, updateUser } = useAuth()

  const [config, setConfig] = useState({
    defaultRiskMargin:   user?.defaultRiskMargin ?? 15,
    defaultProfitMargin: user?.defaultProfitMargin ?? 20,
    defaultTaxRate:      user?.defaultTaxRate ?? 8,
    defaultSteelType:    user?.defaultSteelType ?? 'P20',
    defaultPolishLevel:  user?.defaultPolishLevel ?? 'STANDARD',
    defaultCavities:     user?.defaultCavities ?? 1,
    avatarColor:         user?.avatarColor ?? '#3b82f6',
  })

  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' })
  const [savingConfig, setSavingConfig] = useState(false)
  const [savingPass, setSavingPass] = useState(false)
  const [configOk, setConfigOk] = useState(false)
  const [passOk, setPassOk] = useState(false)
  const [passError, setPassError] = useState('')

  async function saveConfig() {
    setSavingConfig(true)
    try {
      const { data } = await api.patch('/auth/my-config', config)
      updateUser(data)
      setConfigOk(true)
      setTimeout(() => setConfigOk(false), 2500)
    } finally {
      setSavingConfig(false)
    }
  }

  async function savePassword() {
    setPassError('')
    if (passwords.next !== passwords.confirm) return setPassError('As senhas não coincidem')
    if (passwords.next.length < 4) return setPassError('Mínimo 4 caracteres')
    setSavingPass(true)
    try {
      await api.patch('/auth/change-password', {
        currentPassword: passwords.current,
        newPassword: passwords.next,
      })
      setPasswords({ current: '', next: '', confirm: '' })
      setPassOk(true)
      setTimeout(() => setPassOk(false), 2500)
    } catch (e: any) {
      setPassError(e.response?.data?.error || 'Erro ao alterar senha')
    } finally {
      setSavingPass(false)
    }
  }

  if (!user) return null

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Minhas Configurações</h1>
        <p className="text-slate-400 text-sm mt-1">Personalize sua experiência no sistema</p>
      </div>

      {/* Profile card */}
      <div className="card flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-lg"
          style={{ backgroundColor: config.avatarColor }}>
          {user.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="font-bold text-white text-lg">{user.name}</p>
          <p className="text-slate-400 text-sm">@{user.username}</p>
          <p className="text-xs mt-0.5 px-2 py-0.5 rounded-full inline-block bg-primary-500/10 text-primary-400 border border-primary-500/30">
            {{ADMIN: 'Administrador', ENGINEER: 'Engenheiro', SALESPERSON: 'Vendedor'}[user.role]}
          </p>
        </div>
      </div>

      {/* Defaults */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Sliders size={16} className="text-primary-400" />
          <h2 className="font-semibold text-white">Valores Padrão para Orçamentos</h2>
        </div>
        <p className="text-xs text-slate-400">
          Quando você criar um novo orçamento, estes valores serão pré-preenchidos automaticamente.
        </p>

        {/* Avatar color */}
        <div>
          <label className="label">Cor do Avatar</label>
          <div className="flex gap-2 flex-wrap">
            {AVATAR_COLORS.map(c => (
              <button key={c} onClick={() => setConfig({ ...config, avatarColor: c })}
                className={cn('w-9 h-9 rounded-xl transition-all', config.avatarColor === c ? 'ring-2 ring-white scale-110' : 'opacity-60 hover:opacity-100')}
                style={{ backgroundColor: c }} />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Risco / Gordura (%)</label>
            <input type="number" className="input" value={config.defaultRiskMargin}
              onChange={e => setConfig({ ...config, defaultRiskMargin: Number(e.target.value) })} min={0} max={100} />
          </div>
          <div>
            <label className="label">Margem de Lucro (%)</label>
            <input type="number" className="input" value={config.defaultProfitMargin}
              onChange={e => setConfig({ ...config, defaultProfitMargin: Number(e.target.value) })} min={0} max={100} />
          </div>
          <div>
            <label className="label">Impostos (%)</label>
            <input type="number" className="input" value={config.defaultTaxRate}
              onChange={e => setConfig({ ...config, defaultTaxRate: Number(e.target.value) })} min={0} max={100} />
          </div>
          <div>
            <label className="label">Cavidades padrão</label>
            <input type="number" className="input" value={config.defaultCavities}
              onChange={e => setConfig({ ...config, defaultCavities: Number(e.target.value) })} min={1} max={64} />
          </div>
          <div>
            <label className="label">Aço padrão</label>
            <select className="input" value={config.defaultSteelType}
              onChange={e => setConfig({ ...config, defaultSteelType: e.target.value })}>
              <option value="S1045">Aço 1045</option>
              <option value="P20">Aço P20</option>
              <option value="H13">Aço H13</option>
            </select>
          </div>
          <div>
            <label className="label">Polimento padrão</label>
            <select className="input" value={config.defaultPolishLevel}
              onChange={e => setConfig({ ...config, defaultPolishLevel: e.target.value })}>
              <option value="STANDARD">Padrão</option>
              <option value="SEMI_GLOSS">Semi-brilho</option>
              <option value="MIRROR">Espelho</option>
            </select>
          </div>
        </div>

        <button onClick={saveConfig} disabled={savingConfig} className="btn-primary">
          {savingConfig ? <Loader2 size={14} className="animate-spin" /> : configOk ? <CheckCircle size={14} /> : <Save size={14} />}
          {configOk ? 'Salvo!' : 'Salvar Configurações'}
        </button>
      </div>

      {/* Change password */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Key size={16} className="text-amber-400" />
          <h2 className="font-semibold text-white">Alterar Senha</h2>
        </div>

        <div>
          <label className="label">Senha Atual</label>
          <input type="password" className="input" value={passwords.current}
            onChange={e => setPasswords({ ...passwords, current: e.target.value })} placeholder="••••••" />
        </div>
        <div>
          <label className="label">Nova Senha</label>
          <input type="password" className="input" value={passwords.next}
            onChange={e => setPasswords({ ...passwords, next: e.target.value })} placeholder="••••••" />
        </div>
        <div>
          <label className="label">Confirmar Nova Senha</label>
          <input type="password" className="input" value={passwords.confirm}
            onChange={e => setPasswords({ ...passwords, confirm: e.target.value })} placeholder="••••••" />
        </div>

        {passError && <p className="text-red-400 text-sm">{passError}</p>}
        {passOk && <p className="text-green-400 text-sm flex items-center gap-2"><CheckCircle size={14} /> Senha alterada!</p>}

        <button onClick={savePassword} disabled={savingPass || !passwords.current || !passwords.next} className="btn-primary">
          {savingPass ? <Loader2 size={14} className="animate-spin" /> : <Key size={14} />}
          Alterar Senha
        </button>
      </div>
    </div>
  )
}
