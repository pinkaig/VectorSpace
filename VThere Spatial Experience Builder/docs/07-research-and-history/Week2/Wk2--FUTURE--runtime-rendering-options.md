# Future Runtime Rendering Options

**Date metadata:** Wk2  
**Category:** Future  
**Status:** Decision note

## Current model

The editor and visitor runtime use React and Three.js together, but they have different responsibilities:

- React renders the surrounding application UI, controls, labels, and runtime overlays.
- Three.js renders the 3D scene into an HTML canvas through WebGL.
- The runtime reads the shared project document and reconstructs the published scene without exposing authoring controls.

The current prototype reuses the `Viewport` component in runtime mode with interaction disabled. This provides editor/runtime visual parity while the runtime architecture is still being developed.

## Alternative renderer feasibility

A different 3D rendering library could be used for the runtime while the editor continues using Three.js. Possible candidates include Babylon.js and PlayCanvas. PixiJS would be more appropriate for a 2D runtime and would not provide the same full 3D capabilities.

The change is feasible because the project model stores scene data independently from the renderer. However, the current viewport directly creates Three.js geometries, materials, cameras, raycasting, and render loops. Replacing the runtime renderer would therefore require a dedicated renderer boundary rather than changing one import.

A future boundary could expose operations such as:

```ts
interface RuntimeRenderer {
  mount(element: HTMLElement): void
  loadScene(scene: SceneData): void
  dispose(): void
}
```

The runtime application would consume the shared project and interaction systems, while a renderer adapter would translate scene objects into the chosen engine's objects.

## Recommendation

Keep Three.js for both editor and runtime during the MVP. This minimizes implementation cost, keeps preview and published output consistent, and avoids maintaining two rendering pipelines.

Reconsider a separate runtime renderer only if measurable requirements justify it, such as very large scenes, specialised streaming, advanced physics, or a deployment workflow that is better supported by another engine. If that decision is made later, introduce the renderer interface before adding runtime-specific features so the project model and interaction logic remain independent of the rendering library.
