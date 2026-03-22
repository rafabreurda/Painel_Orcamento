import { useState, useCallback, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import api from '@/lib/api'
import {
  Sparkles, Upload, Loader2, CheckCircle, AlertCircle,
  Camera, Zap, RefreshCw, RotateCcw, FileText
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
  { icon: Camera,      label: 'Capturando arquivo...',    duration: 800  },
  { icon: Sparkles,    label: 'Identificando geometria...', duration: 1200 },
  { icon: Zap,         label: 'Calculando dimensões...',  duration: 1000 },
  { icon: Sparkles,    label: 'Definindo configuração...', duration: 900  },
  { icon: CheckCircle, label: 'Análise concluída!',       duration: 600  },
]

const PDF_PREVIEW = 'pdf'

export default function PhotoAnalyzer({ onAnalysis }: Props) {
  const [preview, setPreview] = useState<string | null>(null)
  const [isPdfPreview, setIsPdfPreview] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [stepIdx, setStepIdx] = useState(0)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const prevObjectUrlRef = useRef<string | null>(null)
  // Ref sempre atualizado — evita stale closure em processFile/runSteps
  const onAnalysisRef = useRef(onAnalysis)
  onAnalysisRef.current = onAnalysis

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
      fd.append('file', file, file.name || 'product.jpg')
      const { data } = await api.post('/vision/analyze', fd, { timeout: 20000 })
      setStepIdx(STEPS.length - 1)
      await new Promise(r => setTimeout(r, 500))
      setDone(true)
      onAnalysisRef.current(data.analysis, imageUrl)
    } catch (e: any) {
      if (e.response?.status === 413) {
        setError('Imagem muito grande. Tire uma foto menor ou use JPEG.')
      } else if (e.code === 'ECONNABORTED') {
        setError('Tempo esgotado. Tente uma foto menor.')
      } else {
        const detail = e.response?.data?.detail || e.response?.data?.error || e.message || ''
        setError(`Erro na análise: ${detail || 'Tente novamente.'}`)
      }
    } finally {
      setAnalyzing(false)
    }
  }

  const compressImage = (file: File): Promise<{ blob: Blob; url: string }> => {
    return new Promise((resolve, reject) => {
      // Timeout: if compression takes > 8s, reject
      const timeout = setTimeout(() => {
        reject(new Error('Timeout ao comprimir imagem'))
      }, 8000)

      const img = new Image()
      const objectUrl = URL.createObjectURL(file)

      img.onload = () => {
        try {
          // Keep canvas small to avoid crashing mobile/desktop tabs
          // 640px @ 0.65 produces ~80-250 KB — plenty for AI vision analysis
          const MAX = 640
          const QUALITY = 0.65

          let { width, height } = img
          if (width > MAX || height > MAX) {
            if (width > height) { height = Math.round(height * MAX / width); width = MAX }
            else { width = Math.round(width * MAX / height); height = MAX }
          }

          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            clearTimeout(timeout)
            URL.revokeObjectURL(objectUrl)
            reject(new Error('Canvas não disponível'))
            return
          }
          ctx.drawImage(img, 0, 0, width, height)

          canvas.toBlob(blob => {
            clearTimeout(timeout)
            // Revoke original objectUrl only AFTER we have the compressed result
            URL.revokeObjectURL(objectUrl)
            if (blob) {
              const dataUrl = canvas.toDataURL('image/jpeg', QUALITY)
              canvas.width = 0
              canvas.height = 0
              resolve({ blob, url: dataUrl })
            } else {
              canvas.width = 0
              canvas.height = 0
              reject(new Error('Falha ao comprimir imagem'))
            }
          }, 'image/jpeg', QUALITY)
        } catch (err) {
          clearTimeout(timeout)
          URL.revokeObjectURL(objectUrl)
          reject(err)
        }
      }
      img.onerror = () => {
        clearTimeout(timeout)
        URL.revokeObjectURL(objectUrl)
        reject(new Error('Falha ao carregar imagem'))
      }
      img.src = objectUrl
    })
  }

  const processFile = useCallback(async (file: File) => {
    setDone(false)
    setError('')
    setIsPdfPreview(false)

    // Revoke previous object URL to free memory
    if (prevObjectUrlRef.current) {
      URL.revokeObjectURL(prevObjectUrlRef.current)
      prevObjectUrlRef.current = null
    }

    const isPdf = file.type === 'application/pdf'

    if (isPdf) {
      if (file.size > 10 * 1024 * 1024) {
        setError('PDF muito grande (máx 10MB). Tente um arquivo menor.')
        return
      }
      setPreview(PDF_PREVIEW)
      setIsPdfPreview(true)
      await runSteps(file, PDF_PREVIEW)
      return
    }

    // Hard limit: reject files > 25MB immediately before canvas crashes the tab
    if (file.size > 25 * 1024 * 1024) {
      setError('Foto muito grande (máx 25MB). Use uma foto com menos de 25MB.')
      return
    }

    // Image path: show temporary placeholder while compressing
    const tempUrl = URL.createObjectURL(file)
    prevObjectUrlRef.current = tempUrl
    setPreview(tempUrl)

    try {
      const { blob, url: compressedUrl } = await compressImage(file)
      const compressed = new File([blob], 'product.jpg', { type: 'image/jpeg' })

      // Replace preview with compressed version; revoke the temp blob URL
      if (prevObjectUrlRef.current === tempUrl) {
        URL.revokeObjectURL(tempUrl)
        prevObjectUrlRef.current = null
      }
      setPreview(compressedUrl)

      await runSteps(compressed, compressedUrl)
    } catch (compressErr) {
      // Compression failed — do NOT try with original (would crash browser)
      URL.revokeObjectURL(tempUrl)
      prevObjectUrlRef.current = null
      setPreview(null)
      setError('Erro ao processar imagem. Tente uma foto menor ou tire uma nova foto.')
      setAnalyzing(false)
      return
    }
  }, [])

  const onDrop = useCallback(async (files: File[]) => {
    const file = files[0]
    if (!file) return
    await processFile(file)
  }, [processFile])

  function handleCameraCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    processFile(file)
    e.target.value = '' // reset so same file can be re-selected
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [], 'application/pdf': [] },
    multiple: false,
    disabled: analyzing,
  })

  const currentStep = STEPS[stepIdx]

  return (
    <div className="space-y-3">
      {/* Hidden native camera input — capture for mobile */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleCameraCapture}
      />

      {/* Drop zone */}
      {!preview && (
        <div className="space-y-2">
          <div
            {...getRootProps()}
            className={cn(
              'relative border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-300',
              isDragActive
                ? 'border-primary-400 bg-primary-500/10 scale-[1.02]'
                : 'border-slate-600 hover:border-primary-500 hover:bg-primary-500/5'
            )}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-600 to-purple-600 flex items-center justify-center shadow-lg shadow-primary-600/30">
                <Sparkles size={24} className="text-white" />
              </div>
              <div>
                <p className="font-semibold text-white text-sm">
                  Arraste a foto ou PDF, ou clique para escolher
                </p>
                <p className="text-slate-400 text-xs mt-1">
                  A IA detecta: dimensões, cavidades, tipo de injeção
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1"><Upload size={10} /> JPG, PNG, PDF</span>
                <span className="flex items-center gap-1"><Zap size={10} /> Análise em 3s</span>
                <span className="flex items-center gap-1"><CheckCircle size={10} /> Auto-preenche</span>
              </div>
            </div>
          </div>

          {/* Camera button — prominent on mobile */}
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-primary-600/40 bg-primary-600/10 text-primary-300 font-medium text-sm hover:bg-primary-600/20 transition-all active:scale-[0.98]"
          >
            <Camera size={16} />
            Tirar foto com a câmera
          </button>
        </div>
      )}

      {/* Preview + analyzing overlay */}
      {preview && (
        <div className="relative rounded-2xl overflow-hidden border border-slate-700 bg-dark-900">
          {isPdfPreview ? (
            /* PDF icon preview */
            <div className="flex flex-col items-center justify-center gap-3 py-10">
              <div className="w-20 h-20 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center">
                <FileText size={36} className="text-red-400" />
              </div>
              <div className="text-center">
                <p className="text-white text-sm font-semibold">Desenho PDF</p>
                <p className="text-slate-400 text-xs mt-0.5">Enviando para análise IA...</p>
              </div>
            </div>
          ) : (
            <img
              src={preview}
              className="w-full object-cover"
              style={{ maxHeight: 320 }}
              alt="Produto"
            />
          )}

          {/* Scan overlay during analysis */}
          {analyzing && (
            <div className="absolute inset-0 bg-dark-950/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
              {/* Scan lines animation */}
              {!isPdfPreview && (
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  <div
                    className="w-full h-0.5 bg-gradient-to-r from-transparent via-primary-400 to-transparent opacity-70"
                    style={{ animation: 'scanLine 1.5s ease-in-out infinite', position: 'absolute' }}
                  />
                </div>
              )}

              {/* Corner markers */}
              {!isPdfPreview && [['top-3 left-3', 'border-t-2 border-l-2'],
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
            <div className="absolute top-2 right-2 flex gap-1.5">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="bg-dark-900/80 border border-slate-700 p-1.5 rounded-lg hover:bg-dark-800 transition-colors"
                title="Tirar nova foto com câmera"
              >
                <Camera size={13} className="text-primary-400" />
              </button>
              <button
                {...getRootProps()}
                onClick={e => e.stopPropagation()}
                className="bg-dark-900/80 border border-slate-700 p-1.5 rounded-lg hover:bg-dark-800 transition-colors"
                title="Escolher novo arquivo"
              >
                <input {...getInputProps()} />
                <RefreshCw size={13} className="text-slate-400" />
              </button>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-center justify-between gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/30 px-3 py-2 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertCircle size={14} className="shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setError('')
              setPreview(null)
              setIsPdfPreview(false)
              if (prevObjectUrlRef.current) {
                URL.revokeObjectURL(prevObjectUrlRef.current)
                prevObjectUrlRef.current = null
              }
            }}
            className="shrink-0 flex items-center gap-1 text-xs text-red-300 hover:text-white bg-red-500/20 hover:bg-red-500/40 px-2 py-1 rounded-md transition-colors"
          >
            <RotateCcw size={11} />
            Tentar novamente
          </button>
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
