import { useContext } from 'react'
import { ToastContext } from '@/hooks/useToast'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const CONFIG = {
  success: { icon: CheckCircle, cls: 'border-green-500/40 bg-green-500/10', iconCls: 'text-green-400', titleCls: 'text-green-300' },
  error:   { icon: XCircle,     cls: 'border-red-500/40   bg-red-500/10',   iconCls: 'text-red-400',   titleCls: 'text-red-300'   },
  warning: { icon: AlertTriangle,cls: 'border-amber-500/40 bg-amber-500/10', iconCls: 'text-amber-400', titleCls: 'text-amber-300' },
  info:    { icon: Info,         cls: 'border-blue-500/40  bg-blue-500/10',  iconCls: 'text-blue-400',  titleCls: 'text-blue-300'  },
}

export default function Toaster() {
  const { toasts, dismiss } = useContext(ToastContext)

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 w-80">
      {toasts.map(t => {
        const { icon: Icon, cls, iconCls, titleCls } = CONFIG[t.type]
        return (
          <div
            key={t.id}
            className={cn(
              'flex items-start gap-3 px-4 py-3 rounded-xl border backdrop-blur-sm shadow-lg',
              'animate-in slide-in-from-right-4 fade-in duration-200',
              cls
            )}
          >
            <Icon size={16} className={cn('shrink-0 mt-0.5', iconCls)} />
            <div className="flex-1 min-w-0">
              <p className={cn('text-sm font-semibold', titleCls)}>{t.title}</p>
              {t.description && <p className="text-xs text-slate-400 mt-0.5">{t.description}</p>}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="shrink-0 text-slate-500 hover:text-slate-300 transition-colors"
            >
              <X size={13} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
