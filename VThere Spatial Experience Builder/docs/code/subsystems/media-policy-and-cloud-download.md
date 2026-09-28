# Media Policy and Cloud Download Control

**Baseline phase:** built alongside the attachment slice; the cloud half is reserved for Stage 3
(backend media). See [8-stage baseline overview](../baseline-phases.md).

**See also:** [`asset-manager.md`](asset-manager.md) for the resolver chain this policy layer sits
inside, [`attachment-integration.md`](attachment-integration.md) sections 5–6 for the attachment
model, and [`audio-system.md`](audio-system.md) for the one kind that deliberately resolves
outside this chain today.

## Purpose

Answer three questions in **one** place, for every media kind, regardless of which resolver
produced the bytes:

1. **What may this kind carry?** An exact content-type allowlist.
2. **How big may one file be?** A per-kind byte cap, checked before the bytes are cached.
3. **Who owns the decoded memory, and how much?** A per-kind decoded budget naming the type
   package responsible.

The reason this is one table rather than a check in each resolver: an asset can arrive from a
primitive, a dev-time local catalog, an inline project field, or (once Stage 3 lands) a signed
URL from object storage. A guard placed per-origin has to be written four times and will
diverge. A guard placed once, *after* resolution and *before* caching, cannot be bypassed by
adding a fifth origin.

## Boundary

```text
AssetRef { assetId, kind }              kind: cube|sphere|cylinder|model   (not media)
          |                                  | audio|image|text|video     (media)
          v
  CachingAssetResolver            <- caches only what the guard already approved
          |
          v
  ContentGuardResolver            <- THIS LAYER: allowlist + size cap
          |                            reads MEDIA_KIND_SPECS
          v
  KindRouterResolver
    primitives | inlineText | catalog | (RemoteMediaResolver, Stage 3)
```

The guard sits **inside** the cache, not outside it. That ordering is deliberate: a rejected
asset must not occupy a cache entry, and an approved one should be cached without re-checking.
Non-media kinds pass through untouched — a primitive or GLB model has no content-type contract
this table owns.

## Where to find things

| Concern | Owner |
|---|---|
| The per-kind table: allowlist, byte cap, decoded budget, owning package | [`packages/assets/src/mediaKinds.ts`](../../packages/assets/src/mediaKinds.ts) |
| Enforcement after resolution, before caching | [`packages/assets/src/ContentGuardResolver.ts`](../../packages/assets/src/ContentGuardResolver.ts) |
| Which leg of the chain a kind routes to | [`packages/assets/src/resolvers/KindRouterResolver.ts`](../../packages/assets/src/resolvers/KindRouterResolver.ts) |
| The `MediaKind` union itself | [`packages/project/src/index.ts`](../../packages/project/src/index.ts) |
| Reserved cloud origin (skeleton) | [`packages/assets/src/resolvers/RemoteMediaResolver.ts`](../../packages/assets/src/resolvers/RemoteMediaResolver.ts) |
| Chain composition in the app | [`src/viewport/assetResolution.ts`](../../src/viewport/assetResolution.ts) |
| Serializer's own text cap (must match the table) | [`src/serializer.ts`](../../src/serializer.ts) |

## The table

```ts
export interface MediaKindSpec {
  kind: MediaKind
  contentTypes: readonly string[]   // exact match; an extension is never trusted
  maxBytes: number                  // upload and resolve limit for one file
  owner: 'audio' | 'image' | 'text' | 'video'
  decodedBudgetBytes: number        // 0 = not byte-budgeted (streamed or inline)
}
```

| Kind | Content types | `maxBytes` | Decoded budget | Note |
|---|---|---|---|---|
| `audio` | `audio/mpeg`, `audio/ogg`, `audio/wav`, `audio/mp4`, `audio/webm` | 20 MB | 64 MB | decoded PCM is far larger than the file |
| `image` | `image/png`, `image/jpeg`, `image/webp` | 10 MB | 128 MB | `image/svg+xml` **deliberately excluded** |
| `video` | `video/mp4`, `video/webm` | 200 MB | 0 | streamed; limited by playing slots, not bytes |
| `text` | `text/plain`, `text/markdown` | 64 KB | 0 | matches the serializer's per-asset cap |

