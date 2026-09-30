# Source Brief Audit

**Source:** `VThere_DigiPen_Spatial_Experience_Builder_Project_5.docx`
**Audited documents:** `FOUNDATION--project-scope.md`, `FOUNDATION--tech-stack.md`, Stage 3 architecture documents
**Audit date:** 2026-09-06

**Baseline phase:** Not stage-specific — see [8-stage baseline overview](../../code/baseline-phases.md) for the full sequence.

## Coverage summary

| Brief consideration | Status | Evidence / action |
|---|---|---|
| Browser-based authoring application | COVERED | Scope, architecture, and frontend stack |
| No-code authoring for a teenage first-time user | PARTIAL | Scope says non-programmer; onboarding and two-minute usability test need explicit product work |
| Chrome, Safari, Firefox browser support | PARTIAL | Browser baseline exists, but Firefox and exact supported versions need confirmation |
| Supplied 3D environments | OUTSTANDING | Environment asset inventory and licensing are not yet defined |
| Two to four environments | OUTSTANDING | Add a target count after VThere confirms available environments |
| Curated 20â€“30 asset library | OUTSTANDING | Asset count, thumbnails, categories, scale, orientation, and pivot standards need an asset contract |
| glTF/GLB as the supported 3D format | OUTSTANDING | Declare GLB as the only MVP 3D asset format |
| Orbit, pan, zoom, and first-person walk mode | OUTSTANDING | Visitor/editor camera modes are not yet specified in contracts |
| Loading states for large environments | OUTSTANDING | Add loading, progress, error, and retry states to runtime acceptance tests |
| Responsive laptop/tablet/phone viewing | PARTIAL | Responsive browser viewing is scoped; tablet/iPad behavior and editing support need a decision |
| Six-trigger/six-action WHEN -> DO language | OUTSTANDING | Current scope only lists examples; exact vocabulary must be approved at pitch |
| Immediate interaction testing inside editor | OUTSTANDING | Preview exists, but an in-editor rule test workflow is not explicitly contracted |
| Project create/open/duplicate/archive | OUTSTANDING | Save/load exists; lifecycle operations need API and acceptance coverage |
| Draft and published states | PARTIAL | Immutable publication is designed; draft status and archive behavior need explicit API states |
| Administrator, educator, student, visitor roles | PARTIAL | Admin/author/visitor exist; educator/facilitator workflows and permissions need ownership rules |
| No public self-service signup | OUTSTANDING | Auth is selected, but account provisioning must be administrator-created only |
| Text, image, audio, video, hotspot, exhibit, navigation point | COVERED/PARTIAL | Core content is scoped; navigation point and positioned/global audio need schema detail |
| Multiple rules with predictable ordering | COVERED | Interaction and testing documents |
| Interactive zone enter edge detection | COVERED | Interaction requirements and authoring-engine test matrix |
| Camera transitions interpolate smoothly | OUTSTANDING | Add to runtime interaction contract and tests |
| Scene-navigation loop protection | OUTSTANDING | Add a bounded navigation policy and test A -> B -> A entry behavior |
| Versioned project file and migrations | COVERED | Serialization and persistence invariants |
| Preview equals published | COVERED | Architecture, contracts, parity tests |
| Analytics: visits, hotspot clicks, time, scenes reached | COVERED | Scope, API, testing strategy |
| Basic analytics reporting view | OUTSTANDING | Events are defined; author/educator reporting screen is not |
| Publish public/unlisted/authenticated | COVERED | Contracts and access model |
| Published runtime contains no editor capability | COVERED | Runtime boundary |
| Gaussian Splat viewing as possible stretch | PARTIAL | Generation is forbidden; viewing is not explicitly categorized and should remain excluded unless approved |
| Team role ownership | PARTIAL | Architecture boundaries exist; UXGD/IMGD/RTIS/BFA ownership matrix and deliverables need project planning |
| DigiPen 5â€“9 team composition | COVERED | Scope constraint |
| Jira/Scrum and UXGD PM | COVERED | Scope/stack constraints |
| 80% team / 20% individual grading evidence | OUTSTANDING | Add contribution evidence requirements to project operations docs |
| Pitch Weeks 1â€“2 and Milestone 3 MVP | COVERED/PARTIAL | Scope says Milestone 3; official dates and phase gates are not recorded |
| Pilot with people outside the team | OUTSTANDING | Add pilot protocol, usability observation, and defect triage phase |
| NDA, confidentiality, IP, reuse, handoff | OUTSTANDING | Must be confirmed in writing with DigiPen/VThere before using real assets or partner data |
| School-student pilot consent/safeguarding | OUTSTANDING | Required if a classroom pilot is conducted |
| Mentor and consultation arrangement | OUTSTANDING | Confirm named mentor, recurring slot, and communication channel |
| Final source-code, tests, documentation handoff | PARTIAL | Documentation exists; final handoff checklist and IP terms need approval |

