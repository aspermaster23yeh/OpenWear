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
const LAYER_EPS = 0.0035
const PROJECTOR_PULL = 0.22
/** Extra lift on the invisible grab handle so it stays easy to pick. */
const DRAG_LIFT = 0.045
/** Final wrap quality (segments). 6 → 7×7 = 49 verts. */
const PATCH_RES = 6
/** Coarse samples while dragging (3 → 3×3 = 9 rays). */
const DRAFT_SAMPLES = 3

const _local = new THREE.Vector3()
const _normal = new THREE.Vector3()
const _origin = new THREE.Vector3()
const _dir = new THREE.Vector3()
const _ndc = new THREE.Vector2()
const _tangent = new THREE.Vector3()
const _bitangent = new THREE.Vector3()
const _center = new THREE.Vector3()
const _offset = new THREE.Vector3()
const _quat = new THREE.Quaternion()
const _up = new THREE.Vector3(0, 1, 0)
const _tmp = new THREE.Vector3()
const _hitPoint = new THREE.Vector3()
const _dragPlane = new THREE.Plane()
const _raycaster = new THREE.Raycaster()
/** Scratch buffer for draft bilinear samples (max DRAFT_SAMPLES² × 3). */
const _draftSamples = new Float32Array(DRAFT_SAMPLES * DRAFT_SAMPLES * 3)

