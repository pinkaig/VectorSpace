/**
 * @file       optimiseModel.ts
 * @project    Spatial Experience Builder
 * @author     Goh Pin Kai
 * @brief      Optimises imported glTF/GLB models that exceed the model budget.
 *             Cleans and simplifies geometry, resizes oversized textures, and
 *             exports a GLB compatible with the viewport loader.
 *
 * @copyright  Copyright (C) 2026 DigiPen Institute of Technology.
 *             Reproduction or disclosure of this file or its contents without the
 *             prior written consent of DigiPen Institute of Technology is prohibited.
 */
/********************************************************************************************/
import { WebIO, type Document, type Texture } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dedup, getGLPrimitiveCount, prune, simplify, weld } from '@gltf-transform/functions'
import { MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer'
import { MAX_TEXTURE_SIZE, TARGET_TRIANGLES, checkBudget, fitWithinLimit, type ModelStats } from './modelBudget'

/** Re-encodes `image` (in `mimeType`) at exactly width × height, in the same format. */
export type ResizeImage = (image: Uint8Array, mimeType: string, width: number, height: number) => Promise<Uint8Array>

export interface OptimiseInput {
  entryName: string
  /** Every file of the model by name: the .glb, or a .gltf plus its .bin/texture files. */
  files: ReadonlyMap<string, Uint8Array>
  resizeImage: ResizeImage
}

export type OptimiseResult =
  | { status: 'within-budget'; before: ModelStats }
  | { status: 'optimised'; before: ModelStats; after: ModelStats; glb: Uint8Array }
  | { status: 'failed'; reason: string }

// glTF primitive modes that draw triangles: TRIANGLES, TRIANGLE_STRIP, TRIANGLE_FAN.
const TRIANGLE_MODES = new Set([4, 5, 6])
// Formats the canvas/Sharp resizers can round-trip. KTX2/Basis textures are left alone.
const RESIZABLE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])
// Simplification may stop short of TARGET_TRIANGLES rather than deviate from the
// original surface by more than this fraction of the mesh's radius. Keeps silhouettes.
const SIMPLIFY_MAX_ERROR = 0.01

const createIO = async (): Promise<WebIO> => {
  await MeshoptDecoder.ready
  return new WebIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.decoder': MeshoptDecoder })
}

// Counted per placed node, so a mesh instanced three times counts three times —
// that is what the GPU draws.
const countTriangles = (document: Document): number =>
  document.getRoot().listNodes().reduce((total, node) => {
    const mesh = node.getMesh()
    if (!mesh) return total
    return total + mesh.listPrimitives()
      .filter((primitive) => TRIANGLE_MODES.has(primitive.getMode()))
      .reduce((sum, primitive) => sum + getGLPrimitiveCount(primitive), 0)
  }, 0)

const measure = (document: Document, fileBytes: number): ModelStats => {
  const textures = document.getRoot().listTextures()
  const maxTextureSize = textures.reduce((max, texture) => {
    const size = texture.getSize()
    return size ? Math.max(max, size[0], size[1]) : max
  }, 0)
  return { triangles: countTriangles(document), maxTextureSize, textureCount: textures.length, fileBytes }
}

const readDocument = async (io: WebIO, { entryName, files }: OptimiseInput): Promise<Document> => {
  const entry = files.get(entryName)
  if (!entry) throw new Error(`Missing ${entryName}`)
  if (entryName.toLowerCase().endsWith('.glb')) return io.readBinary(entry)
  // A .gltf's external buffers/images are resolved by their URI, as written in the JSON.
  const json = JSON.parse(new TextDecoder().decode(entry))
  const resources: Record<string, Uint8Array> = {}
  const uris = [...(json.buffers ?? []), ...(json.images ?? [])]
    .map((item: { uri?: string }) => item.uri)
    .filter((uri: string | undefined): uri is string => !!uri && !uri.startsWith('data:'))
  for (const uri of uris) {
    const file = files.get(decodeURIComponent(uri.split('/').pop() ?? uri))
    if (file) resources[uri] = file
  }
  return io.readJSON({ json, resources })
}

const resizeTexture = async (texture: Texture, resizeImage: ResizeImage): Promise<void> => {
  const size = texture.getSize()
  const image = texture.getImage()
  const mimeType = texture.getMimeType()
  if (!size || !image || !RESIZABLE_TYPES.has(mimeType)) return
  const [width, height] = fitWithinLimit(size[0], size[1], MAX_TEXTURE_SIZE)
  if (width === size[0] && height === size[1]) return
  texture.setImage(await resizeImage(image, mimeType, width, height))
}

const totalBytes = (files: ReadonlyMap<string, Uint8Array>): number =>
  [...files.values()].reduce((sum, file) => sum + file.byteLength, 0)

export const optimiseModel = async (input: OptimiseInput): Promise<OptimiseResult> => {
  let io: WebIO
  let document: Document
  try {
    io = await createIO()
    document = await readDocument(io, input)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { status: 'failed', reason: /draco/i.test(message) ? 'it uses Draco compression, which the optimiser cannot read' : `it could not be read (${message})` }
  }

  const before = measure(document, totalBytes(input.files))
  const { overTriangles, overTextures } = checkBudget(before)
  if (!overTriangles && !overTextures) return { status: 'within-budget', before }

  try {
    // Merge identical data and drop anything unused first: cheap, lossless, and it
    // gives the simplifier a connected mesh to work with.
    await document.transform(dedup(), prune())
    if (overTriangles) {
      await MeshoptSimplifier.ready
      await document.transform(
        weld(),
        simplify({ simplifier: MeshoptSimplifier, ratio: TARGET_TRIANGLES / before.triangles, error: SIMPLIFY_MAX_ERROR }),
      )
    }
    if (overTextures) {
      for (const texture of document.getRoot().listTextures()) await resizeTexture(texture, input.resizeImage)
    }
    await document.transform(prune())

    // Decoded on read; writing the data back uncompressed keeps it loadable by GLTFLoader.
    document.getRoot().listExtensionsUsed()
      .filter((extension) => extension.extensionName === 'EXT_meshopt_compression')
      .forEach((extension) => extension.dispose())

    const glb = await io.writeBinary(document)
    return { status: 'optimised', before, after: measure(document, glb.byteLength), glb }
  } catch (error) {
    return { status: 'failed', reason: `optimising failed (${error instanceof Error ? error.message : String(error)})` }
  }
}
