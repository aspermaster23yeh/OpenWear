import { useCursor, useGLTF, useTexture } from '@react-three/drei'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type RefObject,
} from 'react'
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

const TARGET_SIZE = 1.15
const LAYER_EPS = 0.003
const PATCH_RES = 6

const _local = new THREE.Vector3()
const _normal = new THREE.Vector3()
const _origin = new THREE.Vector3()
const _dir = new THREE.Vector3()
const _ndc = new THREE.Vector2()
const _raycaster = new THREE.Raycaster()

function simplifyMaterial(_source: THREE.Material) {
  // Lambert + no normal maps: ~310k tris stays orbit-friendly on integrated GPUs
  return new THREE.MeshLambertMaterial({
    color: new THREE.Color('#ffffff'),
    side: THREE.FrontSide,
  })
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

function getBodyMeshes(root: THREE.Object3D) {
  const meshes: THREE.Mesh[] = []
  root.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (mesh.isMesh && mesh.visible && mesh.userData.isShirt) meshes.push(mesh)
  })
  return meshes.sort((a, b) => {
    const va = a.geometry?.attributes?.position?.count ?? 0
    const vb = b.geometry?.attributes?.position?.count ?? 0
    return vb - va
  })
}

function placeFromHit(
  hit: THREE.Intersection,
  parent: THREE.Object3D,
): { position: { x: number; y: number; z: number }; side: 'front' | 'back' } | null {
  if (!hit.face) return null

  parent.updateMatrixWorld(true)
  _normal
    .copy(hit.face.normal)
    .transformDirection(hit.object.matrixWorld)
    .normalize()

  const side: 'front' | 'back' = _normal.z >= 0 ? 'front' : 'back'
  if (side === 'front' && _normal.z < 0) _normal.negate()
  if (side === 'back' && _normal.z > 0) _normal.negate()

  parent.worldToLocal(_local.copy(hit.point).addScaledVector(_normal, LAYER_EPS))

  return {
    position: { x: _local.x, y: _local.y, z: _local.z },
    side,
  }
}

/** Reset subdivided plane to a flat unit square in XY. */
function resetFlatPlane(geometry: THREE.PlaneGeometry) {
  const pos = geometry.attributes.position
  const uv = geometry.attributes.uv
  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(i, uv.getX(i) - 0.5, uv.getY(i) - 0.5, 0)
  }
  pos.needsUpdate = true
  geometry.computeVertexNormals()
}

/**
 * Project every grid vertex onto the shirt so the graphic follows mold curvature.
 * Vertices end up in `parent` local space; mesh transform should be identity.
 */
function projectPatchOntoShirt(
  geometry: THREE.PlaneGeometry,
  parent: THREE.Object3D,
  bodyMeshes: THREE.Mesh[],
  graphic: Graphic,
) {
  if (!bodyMeshes.length) return

  parent.updateMatrixWorld(true)
  const fromFront = graphic.side === 'front'
  const cx = graphic.position.x
  const cy = graphic.position.y
  const cos = Math.cos(graphic.rotation)
  const sin = Math.sin(graphic.rotation)
  const targets = bodyMeshes.slice(0, 1)

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

    _origin.set(x, y, fromFront ? 1.4 : -1.4).applyMatrix4(parent.matrixWorld)
    _dir
      .set(0, 0, fromFront ? -1 : 1)
      .transformDirection(parent.matrixWorld)
      .normalize()
    _raycaster.set(_origin, _dir)
    _raycaster.far = 4

    const hit = _raycaster.intersectObjects(targets, false)[0]
    if (hit?.face) {
      hits++
      _normal
        .copy(hit.face.normal)
        .transformDirection(hit.object.matrixWorld)
        .normalize()
      if (fromFront && _normal.z < 0) _normal.negate()
      if (!fromFront && _normal.z > 0) _normal.negate()

      parent.worldToLocal(
        _local.copy(hit.point).addScaledVector(_normal, LAYER_EPS),
      )
      pos.setXYZ(i, _local.x, _local.y, _local.z)
    } else {
      // Keep center depth if a corner misses (sleeve edge, etc.)
      pos.setXYZ(i, x, y, graphic.position.z)
    }
  }

  pos.needsUpdate = true
  geometry.computeVertexNormals()

  // If almost nothing hit, leave a flat card at the stored pose
  if (hits < pos.count * 0.3) {
    resetFlatPlane(geometry)
  }
}

