import { useState, useCallback, useRef, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import api from '@/lib/api'
import {
  Sparkles, Upload, Loader2, CheckCircle, AlertCircle,
  Camera, Zap, RefreshCw, RotateCcw, FileText, X, Maximize
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
  
  // Scanner state
  const [isScannerOpen, setIsScannerOpen] = useState(false)
  const [cameraLoading, setCameraLoading] = useState(false)
  
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const prevObjectUrlRef = useRef<string | null>(null)
  
  const onAnalysisRef = useRef(onAnalysis)
  onAnalysisRef.current = onAnalysis

  // Cleanup effect
  useEffect(() => {
    return () => {
      stopScanner()
      if (prevObjectUrlRef.current) URL.revokeObjectURL(prevObjectUrlRef.current)
    }
  }, [])

  const stopScanner = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setIsScannerOpen(false)
    setCameraLoading(false)
  }

  const startScanner = async () => {
    setError('')
    setCameraLoading(true)
    setIsScannerOpen(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
    } catch (err: any) {
      console.error('Erro ao abrir câmera:', err)
      setError('Não foi possível acessar a câmera. Verifique as permissões.')
      setIsScannerOpen(false)
    } finally {
      setCameraLoading(false)
    }
  }

  const captureFrame = () => {
    const video = videoRef.current
    if (!video || !streamRef.current) return

    const canvas = document.createElement('canvas')
    const MAX = 640
    let w = video.videoWidth
    let h = video.videoHeight
    
    if (w > MAX || h > MAX) {
      if (w > h) { h = Math.round(h * MAX / w); w = MAX }
      else { w = Math.round(w * MAX / h); h = MAX }
    }
    
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(video, 0, 0, w, h)
    
    canvas.toBlob(blob => {
      if (blob) {
        const file = new File([blob], 'capture.jpg', { type: 'image/jpeg' })
        const url = URL.createObjectURL(blob)
        
        // Stop camera immediately to save memory
        stopScanner()
        
        // Start analysis
        processCapturedFile(file, url)
      }
    }, 'image/jpeg', 0.8)
  }

  const runSteps = async (file: File, imageUrl: string) => {
    setAnalyzing(true)
    setDone(false)
    setError('')

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

      if (data?.analysis && onAnalysisRef.current) {
        onAnalysisRef.current(data.analysis, imageUrl)
      } else {
        throw new Error('Análise incompleta retornada pela IA')
      }
    } catch (e: any) {
      console.error('[Analyzer] Error:', e)
      if (e.response?.status === 413) {
        setError('Imagem muito grande. Use o modo Scanner para melhor resultado.')
      } else if (e.code === 'ECONNABORTED') {
        setError('Tempo esgotado. Verifique sua conexão.')
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
      const timeout = setTimeout(() => {
        reject(new Error('Timeout ao comprimir imagem'))
      }, 10000)

      const img = new Image()
      const objectUrl = URL.createObjectURL(file)

      img.onload = () => {
        try {
          const MAX = 640
          const QUALITY = 0.65

          let { width, height } = img
          if (width > MAX || height > MAX) {
            if (width > height) {
              height = Math.round(height * MAX / width)
              width = MAX
            } else {
              width = Math.round(width * MAX / height)
              height = MAX
            }
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
            URL.revokeObjectURL(objectUrl)
            if (blob) {
              const blobUrl = URL.createObjectURL(blob)
              canvas.width = 0
              canvas.height = 0
              resolve({ blob, url: blobUrl })
            } else {
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
        reject(new Error('Falha ao carregar imagem para compressão'))
      }
      img.src = objectUrl
    })
  }

  const processFile = useCallback(async (file: File) => {
    setDone(false)
    setError('')
    setIsPdfPreview(false)

    if (prevObjectUrlRef.current) {
      URL.revokeObjectURL(prevObjectUrlRef.current)
      prevObjectUrlRef.current = null
    }

    const isPdf = file.type === 'application/pdf'

    if (isPdf) {
      if (file.size > 10 * 1024 * 1024) {
        setError('PDF muito grande (máx 10MB).')
        return
      }
      setPreview(PDF_PREVIEW)
      setIsPdfPreview(true)
      await runSteps(file, PDF_PREVIEW)
      return
    }

    if (file.size > 30 * 1024 * 1024) {
      setError('Foto muito grande (máx 30MB). Use o modo Scanner.')
      return
    }

    setAnalyzing(true)

    try {
      const { blob, url: blobUrl } = await compressImage(file)
      const compressedFile = new File([blob], 'product.jpg', { type: 'image/jpeg' })

      prevObjectUrlRef.current = blobUrl
      setPreview(blobUrl)

      await runSteps(compressedFile, blobUrl)
    } catch (compressErr: any) {
      setPreview(null)
      setError(compressErr.message || 'Erro ao processar imagem.')
      setAnalyzing(false)
    }
  }, [])

  const processCapturedFile = async (file: File, url: string) => {
    setDone(false)
    setError('')
    setIsPdfPreview(false)
    
    if (prevObjectUrlRef.current) {
      URL.revokeObjectURL(prevObjectUrlRef.current)
    }
    prevObjectUrlRef.current = url
    setPreview(url)
    
    await runSteps(file, url)
  }

  const onDrop = useCallback(async (files: File[]) => {
    const file = files[0]
    if (!file) return
    await processFile(file)
  }, [processFile])

  function handleCameraCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    processFile(file)
    e.target.value = ''
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
      {/* Hidden native camera input — fallback */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleCameraCapture}
      />

      {/* Drop zone */}
      {!preview && !isScannerOpen && (
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
                  Recomendado para PC e arquivos salvos
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={startScanner}
              className="flex items-center justify-center gap-2 py-3 rounded-xl border border-primary-500/30 bg-primary-600/10 text-primary-300 font-bold text-sm hover:bg-primary-600/20 transition-all active:scale-[0.98]"
            >
              <Camera size={16} />
              Usar Scanner (Celular)
            </button>
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-700 bg-dark-900 text-slate-400 font-medium text-sm hover:bg-dark-800 transition-all active:scale-[0.98]"
            >
              <Upload size={16} />
              Subir Foto
            </button>
          </div>
        </div>
      )}

      {/* Live Scanner Overlay */}
      {isScannerOpen && (
        <div className="relative rounded-2xl overflow-hidden aspect-[4/3] bg-dark-950 border border-primary-500/30">
          {cameraLoading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-primary-400">
              <Loader2 size={32} className="animate-spin" />
              <span className="text-xs font-medium uppercase tracking-widest">Iniciando câmera...</span>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              
              {/* Scan Area Overlay */}
              <div className="absolute inset-0 pointer-events-none border-[40px] border-dark-950/40 flex items-center justify-center">
                <div className="w-full h-full border border-primary-400/30 rounded-lg relative">
                  {/* Corners */}
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-primary-400" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-primary-400" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-primary-400" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-primary-400" />
                </div>
              </div>

              {/* Scanner Controls */}
              <div className="absolute bottom-6 inset-x-0 flex items-center justify-center gap-10">
                <button
                  type="button"
                  onClick={stopScanner}
                  className="w-12 h-12 rounded-full bg-dark-900/80 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white"
                >
                  <X size={20} />
                </button>
                <button
                  type="button"
                  onClick={captureFrame}
                  className="w-16 h-16 rounded-full bg-primary-500 border-4 border-white flex items-center justify-center shadow-2xl active:scale-90 transition-transform"
                >
                  <div className="w-12 h-12 rounded-full border-2 border-white/20" />
                </button>
                <div className="w-12" /> {/* alignment spacer */}
              </div>
              
              <div className="absolute top-4 left-4">
                <div className="bg-primary-500 text-dark-950 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter animate-pulse">
                  Live Scanner
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Preview + analyzing overlay */}
      {preview && !isScannerOpen && (
        <div className="relative rounded-2xl overflow-hidden border border-slate-700 bg-dark-900 shadow-xl">
          {isPdfPreview ? (
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

          {analyzing && (
            <div className="absolute inset-0 bg-dark-950/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
              {!isPdfPreview && (
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  <div
                    className="w-full h-0.5 bg-gradient-to-r from-transparent via-primary-400 to-transparent opacity-70"
                    style={{ animation: 'scanLine 1.5s ease-in-out infinite', position: 'absolute' }}
                  />
                </div>
              )}

              <div className="text-center z-10 transition-all duration-500">
                <div className="flex items-center gap-2 mb-3 justify-center">
                  <currentStep.icon size={18} className="text-primary-400 animate-pulse" />
                  <span className="text-primary-300 font-medium text-sm">{currentStep.label}</span>
                </div>

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

          {done && !analyzing && (
            <div className="absolute inset-0 bg-green-500/10 border border-green-500/40 rounded-2xl flex items-center justify-center">
              <div className="flex items-center gap-2 bg-dark-900/90 px-4 py-2 rounded-full border border-green-500/40 shadow-lg scale-in">
                <CheckCircle size={16} className="text-green-400" />
                <span className="text-green-300 text-sm font-medium">Análise aplicada com sucesso</span>
              </div>
            </div>
          )}

          {!analyzing && (
            <div className="absolute top-2 right-2 flex gap-1.5">
              <button
                type="button"
                onClick={startScanner}
                className="bg-dark-900/80 border border-slate-700 p-1.5 rounded-lg hover:bg-dark-800 transition-colors"
                title="Novo Scanner"
              >
                <Maximize size={13} className="text-primary-400" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setError('')
                  setPreview(null)
                  setIsPdfPreview(false)
                }}
                className="bg-dark-900/80 border border-slate-700 p-1.5 rounded-lg hover:bg-dark-800 transition-colors"
                title="Remover"
              >
                <X size={13} className="text-slate-400" />
              </button>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-center justify-between gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/30 px-3 py-2 rounded-lg animate-in slide-in-from-top-2">
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
            }}
            className="shrink-0 flex items-center gap-1 text-xs text-red-300 hover:text-white bg-red-500/20 hover:bg-red-500/40 px-2 py-1 rounded-md transition-colors"
          >
            <RotateCcw size={11} />
            Resetar
          </button>
        </div>
      )}

      <style>{`
        @keyframes scanLine {
          0% { top: 0%; }
          100% { top: 100%; }
        }
        .scale-in {
          animation: scale 0.3s ease-out;
        }
        @keyframes scale {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
