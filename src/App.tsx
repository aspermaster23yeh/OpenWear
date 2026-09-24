import { Suspense, useCallback, useRef, useState, type DragEvent } from 'react'
import { Canvas3D, type Canvas3DHandle } from './components/Canvas3D'
import { UIOverlay } from './components/UIOverlay'
import { useMockupStore } from './store/useMockupStore'

function ViewportLoader() {
  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-[var(--studio-bg,#0b0d12)]">
      <div className="relative h-14 w-14">
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-white/10 border-t-[#c8f542]" />
        <div className="absolute inset-2 rounded-full bg-white/5" />
      </div>
      <div className="text-center">
        <p className="font-display text-2xl tracking-[0.14em] text-white/90">OPENWEAR</p>
        <p className="mt-1 text-[10px] uppercase tracking-[0.28em] text-white/35">
          Loading studio…
        </p>
      </div>
    </div>
  )
}

export default function App() {
  const canvasRef = useRef<Canvas3DHandle>(null)
  const [isExporting, setIsExporting] = useState(false)
  const exportTransparent = useMockupStore((s) => s.exportTransparent)
  const addGraphic = useMockupStore((s) => s.addGraphic)
  const setIsDraggingFile = useMockupStore((s) => s.setIsDraggingFile)

  const handleExport = useCallback(() => {
    setIsExporting(true)
    requestAnimationFrame(() => {
      canvasRef.current?.exportPng(exportTransparent)
      setTimeout(() => setIsExporting(false), 400)
    })
  }, [exportTransparent])

  const handleFile = useCallback(
    (file: File | undefined, mode: 'add' | 'replace' = 'add') => {
      if (!file) return
      if (!file.type.match(/^image\/(png|jpeg|jpg|webp)$/)) return

      const url = URL.createObjectURL(file)
      const name = file.name.replace(/\.[^.]+$/, '') || 'Gráfico'
      if (mode === 'replace') {
        useMockupStore.getState().replaceActiveGraphicUrl(url, name)
      } else {
        addGraphic(url, name)
      }
    },
    [addGraphic],
  )

  const onDragEnter = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer.types.includes('Files')) setIsDraggingFile(true)
  }

  const onDragOver = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const onDragLeave = (e: DragEvent) => {
    e.preventDefault()
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDraggingFile(false)
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingFile(false)
    handleFile(e.dataTransfer.files?.[0], 'add')
  }

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <Suspense fallback={<ViewportLoader />}>
        <Canvas3D ref={canvasRef} />
      </Suspense>
      <UIOverlay onExport={handleExport} isExporting={isExporting} onFileSelected={handleFile} />
    </div>
  )
}
