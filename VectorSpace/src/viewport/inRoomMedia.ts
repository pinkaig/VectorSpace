/**
 * @file        inRoomMedia.ts
 * @author      Weian Ching
 * @brief       Info inside the 3D room: an info card shown as a sign above its
 *              thing, and a video playing on a screen above its thing.
 *
 * @responsibility
 * The built-in, in-room way to show a fact card or a video (as well as the
 * pop-up a click opens). For each thing whose card has `inRoom`, a sign with
 * the title, a picture and the text floats above it; for each thing whose
 * video has `screen`, a screen does. Both always turn to face the viewer.
 * - An uploaded video plays on the screen (three.js VideoTexture), muted and
 *   looping while in Play; clicking the thing turns its sound on and off. In
 *   the editor the screen shows a still frame.
 * - A YouTube video cannot be drawn onto a 3D surface (the browser will not
 *   hand its pixels to WebGL), so its screen is a "click to watch" poster and a
 *   click opens the usual pop-up player.
 * Signs and screens are never picked by clicks; the thing under them is.
 *
 * @documentation
 * src/runtime/builtInInteractions.ts (the pop-up side of the same behaviour).
 */
import * as THREE from 'three'
import type { AssetDescriptor, AssetRef } from '../../packages/assets/src/index'
import type { SceneObject, TextAssetMeta, TextAttachment, VideoAttachment } from '../project/model'

const SIGN_WIDTH = 1.4                    // world units
const SCREEN_WIDTH = 1.6
const GAP_ABOVE = 0.25                    // between the thing's top and the sign's bottom
const CANVAS_WIDTH = 1024
const FONT = "'Nunito', system-ui, sans-serif"
const TITLE_FONT = "'Fredoka', 'Nunito', system-ui, sans-serif"

type Resolve = (ref: AssetRef) => Promise<AssetDescriptor>

interface Item {
  signature: string
  mesh: THREE.Mesh
  video?: HTMLVideoElement
  dispose: () => void
}

/** The plain text of a markdown-lite card: no ** or *, links reduced to their words. */
export const plainCardText = (source: string): string =>
  source
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,3}\s+/gm, '')
    .replace(/^\s*[-*]\s+/gm, '• ')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')

/** Breaks text into lines that fit `width` pixels; keeps the author's own line breaks. */
export const wrapLines = (measure: (text: string) => number, text: string, width: number, maxLines: number): string[] => {
  const lines: string[] = []
  for (const paragraph of text.split(/\n+/)) {
    let line = ''
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word
      if (measure(next) <= width || !line) line = next
      else {
        lines.push(line)
        line = word
      }
    }
    if (line) lines.push(line)
  }
  if (lines.length <= maxLines) return lines
  const kept = lines.slice(0, maxLines)
  kept[maxLines - 1] = `${kept[maxLines - 1].replace(/\s+\S*$/, '')}…`
  return kept
}

const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

const loadImage = (url: string) =>
  new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image()
    // without this a picture from another site would taint the canvas and WebGL would refuse it
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = url
  })

/** Draws a sign: white card, title, optional picture, then the text. */
const drawSign = (title: string, text: string, picture: HTMLImageElement | null): HTMLCanvasElement => {
  const pad = 56
  const inner = CANVAS_WIDTH - pad * 2
  const measureCanvas = document.createElement('canvas').getContext('2d')!
  measureCanvas.font = `600 40px ${FONT}`
  const lines = wrapLines((line) => measureCanvas.measureText(line).width, text, inner, 12)
  const pictureHeight = picture ? Math.min(420, (inner * picture.height) / picture.width) : 0
  const height = pad + 72 + (picture ? pictureHeight + 28 : 0) + lines.length * 54 + pad

  const canvas = document.createElement('canvas')
  canvas.width = CANVAS_WIDTH
  canvas.height = Math.max(240, height)
  const ctx = canvas.getContext('2d')!
  roundRect(ctx, 6, 6, canvas.width - 12, canvas.height - 12, 40)
  ctx.fillStyle = '#FFFFFF'
  ctx.fill()
  ctx.lineWidth = 8
  ctx.strokeStyle = '#5B4BD6'
  ctx.stroke()

  let y = pad
  ctx.fillStyle = '#1F1B3A'
  ctx.textBaseline = 'top'
  ctx.font = `600 60px ${TITLE_FONT}`
  ctx.fillText(title || 'Fact card', pad, y, inner)
  y += 72
  if (picture) {
    const width = Math.min(inner, (pictureHeight * picture.width) / picture.height)
    ctx.drawImage(picture, pad, y, width, pictureHeight)
    y += pictureHeight + 28
  }
  ctx.fillStyle = '#3B3363'
  ctx.font = `600 40px ${FONT}`
  for (const line of lines) {
    ctx.fillText(line, pad, y, inner)
    y += 54
  }
  return canvas
}

