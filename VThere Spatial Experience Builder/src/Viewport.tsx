/**
 * @file        Viewport.tsx
 * @author      Sherman Goh Wee Hao
 * @date        2026-09-13
 * @reviewed    2026-09-13
 * @brief       React-to-Three.js 3D viewport bridge.
 *
 * @responsibility
 * Creates the Three.js scene, reconstructs project objects, handles editor
 * selection and floor movement, and owns renderer lifecycle cleanup.
 *
 * @inputs
 * ViewportProps: objects, selectedId, onSelect, onMove, and interactive mode.
 *
 * @outputs
 * A React mount element containing a WebGL canvas and optional editor hint.
 *
 * @members
 * mountRef, dataRef, scene, camera, renderer, raycaster, objectsGroup,
 * resize, syncObjects, pointer handlers, ResizeObserver, animation frame.
 *
 * @documentation
 * Larger system guide: docs/05-subsystems/viewport.md
 */
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
    const objectsGroup = new THREE.Group()
    scene.add(objectsGroup)
    scene.add(new THREE.HemisphereLight(0xdbe9e7, 0x17222d, 2.2))
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.5)
    keyLight.position.set(4, 8, 5)
    scene.add(keyLight)
    const grid = new THREE.GridHelper(12, 12, 0x35515a, 0x1a2b34)
    scene.add(grid)
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.MeshBasicMaterial({ color: 0x101a21, transparent: true, opacity: 0.6 }))
    floor.rotation.x = -Math.PI / 2
    scene.add(floor)
    let dragging: { id: string; startX: number; startZ: number; startPointerX: number; startPointerY: number } | null = null
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
      if (item) dragging = { id: item.id, startX: item.transform.position[0], startZ: item.transform.position[2], startPointerX: event.clientX, startPointerY: event.clientY }
      renderer.domElement.setPointerCapture(event.pointerId)
    }
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return
      const scale = 0.012
      const next: [number, number, number] = [dragging.startX + (event.clientX - dragging.startPointerX) * scale, dataRef.current.objects.find((item) => item.id === dragging?.id)?.transform.position[1] ?? 0, dragging.startZ + (event.clientY - dragging.startPointerY) * scale]
      dataRef.current.onMove(dragging.id, next)
    }
    const onPointerUp = () => { dragging = null }
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