function simplifyMaterial(_source: THREE.Material) {
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

/**
 * Project the graphic in the surface tangent plane so:
 * - size stays constant (no blow-up on the torso)
 * - the patch wraps around fabric curvature
 * Vertices are written in `parent` local space; mesh transform must stay identity.
 *
 * `draft: true` — few tangent samples + bilinear fill (fast enough for live drag).
 * `draft: false` — raycast every vertex (final quality on release / idle).
 */
function projectPatchOntoShirt(
  geometry: THREE.PlaneGeometry,
  parent: THREE.Object3D,
  bodyMeshes: THREE.Mesh[],
  graphic: Graphic,
  opts: { draft?: boolean } = {},
) {
  if (!bodyMeshes.length) return

  const draft = !!opts.draft
  parent.updateMatrixWorld(true)
  // One mesh while dragging; full set when settling.
  const targets = draft ? bodyMeshes.slice(0, 1) : bodyMeshes
  const fromFront = graphic.side === 'front'
  const lift = draft ? LAYER_EPS * 2.2 : LAYER_EPS

  // 1) Resolve center + normal on the fabric
  _origin
    .set(
      graphic.position.x,
      graphic.position.y,
      fromFront ? 1.5 : -1.5,
    )
    .applyMatrix4(parent.matrixWorld)
  _dir
    .set(0, 0, fromFront ? -1 : 1)
    .transformDirection(parent.matrixWorld)
    .normalize()
  _raycaster.set(_origin, _dir)
  _raycaster.far = 4

  const centerHit = _raycaster.intersectObjects(targets, false)[0]
  if (!centerHit?.face) return

  _center.copy(centerHit.point)
  _normal
    .copy(centerHit.face.normal)
    .transformDirection(centerHit.object.matrixWorld)
    .normalize()
  if (fromFront && _normal.z < 0) _normal.negate()
  if (!fromFront && _normal.z > 0) _normal.negate()

  // 2) Tangent basis on the surface (world space), then rotate by graphic.rotation
  _tangent.crossVectors(_up, _normal)
  if (_tangent.lengthSq() < 1e-6) {
    _tangent.set(1, 0, 0).cross(_normal)
  }
  _tangent.normalize()
  _bitangent.crossVectors(_normal, _tangent).normalize()

  _quat.setFromAxisAngle(_normal, graphic.rotation)
  _tangent.applyQuaternion(_quat)
  _bitangent.applyQuaternion(_quat)

  const size = graphic.scale
  const pos = geometry.attributes.position
  const uv = geometry.attributes.uv

  const sampleSurface = (u: number, v: number, out: THREE.Vector3) => {
    _offset
      .copy(_tangent)
      .multiplyScalar(u * size)
      .addScaledVector(_bitangent, v * size)

    _origin.copy(_center).add(_offset).addScaledVector(_normal, PROJECTOR_PULL)
    _dir.copy(_normal).negate()
    _raycaster.set(_origin, _dir)
    _raycaster.far = PROJECTOR_PULL * 2.5

    const hit = _raycaster.intersectObjects(targets, false)[0]
    if (hit) {
      parent.worldToLocal(out.copy(hit.point).addScaledVector(_normal, lift))
      return true
    }
    parent.worldToLocal(
      out.copy(_center).add(_offset).addScaledVector(_normal, lift),
    )
    return false
  }

  let hits = 0

  if (draft) {
    // Coarse NxN raycasts, then bilinear upsample onto every vertex.
    const n = DRAFT_SAMPLES
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const u = i / (n - 1) - 0.5
        const v = j / (n - 1) - 0.5
        if (sampleSurface(u, v, _tmp)) hits++
        const idx = (j * n + i) * 3
        _draftSamples[idx] = _tmp.x
        _draftSamples[idx + 1] = _tmp.y
        _draftSamples[idx + 2] = _tmp.z
      }
    }

    for (let vi = 0; vi < pos.count; vi++) {
      const su = uv.getX(vi) * (n - 1)
      const sv = uv.getY(vi) * (n - 1)
      const i0 = Math.min(Math.floor(su), n - 2)
      const j0 = Math.min(Math.floor(sv), n - 2)
      const fx = su - i0
      const fy = sv - j0

      const i00 = (j0 * n + i0) * 3
      const i10 = (j0 * n + i0 + 1) * 3
      const i01 = ((j0 + 1) * n + i0) * 3
      const i11 = ((j0 + 1) * n + i0 + 1) * 3

      const x =
        (1 - fx) * (1 - fy) * _draftSamples[i00] +
        fx * (1 - fy) * _draftSamples[i10] +
        (1 - fx) * fy * _draftSamples[i01] +
        fx * fy * _draftSamples[i11]
      const y =
        (1 - fx) * (1 - fy) * _draftSamples[i00 + 1] +
        fx * (1 - fy) * _draftSamples[i10 + 1] +
        (1 - fx) * fy * _draftSamples[i01 + 1] +
        fx * fy * _draftSamples[i11 + 1]
      const z =
        (1 - fx) * (1 - fy) * _draftSamples[i00 + 2] +
        fx * (1 - fy) * _draftSamples[i10 + 2] +
        (1 - fx) * fy * _draftSamples[i01 + 2] +
        fx * fy * _draftSamples[i11 + 2]

      pos.setXYZ(vi, x, y, z)
    }
  } else {
    for (let i = 0; i < pos.count; i++) {
      const u = uv.getX(i) - 0.5
      const v = uv.getY(i) - 0.5
      if (sampleSurface(u, v, _local)) hits++
      pos.setXYZ(i, _local.x, _local.y, _local.z)
    }
  }

  pos.needsUpdate = true
  if (!draft) {
    geometry.computeVertexNormals()
  }
  geometry.computeBoundingSphere()
  geometry.computeBoundingBox()

  if (hits < 2) {
    for (let i = 0; i < pos.count; i++) {
      const u = uv.getX(i) - 0.5
      const v = uv.getY(i) - 0.5
      pos.setXYZ(
        i,
        graphic.position.x + u * size,
        graphic.position.y + v * size,
        graphic.position.z,
      )
    }
    pos.needsUpdate = true
    geometry.computeVertexNormals()
    geometry.computeBoundingSphere()
    geometry.computeBoundingBox()
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
  onDragStart: (id: string, clientX: number, clientY: number) => void
}) {
  const texture = useTexture(graphic.url)
  const isDraggingGraphic = useMockupStore((s) => s.isDraggingGraphic)
  const invalidate = useThree((s) => s.invalidate)
  const [hovered, setHovered] = useState(false)
  useCursor(hovered, 'grab', 'auto')

  const meshRef = useRef<THREE.Mesh>(null)
  const matRef = useRef<THREE.MeshBasicMaterial>(null)

  const geometry = useMemo(
    () => new THREE.PlaneGeometry(1, 1, PATCH_RES, PATCH_RES),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [graphic.id, graphic.url],
  )

  const bodyMeshes = useMemo(() => getBodyMeshes(shirtRoot), [shirtRoot])

  useLayoutEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 8
    texture.minFilter = THREE.LinearMipmapLinearFilter
    texture.magFilter = THREE.LinearFilter
    texture.generateMipmaps = true
    texture.needsUpdate = true
  }, [texture])

  const draggingThis = isDraggingGraphic && isActive

  // Live wrap while dragging — coarse samples only (keeps UI responsive)
  useLayoutEffect(() => {
    const mesh = meshRef.current
    const parent = groupRef.current
    if (!mesh || !parent || !draggingThis) return

    mesh.position.set(0, 0, 0)
    mesh.rotation.set(0, 0, 0)
    mesh.scale.set(1, 1, 1)
    if (matRef.current) matRef.current.depthTest = false
    projectPatchOntoShirt(geometry, parent, bodyMeshes, graphic, {
      draft: true,
    })
    invalidate()
  }, [
    draggingThis,
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

  // Idle / on release: full-quality wrap
  useLayoutEffect(() => {
    if (isDraggingGraphic) return

    const mesh = meshRef.current
    const parent = groupRef.current
    if (!mesh || !parent) return

    const t = window.setTimeout(() => {
      mesh.position.set(0, 0, 0)
      mesh.rotation.set(0, 0, 0)
      mesh.scale.set(1, 1, 1)
      if (matRef.current) matRef.current.depthTest = true
      projectPatchOntoShirt(geometry, parent, bodyMeshes, graphic, {
        draft: false,
      })
      invalidate()
    }, 16)

    return () => window.clearTimeout(t)
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
    <group>
      {/* Grab handle — always hittable, follows stored center */}
      <mesh
        position={[
          graphic.position.x,
          graphic.position.y,
          graphic.position.z + (graphic.side === 'front' ? DRAG_LIFT : -DRAG_LIFT),
        ]}
        rotation={[0, graphic.side === 'front' ? 0 : Math.PI, graphic.rotation]}
        scale={Math.max(graphic.scale, 0.2) * 1.5}
        renderOrder={21}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHovered(true)
        }}
        onPointerOut={() => setHovered(false)}
        onPointerDown={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation()
          ;(e.nativeEvent.target as HTMLElement | null)?.setPointerCapture?.(
            e.pointerId,
          )
          onDragStart(graphic.id, e.clientX, e.clientY)
        }}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          transparent
          opacity={0}
          depthTest={false}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh
        ref={meshRef}
        geometry={geometry}
        userData={{ graphicId: graphic.id }}
        renderOrder={20}
        frustumCulled={false}
        raycast={() => undefined}
      >
        <meshBasicMaterial
          ref={matRef}
          map={texture}
          transparent
          depthTest={!draggingThis}
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={-8}
          polygonOffsetUnits={-8}
          toneMapped={false}
          side={THREE.DoubleSide}
          opacity={isActive ? 1 : 0.92}
        />
      </mesh>
    </group>
  )
}

