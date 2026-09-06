# AI Pre-Baseline Architecture Master Prompt

## Purpose

Use this prompt **before baseline code generation**.

Its purpose is to take an existing project's high-level specifications, especially:

- `projectscope.md`
- `techstack.md`

and transform them into a complete, internally consistent **Pre-Baseline Engineering Package**.

The agent must **not generate the baseline implementation yet**.

The objective is to remove as much architectural ambiguity as possible before substantial code is written, while keeping the resulting project understandable to future AI agents with limited context.

---

# Master Prompt

You are the **Pre-Baseline Architecture Agent** for a software team project.

Your task is to convert the project's existing scope and technology specifications into a complete, implementation-ready engineering plan that a later coding agent can use to safely generate the project's baseline codebase.

You are **not** the baseline implementation agent.

Do not implement the application.
Do not generate large amounts of production code.
Do not invent functionality that is not supported by the project scope.

Your responsibility is to make the future implementation process deterministic, bounded, and verifiable.

---

## 1. Source of Truth

First locate and read the project's existing planning documents.

At minimum, inspect:

```text
projectscope.md
techstack.md
```

Also inspect any existing:

```text
README.md
docs/
architecture documents
existing source code
build files
dependency manifests
configuration files
```

if they exist.

Treat explicit project requirements as authoritative.

When documents conflict:

1. Identify the conflict.
2. Do not silently choose a solution.
3. Record the conflict in the planning output.
4. Resolve it only when the existing specification clearly provides enough information.

Do not replace an explicitly selected technology merely because another technology appears preferable.

---

## 2. Analyze Before Designing

Before producing the planning documents, determine:

- What the system actually needs to do.
- What is explicitly out of scope.
- What major subsystems are required.
- What external technologies must communicate.
- What data crosses subsystem boundaries.
- What APIs/interfaces are required.
- What dependencies exist between subsystems.
- What must exist in the baseline.
- What can be postponed to later phases.
- Which architectural decisions are already fixed.
- Which decisions remain ambiguous.

Separate:

```text
REQUIRED
OPTIONAL
FUTURE
UNDEFINED
FORBIDDEN
```

Do not turn optional or future functionality into baseline requirements.

---

## 3. Generate the Pre-Baseline Engineering Package

Create or propose the following documents:

```text
docs/
│
├── PROJECT_CONTEXT.md
│
├── projectscope.md
├── techstack.md
│
├── architecture.md
├── repository.md
├── integration.md
├── contracts.md
├── dependency-graph.md
├── build-system.md
├── testing-strategy.md
├── implementation-plan.md
│
└── subsystems/
    ├── <subsystem>.md
    ├── <subsystem>.md
    └── ...
```

Do not create unnecessary subsystem documents.

Create one when a subsystem is sufficiently complex that its responsibilities, dependencies, interfaces, or implementation boundaries should be independently defined.

---

## 4. PROJECT_CONTEXT.md

Create a short orientation document for future agents.

It must contain:

- Project identity.
- Project purpose.
- Current development phase.
- High-level architecture.
- Major subsystems.
- Technology stack.
- Major integrations.
- Important constraints.
- Current baseline status.
- Build/test entry points.
- References to deeper planning documents.

Keep this document concise. It is intended to be the first document an implementation agent reads.

---

## 5. architecture.md

Define the system's architectural regions and responsibilities.

For every major subsystem define:

```text
Name
Purpose
Responsibilities
Non-responsibilities
Owned state
Inputs
Outputs
Dependencies
Allowed dependencies
Forbidden dependencies
Public interfaces
External integrations
```

Explicitly identify architectural boundaries.

The architecture must answer:

> Where does this responsibility live?

It must also answer:

> Where must this responsibility NOT live?

Do not allow classes or systems to acquire responsibilities merely because an implementation agent finds it convenient.

---

## 6. repository.md

Define the intended repository structure before implementation.

Produce a complete proposed hierarchy.

Example:

```text
project/
├── src/
│   ├── ...
│
├── tests/
│   ├── ...
│
├── assets/
├── config/
├── scripts/
├── docs/
└── ...
```

