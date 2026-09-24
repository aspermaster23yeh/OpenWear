import { useGLTF, useTexture } from '@react-three/drei'
import { useLayoutEffect, useMemo } from 'react'
import * as THREE from 'three'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import straightUrl from '../assets/crewneck-straight-cut-short-sleeve-t-shirt-3d-model-b42a1ab90447.glb?url'
import relaxedUrl from '../assets/relaxed-crewneck-drop-shoulder-elbow-sleeve-t-shirt-3d-model-b2e6febd66e6.glb?url'
import { useMockupStore, type ShirtId } from '../store/useMockupStore'

const SHIRT_URLS: Record<ShirtId, string> = {
  straight: straightUrl,
  relaxed: relaxedUrl,
}

useGLTF.preload(straightUrl)

const HIDDEN_MESHES: Partial<Record<ShirtId, string[]>> = {
  straight: ['REBUILD_Tonal_Double_Stitch'],
}

// Plane must sit in front of the fitted chest (~0.24–0.30). Values below that
// bury the graphic inside the mesh so depth-test hides it completely.
const LOGO_Z: Record<ShirtId, number> = {
  straight: 0.42,
  relaxed: 0.45,
}

const MAX_TEX_SIZE = 1024
const TARGET_SIZE = 1.15

function downscaleTexture(tex: THREE.Texture) {
  const img = tex.image as
    | HTMLImageElement
    | HTMLCanvasElement
    | ImageBitmap
    | undefined
  if (!img?.width || !img?.height) return

  const maxDim = Math.max(img.width, img.height)
  if (maxDim <= MAX_TEX_SIZE) return

  const scale = MAX_TEX_SIZE / maxDim
  const w = Math.max(1, Math.round(img.width * scale))
  const h = Math.max(1, Math.round(img.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.drawImage(img as CanvasImageSource, 0, 0, w, h)
  tex.image = canvas
  tex.needsUpdate = true
}

function simplifyMaterial(source: THREE.Material) {
  const std = source as THREE.MeshStandardMaterial
  // Keep normal maps for fabric detail; skip baseColor maps (CLOZDESIGN watermarks)
  const next = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#ffffff'),
    map: null,
    normalMap: std.normalMap ?? null,
    normalScale: std.normalScale?.clone() ?? new THREE.Vector2(1, 1),
    roughness: std.roughness ?? 0.85,
    metalness: 0,
    side: THREE.DoubleSide,
    envMapIntensity: 0.35,
  })

  if (next.normalMap) {
    next.normalMap = next.normalMap.clone()
    downscaleTexture(next.normalMap)
  }

  return next
}

function fitToUnitSize(root: THREE.Object3D) {
  root.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(root)
  const size = box.getSize(new THREE.Vector3())
  const maxDim = Math.max(size.x, size.y, size.z) || 1
  root.scale.multiplyScalar(TARGET_SIZE / maxDim)

  root.updateMatrixWorld(true)
  const fitted = new THREE.Box3().setFromObject(root)
  const center = fitted.getCenter(new THREE.Vector3())
  root.position.sub(center)
}

function ShirtMesh({ shirtId }: { shirtId: ShirtId }) {
  const url = SHIRT_URLS[shirtId]
  const { scene } = useGLTF(url)
  const color = useMockupStore((s) => s.color)
  const logoUrl = useMockupStore((s) => s.logoUrl)
  const logoPosition = useMockupStore((s) => s.logoPosition)
  const logoScale = useMockupStore((s) => s.logoScale)
  const logoRotation = useMockupStore((s) => s.logoRotation)
  const decalSide = useMockupStore((s) => s.decalSide)

  const logoTexture = useTexture(logoUrl)

  useLayoutEffect(() => {
    logoTexture.colorSpace = THREE.SRGBColorSpace
    logoTexture.anisotropy = 4
    logoTexture.needsUpdate = true
  }, [logoTexture])

  const cloned = useMemo(() => {
    const root = cloneSkinned(scene)
    const hidden = new Set(HIDDEN_MESHES[shirtId] ?? [])

    root.traverse((child) => {
      const mesh = child as THREE.Mesh
      if (!mesh.isMesh) return

      if (hidden.has(mesh.name)) {
        mesh.visible = false
        return
      }

      mesh.castShadow = false
      mesh.receiveShadow = false
      mesh.frustumCulled = true

      const sources = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      const mats = sources.map((m) => simplifyMaterial(m))
      mesh.material = Array.isArray(mesh.material) ? mats : mats[0]
    })

    fitToUnitSize(root)
    return root
  }, [scene, shirtId])

  useLayoutEffect(() => {
    const tint = new THREE.Color(color)
    cloned.traverse((child) => {
      const mesh = child as THREE.Mesh
      if (!mesh.isMesh || !mesh.visible) return
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const mat of mats) {
        const std = mat as THREE.MeshStandardMaterial
        if (std?.color) std.color.copy(tint)
      }
    })
  }, [cloned, color])

  const z = LOGO_Z[shirtId]
  const logoPos = useMemo(
    (): [number, number, number] => [
      logoPosition.x,
      logoPosition.y + 0.08,
      decalSide === 'front' ? z : -z,
    ],
    [logoPosition.x, logoPosition.y, decalSide, z],
  )

  const logoRot = useMemo(
    (): [number, number, number] => [
      0,
      decalSide === 'front' ? 0 : Math.PI,
      logoRotation,
    ],
    [decalSide, logoRotation],
  )

  return (
    <group>
      <primitive object={cloned} />
      <mesh
        position={logoPos}
        rotation={logoRot}
        scale={logoScale}
        renderOrder={10}
        frustumCulled={false}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          map={logoTexture}
          transparent
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  )
}

export function ShirtModel() {
  const shirtId = useMockupStore((s) => s.shirtId)
  return <ShirtMesh key={shirtId} shirtId={shirtId} />
}
