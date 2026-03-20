import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import api from '@/lib/api'
import {
  Sparkles, Upload, Loader2, CheckCircle, AlertCircle,
  Camera, Zap, RefreshCw
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface MoldAnalysis {
  productDescription: string
  productType: string
  complexity: string
  estimatedDimensions: { x: number; y: number; z: number }
  suggestedCavities: number
  injectionType: string
  nozzleCount: number
  needsDrawers: boolean
  drawerCount: number
  suggestedSteel: string
  suggestedPolish: string
  moldSeries: string
  estimatedCycles: string
  technicalNotes: string[]
  warnings: string[]
  cavityLayout: string
}

interface Props {
  onAnalysis: (analysis: MoldAnalysis, imagePreview: string) => void
}

const STEPS = [
  { icon: Camera,   label: 'Capturando imagem...',     duration: 800  },
  { icon: Sparkles, label: 'Identificando geometria...', duration: 1200 },
  { icon: Zap,      label: 'Calculando dimensões...',  duration: 1000 },
  { icon: Sparkles, label: 'Definindo configuração...', duration: 900  },
  { icon: CheckCircle, label: 'Análise concluída!',    duration: 600  },
]

export default function PhotoAnalyzer({ onAnalysis }: Props) {
  const [preview, setPreview] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [stepIdx, setStepIdx] = useState(0)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const runSteps = async (file: File, imageUrl: string) => {
    setAnalyzing(true)
    setDone(false)
    setError('')

    // Animate steps
    for (let i = 0; i < STEPS.length - 1; i++) {
      setStepIdx(i)
      await new Promise(r => setTimeout(r, STEPS[i].duration))
    }

    try {
      const fd = new FormData()
      fd.append('file', file)
      const { data } = await api.post('/vision/analyze', fd)
      setStepIdx(STEPS.length - 1)
      await new Promise(r => setTimeout(r, 500))
      setDone(true)
      onAnalysis(data.analysis, imageUrl)
    } catch (e: any) {
      setError('Erro na análise. Tente novamente.')
    } finally {
      setAnalyzing(false)
    }
  }

  const onDrop = useCallback(async (files: File[]) => {
    const file = files[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setPreview(url)
    setDone(false)
    await runSteps(file, url)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    multiple: false,
    disabled: analyzing,
  })

  const currentStep = STEPS[stepIdx]

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      {!preview && (
        <div
          {...getRootProps()}
          className={cn(
            'relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-300',
            isDragActive
              ? 'border-primary-400 bg-primary-500/10 scale-[1.02]'
              : 'border-slate-600 hover:border-primary-500 hover:bg-primary-500/5'
          )}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-600 to-purple-600 flex items-center justify-center shadow-lg shadow-primary-600/30">
              <Sparkles size={28} className="text-white" />
            </div>
            <div>
              <p className="font-semibold text-white text-base">
                Solte a foto do produto aqui
              </p>
              <p className="text-slate-400 text-sm mt-1">
                A IA detecta automaticamente: dimensões, cavidades, tipo de injeção
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-500 mt-1">
              <span className="flex items-center gap-1"><Camera size={11} /> Foto real</span>
              <span className="flex items-center gap-1"><Zap size={11} /> Análise em 3s</span>
              <span className="flex items-center gap-1"><CheckCircle size={11} /> Auto-preenche</span>
            </div>
          </div>
        </div>
      )}

      {/* Preview + analyzing overlay */}
      {preview && (
        <div className="relative rounded-2xl overflow-hidden border border-slate-700 bg-dark-900">
          <img
            src={preview}
            className="w-full object-cover"
            style={{ maxHeight: 220 }}
            alt="Produto"
          />

          {/* Scan overlay during analysis */}
          {analyzing && (
            <div className="absolute inset-0 bg-dark-950/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
              {/* Scan lines animation */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div
                  className="w-full h-0.5 bg-gradient-to-r from-transparent via-primary-400 to-transparent opacity-70"
                  style={{ animation: 'scanLine 1.5s ease-in-out infinite', position: 'absolute' }}
                />
              </div>

              {/* Corner markers */}
              {[['top-3 left-3', 'border-t-2 border-l-2'],
                ['top-3 right-3', 'border-t-2 border-r-2'],
                ['bottom-3 left-3', 'border-b-2 border-l-2'],
                ['bottom-3 right-3', 'border-b-2 border-r-2']
              ].map(([pos, border], i) => (
                <div key={i} className={`absolute ${pos} w-6 h-6 ${border} border-primary-400 opacity-80`} />
              ))}

              <div className="text-center z-10">
                <div className="flex items-center gap-2 mb-3 justify-center">
                  <currentStep.icon size={18} className="text-primary-400 animate-pulse" />
                  <span className="text-primary-300 font-medium text-sm">{currentStep.label}</span>
                </div>

                {/* Step progress */}
                <div className="flex gap-1.5 justify-center">
                  {STEPS.map((_, i) => (
                    <div
                      key={i}
                      className={cn('h-1 rounded-full transition-all duration-300',
                        i < stepIdx ? 'w-6 bg-primary-400'
                        : i === stepIdx ? 'w-8 bg-primary-300'
                        : 'w-6 bg-slate-700'
                      )}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Done overlay */}
          {done && !analyzing && (
            <div className="absolute inset-0 bg-green-500/10 border border-green-500/40 rounded-2xl flex items-center justify-center">
              <div className="flex items-center gap-2 bg-dark-900/90 px-4 py-2 rounded-full border border-green-500/40">
                <CheckCircle size={16} className="text-green-400" />
                <span className="text-green-300 text-sm font-medium">Análise aplicada com sucesso</span>
              </div>
            </div>
          )}

          {/* Re-analyze button */}
          {!analyzing && (
            <button
              {...getRootProps()}
              onClick={e => e.stopPropagation()}
              className="absolute top-2 right-2 bg-dark-900/80 border border-slate-700 p-1.5 rounded-lg hover:bg-dark-800 transition-colors"
              title="Nova foto"
            >
              <input {...getInputProps()} />
              <RefreshCw size={13} className="text-slate-400" />
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/30 px-3 py-2 rounded-lg">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      <style>{`
        @keyframes scanLine {
          0% { top: 0%; }
          100% { top: 100%; }
        }
      `}</style>
    </div>
  )
}
