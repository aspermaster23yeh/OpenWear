import { create } from 'zustand'

export type DecalSide = 'front' | 'back'
export type CameraPreset = 'front' | 'back' | 'side' | 'reset' | null
export type ShirtId = 'straight' | 'relaxed'
export type StudioBgId =
  | 'void'
  | 'concrete'
  | 'studio'
  | 'fog'
  | 'sand'
  | 'night'
  | 'custom'

export const COLOR_PRESETS = [
  { name: 'Blanco', value: '#ffffff' },
  { name: 'Negro', value: '#1a1a1a' },
  { name: 'Beige', value: '#d4c4a8' },
  { name: 'Azul marino', value: '#1e2a44' },
  { name: 'Rojo vintage', value: '#8b3a3a' },
] as const

export const STUDIO_BACKGROUNDS: {
  id: StudioBgId
  name: string
  color: string
}[] = [
  { id: 'void', name: 'Void', color: '#0b0d12' },
  { id: 'concrete', name: 'Concrete', color: '#2a2c2f' },
  { id: 'studio', name: 'Studio', color: '#e8e6e1' },
  { id: 'fog', name: 'Fog', color: '#9a9ea6' },
  { id: 'sand', name: 'Sand', color: '#c4b49a' },
  { id: 'night', name: 'Night', color: '#12151c' },
  { id: 'custom', name: 'Custom', color: '#0b0d12' },
]

export const SHIRT_MODELS: {
  id: ShirtId
  name: string
  description: string
}[] = [
  {
    id: 'straight',
    name: 'Straight cut',
    description: 'Crewneck manga corta',
  },
  {
    id: 'relaxed',
    name: 'Relaxed',
    description: 'Drop shoulder · elbow sleeve',
  },
]

export const DEFAULT_LOGO = '/demo-logo.svg'
export const MAX_GRAPHICS = 8

export interface Graphic {
  id: string
  url: string
  name: string
  /** Local position on the shirt group (set by drag / sliders). */
  position: { x: number; y: number; z: number }
  scale: number
  rotation: number
  side: DecalSide
}

function createGraphic(partial: Partial<Graphic> & { url: string }): Graphic {
  return {
    id: partial.id ?? crypto.randomUUID(),
    url: partial.url,
    name: partial.name ?? 'Gráfico',
    position: partial.position ?? { x: 0, y: 0.12, z: 0.26 },
    scale: partial.scale ?? 0.2,
    rotation: partial.rotation ?? 0,
    side: partial.side ?? 'front',
  }
}

function defaultGraphics(): Graphic[] {
  return [
    createGraphic({
      id: 'demo',
      url: DEFAULT_LOGO,
      name: 'Demo',
    }),
  ]
}

interface MockupState {
  shirtId: ShirtId
  color: string
  graphics: Graphic[]
  activeGraphicId: string | null
  cameraPreset: CameraPreset
  exportTransparent: boolean
  isDraggingFile: boolean
  isDraggingGraphic: boolean
  studioBgId: StudioBgId
  studioBgColor: string

  setShirtId: (shirtId: ShirtId) => void
  setColor: (color: string) => void
  addGraphic: (url: string, name?: string) => void
  replaceActiveGraphicUrl: (url: string, name?: string) => void
  removeGraphic: (id: string) => void
  selectGraphic: (id: string) => void
  updateActiveGraphic: (
    patch: Partial<Omit<Graphic, 'id' | 'url' | 'name'>>,
  ) => void
  setActiveSide: (side: DecalSide) => void
  setActivePosition: (position: Partial<Graphic['position']>) => void
  setActiveScale: (scale: number) => void
  setActiveRotation: (rotation: number) => void
  setCameraPreset: (preset: CameraPreset) => void
  setExportTransparent: (value: boolean) => void
  setIsDraggingFile: (value: boolean) => void
  setIsDraggingGraphic: (value: boolean) => void
  setStudioBgId: (id: StudioBgId) => void
  setStudioBgColor: (color: string) => void
  resetGraphics: () => void
}

const defaultBg = STUDIO_BACKGROUNDS[0]

