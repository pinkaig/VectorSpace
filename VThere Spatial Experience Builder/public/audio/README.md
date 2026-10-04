# Bundled audio clips

Drop `.mp3`/`.ogg`/`.wav` files here, then add a matching entry to
`src/audioAssets.ts`'s `audioAssetCatalog` (assetId, label, and
`url: '/audio/<file>'`). The catalog registers each entry into
`audioResolution.ts`'s resolver map on app load — no import UI or device
persistence involved; the browser just fetches the URL at play time.