## Outstanding decisions before implementation

### 1. MVP vocabulary

Approve the exact six triggers and six actions, or explicitly reduce them. The brief's example vocabulary is:

- Triggers: visitor clicks object, visitor enters zone, scene starts, time passes, visitor looks at object, visitor closes a panel.
- Actions: show panel, play audio/video, move camera to viewpoint, show/hide object, navigate scene, open link.

This decision changes the project schema, interaction builder, runtime engine, and test matrix.

### 2. Navigation model

Choose whether visitors use free first-person movement, camera-point navigation, or both. The brief explicitly describes orbit/pan/zoom for authoring and first-person-style walking for visitors. This changes camera controls, mobile input, zone detection, performance, and accessibility.

### 3. Asset and environment inventory

Before baseline data is created, record the approved two-to-four environments and approximately 20â€“30 GLB assets, including license/source, scale, units, orientation, pivot, thumbnail, collision/interaction proxy, file size, and attribution.

### 4. Project lifecycle and roles

Define server-side states and permissions for administrator-created accounts, educator/facilitator assignment and review, student creation/editing, visitor read-only access, duplicate/archive operations, and public/unlisted/authenticated publication.

### 5. Pilot and conduct

Before testing with school students, confirm consent, safeguarding, data-handling, and whether collected analytics are personally identifiable. Confirm NDA, IP ownership, asset usage, publication, code reuse, and final handoff terms in writing.

### 6. Delivery calendar and evidence

Replace relative phase names with the official DigiPen calendar, confirm the Milestone 3 date, create Jira ownership for every subsystem, and define evidence for the 80% team / 20% individual grading split.

## Required follow-up artifacts

- `../05-subsystems/CURRENT--asset-library-contract.md` for environment/asset inventory and licensing.
- `../03-delivery/GOVERNANCE--roles-and-delivery.md` for UXGD/IMGD/RTIS/BFA ownership, Jira evidence, milestones, and handoff.
- `../07-research-and-history/GOVERNANCE--pilot-and-conduct.md` for usability testing, safeguarding, confidentiality, IP, and data handling.
- `../02-architecture/FOUNDATION--contracts.md` for final trigger/action vocabulary, camera/navigation behavior, project lifecycle states, and loading states.

## Audit conclusion

The current architecture follows the brief's central plan: curated spatial authoring, one versioned project file, a separate runtime, custom gizmo/serialization/interaction engineering, persistence, and preview/published parity. It is not yet complete as a source-brief implementation baseline until the outstanding decisions above are approved and the follow-up artifacts are created.

```text
SOURCE BRIEF AUDIT: ALIGNED WITH OUTSTANDING DECISIONS

Core architecture:       COVERED
Custom technical module: COVERED
Persistence and recovery: COVERED IN DESIGN
User journey:            PARTIAL
Required scenarios:      PARTIAL
Team/delivery obligations: OUTSTANDING
Pilot/legal/data duties: OUTSTANDING
Baseline readiness:      NOT READY
```
