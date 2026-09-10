# 03 â€” Pre-Baseline Architecture

**Stage 3 of 5.**
[`01 Scope`](01_UNDATED--FOUNDATION--project-scope.md) â†’ [`02 Tech Stack`](02_UNDATED--FOUNDATION--tech-stack.md) â†’ `03 Pre-Baseline Architecture` â†’ [`04 Baseline`](04_Baseline_Generation.md) â†’ [`05 Phase Implementation`](05_Phase_Implementation.md)

| | |
|---|---|
| **Reads** | `UNDATED--FOUNDATION--project-scope.md`, `UNDATED--FOUNDATION--tech-stack.md`, existing code/build/config |
| **Produces** | The skeleton, plus the supporting documents it needs â€” see Â§3 |
| **Model tier** | **Top tier.** This is the genuinely hard, ambiguous design work. This is the stage worth paying for. |
| **Subagent** | `architect` (pinned to opus). Brief it per Â§0. |
| **Human gate** | **Hard stop.** I read the skeleton like a PR before any code is written anywhere. |

---

## The point of this stage

Changing a skeleton is free. Changing code is not.

Everything here exists to make Stage 4 deterministic â€” so the baseline agent implements
decisions rather than making them.

**The skeleton is the deliverable.** The documents in Â§3 exist to support the skeleton and to
survive a context reset. They are not the product. Do not generate a document because the list
mentions it; generate it because a later agent would otherwise guess.

---

## Â§0 â€” Briefing the architect subagent

`architect` starts with **zero context.** It sees none of the conversation â€” only the prompt
it is handed plus the files it opens. A one-line prompt produces a design against a guess.

Hand it, explicitly:

```text
Objective        â€” one paragraph: what is being designed and why
Source of truth  â€” paths to UNDATED--FOUNDATION--project-scope.md and UNDATED--FOUNDATION--tech-stack.md
Existing state   â€” paths to any code, build files, config that already exist
Constraints      â€” the fixed technology decisions it may not revisit
Non-goals        â€” what is explicitly out of scope (from scope Â§6)
Deliverable      â€” "skeleton per Â§2 of 03_AI_Pre_Baseline_Architecture_Master_Prompt.md"
Topic SESSION.md â€” path, if one exists
```

If `SESSION.md` is stale, refresh it *before* spawning. A subagent working from a stale
handoff designs against the wrong plan, and the mistake is invisible until review.

If this session is configured not to spawn subagents unless asked, **ask first** â€” that
setting overrides any "use proactively" guidance.

---

## Â§1 â€” Read and analyse before designing

Read `UNDATED--FOUNDATION--project-scope.md` and `UNDATED--FOUNDATION--tech-stack.md`. Also read any existing `README.md`, `docs/`,
source, build files, dependency manifests, configuration.

**When documents conflict:** identify the conflict, record it, and resolve it only if the
existing specification clearly provides enough information. Do not silently pick a side. Do
not replace an explicitly selected technology because another looks preferable.

Then determine:

- What the system actually needs to do, and what is explicitly out of scope.
- Which major subsystems are required.
- What data crosses subsystem boundaries.
- Which interfaces are required, and which dependencies exist between subsystems.
- What must exist in the baseline vs. what can be postponed.
- Which architectural decisions are already fixed, and which remain ambiguous.

Tag everything `REQUIRED` Â· `OPTIONAL` Â· `FUTURE` Â· `UNDEFINED` Â· `FORBIDDEN`.
Do not promote optional or future functionality into baseline requirements.

### Learn gate

List the **architectural patterns** this design commits us to â€” repository pattern, dependency
injection, event loop, connection pooling, whatever applies. Split `FAMILIAR` / `UNFAMILIAR`.

For anything `UNFAMILIAR`, stop and route to `tutor` (`/learn <pattern>`) **before** the
skeleton is designed, not after. The order is `learn â†’ skeleton â†’ implement â†’ review`, and it
does not bend because the schedule is tight.

The tutor gives a minimal isolated example showing the function-call flow â€” bare mechanism,
compiled, real output, default C++. Not project code. Mapping the pattern onto this project is
*this* stage's job, and it happens after the mechanism is understood, not instead of it.

---

## Â§2 â€” The skeleton (the actual deliverable)

A skeleton is three things and no more:

### 2a. Module / file boundaries and responsibilities

For each major subsystem:

```text
Name                       â€” the canonical name, used everywhere (see Â§6)
Purpose                    â€” one sentence
Responsibilities           â€” what lives here
Non-responsibilities       â€” what must NOT live here, even when convenient
Owned state                â€” what it alone may mutate
Inputs / Outputs
Allowed dependencies
Forbidden dependencies
Repository location        â€” the path this occupies
```

The `Non-responsibilities` and `Forbidden dependencies` lines are the load-bearing ones. Any
document can say where a responsibility lives. The value is in saying where it must not drift
to when an implementer finds it convenient.

### 2b. Class / interface signatures â€” no bodies

