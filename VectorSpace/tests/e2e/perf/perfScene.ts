/** Deterministic N-object primitive scene, seeded through the editor's localStorage draft. */
const KINDS = ['cube', 'sphere', 'cylinder'] as const
const COLORS = [0x4ea7a0, 0xd9822b, 0x7b6cd9, 0xc2455a, 0x5aa469]
const SPACING = 1.4

export const buildPerfProject = (objectCount: number) => {
  const columns = Math.ceil(Math.sqrt(objectCount * 1.6))
  const rows = Math.ceil(objectCount / columns)
  const objects = Array.from({ length: objectCount }, (_, i) => {
    const kind = KINDS[i % KINDS.length]
    const col = i % columns
    const row = Math.floor(i / columns)
    return {
      id: `perf-${i}`,
      name: `Perf ${i}`,
      assetId: `primitive-${kind}`,
      assetKind: kind,
      visible: true,
      enabled: true,
      color: COLORS[i % COLORS.length],
      transform: {
        position: [(col - (columns - 1) / 2) * SPACING, 0.5, (row - (rows - 1) / 2) * SPACING] as [number, number, number],
        rotation: [0, (i * 0.37) % Math.PI, 0] as [number, number, number],
        scale: [1, 1, 1] as [number, number, number],
      },
    }
  })
  return {
    schemaVersion: 1,
    id: `project-perf-${objectCount}`,
    name: `Perf ${objectCount}`,
    activeSceneId: 'scene-perf',
    scenes: [
      {
        id: 'scene-perf',
        name: 'Perf Scene',
        environmentId: 'env-empty',
        startCamera: { position: [0, 14, 26], target: [0, 0, 0] },
        objects,
        zones: [],
      },
    ],
    rules: [],
  }
}