type DragApi = {
  startDrag: (id: string, clientX?: number, clientY?: number) => void
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
  const { camera, gl, invalidate, controls } = useThree()
  const setIsDraggingGraphic = useMockupStore((s) => s.setIsDraggingGraphic)
  const selectGraphic = useMockupStore((s) => s.selectGraphic)
  const updateActiveGraphic = useMockupStore((s) => s.updateActiveGraphic)
  const dragging = useRef(false)
  const lockedSide = useRef<'front' | 'back' | null>(null)
  const moveRaf = useRef(0)
  const pending = useRef<{ x: number; y: number } | null>(null)

  const shirtMeshes = useMemo(() => getBodyMeshes(shirtRoot), [shirtRoot])

  const setOrbitEnabled = (enabled: boolean) => {
    const orbit = controls as { enabled?: boolean } | null
    if (orbit && typeof orbit.enabled === 'boolean') orbit.enabled = enabled
  }

  const applyHit = (clientX: number, clientY: number) => {
    const parent = groupRef.current
    if (!parent || !shirtMeshes.length) return

    const state = useMockupStore.getState()
    const active = state.graphics.find((g) => g.id === state.activeGraphicId)
    if (!active) return

    const rect = gl.domElement.getBoundingClientRect()
    _ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1
    _ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1
    _raycaster.setFromCamera(_ndc, camera)

    // Raycast every visible shirt mesh (sleeves, torso, etc.)
    const hits = _raycaster.intersectObjects(shirtMeshes, false)
    const prefer = lockedSide.current ?? active.side

    let hit =
      hits.find((h) => {
        if (!h.face) return false
        _normal
          .copy(h.face.normal)
          .transformDirection(h.object.matrixWorld)
          .normalize()
        return prefer === 'front' ? _normal.z >= 0 : _normal.z < 0
      }) ?? hits[0]

    if (hit?.face) {
      const placed = placeFromHit(hit, parent)
      if (placed) {
        if (!lockedSide.current) lockedSide.current = placed.side
        updateActiveGraphic({
          position: placed.position,
          side: lockedSide.current,
        })
        invalidate()
        return
      }
    }

    // Fallback: keep following the pointer on a plane at the graphic depth
    // so the image never "sticks" when the ray misses fabric for a frame.
    parent.updateMatrixWorld(true)
    _center
      .set(active.position.x, active.position.y, active.position.z)
      .applyMatrix4(parent.matrixWorld)
    _normal
      .set(0, 0, prefer === 'front' ? 1 : -1)
      .transformDirection(parent.matrixWorld)
      .normalize()
    _dragPlane.setFromNormalAndCoplanarPoint(_normal, _center)

    if (!_raycaster.ray.intersectPlane(_dragPlane, _hitPoint)) return

    parent.worldToLocal(_local.copy(_hitPoint))
    if (!lockedSide.current) lockedSide.current = prefer
    updateActiveGraphic({
      position: {
        x: _local.x,
        y: _local.y,
        z: active.position.z,
      },
      side: lockedSide.current,
    })
    invalidate()
  }

  const queueHit = (clientX: number, clientY: number) => {
    pending.current = { x: clientX, y: clientY }
    if (moveRaf.current) return
    moveRaf.current = requestAnimationFrame(() => {
      moveRaf.current = 0
      const p = pending.current
      pending.current = null
      if (p) applyHit(p.x, p.y)
    })
  }

  const beginDrag = (clientX?: number, clientY?: number) => {
    dragging.current = true
    lockedSide.current =
      useMockupStore.getState().graphics.find(
        (g) => g.id === useMockupStore.getState().activeGraphicId,
      )?.side ?? 'front'
    setIsDraggingGraphic(true)
    setOrbitEnabled(false)
    if (clientX != null && clientY != null) applyHit(clientX, clientY)
  }

  useLayoutEffect(() => {
    dragApiRef.current = {
      startDrag: (id: string, clientX?: number, clientY?: number) => {
        selectGraphic(id)
        beginDrag(clientX, clientY)
      },
      onShirtDown: (e: ThreeEvent<PointerEvent>) => {
        if (!useMockupStore.getState().activeGraphicId) return
        e.stopPropagation()
        beginDrag(e.clientX, e.clientY)
      },
    }
  })

  useEffect(() => {
    const canvas = gl.domElement

    const onMove = (e: PointerEvent) => {
      if (!dragging.current) return
      e.preventDefault()
      queueHit(e.clientX, e.clientY)
    }

    const onUp = () => {
      if (!dragging.current) return
      dragging.current = false
      lockedSide.current = null
      if (moveRaf.current) {
        cancelAnimationFrame(moveRaf.current)
        moveRaf.current = 0
      }
      if (pending.current) {
        applyHit(pending.current.x, pending.current.y)
        pending.current = null
      }
      setIsDraggingGraphic(false)
      setOrbitEnabled(true)
    }

    canvas.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      canvas.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      if (moveRaf.current) cancelAnimationFrame(moveRaf.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, gl, shirtMeshes, controls])

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
          onDragStart={(id, x, y) => dragApiRef.current?.startDrag(id, x, y)}
        />
      ))}
    </group>
  )
}

export function ShirtModel() {
  const shirtId = useMockupStore((s) => s.shirtId)
  return <ShirtMesh key={shirtId} shirtId={shirtId} />
}