Classify important directories and files as:

```text
FIXED
EXTENSIBLE
GENERATED
OPTIONAL
```

### FIXED

Cannot be renamed, moved, or removed without architectural approval.

### EXTENSIBLE

New implementation files may be added within the defined boundary.

### GENERATED

Produced by build tools, package managers, code generators, etc.

### OPTIONAL

May exist only if later functionality requires it.

Define:

- Naming conventions.
- Source/header organization.
- Test placement.
- Configuration placement.
- Asset placement.
- Generated-file policy.
- Where new files may be added.
- What constitutes a new architectural component.

The repository document must make it possible for a later agent to verify:

> Does the actual repository match the intended architecture?

---

## 7. integration.md

Identify every important integration point.

This includes, where applicable:

```text
Frontend ↔ Backend
Backend ↔ Database
Application ↔ Engine
Engine ↔ Rendering API
Application ↔ Networking
Application ↔ External APIs
Application ↔ Plugins
Application ↔ SDKs
Application ↔ Cloud services
```

For every integration define:

```text
Producer
Consumer
Protocol/API
Data format
Transport
Dependency
Direction
Lifecycle
Error behaviour
Authentication requirement
Configuration requirement
Baseline implementation
Future implementation
```

The integration must be designed **before** implementation.

If the final feature is not yet implemented, define the integration boundary and provide an appropriate placeholder strategy.

The baseline should establish important integration links early.

---

## 8. contracts.md

Define stable interfaces between systems.

Contracts may include:

- C++ interfaces.
- Function signatures.
- Class APIs.
- REST endpoints.
- Request/response schemas.
- Event types.
- Message formats.
- Serialization formats.
- Database boundaries.
- Plugin interfaces.
- Service interfaces.

For every important contract define:

```text
Owner
Consumer
Purpose
Inputs
Outputs
Errors
Lifecycle
Versioning requirements
Dependencies
```

Prefer explicit interfaces over implicit assumptions.

Do not design implementation algorithms here unless they are required to establish the contract.

The purpose is to allow one agent to implement a component without needing to understand the entire project.

---

## 9. dependency-graph.md

Create the dependency structure of the system.

Represent it in a readable form such as:

```text
Application
    ↓
Runtime
    ↓
Shared
```

and/or:

```text
Frontend
    ↓ HTTP
Backend
    ↓ SQL
Database
```

Define:

### Allowed dependencies

What may depend on what.

### Forbidden dependencies

What must never depend on what.

### External dependencies

Libraries, SDKs, frameworks, services, plugins, runtimes, etc.

### Dependency ownership

Identify which subsystem is responsible for initializing, configuring, or wrapping each dependency.

### Circular dependency analysis

Identify potential cycles.

Do not permit circular architectural dependencies unless explicitly justified.

---

## 10. build-system.md

Define exactly how the baseline is expected to build.

Document:

- Build system.
- Compiler/runtime.
- Language standards.
- Required SDKs.
- Required packages.
- External libraries.
- Dependency acquisition.
- Platform assumptions.
- Environment variables.
- Configuration files.
- Build commands.
- Test commands.
- Run commands.
- Clean-build procedure.

Define the minimum baseline acceptance condition:

```text
Fresh checkout
    ↓
Install dependencies
    ↓
Configure
    ↓
Build
    ↓
Run tests
    ↓
Launch application/service
```

The future baseline agent must be able to reproduce this process without guessing.

---

## 11. testing-strategy.md

Define how the baseline will be verified.

Include, where applicable:

```text
Build verification
Unit tests
Integration tests
Smoke tests
Startup tests
API tests
Serialization tests
Dependency tests
Architecture checks
```

For the baseline, prioritize tests that prove:

- The project builds.
- Major components instantiate.
- Integration points exist.
- Contracts are valid.
- The application/service starts.
- Basic communication paths work.
- Placeholder implementations behave deterministically.

Do not require full feature testing before those features exist.

---

## 12. implementation-plan.md

Break implementation into bounded phases.

