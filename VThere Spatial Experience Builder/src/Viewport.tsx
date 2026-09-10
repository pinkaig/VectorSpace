import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { CameraPose, SceneObject } from './model'
import { loadEnvironment } from './environments'

export type CameraMode = 'orbit' | 'walk'

interface ViewportProps {
  objects: SceneObject[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onMove: (id: string, position: [number, number, number]) => void
  sceneId: string
  environmentId: string
  startCamera: CameraPose
  cameraMode: CameraMode
  resetToken: number
}

export interface ViewportHandle {
  getCameraPose: () => CameraPose
}

interface EnvStatus {
  state: 'loading' | 'ready' | 'error'
  progress: number
  message?: string
}

const colorFor = (kind: SceneObject['assetKind']) => ({ cube: 0x4ea7a0, sphere: 0xe6ad5a, cylinder: 0xd66d75 })[kind]
const WALK_SPEED = 3.6
const MOVE_KEYS: Record<string, [number, number]> = {
  KeyW: [0, 1], ArrowUp: [0, 1],
  KeyS: [0, -1], ArrowDown: [0, -1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0],
  KeyD: [1, 0], ArrowRight: [1, 0],
}

const isTypingTarget = (target: EventTarget | null) => {
  const element = target as HTMLElement | null
  return !!element && (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.isContentEditable)
}

const Viewport = forwardRef<ViewportHandle, ViewportProps>(function Viewport(
  { objects, selectedId, onSelect, onMove, sceneId, environmentId, startCamera, cameraMode, resetToken },
  ref,
) {
  const mountRef = useRef<HTMLDivElement>(null)
  const dataRef = useRef({ objects, selectedId, onSelect, onMove, startCamera, cameraMode })
  dataRef.current = { objects, selectedId, onSelect, onMove, startCamera, cameraMode }

  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const applyPoseRef = useRef<(pose: CameraPose) => void>(() => {})
  const environmentGroupRef = useRef<THREE.Group | null>(null)
  const currentEnvDisposeRef = useRef<(() => void) | null>(null)
  // Walk-mode look direction. Lives outside the setup effect so the camera-mode-switch
  // effect below can re-seed it from the camera's current orientation on every transition.
  const yawRef = useRef(0)
  const pitchRef = useRef(0)
  const [envStatus, setEnvStatus] = useState<EnvStatus>({ state: 'loading', progress: 0 })
  const [reloadToken, setReloadToken] = useState(0)

  useImperativeHandle(ref, () => ({
    getCameraPose: (): CameraPose => {
      const camera = cameraRef.current
      if (!camera) return dataRef.current.startCamera
      const forward = camera.getWorldDirection(new THREE.Vector3())
      const target = camera.position.clone().add(forward.multiplyScalar(6))
      return { position: [camera.position.x, camera.position.y, camera.position.z], target: [target.x, target.y, target.z] }
    },
  }), [])

  // Scene/renderer/camera setup — created once. All per-render values are read from refs so
  // toggling camera mode or editing objects never tears down the WebGL context.
  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0b1118)
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200)
    cameraRef.current = camera
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    mount.appendChild(renderer.domElement)

    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    const objectsGroup = new THREE.Group()
    const environmentGroup = new THREE.Group()
    environmentGroupRef.current = environmentGroup
    scene.add(environmentGroup)
    scene.add(objectsGroup)
    scene.add(new THREE.HemisphereLight(0xdbe9e7, 0x17222d, 2.2))
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2)
    keyLight.position.set(4, 8, 5)
    scene.add(keyLight)
    const grid = new THREE.GridHelper(16, 16, 0x35515a, 0x1a2b34)
    grid.position.y = 0.01
    scene.add(grid)

    // Orbit/pan/zoom for arranging content — disabled while walking or dragging an object.
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.12
    controls.maxDistance = 40
    controls.minDistance = 1
    controls.maxPolarAngle = Math.PI * 0.49
    controlsRef.current = controls

    const applyPose = (pose: CameraPose) => {
      camera.position.set(...pose.position)
      const target = new THREE.Vector3(...pose.target)
      camera.lookAt(target)
      controls.target.copy(target)
      controls.update()
      const forward = target.clone().sub(camera.position).normalize()
      yawRef.current = Math.atan2(-forward.x, -forward.z)
      pitchRef.current = Math.asin(THREE.MathUtils.clamp(forward.y, -1, 1))
    }
    applyPoseRef.current = applyPose
    applyPose(dataRef.current.startCamera)

    let dragging: { id: string; startX: number; startZ: number; startPointerX: number; startPointerY: number } | null = null
    let looking: { startPointerX: number; startPointerY: number; startYaw: number; startPitch: number } | null = null
    const pressedKeys = new Set<string>()

    const resize = () => {
      const width = mount.clientWidth
      const height = mount.clientHeight
      camera.aspect = width / Math.max(height, 1)
      camera.updateProjectionMatrix()
      renderer.setSize(width, height, false)
    }
    const syncObjects = () => {
      objectsGroup.clear()
      dataRef.current.objects.forEach((item) => {
        const geometry = item.assetKind === 'sphere' ? new THREE.SphereGeometry(0.65, 32, 20) : item.assetKind === 'cylinder' ? new THREE.CylinderGeometry(0.55, 0.55, 1.2, 32) : new THREE.BoxGeometry(1.1, 1.1, 1.1)
        const material = new THREE.MeshStandardMaterial({ color: colorFor(item.assetKind), roughness: 0.68, metalness: 0.05 })
        const mesh = new THREE.Mesh(geometry, material)
        mesh.name = item.id
        mesh.position.set(...item.transform.position)
        mesh.rotation.set(...item.transform.rotation)
        mesh.scale.set(...item.transform.scale)
        if (item.id === dataRef.current.selectedId) {
          const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color: 0xf3d48b }))
          mesh.add(edges)
        }
        objectsGroup.add(mesh)
      })
    }
    const getPointer = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    }
    const pick = (event: PointerEvent) => {
      getPointer(event)
      raycaster.setFromCamera(pointer, camera)
      const hit = raycaster.intersectObjects(objectsGroup.children, false)[0]
      return hit?.object ?? null
    }
    const onPointerDown = (event: PointerEvent) => {
      if (dataRef.current.cameraMode === 'walk') {
        looking = { startPointerX: event.clientX, startPointerY: event.clientY, startYaw: yawRef.current, startPitch: pitchRef.current }
        renderer.domElement.setPointerCapture(event.pointerId)
        return
      }
      const hit = pick(event)
      if (!hit) { dataRef.current.onSelect(null); return }
      controls.enabled = false
      dataRef.current.onSelect(hit.name)
      const item = dataRef.current.objects.find((object) => object.id === hit.name)
      if (item) dragging = { id: item.id, startX: item.transform.position[0], startZ: item.transform.position[2], startPointerX: event.clientX, startPointerY: event.clientY }
      renderer.domElement.setPointerCapture(event.pointerId)
    }
    const onPointerMove = (event: PointerEvent) => {
      if (looking) {
        const sensitivity = 0.0045
        yawRef.current = looking.startYaw - (event.clientX - looking.startPointerX) * sensitivity
        pitchRef.current = THREE.MathUtils.clamp(looking.startPitch - (event.clientY - looking.startPointerY) * sensitivity, -1.4, 1.4)
        camera.rotation.order = 'YXZ'
        camera.rotation.set(pitchRef.current, yawRef.current, 0)
        return
      }
      if (!dragging) return
      const scale = 0.012
      const next: [number, number, number] = [dragging.startX + (event.clientX - dragging.startPointerX) * scale, dataRef.current.objects.find((item) => item.id === dragging?.id)?.transform.position[1] ?? 0, dragging.startZ + (event.clientY - dragging.startPointerY) * scale]
      dataRef.current.onMove(dragging.id, next)
    }
    const onPointerUp = (event: PointerEvent) => {
      if (looking) {
        const moved = Math.hypot(event.clientX - looking.startPointerX, event.clientY - looking.startPointerY)
        looking = null
        if (moved < 4) {
          const hit = pick(event)
          dataRef.current.onSelect(hit?.name ?? null)
        }
        return
      }
      dragging = null
      controls.enabled = dataRef.current.cameraMode === 'orbit'
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return
      if (!(event.code in MOVE_KEYS)) return
      if (dataRef.current.cameraMode === 'walk') event.preventDefault()
      pressedKeys.add(event.code)
    }
    const onKeyUp = (event: KeyboardEvent) => { pressedKeys.delete(event.code) }

    const observer = new ResizeObserver(resize)
    observer.observe(mount)
    renderer.domElement.addEventListener('pointerdown', onPointerDown)
    renderer.domElement.addEventListener('pointermove', onPointerMove)
    renderer.domElement.addEventListener('pointerup', onPointerUp)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    let frame = 0
    let lastTime = performance.now()
    const animate = () => {
      frame = requestAnimationFrame(animate)
      const now = performance.now()
      const delta = Math.min((now - lastTime) / 1000, 0.1)
      lastTime = now
      syncObjects()
      if (dataRef.current.cameraMode === 'walk') {
        let dx = 0
        let dz = 0
        pressedKeys.forEach((code) => { const [x, z] = MOVE_KEYS[code] ?? [0, 0]; dx += x; dz += z })
        if (dx !== 0 || dz !== 0) {
          const length = Math.hypot(dx, dz) || 1
          const forward = new THREE.Vector3(-Math.sin(yawRef.current), 0, -Math.cos(yawRef.current))
          const right = new THREE.Vector3(Math.cos(yawRef.current), 0, -Math.sin(yawRef.current))
          const step = (WALK_SPEED * delta) / length
          camera.position.addScaledVector(forward, dz * step)
          camera.position.addScaledVector(right, dx * step)
        }
      } else {
        controls.update()
      }
      renderer.render(scene, camera)
    }
    resize()
    animate()

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      renderer.domElement.removeEventListener('pointermove', onPointerMove)
      renderer.domElement.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      controls.dispose()
      currentEnvDisposeRef.current?.()
      currentEnvDisposeRef.current = null
      renderer.dispose()
      mount.removeChild(renderer.domElement)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

