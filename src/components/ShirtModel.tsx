import { useGLTF, useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import straightUrl from '../assets/crewneck-straight-cut-short-sleeve-t-shirt-3d-model-b42a1ab90447.glb?url'
import relaxedUrl from '../assets/relaxed-crewneck-drop-shoulder-elbow-sleeve-t-shirt-3d-model-b2e6febd66e6.glb?url'
import { useMockupStore, type Graphic, type ShirtId } from '../store/useMockupStore'

const SHIRT_URLS: Record<ShirtId, string> = {
  straight: straightUrl,
  relaxed: relaxedUrl,
}

useGLTF.preload(straightUrl)

const HIDDEN_MESHES: Partial<Record<ShirtId, string[]>> = {
  straight: ['REBUILD_Tonal_Double_Stitch'],
}

const BODY_MESH_HINTS = ['Cotton_Cuff_Continuous', 'Cotton']

const MAX_TEX_SIZE = 1024
const TARGET_SIZE = 1.15
const SURFACE_EPS = 0.0015
const PATCH_RES = 12
const FALLBACK_Z: Record<ShirtId, number> = {
  straight: 0.25,
  relaxed: 0.3,
}

const _origin = new THREE.Vector3()
const _dir = new THREE.Vector3()
const _local = new THREE.Vector3()
const _worldNormal = new THREE.Vector3()
const _raycaster = new THREE.Raycaster()

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

function collectBodyMeshes(root: THREE.Object3D) {
  const meshes: THREE.Mesh[] = []
  root.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (!mesh.isMesh || !mesh.visible) return
    meshes.push(mesh)
  })

  const hinted = meshes.filter((m) =>
    BODY_MESH_HINTS.some((h) => m.name.includes(h)),
  )
  const pool = hinted.length ? hinted : meshes
  return pool.sort((a, b) => {
    const va = a.geometry?.attributes?.position?.count ?? 0
    const vb = b.geometry?.attributes?.position?.count ?? 0
    return vb - va
  })
}

/**
 * Build a grid patch whose vertices are projected onto the shirt surface,
 * so the graphic follows fabric curvature instead of floating as a flat card.
 */
function projectPatchOntoSurface(
  geometry: THREE.PlaneGeometry,
  parent: THREE.Object3D,
  target: THREE.Object3D,
  graphic: Graphic,
  shirtId: ShirtId,
) {
  parent.updateMatrixWorld(true)
  target.updateMatrixWorld(true)

  const bodies = collectBodyMeshes(target)
  const fromFront = graphic.side === 'front'
  const cx = graphic.position.x
  const cy = graphic.position.y + 0.08
  const cos = Math.cos(graphic.rotation)
  const sin = Math.sin(graphic.rotation)

  const pos = geometry.attributes.position
  const uv = geometry.attributes.uv
  let hits = 0

  for (let i = 0; i < pos.count; i++) {
    const u = uv.getX(i) - 0.5
    const v = uv.getY(i) - 0.5
    const ru = u * cos - v * sin
    const rv = u * sin + v * cos
    const x = cx + ru * graphic.scale
    const y = cy + rv * graphic.scale

    _origin.set(x, y, fromFront ? 1.5 : -1.5).applyMatrix4(parent.matrixWorld)
    _dir
      .set(0, 0, fromFront ? -1 : 1)
      .transformDirection(parent.matrixWorld)
      .normalize()
    _raycaster.set(_origin, _dir)
    _raycaster.far = 4

    // Prefer main body panel; fall back to any hit on the garment
    let hit =
      _raycaster.intersectObjects(bodies.slice(0, 1), false)[0] ??
      _raycaster.intersectObject(target, true)[0]

    // Skip hits on the patch meshes themselves if any
    while (hit && (hit.object as THREE.Mesh).renderOrder >= 10) {
      const rest = _raycaster.intersectObject(target, true)
      hit = rest.find((h) => (h.object as THREE.Mesh).renderOrder < 10)
    }

    if (hit?.face) {
      hits++
      _worldNormal
        .copy(hit.face.normal)
        .transformDirection(hit.object.matrixWorld)
        .normalize()
      if (fromFront && _worldNormal.z < 0) _worldNormal.negate()
      if (!fromFront && _worldNormal.z > 0) _worldNormal.negate()

      parent.worldToLocal(
        _local.copy(hit.point).addScaledVector(_worldNormal, SURFACE_EPS),
      )
      pos.setXYZ(i, _local.x, _local.y, _local.z)
    } else {
      const z = fromFront ? FALLBACK_Z[shirtId] : -FALLBACK_Z[shirtId]
      pos.setXYZ(i, x, y, z)
    }
  }

  pos.needsUpdate = true
  geometry.computeVertexNormals()

  if (hits < pos.count * 0.25) {
    for (let i = 0; i < pos.count; i++) {
      const u = uv.getX(i) - 0.5
      const v = uv.getY(i) - 0.5
      const ru = u * cos - v * sin
      const rv = u * sin + v * cos
      const x = cx + ru * graphic.scale
      const y = cy + rv * graphic.scale
      const z = fromFront ? FALLBACK_Z[shirtId] : -FALLBACK_Z[shirtId]
      pos.setXYZ(i, x, y, z)
    }
    pos.needsUpdate = true
    geometry.computeVertexNormals()
  }
}

function SurfacePatch({
  graphic,
  target,
  shirtId,
}: {
  graphic: Graphic
  target: THREE.Object3D
  shirtId: ShirtId
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const needsProject = useRef(true)
  const warmFrames = useRef(0)
  const texture = useTexture(graphic.url)

  const geometry = useMemo(
    () => new THREE.PlaneGeometry(1, 1, PATCH_RES, PATCH_RES),
    // recreate when identity changes so UV/layout stays clean
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [graphic.id, graphic.url],
  )

  useLayoutEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 4
    texture.needsUpdate = true
  }, [texture])

  useLayoutEffect(() => {
    needsProject.current = true
    warmFrames.current = 0
  }, [graphic, target, shirtId, geometry])

  useFrame(() => {
    const mesh = meshRef.current
    if (!mesh?.parent) return

    // Re-project for a few frames after mount so <Center> matrix is settled
    const warming = warmFrames.current < 8
    if (warming) warmFrames.current += 1
    if (!needsProject.current && !warming) return

    needsProject.current = false
    projectPatchOntoSurface(geometry, mesh.parent, target, graphic, shirtId)
    mesh.position.set(0, 0, 0)
    mesh.rotation.set(0, 0, 0)
    mesh.scale.set(1, 1, 1)
  })

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      renderOrder={10}
      frustumCulled={false}
    >
      <meshBasicMaterial
        map={texture}
        transparent
        depthWrite={false}
        depthTest
        polygonOffset
        polygonOffsetFactor={-8}
        polygonOffsetUnits={-8}
        toneMapped={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

function ShirtMesh({ shirtId }: { shirtId: ShirtId }) {
  const url = SHIRT_URLS[shirtId]
  const { scene } = useGLTF(url)
  const color = useMockupStore((s) => s.color)
  const graphics = useMockupStore((s) => s.graphics)

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

  return (
    <group>
      <primitive object={cloned} />
      {graphics.map((graphic) => (
        <SurfacePatch
          key={`${graphic.id}:${graphic.url}`}
          graphic={graphic}
          target={cloned}
          shirtId={shirtId}
        />
      ))}
    </group>
  )
}

export function ShirtModel() {
  const shirtId = useMockupStore((s) => s.shirtId)
  return <ShirtMesh key={shirtId} shirtId={shirtId} />
}