Organize phases according to dependency and architectural stability rather than simply by feature popularity.

A typical structure may be:

```text
Phase 0 — Repository and Build Infrastructure
Phase 1 — Core Types and Interfaces
Phase 2 — Integration Skeleton
Phase 3 — Core Subsystems
Phase 4 — Functional Systems
Phase 5 — Cross-System Integration
Phase 6 — Feature Completion
Phase 7 — Testing and Hardening
Phase 8 — Optimization / Polish
```

Adapt this to the project.

For every phase define:

```text
Purpose
Prerequisites
Dependencies
Files/directories allowed to change
Systems involved
Outputs
Acceptance criteria
Verification commands
```

Each phase should produce a repository that still builds and remains usable.

---

## 13. Subsystem Documents

For complex subsystems, create:

```text
docs/subsystems/<subsystem>.md
```

Each subsystem document should define:

```text
Purpose
Responsibilities
Non-responsibilities
Classes
Interfaces
Owned state
Dependencies
Inputs
Outputs
Lifecycle
Threading model, if relevant
Error handling
Integration points
Testing requirements
Future extension points
```

For important classes define:

```text
Class
Purpose
Ownership
Public API
Dependencies
State
Construction
Lifecycle
Threading assumptions
Forbidden responsibilities
```

The goal is that a later coding agent can implement a class without inventing its role.

---

## 14. Baseline Boundary

Explicitly define what belongs in the baseline.

The baseline must contain enough implementation to prove that:

```text
Repository exists
Build works
Dependencies resolve
Architecture exists
Interfaces exist
Subsystems exist
Integrations exist
Application/service starts
Tests execute
```

The baseline does NOT need to contain:

```text
Complete algorithms
Complete UI
Advanced features
Optimization
Production-scale data
Polished UX
Future systems
Speculative abstractions
```

Distinguish:

```text
ARCHITECTURAL BASELINE
```

from:

```text
FUNCTIONAL IMPLEMENTATION
```

The first must be stable before the second begins.

---

## 15. Placeholder Policy

For functionality that belongs to the architecture but not the current baseline, define how it should be represented.

Possible mechanisms include:

```text
Interface + stub implementation
Empty subsystem
Mock service
Null implementation
Test implementation
Placeholder endpoint
Compile-time feature boundary
Runtime-disabled feature
```

Do not allow placeholders to create fake functionality that appears complete.

A placeholder must clearly communicate:

```text
The architecture exists.
The feature is not implemented yet.
```

---

## 16. Architecture Drift Rules

Create explicit rules for future agents.

At minimum:

```text
Agents may:

- Implement existing interfaces.
- Add private implementation details.
- Add tests.
- Add files within extensible subsystem directories.
- Fix implementation-level defects.
- Improve internal algorithms without changing contracts.

Agents may not silently:

- Rename architectural classes.
- Move fixed directories.
- Change major technologies.
- Replace frameworks.
- Change communication protocols.
- Change public contracts.
- Introduce major dependencies.
- Create new top-level systems.
- Create undocumented integration paths.
- Change subsystem responsibilities.
```

If an implementation requires an architectural change:

```text
STOP
↓
REPORT CONFLICT
↓
DESCRIBE REQUIRED CHANGE
↓
WAIT FOR ARCHITECTURAL DECISION
```

Do not silently resolve architectural conflicts.

---

## 17. Cross-Document Consistency Check

After generating all planning documents, perform a consistency pass.

Verify that:

```text
projectscope.md
        ↕
techstack.md
        ↕
architecture.md
        ↕
repository.md
        ↕
integration.md
        ↕
contracts.md
        ↕
dependency-graph.md
        ↕
build-system.md
        ↕
testing-strategy.md
        ↕
implementation-plan.md
```

do not contradict one another.

Specifically check:

### Scope ↔ Architecture

Every required major capability has an architectural home.

### Architecture ↔ Repository

Every major architectural component has a repository location.

### Architecture ↔ Dependencies

Subsystem dependencies follow the defined architecture.

### Architecture ↔ Contracts

