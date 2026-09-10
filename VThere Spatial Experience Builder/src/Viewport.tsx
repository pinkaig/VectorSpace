import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { SceneObject } from './model'

interface ViewportProps {
  objects: SceneObject[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onMove: (id: string, position: [number, number, number]) => void
  interactive?: boolean
}

const colorFor = (kind: SceneObject['assetKind']) => ({ cube: 0x4ea7a0, sphere: 0xe6ad5a, cylinder: 0xd66d75 })[kind]

export default function Viewport({ objects, selectedId, onSelect, onMove, interactive = true }: ViewportProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const dataRef = useRef({ objects, selectedId, onSelect, onMove })
  dataRef.current = { objects, selectedId, onSelect, onMove }

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0b1118)
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100)
    camera.position.set(7, 5.5, 8)
    camera.lookAt(0, 0.7, 0)
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    mount.appendChild(renderer.domElement)
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()

    // used for drag math: instead of moving objects by raw screen-pixel deltas,
    // we raycast teh cursor against the floor plane to get the object's real 3D position
    const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
    const dragIntersection = new THREE.Vector3()
    
    const objectsGroup = new THREE.Group()
    scene.add(objectsGroup)
    scene.add(new THREE.HemisphereLight(0xdbe9e7, 0x17222d, 2.2))
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.5)
    keyLight.position.set(4, 8, 5)
    scene.add(keyLight)
    const grid = new THREE.GridHelper(12, 12, 0x5f8a94, 0x1a2b34)
    scene.add(grid)
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.MeshBasicMaterial({ color: 0x101a21, transparent: true, opacity: 0.6 }))
    floor.rotation.x = -Math.PI / 2
    scene.add(floor)
    let dragging: { id: string; offsetX: number; offsetZ: number } | null = null

    // track the last computed position during a drag, so onPointerUp can
    // commit it once without needing to recompute or re-raycast
    let lastDragPosition: [number, number, number] | null = null

    let renderedSignature = ''

    const resize = () => {
      const width = mount.clientWidth
      const height = mount.clientHeight
      camera.aspect = width / Math.max(height, 1)
      camera.updateProjectionMatrix()
      renderer.setSize(width, height, false)
    }
    const syncObjects = () => {
      const signature = JSON.stringify([dataRef.current.objects, dataRef.current.selectedId])
      if (signature === renderedSignature) return
      objectsGroup.traverse((child) => {
        if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) {
          child.geometry.dispose()
          if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose())
          else child.material.dispose()
        }
      })
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
      renderedSignature = signature
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
      const hit = pick(event)
      if (!hit) { dataRef.current.onSelect(null); return }
      dataRef.current.onSelect(hit.name)
      const item = dataRef.current.objects.find((object) => object.id === hit.name)

      if (item) {
        // Find where the initial click landed on the floor plane, so we can
        // preserve the offset between "where you grabbed the object" and its
        // actual position, instead of snapping the object onto the cursor.
        dragPlane.constant = -item.transform.position[1]
        raycaster.ray.intersectPlane(dragPlane, dragIntersection)
        dragging = {
          id: item.id,
          offsetX: item.transform.position[0] - dragIntersection.x,
          offsetZ: item.transform.position[2] - dragIntersection.z,
        }
      }

      renderer.domElement.setPointerCapture(event.pointerId)
    }

    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return

      // rebuild the ray from the camera through the current cursor position,
      // uses same approach pick() uses for click selection
      getPointer(event)
      raycaster.setFromCamera(pointer, camera)

      // find exactly where that ray crosses the floor plane, and this can return
      // null in the rare case that ray is parallel to the plane, so we add a guard
      const hit = raycaster.ray.intersectPlane(dragPlane, dragIntersection)
      if (!hit) return

      // Y is not given by horizontal plane, so keep the current height of object
      const currentY = dataRef.current.objects.find((object) => object.id === dragging!.id)?.transform.position[1] ?? 0

      const next: [number, number, number] = [dragIntersection.x + dragging.offsetX, currentY, dragIntersection.z + dragging.offsetZ]

      // instead of calling onMove (which would push a history entry every frame),
      // look up the actual mesh in the scene by name and move it directly.
      // syncObjects won't fight us here because dataRef.current.objects hasn't
      // changed, so its JSON signature check skips the rebuild
      const mesh = objectsGroup.getObjectByName(dragging.id)
      if (mesh) {
        mesh.position.set(next[0], next[1], next[2])
      }
      // remember this so onPointerUp can commit it without recomputing anything
      lastDragPosition = next
    }
        
    const onPointerUp = () => {
      // only commit if we were actually dragging something and moved it at least once
      if (dragging && lastDragPosition) {
        dataRef.current.onMove(dragging.id, lastDragPosition)
      }
      dragging = null
      lastDragPosition = null
    }
    
    const observer = new ResizeObserver(resize)
    observer.observe(mount)
    if (interactive) {
      renderer.domElement.addEventListener('pointerdown', onPointerDown)
      renderer.domElement.addEventListener('pointermove', onPointerMove)
      renderer.domElement.addEventListener('pointerup', onPointerUp)
    }
    let frame = 0
    const animate = () => { frame = requestAnimationFrame(animate); syncObjects(); renderer.render(scene, camera) }
    resize(); animate()
    return () => { cancelAnimationFrame(frame); observer.disconnect(); renderer.domElement.removeEventListener('pointerdown', onPointerDown); renderer.domElement.removeEventListener('pointermove', onPointerMove); renderer.domElement.removeEventListener('pointerup', onPointerUp); objectsGroup.traverse((child) => { if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) { child.geometry.dispose(); if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose()); else child.material.dispose() } }); renderer.dispose(); mount.removeChild(renderer.domElement) }
  }, [interactive])

  return <div className="viewport" ref={mountRef}>{interactive && <div className="viewport-hint">Drag a selected object across the floor plane</div>}</div>
}