### Why these specific values

**`image/svg+xml` is excluded on purpose.** SVG is an XML document that can carry `<script>`
and external references. Accepting it as an "image" would mean accepting script execution
through an asset pipeline whose whole contract is "inert bytes". If SVG is ever needed it wants
its own kind with its own sanitiser, not a line added to this allowlist. **Do not add it to
make a test pass.**

**Video has `decodedBudgetBytes: 0` while audio has 64 MB.** This is not an omission. Audio is
decoded to PCM in memory and a byte budget is the correct unit. Video is handed to the browser's
media stack and streamed — its cost is concurrent playing elements, not a heap total, so a byte
budget would be a number that cannot be enforced. Zero here means "not byte-budgeted", not
"unlimited".

**Text's 64 KB cap mirrors `MAX_TEXT_ASSET_BYTES` in `src/serializer.ts`.** These two numbers
must move together. They are duplicated because the serializer validates project data before
any resolver exists, and the guard validates resolved bytes after. If you change one, change
both — a mismatch means either a text asset that saves but will not resolve, or one that
resolves but cannot be saved.

**The client list and the future backend list must be identical.** The guard is a fast-fail
convenience, not the security boundary. A client-side allowlist protects the client's own
memory; it does not stop anyone posting whatever they like to the API. When Stage 3's media
endpoints get real bodies, they need the same table server-side. Treating the client check as
sufficient is the mistake this note exists to prevent.

## Controlling cloud download of large attachment assets

Today every resolved asset is a local URL or an inline string, so "download" costs nothing.
Once assets come from object storage (Stage 3) or a document drive, the same chain is
responsible for *not* pulling hundreds of megabytes the user never looks at. The mechanisms
already in place, and what each one does and does not do:

### 1. Size is rejected before bytes are fetched — when the origin reports it

`ContentGuardResolver` checks `descriptor.sizeBytes` against the cap. The important subtlety:

```ts
// an unknown size passes: the guard blocks what it can prove, and the
// type package still applies its own budget when the bytes arrive
if (descriptor.sizeBytes !== undefined && descriptor.sizeBytes > spec.maxBytes) { ...error... }
```

An **unknown size passes the guard**. This is the correct default for a resolver that returns a
URL rather than bytes — it cannot invent a size it was not told. It also means the cap is only
as good as the origin's metadata. For a cloud origin this is a requirement, not a nicety:
`RemoteMediaResolver` must populate `sizeBytes` from the backend's object metadata (a HEAD, or
the size stored alongside the object), or the cap silently stops applying to exactly the assets
it was written for.

A descriptor that carries `url` but no `blob` has not transferred anything yet. The guard
rejecting it costs one metadata round-trip, not a download — which is the whole point of
checking before the type package opens it.

### 2. A URL descriptor defers the transfer to the consumer

`AssetDescriptor` can carry `url`, `blob`, or both. Returning a `url` alone means "here is where
it lives", and the actual bytes move when an `<audio>`, `<video>`, `<img>` or fetch touches it.
For large media this is the desired shape: the browser streams with range requests, honours its
own cache, and never materialises the whole file in the heap.

Returning a `blob` means the bytes are already in memory. That is appropriate only for small,
frequently reused assets. The audio system makes this choice explicit with a per-asset
`cacheStrategy: 'url' | 'cached'` — streaming by default, byte-caching only for short SFX that
would otherwise re-fetch on every trigger. **A cloud text/document origin should default to
`url` + a size cap, not to eager blobs.**

### 3. Concurrent resolves of the same asset collapse to one request

`CachingAssetResolver` keys in-flight promises on `` `${ref.kind}:${ref.assetId}` ``:

```ts
private readonly inFlight = new Map<string, Promise<AssetDescriptor>>()
```

Ten panels opening the same document, or ten objects sharing one model, issue **one** delegate
call. Without this, a cloud origin turns a single user action into a burst of identical signed-URL
requests. This is the difference between a cache that helps after the first load and one that
helps during it.

### 4. Only successful resolutions are cached, and signed URLs expire

