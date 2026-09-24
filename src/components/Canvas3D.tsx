import {
  Center,
  Html,
  OrbitControls,
  useProgress,
} from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import {
  Suspense,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  forwardRef,
  type RefObject,
} from 'react'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import * as THREE from 'three'
import { useMockupStore } from '../store/useMockupStore'
import { ShirtModel } from './ShirtModel'

export type CameraView = 'front' | 'back' | 'side' | 'reset'

export interface Canvas3DHandle {
  exportPng: (transparent: boolean) => void
}

const CAMERA_PRESETS: Record<
  CameraView,
  { position: [number, number, number]; target: [number, number, number] }
> = {
  front: { position: [0, 0.15, 2.4], target: [0, 0.05, 0] },
  back: { position: [0, 0.15, -2.4], target: [0, 0.05, 0] },
  side: { position: [2.4, 0.2, 0.35], target: [0, 0.05, 0] },
  reset: { position: [0.35, 0.35, 2.2], target: [0, 0.05, 0] },
}

function LoaderFallback() {
  const { progress } = useProgress()

  return (
    <Html center>
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-[#12161e]/90 px-8 py-7 shadow-2xl backdrop-blur-md">
        <div className="relative h-12 w-12">
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-white/10 border-t-[#e8a87c]" />
        </div>
        <p className="text-sm font-medium text-white/85">Cargando camiseta 3D</p>
        <div className="h-1 w-40 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-[#e8a87c] transition-all duration-300"
            style={{ width: `${Math.max(progress, 8)}%` }}
          />
        </div>
        <p className="text-xs tabular-nums text-white/40">{progress.toFixed(0)}%</p>
      </div>
    </Html>
  )
}

function CameraRig({ controlsRef }: { controlsRef: RefObject<OrbitControlsImpl | null> }) {
  const cameraPreset = useMockupStore((s) => s.cameraPreset)
  const setCameraPreset = useMockupStore((s) => s.setCameraPreset)
  const { camera } = useThree()

  useEffect(() => {
    if (!cameraPreset || !controlsRef.current) return

    const preset = CAMERA_PRESETS[cameraPreset]
    camera.position.set(...preset.position)
    controlsRef.current.target.set(...preset.target)
    controlsRef.current.update()
    setCameraPreset(null)
  }, [cameraPreset, camera, controlsRef, setCameraPreset])

  return null
}

function Scene({
  controlsRef,
  onReady,
}: {
  controlsRef: RefObject<OrbitControlsImpl | null>
  onReady: (gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) => void
}) {
  const { gl, scene, camera } = useThree()
  const shirtId = useMockupStore((s) => s.shirtId)

  useEffect(() => {
    onReady(gl, scene, camera)
  }, [gl, scene, camera, onReady])

  return (
    <>
      <color attach="background" args={['#0b0d12']} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[4, 6, 4]} intensity={1.15} />
      <directionalLight position={[-3, 2, -2]} intensity={0.45} color="#a8c0ff" />
      <hemisphereLight args={['#f0f4ff', '#1a120c', 0.35]} />

      <Suspense fallback={<LoaderFallback />}>
        <Center key={shirtId}>
          <ShirtModel />
        </Center>
      </Suspense>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.95, 0]} receiveShadow={false}>
        <circleGeometry args={[1.6, 48]} />
        <meshBasicMaterial color="#050608" transparent opacity={0.55} />
      </mesh>

      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={1.2}
        maxDistance={5}
        minPolarAngle={0.2}
        maxPolarAngle={Math.PI - 0.2}
        target={[0, 0.05, 0]}
      />

      <CameraRig controlsRef={controlsRef} />
    </>
  )
}

export const Canvas3D = forwardRef<Canvas3DHandle>(function Canvas3D(_, ref) {
  const controlsRef = useRef<OrbitControlsImpl | null>(null)
  const renderContext = useRef<{
    gl: THREE.WebGLRenderer
    scene: THREE.Scene
    camera: THREE.Camera
  } | null>(null)

  const handleReady = useCallback(
    (gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) => {
      renderContext.current = { gl, scene, camera }
    },
    [],
  )

  useImperativeHandle(ref, () => ({
    exportPng: (transparent: boolean) => {
      const ctx = renderContext.current
      if (!ctx) return

      const { gl, scene, camera } = ctx
      const prevClearAlpha = gl.getClearAlpha()
      const prevBackground = scene.background

      if (transparent) {
        scene.background = null
        gl.setClearColor(0x000000, 0)
      }

      gl.render(scene, camera)
      const dataUrl = gl.domElement.toDataURL('image/png')

      scene.background = prevBackground
      gl.setClearAlpha(prevClearAlpha)
      gl.render(scene, camera)

      const link = document.createElement('a')
      link.download = `shirt-mockup-${Date.now()}.png`
      link.href = dataUrl
      link.click()
    },
  }))

  return (
    <Canvas
      className="h-full w-full touch-none"
      dpr={[1, 1.5]}
      gl={{
        preserveDrawingBuffer: true,
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
        failIfMajorPerformanceCaveat: false,
      }}
      camera={{ position: [0.35, 0.35, 2.2], fov: 35, near: 0.1, far: 100 }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0)
        const canvas = gl.domElement
        canvas.addEventListener('webglcontextlost', (e) => {
          e.preventDefault()
          console.warn('[Canvas3D] WebGL context lost — recarga la página')
        })
      }}
    >
      <Scene controlsRef={controlsRef} onReady={handleReady} />
    </Canvas>
  )
})
