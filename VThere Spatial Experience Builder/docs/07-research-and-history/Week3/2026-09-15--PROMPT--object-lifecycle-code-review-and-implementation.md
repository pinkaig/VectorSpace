# Prompt: object lifecycle architecture review and safe code scaffolding

You are working in the VThere Spatial Experience Builder project. Your job is to review the existing architecture, plan carefully, and then add a small, safe, documented object lifecycle extension to the shared project model without breaking the current app.

## Objective

Implement or scaffold code in `packages/project/src/index.ts` to reflect the future object lifecycle requirements while preserving the existing flat `ProjectData` snapshot model and minimizing system instability.

The design should include the following concerns:
- object identity and stable ID strategy
- separate `visible` and `enabled`/active state
- object status semantics
- parent-child / grouping considerations
- object creation and duplication
- object removal
- whether the logic belongs in a service/command layer instead of a singleton global manager
- how this fits a front-end web app architecture that keeps project state, UI state, and renderer output in separate layers

## Required workflow

1. Inspect the current structure first.
   - Read the canonical project model in `packages/project/src/index.ts`.
   - Review the editor/state wiring in `src/App.tsx`.
   - Review renderer sync in `src/Viewport.tsx`.
   - Review persistence/serialization in `src/serializer.ts`.
   - Check any relevant docs under `docs/` related to object state, architecture, or project structure.

2. Perform an architecture analysis before editing.
   - Explain the current source of truth.
   - Identify which state is canonical vs derived.
   - Describe risks in the current structure.
   - Explain whether the app currently has any hidden global mutable state or duplicated object authority.
   - Discuss the expected stability and longevity of the codebase if object lifecycle logic is added in the wrong place.

3. Produce a short implementation plan.
   - State what you will change and why.
   - State what you will not change yet to avoid destabilizing the app.
   - Describe compatibility constraints and schema evolution considerations.
   - Call out any assumptions about future migration or API boundaries.

4. Make the smallest safe change.
   - Add pseudo-code in the project index file to show the intended lifecycle flow.
   - Add commented class-oriented code sketches that outline future object lifecycle services or command handlers.
   - Keep the comment code clearly marked as design scaffolding, not active runtime logic, unless the project already has a clear pattern for that style.
   - Do not introduce a second source of truth.
   - Avoid making the object model overly complex before the project has a stable ownership boundary.

5. Validate the file after the edit.
   - Check for TypeScript errors or obvious compatibility issues.
   - Confirm the new comments and pseudo-code are non-breaking and clearly documented.

## Analysis expectations

In your response, include a section titled `Architecture Analysis` covering these points:
- current structural strengths and weaknesses
- where object state should live
- whether a global `ObjectManager` is advisable
- what should be in the canonical model vs command layer vs renderer cache vs UI state
- how this design affects stability, maintainability, and long-term codebase longevity
- what risks exist in browser/web app state and non-procedural runtime behavior

Also include a section titled `Implementation Plan` summarizing the exact steps you will take before writing code.

## Editing constraints

- The change must remain compatible with the current model unless there is a strong reason to introduce a schema migration.
- If the object lifecycle is not fully implemented yet, represent it as clear pseudo-code and commented architecture notes.
- Prefer safe, descriptive naming over clever abstractions.
- The comments should explain trade-offs and future extension paths.
- Use TypeScript-friendly examples and maintain the style of the project.

## Final output requirements

Provide:
1. a brief summary of the architecture analysis;
2. the implementation plan;
3. a concise description of the file change made;
4. verification status (for example, TypeScript errors check or no obvious issues found);
5. any follow-up recommendations for a future full implementation.

## Success criteria

The work is successful if:
- the agent inspects the codebase before editing;
- the design rationale is clear and architecture-aware;
- the update is intentionally conservative and future-facing;
- the code remains stable and easy to evolve;
- there is no hidden mutation of authoritative state from multiple layers.
