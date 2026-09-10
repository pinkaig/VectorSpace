# Asset Library Contract

**Status:** Outstanding approval artifact

## MVP rules

- Use supplied or openly licensed assets only.
- Use GLB/glTF throughout the MVP; OBJ, FBX, and conversion pipelines are out of scope.
- Supply two to four approved 3D environments.
- Supply approximately 20–30 curated placeable assets with thumbnails, categories, stable IDs, and known scale/orientation/pivot conventions.
- Store large binaries in object storage; the project file stores stable asset IDs and metadata references.
- Asset loading must expose loading, progress, error, retry, and missing-asset states.

## Required inventory fields

```text
assetId
name
category
kind: environment | exhibit | media
sourceUrl
license
attribution
fileFormat: glb
fileSizeBytes
unitScale
upAxis
forwardAxis
pivot
thumbnailUrl
collisionOrInteractionProxy
approvedBy
```

## Acceptance checks

- Every asset has a licensing/attribution record before it enters the approved registry.
- Every asset loads in the target browser matrix and uses the documented scale and pivot.
- An environment can load with visible progress and a recoverable error state.
- Asset budgets are tested on the three-year-old school laptop scenario.