// Orbit and walk mode use different camera controls. 
// Disable OrbitControls when walk mode starts to prevent camera snapping. 
// When switching modes, update the new control using the camera's current direction 
// so the camera transition stays smooth.
  const previousModeRef = useRef<CameraMode | null>(null)
  useEffect(() => {
    const camera = cameraRef.current
    const controls = controlsRef.current
    if (!camera || !controls) return
    controls.enabled = cameraMode === 'orbit'
    const isFirstRun = previousModeRef.current === null
    const changed = previousModeRef.current !== cameraMode
    previousModeRef.current = cameraMode
    if (isFirstRun || !changed) return
    const forward = camera.getWorldDirection(new THREE.Vector3())
    if (cameraMode === 'walk') {
      yawRef.current = Math.atan2(-forward.x, -forward.z)
      pitchRef.current = THREE.MathUtils.clamp(Math.asin(THREE.MathUtils.clamp(forward.y, -1, 1)), -1.4, 1.4)
      camera.rotation.order = 'YXZ'
      camera.rotation.set(pitchRef.current, yawRef.current, 0)
    } else {
      controls.target.copy(camera.position.clone().addScaledVector(forward, 6))
    }
  }, [cameraMode])

  // Environment loading — a separate lifecycle from the renderer so switching scenes or
  // retrying a failed load never rebuilds the WebGL context.
  useEffect(() => {
    let cancelled = false
    setEnvStatus({ state: 'loading', progress: 0 })
    loadEnvironment(environmentId, { onProgress: (ratio) => { if (!cancelled) setEnvStatus({ state: 'loading', progress: ratio }) } })
      .then((loaded) => {
        if (cancelled) { loaded.dispose(); return }
        const holder = environmentGroupRef.current
        holder?.clear()
        holder?.add(loaded.group)
        currentEnvDisposeRef.current?.()
        currentEnvDisposeRef.current = loaded.dispose
        setEnvStatus({ state: 'ready', progress: 1 })
        applyPoseRef.current(dataRef.current.startCamera)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setEnvStatus({ state: 'error', progress: 0, message: error instanceof Error ? error.message : 'Failed to load environment' })
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [environmentId, sceneId, reloadToken])

  useEffect(() => {
    if (envStatus.state === 'ready') applyPoseRef.current(dataRef.current.startCamera)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetToken])

  return (
    <div className="viewport" ref={mountRef}>
      {envStatus.state !== 'ready' && (
        <div className="viewport-overlay">
          {envStatus.state === 'loading' ? (
            <>
              <div className="spinner" />
              <p>Loading environment…</p>
              <div className="progress-track"><div className="progress-fill" style={{ width: `${Math.round(envStatus.progress * 100)}%` }} /></div>
            </>
          ) : (
            <>
              <p className="overlay-error">Could not load this environment.</p>
              <p className="overlay-detail">{envStatus.message}</p>
              <button className="button subtle" onClick={() => setReloadToken((value) => value + 1)}>Retry</button>
            </>
          )}
        </div>
      )}
      <div className="viewport-hint">{cameraMode === 'walk' ? 'Drag to look · WASD to walk · Click to select' : 'Drag a selected object across the floor'}</div>
    </div>
  )
})

export default Viewport