`AssetCache` caches `ready` descriptors only — `loading` and `error` are never stored, so a
failure retries rather than sticking. A descriptor with `expiresAt` is evicted when that time
passes, which is what makes signed URLs safe to cache at all. `RemoteMediaResolver` must set
`expiresAt` from the presigned URL's real TTL; if it does not, the cache will happily serve a
dead URL until reload.

### 5. Retry is manual, and that is a download-control decision

`PlaceholderAssetResolver` has no automatic retry, no backoff, no retry limit. A failed large
download stays failed until a user presses retry. For metered or slow connections this is the
conservative default — an automatic retry loop on a 200 MB video is a way to exhaust someone's
data plan. If automatic retry is ever added it belongs at the UI layer with a backoff and a
cap, not inside the resolver.

### What is not yet built

- **`RemoteMediaResolver` has no body.** It reserves `GET /projects/{projectId}/media/{assetId}`
  → signed URL and currently always returns an error descriptor. Everything above describes the
  contract it must satisfy, not behaviour that runs today.
- **No persistent cache for the generic chain.** `AssetCache` is process memory; a reload starts
  cold. The audio system has its own IndexedDB byte cache
  (`src/viewport/audioResolution.ts`), which is the working reference for what a persistent tier
  looks like, but it is not shared with the chain.
- **No progress reporting.** `AssetStatus` is `idle | loading | ready | error`. There is no
  bytes-received signal, so a 200 MB video and a 2 KB note are both just "loading". A progress
  channel needs a descriptor or store change, not just a UI change.
- **No prefetch or priority policy.** Nothing decides that the asset attached to the object the
  user is looking at should load before one across the scene. Resolution is demand-driven from
  whatever calls `resolveAsset`.
- **No server-side enforcement.** See the warning above: the table must be mirrored in the API.

## Owns

- The per-kind content-type allowlist and byte caps, as data
- Rejecting a disallowed type or over-cap size uniformly, after resolution, before caching
- Naming which type package owns each kind's decoded memory and its starting budget
- The contract a cloud origin must satisfy for size caps and URL expiry to keep working

## Does not own

- **Fetching, streaming or decoding.** The guard inspects a descriptor; it never opens a socket.
- **Per-package decoded caches.** `decodedBudgetBytes` is a starting number this table publishes;
  enforcing it is the owning package's job (see `packages/audio`'s byte cache).
- **Server-side validation.** Stage 3's endpoints must apply the same list independently.
- **Whether an asset *should* load at all** — prefetch, priority and eviction policy are
  unbuilt and would sit above the chain, not in the guard.
- **Audio's resolution path.** `packages/audio` deliberately resolves through its own
  `AudioResolver` seam and does not pass through this guard today; see
  [`audio-system.md`](audio-system.md). Its two-tier `url`/`cached` strategy is the reference
  design for large-media handling, and converging it with the chain needs a tier concept
  `AssetDescriptor` does not have yet.

## Considerations and limits

**Unknown size defeats the cap.** Restated because it is the single most likely way this layer
quietly stops working: if a cloud origin omits `sizeBytes`, oversized assets pass. Populating
it is part of implementing the origin, not an optimisation.

**Two numbers for text, in two files.** `mediaKinds.ts`'s text `maxBytes` and
`src/serializer.ts`'s `MAX_TEXT_ASSET_BYTES` must stay equal. Worth collapsing into one exported
constant when text gains a non-inline origin.

**The caps are tuning numbers, not decisions.** 20 MB of audio and 200 MB of video are starting
points chosen to be generous enough not to block authoring and small enough to catch obvious
mistakes. They are expected to change with real content. The *allowlist* is not in that
category — removing an entry is tuning, adding one is a security decision.

**`image` and `video` have a table entry but no runtime.** There is no image or video resolver,
attachment shape, or renderer. Their rows are the policy half of a kind whose other half is
unbuilt; they cost nothing and are the guardrail those systems will need on day one, but no code
currently exercises them.

**The guard cannot see inside the bytes.** It trusts the declared content type. A file declared
`image/png` that is not one will pass the guard and fail in the decoder. That is the intended
division — sniffing content is a decoder's job, and the guard exists to make the *declared*
contract enforceable in one place.