Signatures only. Types, names, parameters, return types, errors. No implementation.

For each important type:

```text
Class / interface
Purpose
Ownership              â€” who constructs it, who owns its lifetime
Public API             â€” signatures only
Dependencies           â€” what it needs injected
State
Construction / lifecycle
Threading assumptions  â€” if relevant
Forbidden responsibilities
```

Small types with one clear responsibility. Prefer composition over inheritance unless
inheritance genuinely models the domain. Match the conventions already in the codebase over
personal preference.

### 2c. Data flow between the major pieces

A short note â€” prose or a diagram â€” tracing how data actually moves:

```text
Frontend
    â†“ HTTP / JSON
Backend API
    â†“ validated DTO
Simulation Engine
    â†“ result object
Serializer
    â†“ SQL
Database
```

State the direction, the format at each hop, and where validation and trust boundaries sit.
Name the cycles you checked for and confirm none exist, or justify any that do.

**Flag every non-obvious tradeoff here, explicitly, at skeleton stage.** Not buried in a code
comment three weeks later where nobody reviewing the design will see it.

---

## Â§3 â€” Supporting documents: scale to the project

Generate what the project needs. **Do not generate all of these by default.**

**Always:**

```text
docs/UNDATED--CURRENT--project-context.md     â€” the orientation doc; first thing any agent reads
docs/UNDATED--FOUNDATION--UNDATED--FOUNDATION--architecture.md        â€” Â§2a and Â§2c, written down
docs/UNDATED--FOUNDATION--UNDATED--FOUNDATION--repository.md          â€” intended tree, with FIXED / EXTENSIBLE / GENERATED / OPTIONAL
docs/UNDATED--FOUNDATION--UNDATED--FOUNDATION--build-system.md        â€” the real build/test/run commands, verified
docs/UNDATED--FOUNDATION--UNDATED--FOUNDATION--implementation-plan.md â€” bounded phases, in dependency order
```

**When the project actually has them:**

```text
docs/UNDATED--FOUNDATION--UNDATED--FOUNDATION--contracts.md           â€” when two subsystems talk across a stable interface
docs/integration.md         â€” when there are external systems, services, or processes
docs/dependency-graph.md    â€” when the dependency structure isn't obvious from UNDATED--FOUNDATION--UNDATED--FOUNDATION--architecture.md
docs/UNDATED--FOUNDATION--UNDATED--FOUNDATION--testing-strategy.md    â€” when testing is more than "run the test command"
docs/subsystems/<name>.md   â€” ONLY when a subsystem is complex enough that its interfaces
                              and boundaries need defining independently
```

A three-subsystem project does not need eleven documents. Duplicated planning documents drift
apart, and then nobody knows which one is true.

### `UNDATED--CURRENT--project-context.md` â€” keep it short

Identity Â· purpose Â· current phase Â· high-level architecture Â· major subsystems Â· stack Â·
major integrations Â· key constraints Â· baseline status Â· **build/test/run entry points** Â·
pointers to deeper docs.

This is the first document an implementation agent reads. If it is long, it will be skimmed.

### `UNDATED--FOUNDATION--UNDATED--FOUNDATION--repository.md` â€” classify every important path

```text
FIXED        cannot be renamed, moved, or removed without architectural approval
EXTENSIBLE   new implementation files may be added within this boundary
GENERATED    produced by build tools, package managers, codegen
OPTIONAL     may exist only if later functionality requires it
```

Also define naming conventions, test placement, config placement, generated-file policy, and
what counts as a *new architectural component* (as opposed to a new file within an existing
boundary).

The document must let a later agent answer: **does the actual repository match the intended
architecture?**

### `UNDATED--FOUNDATION--UNDATED--FOUNDATION--build-system.md` â€” named checks, actually run

Carry the verified commands forward from `UNDATED--FOUNDATION--tech-stack.md` Â§23. Same rule applies: **run them,
paste real output.** Do not invent a plausible compile line.

Define the baseline acceptance path:

```text
Fresh checkout â†’ install deps â†’ configure â†’ build â†’ run tests â†’ launch
```

### `UNDATED--FOUNDATION--UNDATED--FOUNDATION--implementation-plan.md` â€” phases in dependency order

Order by dependency and architectural stability, not by which feature is most interesting.

For each phase:

```text
Purpose Â· Prerequisites Â· Dependencies Â· Files/directories allowed to change Â·
Systems involved Â· Outputs Â· Acceptance criteria Â· Verification commands
```

Every phase must leave a repository that still builds. Each phase becomes one Stage 5 run.

---

## Â§4 â€” Baseline boundary and placeholders

Distinguish `ARCHITECTURAL BASELINE` from `FUNCTIONAL IMPLEMENTATION`. The first must be
stable before the second starts.

The baseline proves: repository exists Â· build works Â· dependencies resolve Â· interfaces exist Â·
subsystems exist Â· integrations connect Â· the application starts Â· tests execute.