/** The poster a YouTube screen shows: a play button and "click to watch". */
const drawPoster = (): HTMLCanvasElement => {
  const canvas = document.createElement('canvas')
  canvas.width = CANVAS_WIDTH
  canvas.height = CANVAS_WIDTH * 9 / 16
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#1F1B3A'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  const cx = canvas.width / 2
  const cy = canvas.height / 2 - 30
  ctx.fillStyle = '#E62117'
  roundRect(ctx, cx - 90, cy - 62, 180, 124, 34)
  ctx.fill()
  ctx.fillStyle = '#FFFFFF'
  ctx.beginPath()
  ctx.moveTo(cx - 26, cy - 36)
  ctx.lineTo(cx + 40, cy)
  ctx.lineTo(cx - 26, cy + 36)
  ctx.closePath()
  ctx.fill()
  ctx.font = `700 44px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText('YouTube video · click to watch', cx, cy + 96)
  return canvas
}

const makePlane = (width: number, height: number, texture: THREE.Texture | null): THREE.Mesh => {
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide, toneMapped: false, color: texture ? 0xffffff : 0x1f1b3a })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material)
  // signs and screens are labels: the thing below them takes the clicks
  mesh.raycast = () => {}
  mesh.renderOrder = 5
  return mesh
}

const findCardOn = (object: SceneObject) =>
  object.attachments?.find((item): item is TextAttachment => item.kind === 'text' && item.presentation.mode === 'card' && item.presentation.inRoom === true)
const findScreenOn = (object: SceneObject) =>
  object.attachments?.find((item): item is VideoAttachment => item.kind === 'video' && item.screen === true)

export interface InRoomMedia {
  /** Rebuilds signs and screens for these things; cheap when nothing they show changed. */
  sync(objects: readonly SceneObject[]): void
  /** Places each above its thing, facing the camera. Returns true while a video needs frames. */
  update(camera: THREE.Camera, playing: boolean): boolean
  /** A click on a thing in Play: toggles its screen's sound. True when it had a playing screen. */
  click(objectId: string): boolean
  dispose(): void
}

export const createInRoomMedia = (opts: {
  scene: THREE.Scene
  objectsGroup: THREE.Group
  resolveMedia: Resolve
  getText: (assetId: string) => TextAssetMeta | undefined
  requestRender: () => void
}): InRoomMedia => {
  const group = new THREE.Group()
  group.name = 'in-room-media'
  opts.scene.add(group)
  const items = new Map<string, Item>()
  const box = new THREE.Box3()
  const target = new THREE.Vector3()

  const buildSign = (object: SceneObject, card: TextAttachment, signature: string): Item => {
    const mesh = makePlane(SIGN_WIDTH, SIGN_WIDTH * 0.4, null)
    mesh.visible = false
    let texture: THREE.CanvasTexture | null = null
    let alive = true
    const paint = async () => {
      const meta = opts.getText(card.assetId)
      const media = card.presentation.media
      let picture: HTMLImageElement | null = null
      if (media?.kind === 'image') {
        const descriptor = await opts.resolveMedia({ kind: 'image', assetId: media.assetId })
        if (descriptor.status === 'ready' && descriptor.url) picture = await loadImage(descriptor.url)
      }
      if (!alive) return
      const canvas = drawSign(card.presentation.title ?? object.name, plainCardText(meta?.content ?? ''), picture)
      texture = new THREE.CanvasTexture(canvas)
      texture.colorSpace = THREE.SRGBColorSpace
      const material = mesh.material as THREE.MeshBasicMaterial
      material.map = texture
      material.color.set(0xffffff)
      material.needsUpdate = true
      mesh.geometry.dispose()
      mesh.geometry = new THREE.PlaneGeometry(SIGN_WIDTH, (SIGN_WIDTH * canvas.height) / canvas.width)
      mesh.visible = true
      opts.requestRender()
    }
    void paint()
    return {
      signature,
      mesh,
      dispose: () => {
        alive = false
        texture?.dispose()
        mesh.geometry.dispose()
        ;(mesh.material as THREE.Material).dispose()
      },
    }
  }

  const buildScreen = (video: VideoAttachment, signature: string): Item => {
    const mesh = makePlane(SCREEN_WIDTH, SCREEN_WIDTH * 9 / 16, null)
    let alive = true
    let texture: THREE.Texture | null = null
    const item: Item = {
      signature,
      mesh,
      dispose: () => {
        alive = false
        if (item.video) {
          item.video.pause()
          item.video.removeAttribute('src')
          item.video.load()
        }
        texture?.dispose()
        mesh.geometry.dispose()
        ;(mesh.material as THREE.Material).dispose()
      },
    }
    const setTexture = (next: THREE.Texture, aspect: number) => {
      texture = next
      const material = mesh.material as THREE.MeshBasicMaterial
      material.map = next
      material.color.set(0xffffff)
      material.needsUpdate = true
      mesh.geometry.dispose()
      mesh.geometry = new THREE.PlaneGeometry(SCREEN_WIDTH, SCREEN_WIDTH / aspect)
      opts.requestRender()
    }
    void opts.resolveMedia({ kind: 'video', assetId: video.assetId }).then((descriptor) => {
      if (!alive) return
      if (descriptor.status === 'ready' && descriptor.embed) {
        const poster = new THREE.CanvasTexture(drawPoster())
        poster.colorSpace = THREE.SRGBColorSpace
        setTexture(poster, 16 / 9)
        return
      }
      if (descriptor.status !== 'ready' || !descriptor.url) return
      const element = document.createElement('video')
      element.crossOrigin = 'anonymous'
      element.muted = true
      element.loop = true
      element.playsInline = true
      element.preload = 'auto'
      element.src = descriptor.url
      element.addEventListener('loadeddata', () => {
        if (!alive) return
        const videoTexture = new THREE.VideoTexture(element)
        videoTexture.colorSpace = THREE.SRGBColorSpace
        setTexture(videoTexture, element.videoWidth && element.videoHeight ? element.videoWidth / element.videoHeight : 16 / 9)
      }, { once: true })
      item.video = element
    })
    return item
  }

  return {
    sync(objects) {
      const wanted = new Set<string>()
      for (const object of objects) {
        if (object.visible === false) continue
        const card = findCardOn(object)
        const screen = findScreenOn(object)
        if (card) {
          const key = `sign:${object.id}`
          const meta = opts.getText(card.assetId)
          const signature = JSON.stringify([card.presentation.title, card.presentation.media, meta?.content])
          wanted.add(key)
          const current = items.get(key)
          if (!current || current.signature !== signature) {
            current?.dispose()
            if (current) group.remove(current.mesh)
            const item = buildSign(object, card, signature)
            item.mesh.userData.objectId = object.id
            item.mesh.userData.stack = 0
            items.set(key, item)
            group.add(item.mesh)
          }
        }
        if (screen) {
          const key = `screen:${object.id}`
          const signature = screen.assetId
          wanted.add(key)
          const current = items.get(key)
          if (!current || current.signature !== signature) {
            current?.dispose()
            if (current) group.remove(current.mesh)
            const item = buildScreen(screen, signature)
            item.mesh.userData.objectId = object.id
            items.set(key, item)
            group.add(item.mesh)
          }
          // a thing with both: the screen sits above the sign
          items.get(key)!.mesh.userData.stack = card ? 1 : 0
        }
      }
      for (const [key, item] of items) {
        if (wanted.has(key)) continue
        item.dispose()
        group.remove(item.mesh)
        items.delete(key)
      }
      opts.requestRender()
    },

    update(camera, playing) {
      let needsFrames = false
      const signTops = new Map<string, number>()
      // signs first, so a screen on the same thing can stack above its sign
      const ordered = [...items.values()].sort((a, b) => (a.mesh.userData.stack as number) - (b.mesh.userData.stack as number))
      for (const item of ordered) {
        const objectId = item.mesh.userData.objectId as string
        const thing = opts.objectsGroup.getObjectByName(objectId)
        if (!thing) {
          item.mesh.visible = false
          continue
        }
        box.setFromObject(thing)
        if (box.isEmpty()) continue
        const height = (item.mesh.geometry as THREE.PlaneGeometry).parameters.height
        const base = signTops.get(objectId) ?? box.max.y + GAP_ABOVE
        item.mesh.position.set((box.min.x + box.max.x) / 2, base + height / 2, (box.min.z + box.max.z) / 2)
        signTops.set(objectId, base + height + 0.1)
        // turn to face the viewer, staying upright
        camera.getWorldPosition(target)
        target.y = item.mesh.position.y
        item.mesh.lookAt(target)
        if (item.video) {
          if (playing && item.video.paused) void item.video.play().catch(() => undefined)
          if (!playing && !item.video.paused) item.video.pause()
          if (!item.video.paused) needsFrames = true
        }
      }
      return needsFrames
    },

    click(objectId) {
      const item = items.get(`screen:${objectId}`)
      if (!item?.video) return false
      item.video.muted = !item.video.muted
      if (item.video.paused) void item.video.play().catch(() => undefined)
      return true
    },

    dispose() {
      for (const item of items.values()) item.dispose()
      items.clear()
      opts.scene.remove(group)
    },
  }
}
