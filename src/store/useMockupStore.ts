import { create } from 'zustand'

export type DecalSide = 'front' | 'back'
export type CameraPreset = 'front' | 'back' | 'side' | 'reset' | null
export type ShirtId = 'straight' | 'relaxed'

export const COLOR_PRESETS = [
  { name: 'Blanco', value: '#ffffff' },
  { name: 'Negro', value: '#1a1a1a' },
  { name: 'Beige', value: '#d4c4a8' },
  { name: 'Azul marino', value: '#1e2a44' },
  { name: 'Rojo vintage', value: '#8b3a3a' },
] as const

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

interface LogoPosition {
  x: number
  y: number
}

interface MockupState {
  shirtId: ShirtId
  color: string
  logoUrl: string
  logoPosition: LogoPosition
  logoScale: number
  logoRotation: number
  decalSide: DecalSide
  cameraPreset: CameraPreset
  exportTransparent: boolean
  isDraggingFile: boolean

  setShirtId: (shirtId: ShirtId) => void
  setColor: (color: string) => void
  setLogoUrl: (url: string) => void
  setLogoPosition: (position: Partial<LogoPosition>) => void
  setLogoScale: (scale: number) => void
  setLogoRotation: (rotation: number) => void
  setDecalSide: (side: DecalSide) => void
  setCameraPreset: (preset: CameraPreset) => void
  setExportTransparent: (value: boolean) => void
  setIsDraggingFile: (value: boolean) => void
  resetLogo: () => void
}

export const useMockupStore = create<MockupState>((set) => ({
  shirtId: 'straight',
  color: '#ffffff',
  logoUrl: DEFAULT_LOGO,
  logoPosition: { x: 0, y: 0.04 },
  logoScale: 0.15,
  logoRotation: 0,
  decalSide: 'front',
  cameraPreset: null,
  exportTransparent: false,
  isDraggingFile: false,

  setShirtId: (shirtId) => set({ shirtId }),
  setColor: (color) => set({ color }),
  setLogoUrl: (logoUrl) => set({ logoUrl }),
  setLogoPosition: (position) =>
    set((state) => ({
      logoPosition: { ...state.logoPosition, ...position },
    })),
  setLogoScale: (logoScale) => set({ logoScale }),
  setLogoRotation: (logoRotation) => set({ logoRotation }),
  setDecalSide: (decalSide) => set({ decalSide }),
  setCameraPreset: (cameraPreset) => set({ cameraPreset }),
  setExportTransparent: (exportTransparent) => set({ exportTransparent }),
  setIsDraggingFile: (isDraggingFile) => set({ isDraggingFile }),
  resetLogo: () =>
    set({
      logoUrl: DEFAULT_LOGO,
      logoPosition: { x: 0, y: 0.04 },
      logoScale: 0.15,
      logoRotation: 0,
      decalSide: 'front',
    }),
}))
