# Debugging and Logging

**Baseline phase:** Not stage-specific — see [8-stage baseline overview](../FOUNDATION--baseline-phases.md) for the full sequence.

VThere uses small, explicit logging tools so failures can be diagnosed without scattering permanent `console.log` calls through business logic.

## Frontend logger

Use [`packages/debugging/src/index.ts`](../../../packages/debugging/src/index.ts) for browser and shared TypeScript logs:

```ts
import { createLogger } from '../../packages/debugging/src/index'

const logger = createLogger('editor.feature')
logger.debug('Transform preview updated', { objectId, axis })
logger.warn('Draft recovery source rejected', { source, error })
```

Levels are `debug`, `info`, `warn`, and `error`. The default level is `info`, so verbose traces do not overwhelm normal development output.

Enable verbose logs in the browser console:

```js
localStorage.setItem('vthere:log-level', 'debug')
location.reload()
```

Return to normal logging:

```js
localStorage.removeItem('vthere:log-level')
location.reload()
```

The logger redacts keys containing `password`, `secret`, `token`, `authorization`, `cookie`, or `api-key`. Do not log complete project documents, access tokens, credentials, or uploaded asset contents.

## API logger

The FastAPI entry point in [`apps/api/app/main.py`](../../../apps/api/app/main.py) logs request completion and failures. Each request receives an `x-request-id` response header. When investigating a browser/API issue, copy that ID and search the API terminal output for it.

Example log shape:

```text
request_completed request_id=... method=GET path=/health status_code=200 duration_ms=1.24
```

Unhandled API exceptions use `logger.exception`, which includes the traceback. Expected client errors should be logged with useful identifiers and without sensitive payloads.

## Software engineering rules

- Log at the boundary where an operation starts, completes, or fails.
- Include stable identifiers such as `projectId`, `sceneId`, `objectId`, command name, and request ID.
- Include state transitions and durations for persistence, API, publishing, and long-running operations.
- Log errors once at the layer that can add useful recovery context; do not log and rethrow the same error repeatedly.
- Keep domain packages deterministic and testable. Inject a logger or sink instead of importing browser globals into pure business logic.
- Test important failure paths with an injectable sink, as shown in [`packages/debugging/src/index.test.ts`](../../../packages/debugging/src/index.test.ts).
- Never treat a log message as the source of truth. Persistence status, API responses, and tests must carry the actual behavior.

## Investigation workflow

1. Reproduce the smallest failing action.
2. Record the project, scene, object, command, and `x-request-id` where applicable.
3. Enable frontend debug logs if the issue is in browser behavior.
4. Check the persistence transition: `saving`, `saved`, `recovered`, or `failed`.
5. Compare the serialized project before and after the action, without sharing secrets.
6. Add a focused regression test before changing the implementation.
7. Run the narrow test, then the full build and test commands.

## Verification commands

```powershell
cd "VThere Spatial Experience Builder"
npm.cmd test
npm.cmd run build
python -m pytest apps/api/tests -q
```

For a local API session (from `VThere Spatial Experience Builder/`, after `docker compose up -d`
for Postgres/MinIO):

```powershell
cd apps/api
python -m uvicorn app.main:app --reload --port 8000
```

## Related ownership guides

- [Development guide](CURRENT--development-guide.md)
- [Engineering practices](FOUNDATION--engineering-practices.md)
- [Architecture boundaries](https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Architecture-v0.1)
- [Baseline stage overview](../FOUNDATION--baseline-phases.md)
- [Authoring engine design](../subsystems/FOUNDATION--authoring-engine.md)