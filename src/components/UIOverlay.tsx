import {
  Camera,
  Download,
  ImagePlus,
  Loader2,
  RotateCcw,
  Upload,
} from 'lucide-react'
import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import {
  COLOR_PRESETS,
  DEFAULT_LOGO,
  SHIRT_MODELS,
  STUDIO_BACKGROUNDS,
  useMockupStore,
  type CameraPreset,
} from '../store/useMockupStore'

interface UIOverlayProps {
  onExport: () => void
  isExporting?: boolean
  onFileSelected: (file: File | undefined) => void
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="font-display text-[13px] tracking-[0.16em] text-white/45">{title}</h3>
      {children}
    </section>
  )
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
  display,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  display?: string
}) {
  return (
    <label className="block space-y-1.5">
      <div className="flex items-center justify-between text-xs text-white/70">
        <span>{label}</span>
        <span className="tabular-nums text-white/45">{display ?? value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  )
}

export function UIOverlay({
  onExport,
  isExporting = false,
  onFileSelected,
}: UIOverlayProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [panelOpen, setPanelOpen] = useState(true)

  const shirtId = useMockupStore((s) => s.shirtId)
  const color = useMockupStore((s) => s.color)
  const logoUrl = useMockupStore((s) => s.logoUrl)
  const logoPosition = useMockupStore((s) => s.logoPosition)
  const logoScale = useMockupStore((s) => s.logoScale)
  const logoRotation = useMockupStore((s) => s.logoRotation)
  const decalSide = useMockupStore((s) => s.decalSide)
  const exportTransparent = useMockupStore((s) => s.exportTransparent)
  const isDraggingFile = useMockupStore((s) => s.isDraggingFile)
  const studioBgId = useMockupStore((s) => s.studioBgId)
  const studioBgColor = useMockupStore((s) => s.studioBgColor)

  const setShirtId = useMockupStore((s) => s.setShirtId)
  const setColor = useMockupStore((s) => s.setColor)
  const setLogoUrl = useMockupStore((s) => s.setLogoUrl)
  const setLogoPosition = useMockupStore((s) => s.setLogoPosition)
  const setLogoScale = useMockupStore((s) => s.setLogoScale)
  const setLogoRotation = useMockupStore((s) => s.setLogoRotation)
  const setDecalSide = useMockupStore((s) => s.setDecalSide)
  const setCameraPreset = useMockupStore((s) => s.setCameraPreset)
  const setExportTransparent = useMockupStore((s) => s.setExportTransparent)
  const setStudioBgId = useMockupStore((s) => s.setStudioBgId)
  const setStudioBgColor = useMockupStore((s) => s.setStudioBgColor)
  const resetLogo = useMockupStore((s) => s.resetLogo)

  useEffect(() => {
    document.documentElement.style.setProperty('--studio-bg', studioBgColor)
  }, [studioBgColor])

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    onFileSelected(e.target.files?.[0])
    e.target.value = ''
  }

  const cameraButtons: { id: NonNullable<CameraPreset>; label: string }[] = [
    { id: 'front', label: 'Frente' },
    { id: 'back', label: 'Espalda' },
    { id: 'side', label: 'Perfil' },
    { id: 'reset', label: 'Reset' },
  ]

  const isLightBg = (() => {
    const hex = studioBgColor.replace('#', '')
    const r = parseInt(hex.slice(0, 2), 16)
    const g = parseInt(hex.slice(2, 4), 16)
    const b = parseInt(hex.slice(4, 6), 16)
    return (r * 299 + g * 587 + b * 114) / 1000 > 150
  })()

  return (
    <>
      <header className="pointer-events-none absolute left-0 right-0 top-0 z-20 flex items-start justify-between p-5 md:p-7">
        <div className="pointer-events-auto">
          <p
            className={`font-display text-4xl leading-none tracking-[0.06em] md:text-5xl ${
              isLightBg ? 'text-[#0c0c0e]' : 'text-white'
            }`}
          >
            OPENWEAR
          </p>
          <p
            className={`mt-1 text-[10px] font-medium uppercase tracking-[0.28em] ${
              isLightBg ? 'text-[#0c0c0e]/50' : 'text-white/40'
            }`}
          >
            Street 3D Studio
          </p>
        </div>

        <button
          type="button"
          onClick={() => setPanelOpen((v) => !v)}
          className="pointer-events-auto rounded-sm bg-black/50 px-3.5 py-2 font-display text-sm tracking-[0.14em] text-white ring-1 ring-white/15 backdrop-blur-md transition hover:bg-black/70 md:hidden"
        >
          {panelOpen ? 'Cerrar' : 'Control'}
        </button>
      </header>

      {isDraggingFile && (
        <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 border border-dashed border-[#c8f542]/60 bg-black/40 px-10 py-12">
            <Upload className="h-8 w-8 text-[#c8f542]" />
            <p className="font-display text-xl tracking-[0.12em] text-white">Drop your graphic</p>
          </div>
        </div>
      )}

      <aside
        className={`absolute bottom-4 right-4 top-auto z-30 max-h-[min(78vh,760px)] w-[min(100%-2rem,340px)] overflow-y-auto border border-white/10 bg-[rgba(12,12,14,0.88)] p-5 shadow-2xl shadow-black/50 backdrop-blur-xl transition md:bottom-6 md:right-6 ${
          panelOpen
            ? 'opacity-100'
            : 'pointer-events-none translate-y-4 opacity-0 md:pointer-events-auto md:translate-y-0 md:opacity-100'
        }`}
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="font-display text-2xl tracking-[0.1em] text-white">Control Center</p>
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">
              Fit · Color · Scene
            </p>
          </div>
          <button
            type="button"
            onClick={resetLogo}
            className="inline-flex items-center gap-1.5 bg-white/5 px-2.5 py-1.5 text-[11px] uppercase tracking-wider text-white/60 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white"
            title="Restablecer diseño"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </button>
        </div>

        <div className="space-y-6">
          <Section title="Background">
            <div className="grid grid-cols-3 gap-2">
              {STUDIO_BACKGROUNDS.filter((b) => b.id !== 'custom').map((bg) => (
                <button
                  key={bg.id}
                  type="button"
                  title={bg.name}
                  onClick={() => setStudioBgId(bg.id)}
                  className={`group flex flex-col gap-1.5 p-1.5 ring-1 transition ${
                    studioBgId === bg.id
                      ? 'ring-[#c8f542]'
                      : 'ring-white/10 hover:ring-white/30'
                  }`}
                >
                  <span
                    className="h-10 w-full"
                    style={{ backgroundColor: bg.color }}
                  />
                  <span className="font-display text-[11px] tracking-[0.12em] text-white/55 group-hover:text-white/80">
                    {bg.name}
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2.5">
              <input
                type="color"
                value={studioBgColor}
                onChange={(e) => setStudioBgColor(e.target.value)}
                className="h-9 w-9 cursor-pointer overflow-hidden rounded-sm"
                aria-label="Color de fondo personalizado"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-white/70">Custom hex</p>
                <p className="truncate text-[11px] tabular-nums text-white/35">
                  {studioBgColor.toUpperCase()}
                </p>
              </div>
            </div>
          </Section>

          <Section title="Modelo">
            <div className="grid grid-cols-1 gap-2">
              {SHIRT_MODELS.map((model) => (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => setShirtId(model.id)}
                  className={`px-3.5 py-3 text-left transition ${
                    shirtId === model.id
                      ? 'bg-[#c8f542]/12 ring-1 ring-[#c8f542]/60'
                      : 'bg-white/5 ring-1 ring-white/10 hover:bg-white/10'
                  }`}
                >
                  <p
                    className={`font-display text-lg tracking-[0.08em] ${
                      shirtId === model.id ? 'text-[#c8f542]' : 'text-white'
                    }`}
                  >
                    {model.name}
                  </p>
                  <p className="text-xs text-white/40">{model.description}</p>
                </button>
              ))}
            </div>
          </Section>

          <Section title="Diseño">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              className="hidden"
              onChange={onFileChange}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="group flex w-full items-center gap-3 border border-dashed border-white/15 bg-white/[0.03] px-3.5 py-3.5 text-left transition hover:border-[#c8f542]/40 hover:bg-white/[0.06]"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden bg-white/10 ring-1 ring-white/10">
                {logoUrl ? (
                  <img src={logoUrl} alt="Preview" className="h-full w-full object-contain p-1" />
                ) : (
                  <ImagePlus className="h-5 w-5 text-white/50" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-display text-base tracking-[0.08em] text-white">Upload graphic</p>
                <p className="truncate text-xs text-white/40">PNG · JPG · WebP</p>
              </div>
              <Upload className="h-4 w-4 text-white/35 transition group-hover:text-[#c8f542]" />
            </button>
            {logoUrl !== DEFAULT_LOGO && (
              <button
                type="button"
                onClick={() => {
                  if (logoUrl.startsWith('blob:')) URL.revokeObjectURL(logoUrl)
                  setLogoUrl(DEFAULT_LOGO)
                }}
                className="text-xs text-white/40 underline-offset-2 hover:text-white/70 hover:underline"
              >
                Usar logo de demostración
              </button>
            )}
          </Section>

          <Section title="Color de tela">
            <div className="flex items-center gap-2.5">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-10 w-10 cursor-pointer overflow-hidden rounded-sm"
                aria-label="Selector de color"
              />
              <div className="flex flex-1 flex-wrap gap-2">
                {COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    title={preset.name}
                    onClick={() => setColor(preset.value)}
                    className={`h-8 w-8 rounded-full ring-2 transition ${
                      color.toLowerCase() === preset.value.toLowerCase()
                        ? 'scale-110 ring-[#c8f542]'
                        : 'ring-white/15 hover:ring-white/35'
                    }`}
                    style={{ backgroundColor: preset.value }}
                  />
                ))}
              </div>
            </div>
            <p className="text-[11px] tabular-nums text-white/35">{color.toUpperCase()}</p>
          </Section>

          <Section title="Decal">
            <div className="mb-3 grid grid-cols-2 gap-2">
              {(['front', 'back'] as const).map((side) => (
                <button
                  key={side}
                  type="button"
                  onClick={() => setDecalSide(side)}
                  className={`px-3 py-2 font-display text-sm tracking-[0.12em] transition ${
                    decalSide === side
                      ? 'bg-[#c8f542] text-[#0c0c0e]'
                      : 'bg-white/5 text-white/65 ring-1 ring-white/10 hover:bg-white/10'
                  }`}
                >
                  {side === 'front' ? 'Frente' : 'Espalda'}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              <SliderRow
                label="Posición X"
                value={logoPosition.x}
                min={-0.25}
                max={0.25}
                step={0.005}
                onChange={(x) => setLogoPosition({ x })}
              />
              <SliderRow
                label="Posición Y"
                value={logoPosition.y}
                min={-0.2}
                max={0.25}
                step={0.005}
                onChange={(y) => setLogoPosition({ y })}
              />
              <SliderRow
                label="Escala"
                value={logoScale}
                min={0.05}
                max={0.4}
                step={0.005}
                onChange={setLogoScale}
              />
              <SliderRow
                label="Rotación"
                value={logoRotation}
                min={-Math.PI}
                max={Math.PI}
                step={0.01}
                onChange={setLogoRotation}
                display={`${((logoRotation * 180) / Math.PI).toFixed(0)}°`}
              />
            </div>
          </Section>

          <Section title="Cámara">
            <div className="grid grid-cols-2 gap-2">
              {cameraButtons.map((btn) => (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => setCameraPreset(btn.id)}
                  className="inline-flex items-center justify-center gap-1.5 bg-white/5 px-3 py-2 text-xs font-medium uppercase tracking-wider text-white/75 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white"
                >
                  <Camera className="h-3 w-3 opacity-60" />
                  {btn.label}
                </button>
              ))}
            </div>
          </Section>

          <Section title="Export">
            <label className="mb-3 flex cursor-pointer items-center justify-between gap-3 bg-white/[0.03] px-3 py-2.5 ring-1 ring-white/10">
              <span className="text-xs text-white/70">Fondo transparente</span>
              <button
                type="button"
                role="switch"
                aria-checked={exportTransparent}
                onClick={() => setExportTransparent(!exportTransparent)}
                className={`relative h-5 w-9 rounded-full transition ${
                  exportTransparent ? 'bg-[#c8f542]' : 'bg-white/20'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition ${
                    exportTransparent ? 'translate-x-4' : ''
                  }`}
                />
              </button>
            </label>

            <button
              type="button"
              onClick={onExport}
              disabled={isExporting}
              className="flex w-full items-center justify-center gap-2 bg-[#c8f542] px-4 py-3 font-display text-lg tracking-[0.14em] text-[#0c0c0e] transition hover:bg-[#d6ff63] disabled:opacity-60"
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Export PNG
            </button>
          </Section>
        </div>
      </aside>

      <p
        className={`pointer-events-none absolute bottom-5 left-5 z-20 hidden text-[10px] uppercase tracking-[0.2em] md:block ${
          isLightBg ? 'text-[#0c0c0e]/40' : 'text-white/30'
        }`}
      >
        Drag to orbit · Scroll zoom · Drop PNG
      </p>
    </>
  )
}
