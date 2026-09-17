# VThere Spatial Experience Builder

## Proposal baseline

**Status:** Initial implementation baseline  
**Source:** Submitted Project 5 proposal and approved scope  
**Product type:** Browser-based spatial authoring and visitor-runtime application

## Problem

Students and educators need to create small interactive 3D exhibitions without writing code or using a professional 3D authoring tool. The product must make object placement, content attachment, visitor interactions, saving, previewing, publishing, and sharing understandable and dependable.

## Users

- **Author:** creates and edits an exhibition without programming.
- **Visitor:** opens a published exhibition, possibly without an account and on another device.
- **Administrator / organisation owner:** manages accounts, environments, access, and the curated asset library.

## Product outcome

An author can create a multi-scene interactive exhibition from curated assets, attach supported content, define no-code `WHEN -> DO` interactions, save and recover work, preview it in visitor mode, publish it, and share a URL. A visitor can open the published experience on desktop or mobile browser without seeing editing controls.

## Baseline capabilities

1. Create or open a project and load the browser authoring environment.
2. Browse and place curated 3D assets.
3. Select objects from the viewport or scene tree.
4. Move, rotate, scale, rename, inspect, and organize objects.
5. Create multiple scenes and scene navigation.
6. Attach text, image, audio, and video content.
7. Create supported `WHEN -> DO` rules, including object click, zone entry, and scene start.
8. Save, load, autosave, export, recover, undo, and redo authoring work.
9. Preview and publish using the same versioned project representation.
10. Open a published visitor runtime on another device and record basic analytics.

## Quality constraints

- Preview and published runtime behavior must remain equivalent.
- The visitor runtime must not expose editor capability.
- Project serialization must preserve IDs, ordering, transforms, components, interactions, and scene relationships.
- Interaction behavior must be deterministic, including ordered rules and one-shot zone-entry detection.
- Separate users' projects must be isolated by server-side authorization.
- Curated assets must be supplied by the project or openly licensed.
- The application must remain usable on a three-year-old school laptop and on a phone-sized browser viewport.
- Local development and server deployment must be reproducible on Ubuntu 24.04, macOS Tahoe, and Windows 11 where applicable; server components must be deployable on Ubuntu 24.04.

## Explicit non-goals for the baseline

- Arbitrary model upload, conversion, mesh editing, or material authoring.
- Code-based authoring, scripting, variables, and custom conditions.
- Real-time multi-user collaboration.
- Billing, SaaS administration, LMS/SCORM integration, native apps, VR/WebXR, or Gaussian Splat generation.

## Source of truth

This document summarizes the proposal for implementation traceability. The detailed requirement baseline remains in [`project scope`](UNDATED--FOUNDATION--project-scope.md). The technical design is in [`architecture`](../02-architecture/UNDATED--FOUNDATION--architecture.md), and implementation ownership is in [`deliverables`](../03-delivery/2026-09-10--CURRENT--deliverables.md).

## Open decisions before M2

- Final trigger and action vocabulary.
- Organisation permission model.
- Analytics retention, aggregation, and reporting behavior.
- Quantitative performance budgets for load time, frame rate, project size, and concurrency.
- Deployment provider and production identity provider.
- Named team members for each role in the ownership register.