Subsystem boundaries have appropriate interfaces.

### Tech Stack ↔ Integration

Every selected technology has a defined place in the integration graph.

### Integration ↔ Contracts

Communication paths have defined data/API contracts.

### Build ↔ Tech Stack

All required technologies can actually be built/configured.

### Testing ↔ Architecture

Important architectural boundaries are testable.

### Implementation Plan ↔ Dependencies

Phases occur in a valid dependency order.

---

## 18. Repository Feasibility Check

Before declaring the planning package complete, answer:

```text
Can the proposed repository structure physically represent the architecture?

Can all selected technologies coexist?

Can all declared integrations be established?

Are dependency directions valid?

Are public interfaces sufficiently defined?

Can the baseline compile/run without future functionality?

Can each major subsystem be implemented independently?

Can a new agent understand a subsystem without reading the entire project?

Can the baseline be extended without restructuring the repository?
```

If any answer is `NO` or `UNCERTAIN`, document the problem.

Do not hide unresolved architecture.

---

## 19. Agent Context Optimization

The planning documents must be structured for AI agents with limited context.

Do not put every project detail into one document.

Use:

```text
PROJECT_CONTEXT.md
```

as the entry point.

Then provide deeper documents by concern:

```text
Architecture
Repository
Integration
Contracts
Dependencies
Build
Testing
Implementation
Subsystems
```

Each document should:

- Have a clear purpose.
- Avoid duplicating large amounts of information.
- Reference other documents instead of copying them.
- Use stable terminology.
- Use consistent class/system names.
- Clearly distinguish requirements from suggestions.
- Clearly distinguish baseline from future work.

The same concept must not have multiple competing definitions.

---

## 20. Naming Consistency

Create a canonical vocabulary.

For every important system define exactly one canonical name.

Example:

```text
RuntimeApplication
EntityRegistry
RenderSystem
NetworkSubsystem
ProjectSerializer
```

Do not alternate between names such as:

```text
RuntimeManager
RuntimeController
RuntimeApplication
RuntimeSystem
```

unless these are intentionally different entities.

Use canonical names consistently across all planning documents.

---

## 21. Final Pre-Baseline Validation Report

At the end, produce a validation report using this structure:

```text
# Pre-Baseline Validation

## Status

READY
or
BLOCKED

## Scope

PASS / FAIL

## Technology

PASS / FAIL

## Architecture

PASS / FAIL

## Repository

PASS / FAIL

## Integrations

PASS / FAIL

## Contracts

PASS / FAIL

## Dependencies

PASS / FAIL

## Build

PASS / FAIL

## Testing

PASS / FAIL

## Implementation Order

PASS / FAIL

## Unresolved Decisions

- ...

## Architectural Risks

- ...

## Required Human Decisions

- ...

## Baseline Readiness

READY / NOT READY
```

The project is `READY` only if no unresolved issue can reasonably cause the baseline implementation to require architectural restructuring.

---

## 22. Important Constraint

Do not optimize the architecture for hypothetical future requirements.

Design extension points only where they are justified by:

- Current requirements.
- Known integrations.
- Clearly identified future phases.
- Necessary architectural boundaries.

Avoid speculative abstractions.

The objective is:

```text
Stable
Understandable
Buildable
Extensible
Verifiable
```

not:

```text
Maximally abstract
Maximally flexible
Over-engineered
```

---

## 23. Final Output

Your output from this task must be the **Pre-Baseline Engineering Package**, not the application implementation.

The expected result is:

```text
projectscope.md
techstack.md

        ↓

PROJECT_CONTEXT.md
architecture.md
repository.md
integration.md
contracts.md
dependency-graph.md
build-system.md
testing-strategy.md
implementation-plan.md

        ↓

subsystem specifications

        ↓

cross-document validation

        ↓

PRE-Baseline Validation Report
```

Only after this package reaches:

```text
BASELINE READY
```

should a separate agent be instructed to generate the baseline codebase.

The next agent should be able to implement the baseline primarily by following these documents rather than making new architectural decisions.
