# Stage 3 learning note: why auth couldn't be wired into the skeleton routes yet

**Baseline phase:** Stage 3 (backend HTTP surface). See [8-stage baseline overview](../../code/baseline-phases.md).

## The high-level problem

FastAPI resolves a request in **layers**, and each layer can short-circuit the
ones after it. The layers, in order, are roughly:

1. **Routing** — does a path+method match a registered route?
2. **Dependency resolution** — run every `Depends(...)` the route declares
   (this includes security schemes like `HTTPBearer`, and things like
   `get_current_token`).
3. **Request validation** — parse and validate the request body against the
   Pydantic model.
4. **Your handler body** — the code you actually wrote.

Each layer can return a response *before* the next layer ever runs. That's
the whole point of dependency injection — it lets you reject bad requests
early without touching business logic. But it also means: **if you put
`Depends(get_current_token)` on a route, your handler body (the `raise
not_implemented(...)` line) never executes unless the request first passes
authentication.**

Stage 3's acceptance criterion is:

> curl a route → 501 NotImplementedError, not a 404 or 500

That's a statement about the **handler layer**. It assumes nothing upstream
of the handler blocks the request. The moment I added `Depends(get_current_token)`
to every route, I inserted a new layer *above* the handler that can fail in
its own ways — and it did, in three different ways depending on what you send:

| What you send | What happens | Why |
|---|---|---|
| No `Authorization` header | `403 Forbidden` | `HTTPBearer(auto_error=True)` rejects the request before any dependency code of mine even runs |
| `Authorization: Bearer dummy` (garbage) | `500 Internal Server Error` | `jose.jwt.get_unverified_header("dummy")` throws `JWTError`, which I hadn't caught — an unhandled exception becomes a 500 |
| `Authorization: Bearer <real-shaped-but-unsigned JWT>` | `401 Unauthorized` (after I added the missing catch) | JWKS lookup or signature/audience/issuer validation fails |

None of these are 501. So a route that is "real routing + skeleton handler"
by design was actually being gated by "real auth infrastructure" that has
nothing to do with what Stage 3 was supposed to prove yet.

## Why this happened

This is a classic case of **conflating two independent axes of "realness"**:

- **Is the code path real?** (routing, request/response shapes) — yes, this
  was supposed to be real in Stage 3.
- **Is the code path enforced?** (auth actually gating access) — this was
  *not* asked for yet. Authorization is a business-logic concern, and Stage 3
  explicitly scopes business logic *out* ("all handler bodies raise
  NotImplementedError — this is the skeleton domain-logic boundary").

I built `auth.py` as required (real JWKS fetch + JWT validation, importable
and independently testable), but then instinctively wired it into every
route via `Depends(...)`, because that's the idiomatic FastAPI pattern for
"this route needs auth." The instinct was right for a *finished* API and
wrong for a *skeleton* one — I imported next stage's concern (authorization)
into this stage's deliverable (routing shape).

**The fix:** keep `auth.py` real and standalone — it has its own logic,
its own error handling, and will be trivial to attach with one line
(`Depends(get_current_token)`) per route in the stage that actually
implements the handlers. For now, no route depends on it, so curling any
route reaches the handler body directly and returns a clean 501.

## Other problems this class of mistake can cause

This isn't just a Stage 3 quirk — "a dependency/middleware layer silently
changes what status code you get" is a recurring category of bug. Related
risks to watch for as this project grows:

1. **Masking real failures as generic ones.** An unhandled exception in a
   dependency (like the `JWTError` I initially didn't catch) becomes a bare
   500 with a stack trace potentially leaking into logs or (if `DEBUG` is
   ever misconfigured) into the response. Every `Depends` that does I/O or
   parsing needs its own explicit exception handling — don't assume FastAPI
   will turn library exceptions into sensible HTTP errors for you. It only
   does that automatically for `HTTPException` and Pydantic's own
   `ValidationError`.

2. **Tests that assert on the wrong layer.** If integration tests are later
   written against these routes without also sending a valid token (once
   auth *is* wired in), they'll get 401/403 and someone may "fix" it by
   loosening auth instead of fixing the test — a classic way security
   checks get quietly weakened over time.

3. **Order-of-dependency bugs.** FastAPI runs dependencies in the order
   they're declared/discovered, but when multiple dependencies exist (auth,
   rate limiting, request logging, tenant resolution), the *order* determines
   which one "wins" when a request is bad in multiple ways at once. E.g. if
   both an auth check and a payload-size check are dependencies, whichever
   is evaluated first determines whether an oversized-but-unauthenticated
   request gets a 413 or a 401 — this can leak information (confirming a
   route exists / expects a certain shape) to unauthenticated callers if not
   thought through.

4. **Coupling infrastructure availability to unrelated endpoints.** Because
   `_jwks()` does a live HTTP call (`httpx.get` to Auth0's `.well-known/jwks.json`)
   and is only cached *after* the first successful call, wiring auth into
   every route means **every protected endpoint's latency and availability
   now depends on Auth0's uptime**, even for routes where you might later
   want to allow anonymous/public access (e.g. a public "get published
   project" endpoint). Deciding per-route whether auth applies — rather than
   globally — avoids an accidental hard dependency on a third party for
   routes that shouldn't need it.

5. **"Working locally, broken in CI/prod" drift.** `auth0_domain` defaults to
   `""` in `config.py`. Locally, if you never call a protected route, you'll
   never notice this is unset. If auth were wired in now and someone ran the
   Stage 3 acceptance curl commands without configuring Auth0, they'd see 500s
   and might incorrectly conclude the *routing* is broken, burning time
   debugging the wrong layer. Keeping concerns separated (routing correctness
   vs. auth correctness) means each can be verified independently, with
   independent, narrower test setups.

6. **Premature coupling makes staged rollout harder.** The whole point of
   the plan's staged approach (Stage 3 = skeleton, later stage = real
   handlers) is that each stage is independently verifiable and shippable.
   If auth had shipped wired-in now, "verify Stage 3" would have silently
   started requiring "also have a working Auth0 tenant reachable from CI,"
   which is a Stage 5+ (deployment/production) concern, not a Stage 3 one.

## The general lesson

When a plan says "build X as skeleton and Y as real infrastructure in the
same stage," treat that as two deliverables with **no assumed wiring
between them** unless explicitly stated. Build Y so it's correct and usable
on its own (importable, unit-testable, own error handling), and only wire it
into X when the stage that owns X's actual behavior arrives. Prove each
piece meets its own acceptance criteria in isolation before combining them —
combining early is exactly how one piece's failure mode (auth being
misconfigured) ends up masquerading as a failure in a completely different
piece (routing).