function GraphicLayer({
  graphic,
  isActive,
  shirtRoot,
  groupRef,
  onDragStart,
}: {
  graphic: Graphic
  isActive: boolean
  shirtRoot: THREE.Object3D
  groupRef: RefObject<THREE.Group | null>
  onDragStart: (id: string) => void
}) {
  const texture = useTexture(graphic.url)
  const isDraggingGraphic = useMockupStore((s) => s.isDraggingGraphic)
  const invalidate = useThree((s) => s.invalidate)
  const [hovered, setHovered] = useState(false)
  useCursor(hovered, 'grab', 'auto')

  const meshRef = useRef<THREE.Mesh>(null)

  const geometry = useMemo(
    () => new THREE.PlaneGeometry(1, 1, PATCH_RES, PATCH_RES),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [graphic.id, graphic.url],
  )

  const bodyMeshes = useMemo(() => getBodyMeshes(shirtRoot), [shirtRoot])

  useLayoutEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 2
    texture.needsUpdate = true
  }, [texture])

  // Flat preview while dragging — no raycasts (keeps orbit/drag responsive)
  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return

    if (isDraggingGraphic && isActive) {
      resetFlatPlane(geometry)
      mesh.position.set(
        graphic.position.x,
        graphic.position.y,
        graphic.position.z,
      )
      mesh.rotation.set(
        0,
        graphic.side === 'front' ? 0 : Math.PI,
        graphic.rotation,
      )
      mesh.scale.setScalar(graphic.scale)
      invalidate()
    }
  }, [
    isDraggingGraphic,
    isActive,
    graphic.position.x,
    graphic.position.y,
    graphic.position.z,
    graphic.scale,
    graphic.rotation,
    graphic.side,
    geometry,
    invalidate,
  ])

  // Project onto fabric curvature only when idle (after Center settles)
  useLayoutEffect(() => {
    if (isDraggingGraphic) return

    const mesh = meshRef.current
    const parent = groupRef.current
    if (!mesh || !parent) return

    let cancelled = false
    const t = window.setTimeout(() => {
      if (cancelled) return
      mesh.position.set(0, 0, 0)
      mesh.rotation.set(0, 0, 0)
      mesh.scale.set(1, 1, 1)
      projectPatchOntoShirt(geometry, parent, bodyMeshes, graphic)
      invalidate()
    }, 40)

    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [
    isDraggingGraphic,
    graphic.position.x,
    graphic.position.y,
    graphic.position.z,
    graphic.scale,
    graphic.rotation,
    graphic.side,
    graphic,
    bodyMeshes,
    geometry,
    groupRef,
    invalidate,
  ])

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      userData={{ graphicId: graphic.id }}
      renderOrder={20}
      frustumCulled
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(true)
      }}
      onPointerOut={() => setHovered(false)}
      onPointerDown={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation()
        onDragStart(graphic.id)
      }}
    >
      <meshBasicMaterial
        map={texture}
        transparent
        depthTest
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-4}
        polygonOffsetUnits={-4}
        toneMapped={false}
        side={THREE.DoubleSide}
        opacity={isActive ? 1 : 0.92}
      />
    </mesh>
  )
}

type DragApi = {
  startDrag: (id: string) => void
  onShirtDown: (e: ThreeEvent<PointerEvent>) => void
}

function DragSystem({
  groupRef,
  shirtRoot,
  dragApiRef,
}: {
  groupRef: RefObject<THREE.Group | null>
  shirtRoot: THREE.Object3D
  dragApiRef: MutableRefObject<DragApi | null>
}) {
  const { camera, gl, invalidate } = useThree()
  const setIsDraggingGraphic = useMockupStore((s) => s.setIsDraggingGraphic)
  const selectGraphic = useMockupStore((s) => s.selectGraphic)
  const updateActiveGraphic = useMockupStore((s) => s.updateActiveGraphic)
  const dragging = useRef(false)

  const shirtMeshes = useMemo(() => getBodyMeshes(shirtRoot), [shirtRoot])

  const applyHit = (clientX: number, clientY: number) => {
    const parent = groupRef.current
    if (!parent) return

    const rect = gl.domElement.getBoundingClientRect()
    _ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1
    _ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1
    _raycaster.setFromCamera(_ndc, camera)

    const hit = _raycaster.intersectObjects(shirtMeshes.slice(0, 1), false)[0]
    if (!hit) return

    const placed = placeFromHit(hit, parent)
    if (!placed) return
    updateActiveGraphic({ position: placed.position, side: placed.side })
    invalidate()
  }

  useLayoutEffect(() => {
    dragApiRef.current = {
      startDrag: (id: string) => {
        selectGraphic(id)
        dragging.current = true
        setIsDraggingGraphic(true)
      },
      onShirtDown: (e: ThreeEvent<PointerEvent>) => {
        if (!useMockupStore.getState().activeGraphicId) return
        e.stopPropagation()
        dragging.current = true
        setIsDraggingGraphic(true)
        applyHit(e.clientX, e.clientY)
      },
    }
  })

  useEffect(() => {
    const canvas = gl.domElement

    const onMove = (e: PointerEvent) => {
      if (!dragging.current) return
      applyHit(e.clientX, e.clientY)
    }

    const onUp = () => {
      if (!dragging.current) return
      dragging.current = false
      setIsDraggingGraphic(false)
    }

    canvas.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      canvas.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, gl, shirtMeshes])

  return null
}

function ShirtMesh({ shirtId }: { shirtId: ShirtId }) {
  const url = SHIRT_URLS[shirtId]
  const { scene } = useGLTF(url)
  const color = useMockupStore((s) => s.color)
  const graphics = useMockupStore((s) => s.graphics)
  const activeGraphicId = useMockupStore((s) => s.activeGraphicId)
  const groupRef = useRef<THREE.Group>(null)
  const dragApiRef = useRef<DragApi | null>(null)

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
      mesh.userData.isShirt = true

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
        const std = mat as THREE.MeshLambertMaterial
        if (std?.color) std.color.copy(tint)
      }
    })
  }, [cloned, color])

  return (
    <group ref={groupRef}>
      <primitive
        object={cloned}
        onPointerDown={(e: ThreeEvent<PointerEvent>) => {
          dragApiRef.current?.onShirtDown(e)
        }}
      />
      <DragSystem
        groupRef={groupRef}
        shirtRoot={cloned}
        dragApiRef={dragApiRef}
      />
      {graphics.map((graphic) => (
        <GraphicLayer
          key={`${graphic.id}:${graphic.url}`}
          graphic={graphic}
          isActive={graphic.id === activeGraphicId}
          shirtRoot={cloned}
          groupRef={groupRef}
          onDragStart={(id) => dragApiRef.current?.startDrag(id)}
        />
      ))}
    </group>
  )
}

export function ShirtModel() {
  const shirtId = useMockupStore((s) => s.shirtId)
  return <ShirtMesh key={shirtId} shirtId={shirtId} />
}