export const useMockupStore = create<MockupState>((set, get) => ({
  shirtId: 'straight',
  color: '#ffffff',
  graphics: defaultGraphics(),
  activeGraphicId: 'demo',
  cameraPreset: null,
  exportTransparent: false,
  isDraggingFile: false,
  isDraggingGraphic: false,
  studioBgId: defaultBg.id,
  studioBgColor: defaultBg.color,

  setShirtId: (shirtId) => set({ shirtId }),
  setColor: (color) => set({ color }),

  addGraphic: (url, name) => {
    const state = get()
    if (state.graphics.length >= MAX_GRAPHICS) return

    const graphic = createGraphic({
      url,
      name: name ?? `Gráfico ${state.graphics.length + 1}`,
      position: {
        x: (state.graphics.length % 3) * 0.05 - 0.05,
        y: 0.12 - Math.floor(state.graphics.length / 3) * 0.06,
        z: 0.26,
      },
    })

    set({
      graphics: [...state.graphics, graphic],
      activeGraphicId: graphic.id,
    })
  },

  replaceActiveGraphicUrl: (url, name) => {
    const { activeGraphicId, graphics } = get()
    if (!activeGraphicId) {
      get().addGraphic(url, name)
      return
    }

    const prev = graphics.find((g) => g.id === activeGraphicId)
    if (prev?.url.startsWith('blob:') && prev.url !== url) {
      URL.revokeObjectURL(prev.url)
    }

    set({
      graphics: graphics.map((g) =>
        g.id === activeGraphicId
          ? { ...g, url, name: name ?? g.name }
          : g,
      ),
    })
  },

  removeGraphic: (id) => {
    const { graphics, activeGraphicId } = get()
    const target = graphics.find((g) => g.id === id)
    if (target?.url.startsWith('blob:')) URL.revokeObjectURL(target.url)

    const next = graphics.filter((g) => g.id !== id)
    const fallback = next.length ? next[next.length - 1].id : null
    set({
      graphics: next,
      activeGraphicId:
        activeGraphicId === id ? fallback : activeGraphicId,
    })
  },

  selectGraphic: (id) => set({ activeGraphicId: id }),

  updateActiveGraphic: (patch) => {
    const { activeGraphicId, graphics } = get()
    if (!activeGraphicId) return
    set({
      graphics: graphics.map((g) =>
        g.id === activeGraphicId ? { ...g, ...patch } : g,
      ),
    })
  },

  setActiveSide: (side) => {
    const { activeGraphicId, graphics } = get()
    if (!activeGraphicId) return
    set({
      graphics: graphics.map((g) => {
        if (g.id !== activeGraphicId) return g
        const z = Math.abs(g.position.z) || 0.26
        return {
          ...g,
          side,
          position: {
            ...g.position,
            z: side === 'front' ? z : -z,
          },
        }
      }),
    })
  },
  setActivePosition: (position) => {
    const { activeGraphicId, graphics } = get()
    if (!activeGraphicId) return
    set({
      graphics: graphics.map((g) =>
        g.id === activeGraphicId
          ? { ...g, position: { ...g.position, ...position } }
          : g,
      ),
    })
  },
  setActiveScale: (scale) => get().updateActiveGraphic({ scale }),
  setActiveRotation: (rotation) => get().updateActiveGraphic({ rotation }),

  setCameraPreset: (cameraPreset) => set({ cameraPreset }),
  setExportTransparent: (exportTransparent) => set({ exportTransparent }),
  setIsDraggingFile: (isDraggingFile) => set({ isDraggingFile }),
  setIsDraggingGraphic: (isDraggingGraphic) => set({ isDraggingGraphic }),
  setStudioBgId: (studioBgId) => {
    if (studioBgId === 'custom') {
      set({ studioBgId })
      return
    }
    const preset = STUDIO_BACKGROUNDS.find((b) => b.id === studioBgId)
    set({
      studioBgId,
      studioBgColor: preset?.color ?? defaultBg.color,
    })
  },
  setStudioBgColor: (studioBgColor) =>
    set({ studioBgId: 'custom', studioBgColor }),
  resetGraphics: () => {
    const { graphics } = get()
    for (const g of graphics) {
      if (g.url.startsWith('blob:')) URL.revokeObjectURL(g.url)
    }
    const next = defaultGraphics()
    set({ graphics: next, activeGraphicId: next[0]?.id ?? null })
  },
}))
