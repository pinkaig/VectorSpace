# Source File Header Standard

## Purpose

Use file-level documentation as the implementation reference for each source file. Put larger system explanations, cross-file architecture, diagrams, and tutorials in Markdown wiki pages. The source file should explain what it currently does and link to the larger system guide.

## TypeScript and TSX template

```ts
/**
 * @file        Viewport.tsx
 * @author      Sherman Goh Wee Hao
 * @date        2026-09-13
 * @reviewed    2026-09-13
 * @brief       React-to-Three.js 3D viewport bridge.
 *
 * @responsibility
 * Renders scene objects and forwards selection and movement events.
 *
 * @boundary
 * React owns application state. Three.js owns the WebGL scene and canvas.
 *
 * @dependencies
 * React, Three.js, SceneObject.
 *
 * @status
 * Current technical-spike implementation.
 *
 * @documentation
 * See docs/05-subsystems/viewport.md
 */
```

## Required fields

| Field | Meaning |
|---|---|
| `@file` | Repository filename, including extension. |
| `@author` | Primary owner or contributor. Use the team convention for shared files. |
| `@date` | Date the file or header was created. Use ISO format: `YYYY-MM-DD`. |
| `@reviewed` | Date the implementation was last checked against its documentation. |
| `@brief` | One-sentence purpose. |
| `@responsibility` | What the file currently owns. |
| `@inputs` | Important props, arguments, events, or external data consumed. |
| `@outputs` | Return values, rendered elements, callbacks, events, or side effects produced. |
| `@members` | Important functions, state fields, refs, classes, or external resources in the file. |
| `@boundary` | What the module explicitly does not own or where it connects to another layer. |
| `@dependencies` | Important libraries, packages, or domain types. |
| `@status` | Current, prototype, deprecated, or planned. |
| `@documentation` | Link target for the detailed Markdown page. |

## What does not belong in a source header

Do not place the following in every file header:

- A complete change diary
- Long debugging stories
- Full API documentation
- Large code samples
- Unverified claims about performance
- Credentials, tokens, or private data
- Copyright text copied without checking the applicable project policy

## Documentation relationship

```text
Source file
  -> contains implementation-level documentation and current behaviour

Subsystem Markdown page
  -> explains the larger system, cross-file relationships, architecture, examples, errors, tests, and history

Tests
  -> demonstrate executable behaviour
```

## Review rule

When a function, component prop, data field, side effect, or file-level responsibility changes, update the source header in the same pull request. Update the linked Markdown page when the larger system, cross-file contract, architecture, or usage guidance changes. Update `@reviewed` only after the documentation and implementation have been checked together.