The baseline does **not** need: complete algorithms Â· complete UI Â· advanced features Â·
optimisation Â· production data Â· polished UX Â· speculative abstractions.

**Placeholder policy.** For functionality that belongs to the architecture but not the
baseline, specify the mechanism: interface + stub Â· null implementation Â· mock service Â·
placeholder endpoint Â· runtime-disabled feature.

A placeholder must communicate both *the architecture exists* and *the feature is not
implemented yet*. Never let a placeholder look like working functionality â€” a stub that
returns plausible fake data will be mistaken for a finished feature, and the bug surfaces
in the demo.

---

## Â§5 â€” Architecture drift rules

Write these into `UNDATED--CURRENT--project-context.md` so Stages 4 and 5 inherit them.

```text
Agents MAY:
  implement existing interfaces Â· add private implementation detail Â· add tests Â·
  add files within extensible directories Â· fix defects Â·
  improve internal algorithms without changing contracts

Agents MAY NOT silently:
  rename architectural classes Â· move fixed directories Â· change technologies Â·
  replace frameworks Â· change protocols Â· change public contracts Â·
  add major dependencies Â· create new top-level systems Â·
  create undocumented integration paths Â· change subsystem responsibilities
```

When implementation requires an architectural change:

```text
STOP â†’ REPORT CONFLICT â†’ DESCRIBE REQUIRED CHANGE â†’ WAIT FOR DECISION
```

### Trivial-change exemption

A change confined to one file, adding no new class/function/interface, under ~20 lines, needs
no skeleton â€” typo fixes, a debug print, a constant, filling in a body already agreed.

If a "trivial" change starts growing past that, **stop and skeleton it.** The exemption is for
genuinely small edits, not a loophole for shipping design decisions unreviewed.

---

## Â§6 â€” Naming consistency

One canonical name per system, used identically across every document:

```text
RuntimeApplication    EntityRegistry    RenderSystem    NetworkSubsystem
```

Never alternate `RuntimeManager` / `RuntimeController` / `RuntimeSystem` for one thing. A later
agent reading two names assumes two systems and builds the second one.

---

## Â§7 â€” Consistency and feasibility check

Before declaring the package complete, verify these do not contradict each other:

| Pair | Check |
|---|---|
| Scope â†” Architecture | Every required capability has an architectural home |
| Architecture â†” Repository | Every component has a location |
| Architecture â†” Contracts | Every boundary has an interface |
| Tech Stack â†” Integration | Every technology has a place in the graph |
| Integration â†” Contracts | Every communication path has a data contract |
| Build â†” Tech Stack | Everything selected can actually be built |
| Testing â†” Architecture | Every important boundary is testable |
| Plan â†” Dependencies | Phases are in valid dependency order |

Then answer, honestly:

```text
Can the repository structure physically represent the architecture?
Can all selected technologies coexist?
Can all declared integrations be established?
Are dependency directions valid and acyclic?
Can the baseline build and run without future functionality?
Can each subsystem be implemented independently?
Can a new agent understand one subsystem without reading the whole project?
Can the baseline be extended without restructuring?
```

Any `NO` or `UNCERTAIN` gets documented. Do not hide unresolved architecture â€” it does not
become easier to fix once there is code sitting on top of it.

---

## Â§8 â€” Constraint: do not over-engineer

Do not optimise for hypothetical future requirements. Add an extension point only where
justified by current requirements, a known integration, a clearly identified future phase, or
a necessary boundary.

The objective is `Stable Â· Understandable Â· Buildable Â· Extensible Â· Verifiable`.
Not `Maximally abstract Â· Maximally flexible`.

Three similar lines beat a premature abstraction.

---

## Closing block

```text
# Pre-Baseline Validation

STATUS: READY | BLOCKED

Skeleton reviewed by human:   yes / no        <- READY requires yes

Scope            PASS / FAIL
Technology       PASS / FAIL
Architecture     PASS / FAIL
Repository       PASS / FAIL
Integrations     PASS / FAIL / N-A
Contracts        PASS / FAIL / N-A
Dependencies     PASS / FAIL
Build            PASS / FAIL     Command: <exact>   Verified: yes / no
Testing          PASS / FAIL
Implementation   PASS / FAIL

Patterns flagged UNFAMILIAR:  ...
/learn runs completed:        ...
Unresolved decisions:         ...
Architectural risks:          ...
Required human decisions:     ...
Non-obvious tradeoffs:        ...

BASELINE READINESS: READY / NOT READY
```

`READY` only when no unresolved issue could reasonably force the baseline to be restructured â€”
**and only after I have read and approved the skeleton.** An unreviewed skeleton is never
`READY`, however complete it looks.

---

## Handoff

Skeleton approved is the single most important handoff trigger. Run `/handoff` to refresh
`SESSION.md`, then `/compact` or `/clear` before Stage 4 starts.

Stage 4 should work from the documents, not from this conversation. If it can't, the documents
aren't finished.
