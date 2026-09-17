# Stage 6 learning note: why "just call the resolver" wasn't enough to make failure observable

## The high-level problem

Stage 6 asks for one thing that sounds almost too simple to be worth writing
about: "a deliberately broken assetId shows the placeholder/retry state
instead of a silent failure." The natural way to build that is to wire
`SceneObject.assetId` into the Asset Manager's resolver chain and trust the
chain to fail when the id is bad — that's the entire point of `AssetResolver`
existing as a contract in [`packages/assets/src/AssetResolver.ts`](../../packages/assets/src/AssetResolver.ts).

But when I actually tried to *demonstrate* the failure case, I couldn't
produce one. Every assetId I typed into the (newly editable) Inspector field
still resolved as `ready`. The bug wasn't in the wiring — it was in an
assumption about the data itself that had been true since Stage 1 and nobody
had needed to notice yet.

## Tracing it through the codebase

Start at the type that names what an asset *is*:

```ts
// packages/project/src/index.ts
export type AssetKind = 'cube' | 'sphere' | 'cylinder'
```

Every `SceneObject` the editor can currently create has one of exactly these
three kinds — there is no other kind of object in this codebase yet. Now look
at the resolver that's supposed to be the first line of defense for these:

```ts
// packages/assets/src/resolvers/PrimitiveResolver.ts
const PRIMITIVE_KINDS: readonly AssetKind[] = ['cube', 'sphere', 'cylinder']

export class PrimitiveResolver implements AssetResolver {
  async resolve(ref: AssetRef): Promise<AssetDescriptor> {
    if (!PRIMITIVE_KINDS.includes(ref.kind)) {
      return errorAssetDescriptor(ref, `PrimitiveResolver cannot resolve asset kind "${ref.kind}"`)
    }
    return readyAssetDescriptor(ref, { contentType: `model/primitive+${ref.kind}` })
  }
}
```

`PrimitiveResolver.resolve` branches on `ref.kind`, **never on `ref.assetId`**.
That's correct in isolation — a primitive genuinely doesn't need an id to
render, it just needs to know it's a cube. But `AssetRef` bundles both fields
together:

```ts
// packages/assets/src/AssetRef.ts
export interface AssetRef {
  assetId: string
  kind: AssetKind
}
```

And `PRIMITIVE_KINDS` is exactly the same three values as `AssetKind` itself.
Since `AssetKind` has no fourth option yet, **every legal `AssetRef` in this
codebase has a `kind` that `PrimitiveResolver` accepts**, regardless of what
`assetId` says. Typing `assetId: "totally-broken-id"` on a cube still resolves
`ready`, because the resolver was never looking at `assetId` in the first
place — it was checking a field (`kind`) that can't currently be wrong.

The failure mode this created: a resolver chain that is *individually*
correct at every layer (`PrimitiveResolver` does exactly what its own
docstring promises) produces a *system* that cannot fail, which meant Stage
6's acceptance criterion ("broken assetId shows placeholder/retry") was
architecturally unreachable with the naive wiring
`CachingAssetResolver(PrimitiveResolver)`.

## Why this is a distinct bug from the auth-ordering one (Stage 3)

The [Stage 3 note](2026-09-17--NOTE--stage3-auth-dependency-ordering.md)
was about a layer *catching* a request before it should have. This one is the
opposite shape: a layer *passing* a request that it should have rejected,
because the field it validates against (`kind`) happens to be redundant with
the field that's actually supposed to identify the asset (`assetId`) for
every value that exists right now. Both are "a dependency's behavior doesn't
match what the caller assumes it's checking," but one under-fails (too
permissive) and the other over-fails (too strict). Both are invisible until
someone tries the specific input that exposes the mismatch.

## The fix

I didn't change `PrimitiveResolver` — its contract ("I resolve primitive
*kinds*, I don't know about ids") is legitimate and is exercised correctly by
its own unit tests (`PrimitiveResolver.test.ts`). Changing it to also
validate `assetId` would conflate two different resolvers' jobs: a primitive
genuinely has no id-shaped identity to check.

Instead, the app-level composition in [`src/viewport/assetResolution.ts`](../../src/viewport/assetResolution.ts)
now encodes the *policy* of which ids are allowed to be treated as
primitives:

```ts
class FallbackResolver implements AssetResolver {
  async resolve(ref: AssetRef): Promise<AssetDescriptor> {
    if (ref.assetId === `primitive-${ref.kind}`) return this.primary.resolve(ref)
    return this.secondary.resolve(ref)
  }
}
```

`primitive-<kind>` is exactly the id [`makeObject`](../../packages/project/src/index.ts)
assigns when an object is first created (`assetId: \`primitive-${assetKind}\``).
Only that canonical id routes to `PrimitiveResolver`; anything else — like a
user-edited, deliberately broken id — falls through to `LocalCatalogResolver`,
which is backed by an empty dev catalog until real GLB assets exist, so it
fails honestly and visibly instead of silently succeeding.

This is a case where the correct fix lives at the **call site's composition**,
not inside either resolver — each resolver stays honest about the one thing
it actually knows, and the routing policy between them is where
assetId-vs-kind trust decisions belong.

## When this class of bug can occur again

1. **A validated field is currently redundant with an unvalidated one.**
   Anywhere code checks `X` to decide if `Y` is acceptable, and `X` and `Y`
   happen to always agree given today's data, the check silently stops being
   a check the moment something can make `X` and `Y` disagree — here, the
   moment `AssetKind` grows a case that isn't hardcoded 1:1 with a resolver,
   or an id gets user-edited independently of the kind that was used to
   generate it.

2. **A future non-primitive AssetKind reintroduces this exact gap.** If
   `AssetKind` grows e.g. `'glb'` and a real `RemoteMediaResolver`/
   `LocalCatalogResolver` becomes the "kind-matching" backend, whoever wires
   that resolver must remember the same lesson: matching on `kind` alone is
   not the same as validating `assetId`. Grep for `PRIMITIVE_KINDS` and the
   `primitive-${...}` template literal before assuming a new kind is
   automatically safe to route.

3. **Contract tests can pass while the composed system still can't fail.**
   `resolverContract.test.ts` correctly proves each resolver meets its own
   contract in isolation ("PrimitiveResolver resolves primitive kinds").
   None of those tests could have caught this, because the bug only exists
   in how the *app* composes resolvers together, not in any one resolver.
   This is why [`assetResolution.test.ts`](../../src/viewport/assetResolution.test.ts)
   asserts on the *composed* behavior (`resolveAsset` given a broken id),
   one layer up from the per-resolver contract tests — that's the layer
   where this bug actually lived.

4. **"It always succeeds" is easy to mistake for "it's fully wired."**
   Before I tried to break it, the resolver call looked completely
   functional: selection triggered resolution, the badge logic worked, status
   flowed through `AssetDescriptor` correctly. Every visible signal said
   "done." The gap only showed up when I deliberately tried to exercise the
   *failure* branch of an acceptance criterion — a reminder that a green
   demo of the happy path is not evidence the failure path was ever reachable.

## The general lesson

When a resolver (or any validation/dependency layer) checks field `X` to
decide if the whole reference is valid, ask explicitly: *can `X` and the
field I actually care about (`Y`) currently diverge, given all the data this
system can produce today?* If the answer is "no, not yet" — as it was here,
because `AssetKind` only had primitive values — the check is not wrong, but
it is untested territory that will look identical to a correct implementation
right up until someone (a user editing a field, or a future kind being added)
makes `X` and `Y` disagree for the first time.
