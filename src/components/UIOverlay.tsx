import {
  Camera,
  Download,
  ImagePlus,
  Loader2,
  RotateCcw,
  Shirt,
  Upload,
} from 'lucide-react'
import { useRef, useState, type ChangeEvent } from 'react'
import {
  COLOR_PRESETS,
  DEFAULT_LOGO,
  SHIRT_MODELS,
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
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
        {title}
      </h3>
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

  const setShirtId = useMockupStore((s) => s.setShirtId)
  const setColor = useMockupStore((s) => s.setColor)
  const setLogoUrl = useMockupStore((s) => s.setLogoUrl)
  const setLogoPosition = useMockupStore((s) => s.setLogoPosition)
  const setLogoScale = useMockupStore((s) => s.setLogoScale)
  const setLogoRotation = useMockupStore((s) => s.setLogoRotation)
  const setDecalSide = useMockupStore((s) => s.setDecalSide)
  const setCameraPreset = useMockupStore((s) => s.setCameraPreset)
  const setExportTransparent = useMockupStore((s) => s.setExportTransparent)
  const resetLogo = useMockupStore((s) => s.resetLogo)

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    onFileSelected(e.target.files?.[0])
    e.target.value = ''
  }

  const cameraButtons: { id: NonNullable<CameraPreset>; label: string }[] = [
    { id: 'front', label: 'Frente' },
    { id: 'back', label: 'Espalda' },
    { id: 'side', label: 'Perfil' },
    { id: 'reset', label: 'Reset View' },
  ]

  return (
    <>
      <header className="pointer-events-none absolute left-0 right-0 top-0 z-20 flex items-start justify-between p-5 md:p-7">
        <div className="pointer-events-auto">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15 backdrop-blur-md">
              <Shirt className="h-4 w-4 text-[#e8a87c]" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-lg font-semibold tracking-tight text-white">ThreadLab</p>
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">
                3D Mockup Studio
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setPanelOpen((v) => !v)}
          className="pointer-events-auto rounded-full bg-white/10 px-3.5 py-2 text-xs font-medium text-white/80 ring-1 ring-white/15 backdrop-blur-md transition hover:bg-white/15 md:hidden"
        >
          {panelOpen ? 'Ocultar' : 'Controles'}
        </button>
      </header>

      {isDraggingFile && (
        <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-[#0b0d12]/70 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[#e8a87c]/60 bg-white/5 px-10 py-12">
            <Upload className="h-8 w-8 text-[#e8a87c]" />
            <p className="text-sm font-medium text-white">Suelta tu diseño PNG / JPG</p>
          </div>
        </div>
      )}

      <aside
        className={`absolute bottom-4 right-4 top-auto z-30 max-h-[min(78vh,720px)] w-[min(100%-2rem,340px)] overflow-y-auto rounded-2xl border border-white/10 bg-[rgba(18,22,30,0.78)] p-5 shadow-2xl shadow-black/40 backdrop-blur-xl transition md:bottom-6 md:right-6 ${
          panelOpen
            ? 'opacity-100'
            : 'pointer-events-none translate-y-4 opacity-0 md:pointer-events-auto md:translate-y-0 md:opacity-100'
        }`}
      >
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-white">Personalizar</p>
            <p className="text-xs text-white/40">Color, diseño y cámara</p>
          </div>
          <button
            type="button"
            onClick={resetLogo}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1.5 text-[11px] text-white/60 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white"
            title="Restablecer diseño"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </button>
        </div>

        <div className="space-y-6">
          <Section title="Modelo">
            <div className="grid grid-cols-1 gap-2">
              {SHIRT_MODELS.map((model) => (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => setShirtId(model.id)}
                  className={`rounded-xl px-3.5 py-3 text-left transition ${
                    shirtId === model.id
                      ? 'bg-[#e8a87c]/15 ring-1 ring-[#e8a87c]/50'
                      : 'bg-white/5 ring-1 ring-white/10 hover:bg-white/10'
                  }`}
                >
                  <p
                    className={`text-sm font-medium ${
                      shirtId === model.id ? 'text-[#e8a87c]' : 'text-white'
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
              className="group flex w-full items-center gap-3 rounded-xl border border-dashed border-white/15 bg-white/[0.03] px-3.5 py-3.5 text-left transition hover:border-[#e8a87c]/40 hover:bg-white/[0.06]"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/10 ring-1 ring-white/10">
                {logoUrl ? (
                  <img src={logoUrl} alt="Preview" className="h-full w-full object-contain p-1" />
                ) : (
                  <ImagePlus className="h-5 w-5 text-white/50" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white">Cargar diseño</p>
                <p className="truncate text-xs text-white/40">
                  PNG con transparencia, JPG o WebP
                </p>
              </div>
              <Upload className="h-4 w-4 text-white/35 transition group-hover:text-[#e8a87c]" />
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
                className="h-10 w-10 cursor-pointer overflow-hidden rounded-lg"
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
                        ? 'scale-110 ring-[#e8a87c]'
                        : 'ring-white/15 hover:ring-white/35'
                    }`}
                    style={{ backgroundColor: preset.value }}
                  />
                ))}
              </div>
            </div>
            <p className="text-[11px] tabular-nums text-white/35">{color.toUpperCase()}</p>
          </Section>

          <Section title="Ajustes del decal">
            <div className="mb-3 grid grid-cols-2 gap-2">
              {(['front', 'back'] as const).map((side) => (
                <button
                  key={side}
                  type="button"
                  onClick={() => setDecalSide(side)}
                  className={`rounded-lg px-3 py-2 text-xs font-medium transition ${
                    decalSide === side
                      ? 'bg-[#e8a87c] text-[#1a120c]'
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
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-white/5 px-3 py-2 text-xs font-medium text-white/75 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white"
                >
                  <Camera className="h-3 w-3 opacity-60" />
                  {btn.label}
                </button>
              ))}
            </div>
          </Section>

          <Section title="Exportar">
            <label className="mb-3 flex cursor-pointer items-center justify-between gap-3 rounded-lg bg-white/[0.03] px-3 py-2.5 ring-1 ring-white/10">
              <span className="text-xs text-white/70">Fondo transparente</span>
              <button
                type="button"
                role="switch"
                aria-checked={exportTransparent}
                onClick={() => setExportTransparent(!exportTransparent)}
                className={`relative h-5 w-9 rounded-full transition ${
                  exportTransparent ? 'bg-[#e8a87c]' : 'bg-white/20'
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
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#e8a87c] px-4 py-3 text-sm font-semibold text-[#1a120c] transition hover:bg-[#f0b98f] disabled:opacity-60"
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Exportar Render PNG
            </button>
          </Section>
        </div>
      </aside>

      <p className="pointer-events-none absolute bottom-5 left-5 z-20 hidden text-[11px] text-white/30 md:block">
        Arrastra para orbitar · Scroll para zoom · Drop PNG sobre el viewport
      </p>
    </>
  )
}
