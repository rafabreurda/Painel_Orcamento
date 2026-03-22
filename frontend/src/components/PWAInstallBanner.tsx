import { useState } from 'react'
import { Download, X, Smartphone } from 'lucide-react'
import { usePWAInstall } from '../hooks/usePWAInstall'

export function PWAInstallBanner() {
  const { isInstallable, install } = usePWAInstall()
  const [dismissed, setDismissed] = useState(false)

  if (!isInstallable || dismissed) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:w-96 z-50
                    bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl shadow-2xl
                    border border-blue-500/30 p-4 flex items-center gap-3 animate-slide-up">
      <div className="flex-shrink-0 w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
        <Smartphone className="w-5 h-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold text-sm">Instalar NeuroFlux Mold</p>
        <p className="text-blue-200 text-xs mt-0.5">Acesso rápido, funciona offline</p>
      </div>
      <button
        onClick={install}
        className="flex-shrink-0 bg-white text-blue-700 font-semibold text-xs px-3 py-1.5
                   rounded-lg hover:bg-blue-50 transition-colors flex items-center gap-1.5"
      >
        <Download className="w-3.5 h-3.5" />
        Instalar
      </button>
      <button
        onClick={() => setDismissed(true)}
        className="flex-shrink-0 text-blue-200 hover:text-white transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
