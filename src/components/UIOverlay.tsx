import {
  Camera,
  Download,
  ImagePlus,
  Loader2,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import {
  COLOR_PRESETS,
  DEFAULT_LOGO,
  MAX_GRAPHICS,
  SHIRT_MODELS,
  STUDIO_BACKGROUNDS,
  useMockupStore,
  type CameraPreset,
} from '../store/useMockupStore'

interface UIOverlayProps {
  onExport: () => void
  isExporting?: boolean
  onFileSelected: (file: File | undefined, mode?: 'add' | 'replace') => void
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
  disabled,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  display?: string
  disabled?: boolean
}) {
  return (
    <label className={`block space-y-1.5 ${disabled ? 'opacity-40' : ''}`}>
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
        disabled={disabled}
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
  const addInputRef = useRef<HTMLInputElement>(null)
  const replaceInputRef = useRef<HTMLInputElement>(null)
  const [panelOpen, setPanelOpen] = useState(true)

  const shirtId = useMockupStore((s) => s.shirtId)
  const color = useMockupStore((s) => s.color)
  const graphics = useMockupStore((s) => s.graphics)
  const activeGraphicId = useMockupStore((s) => s.activeGraphicId)
  const exportTransparent = useMockupStore((s) => s.exportTransparent)
  const isDraggingFile = useMockupStore((s) => s.isDraggingFile)
  const studioBgId = useMockupStore((s) => s.studioBgId)
  const studioBgColor = useMockupStore((s) => s.studioBgColor)

  const setShirtId = useMockupStore((s) => s.setShirtId)
  const setColor = useMockupStore((s) => s.setColor)
  const selectGraphic = useMockupStore((s) => s.selectGraphic)
  const removeGraphic = useMockupStore((s) => s.removeGraphic)
  const setActiveSide = useMockupStore((s) => s.setActiveSide)
  const setActivePosition = useMockupStore((s) => s.setActivePosition)
  const setActiveScale = useMockupStore((s) => s.setActiveScale)
  const setActiveRotation = useMockupStore((s) => s.setActiveRotation)
  const setCameraPreset = useMockupStore((s) => s.setCameraPreset)
  const setExportTransparent = useMockupStore((s) => s.setExportTransparent)
  const setStudioBgId = useMockupStore((s) => s.setStudioBgId)
  const setStudioBgColor = useMockupStore((s) => s.setStudioBgColor)
  const resetGraphics = useMockupStore((s) => s.resetGraphics)
  const replaceActiveGraphicUrl = useMockupStore((s) => s.replaceActiveGraphicUrl)

  const active = useMemo(
    () => graphics.find((g) => g.id === activeGraphicId) ?? null,
    [graphics, activeGraphicId],
  )

  useEffect(() => {
    document.documentElement.style.setProperty('--studio-bg', studioBgColor)
  }, [studioBgColor])

  const onAddFile = (e: ChangeEvent<HTMLInputElement>) => {
    onFileSelected(e.target.files?.[0], 'add')
    e.target.value = ''
  }

  const onReplaceFile = (e: ChangeEvent<HTMLInputElement>) => {
    onFileSelected(e.target.files?.[0], 'replace')
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

  const canAdd = graphics.length < MAX_GRAPHICS

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
            <p className="font-display text-xl tracking-[0.12em] text-white">Drop to add graphic</p>
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
            onClick={resetGraphics}
            className="inline-flex items-center gap-1.5 bg-white/5 px-2.5 py-1.5 text-[11px] uppercase tracking-wider text-white/60 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white"
            title="Restablecer gráficos"
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
                  <span className="h-10 w-full" style={{ backgroundColor: bg.color }} />
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

          <Section title="Gráficos">
            <input
              ref={addInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              className="hidden"
              onChange={onAddFile}
            />
            <input
              ref={replaceInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              className="hidden"
              onChange={onReplaceFile}
            />

            <div className="grid grid-cols-4 gap-2">
              {graphics.map((g, index) => (
                <button
                  key={g.id}
                  type="button"
                  title={g.name}
                  onClick={() => selectGraphic(g.id)}
                  className={`relative aspect-square overflow-hidden bg-white/5 transition ${
                    g.id === activeGraphicId
                      ? 'ring-2 ring-[#c8f542]'
                      : 'ring-1 ring-white/10 hover:ring-white/30'
                  }`}
                >
                  <img
                    src={g.url}
                    alt={g.name}
                    className="h-full w-full object-contain p-1"
                  />
                  <span className="absolute bottom-0.5 left-0.5 bg-black/70 px-1 font-display text-[10px] text-white/80">
                    {index + 1}
                  </span>
                </button>
              ))}

              {canAdd && (
                <button
                  type="button"
                  onClick={() => addInputRef.current?.click()}
                  className="flex aspect-square flex-col items-center justify-center gap-1 bg-white/[0.03] ring-1 ring-dashed ring-white/20 transition hover:bg-white/[0.06] hover:ring-[#c8f542]/50"
                  title="Añadir gráfico"
                >
                  <Plus className="h-4 w-4 text-[#c8f542]" />
                  <span className="font-display text-[10px] tracking-[0.08em] text-white/50">
                    Add
                  </span>
                </button>
              )}
            </div>

            <p className="text-[11px] text-white/35">
              {graphics.length}/{MAX_GRAPHICS} elementos · drop PNG para añadir
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => replaceInputRef.current?.click()}
                disabled={!active}
                className="flex flex-1 items-center justify-center gap-1.5 bg-white/5 px-3 py-2 text-xs uppercase tracking-wider text-white/70 ring-1 ring-white/10 transition hover:bg-white/10 disabled:opacity-40"
              >
                <ImagePlus className="h-3.5 w-3.5" />
                Cambiar
              </button>
              <button
                type="button"
                onClick={() => active && removeGraphic(active.id)}
                disabled={!active}
                className="inline-flex items-center justify-center gap-1.5 bg-white/5 px-3 py-2 text-xs uppercase tracking-wider text-red-300/80 ring-1 ring-white/10 transition hover:bg-red-500/15 disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>

            {active?.url !== DEFAULT_LOGO && graphics.length === 1 && (
              <button
                type="button"
                onClick={() => replaceActiveGraphicUrl(DEFAULT_LOGO, 'Demo')}
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

          <Section title="Decal activo">
            {!active ? (
              <p className="text-xs text-white/40">Añade un gráfico para editarlo.</p>
            ) : (
              <>
                <p className="truncate text-xs text-white/50">{active.name}</p>
                <div className="mb-3 grid grid-cols-2 gap-2">
                  {(['front', 'back'] as const).map((side) => (
                    <button
                      key={side}
                      type="button"
                      onClick={() => setActiveSide(side)}
                      className={`px-3 py-2 font-display text-sm tracking-[0.12em] transition ${
                        active.side === side
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
                    value={active.position.x}
                    min={-0.45}
                    max={0.45}
                    step={0.005}
                    onChange={(x) => setActivePosition({ x })}
                  />
                  <SliderRow
                    label="Posición Y"
                    value={active.position.y}
                    min={-0.45}
                    max={0.55}
                    step={0.005}
                    onChange={(y) => setActivePosition({ y })}
                  />
                  <p className="text-[11px] text-white/35">
                    Arrastra el gráfico o la camiseta en el viewport para moverlo.
                  </p>
                  <SliderRow
                    label="Escala"
                    value={active.scale}
                    min={0.08}
                    max={1.0}
                    step={0.01}
                    onChange={setActiveScale}
                  />
                  <SliderRow
                    label="Rotación"
                    value={active.rotation}
                    min={-Math.PI}
                    max={Math.PI}
                    step={0.01}
                    onChange={setActiveRotation}
                    display={`${((active.rotation * 180) / Math.PI).toFixed(0)}°`}
                  />
                </div>
              </>
            )}
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
        Drag to orbit · Drag graphic on shirt · Drop PNG to add
      </p>
    </>
  )
}
