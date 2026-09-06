# 03 — Pre-Baseline Architecture

**Stage 3 of 5.**
[`01 Scope`](01_projectscope.md) → [`02 Tech Stack`](02_techstack.md) → `03 Pre-Baseline Architecture` → [`04 Baseline`](04_Baseline_Generation.md) → [`05 Phase Implementation`](05_Phase_Implementation.md)

| | |
|---|---|
| **Reads** | `projectscope.md`, `techstack.md`, existing code/build/config |
| **Produces** | The skeleton, plus the supporting documents it needs — see §3 |
| **Model tier** | **Top tier.** This is the genuinely hard, ambiguous design work. This is the stage worth paying for. |
| **Subagent** | `architect` (pinned to opus). Brief it per §0. |
| **Human gate** | **Hard stop.** I read the skeleton like a PR before any code is written anywhere. |

---

## The point of this stage

Changing a skeleton is free. Changing code is not.

Everything here exists to make Stage 4 deterministic — so the baseline agent implements
decisions rather than making them.

**The skeleton is the deliverable.** The documents in §3 exist to support the skeleton and to
survive a context reset. They are not the product. Do not generate a document because the list
mentions it; generate it because a later agent would otherwise guess.

---

## §0 — Briefing the architect subagent

`architect` starts with **zero context.** It sees none of the conversation — only the prompt
it is handed plus the files it opens. A one-line prompt produces a design against a guess.

Hand it, explicitly:

```text
Objective        — one paragraph: what is being designed and why
Source of truth  — paths to projectscope.md and techstack.md
Existing state   — paths to any code, build files, config that already exist
Constraints      — the fixed technology decisions it may not revisit
Non-goals        — what is explicitly out of scope (from scope §6)
Deliverable      — "skeleton per §2 of 03_AI_Pre_Baseline_Architecture_Master_Prompt.md"
Topic SESSION.md — path, if one exists
```

If `SESSION.md` is stale, refresh it *before* spawning. A subagent working from a stale
handoff designs against the wrong plan, and the mistake is invisible until review.

If this session is configured not to spawn subagents unless asked, **ask first** — that
setting overrides any "use proactively" guidance.

---

## §1 — Read and analyse before designing

Read `projectscope.md` and `techstack.md`. Also read any existing `README.md`, `docs/`,
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

Tag everything `REQUIRED` · `OPTIONAL` · `FUTURE` · `UNDEFINED` · `FORBIDDEN`.
Do not promote optional or future functionality into baseline requirements.

### Learn gate

List the **architectural patterns** this design commits us to — repository pattern, dependency
injection, event loop, connection pooling, whatever applies. Split `FAMILIAR` / `UNFAMILIAR`.

For anything `UNFAMILIAR`, stop and route to `tutor` (`/learn <pattern>`) **before** the
skeleton is designed, not after. The order is `learn → skeleton → implement → review`, and it
does not bend because the schedule is tight.

The tutor gives a minimal isolated example showing the function-call flow — bare mechanism,
compiled, real output, default C++. Not project code. Mapping the pattern onto this project is
*this* stage's job, and it happens after the mechanism is understood, not instead of it.

---

## §2 — The skeleton (the actual deliverable)

A skeleton is three things and no more:

### 2a. Module / file boundaries and responsibilities

For each major subsystem:

```text
Name                       — the canonical name, used everywhere (see §6)
Purpose                    — one sentence
Responsibilities           — what lives here
Non-responsibilities       — what must NOT live here, even when convenient
Owned state                — what it alone may mutate
Inputs / Outputs
Allowed dependencies
Forbidden dependencies
Repository location        — the path this occupies
```

The `Non-responsibilities` and `Forbidden dependencies` lines are the load-bearing ones. Any
document can say where a responsibility lives. The value is in saying where it must not drift
to when an implementer finds it convenient.

### 2b. Class / interface signatures — no bodies

Signatures only. Types, names, parameters, return types, errors. No implementation.

For each important type:

```text
Class / interface
Purpose
Ownership              — who constructs it, who owns its lifetime
Public API             — signatures only
Dependencies           — what it needs injected
State
Construction / lifecycle
Threading assumptions  — if relevant
Forbidden responsibilities
```

Small types with one clear responsibility. Prefer composition over inheritance unless
inheritance genuinely models the domain. Match the conventions already in the codebase over
personal preference.

### 2c. Data flow between the major pieces

A short note — prose or a diagram — tracing how data actually moves:

```text
Frontend
    ↓ HTTP / JSON
Backend API
    ↓ validated DTO
Simulation Engine
    ↓ result object
Serializer
    ↓ SQL
Database
```

State the direction, the format at each hop, and where validation and trust boundaries sit.
Name the cycles you checked for and confirm none exist, or justify any that do.

**Flag every non-obvious tradeoff here, explicitly, at skeleton stage.** Not buried in a code
comment three weeks later where nobody reviewing the design will see it.

---

## §3 — Supporting documents: scale to the project

Generate what the project needs. **Do not generate all of these by default.**

**Always:**

```text
docs/PROJECT_CONTEXT.md     — the orientation doc; first thing any agent reads
docs/architecture.md        — §2a and §2c, written down
docs/repository.md          — intended tree, with FIXED / EXTENSIBLE / GENERATED / OPTIONAL
docs/build-system.md        — the real build/test/run commands, verified
docs/implementation-plan.md — bounded phases, in dependency order
```

**When the project actually has them:**

```text
docs/contracts.md           — when two subsystems talk across a stable interface
docs/integration.md         — when there are external systems, services, or processes
docs/dependency-graph.md    — when the dependency structure isn't obvious from architecture.md
docs/testing-strategy.md    — when testing is more than "run the test command"
docs/subsystems/<name>.md   — ONLY when a subsystem is complex enough that its interfaces
                              and boundaries need defining independently
```

A three-subsystem project does not need eleven documents. Duplicated planning documents drift
apart, and then nobody knows which one is true.

### `PROJECT_CONTEXT.md` — keep it short

Identity · purpose · current phase · high-level architecture · major subsystems · stack ·
major integrations · key constraints · baseline status · **build/test/run entry points** ·
pointers to deeper docs.

This is the first document an implementation agent reads. If it is long, it will be skimmed.

### `repository.md` — classify every important path

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

### `build-system.md` — named checks, actually run

Carry the verified commands forward from `techstack.md` §23. Same rule applies: **run them,
paste real output.** Do not invent a plausible compile line.

Define the baseline acceptance path:

```text
Fresh checkout → install deps → configure → build → run tests → launch
```

### `implementation-plan.md` — phases in dependency order

Order by dependency and architectural stability, not by which feature is most interesting.

For each phase:

```text
Purpose · Prerequisites · Dependencies · Files/directories allowed to change ·
Systems involved · Outputs · Acceptance criteria · Verification commands
```

Every phase must leave a repository that still builds. Each phase becomes one Stage 5 run.

---

## §4 — Baseline boundary and placeholders

Distinguish `ARCHITECTURAL BASELINE` from `FUNCTIONAL IMPLEMENTATION`. The first must be
stable before the second starts.

The baseline proves: repository exists · build works · dependencies resolve · interfaces exist ·
subsystems exist · integrations connect · the application starts · tests execute.

The baseline does **not** need: complete algorithms · complete UI · advanced features ·
optimisation · production data · polished UX · speculative abstractions.

**Placeholder policy.** For functionality that belongs to the architecture but not the
baseline, specify the mechanism: interface + stub · null implementation · mock service ·
placeholder endpoint · runtime-disabled feature.

A placeholder must communicate both *the architecture exists* and *the feature is not
implemented yet*. Never let a placeholder look like working functionality — a stub that
returns plausible fake data will be mistaken for a finished feature, and the bug surfaces
in the demo.

---

## §5 — Architecture drift rules

Write these into `PROJECT_CONTEXT.md` so Stages 4 and 5 inherit them.

```text
Agents MAY:
  implement existing interfaces · add private implementation detail · add tests ·
  add files within extensible directories · fix defects ·
  improve internal algorithms without changing contracts

Agents MAY NOT silently:
  rename architectural classes · move fixed directories · change technologies ·
  replace frameworks · change protocols · change public contracts ·
  add major dependencies · create new top-level systems ·
  create undocumented integration paths · change subsystem responsibilities
```

When implementation requires an architectural change:

```text
STOP → REPORT CONFLICT → DESCRIBE REQUIRED CHANGE → WAIT FOR DECISION
```

### Trivial-change exemption

A change confined to one file, adding no new class/function/interface, under ~20 lines, needs
no skeleton — typo fixes, a debug print, a constant, filling in a body already agreed.

If a "trivial" change starts growing past that, **stop and skeleton it.** The exemption is for
genuinely small edits, not a loophole for shipping design decisions unreviewed.

---

## §6 — Naming consistency

One canonical name per system, used identically across every document:

```text
RuntimeApplication    EntityRegistry    RenderSystem    NetworkSubsystem
```

Never alternate `RuntimeManager` / `RuntimeController` / `RuntimeSystem` for one thing. A later
agent reading two names assumes two systems and builds the second one.

---

## §7 — Consistency and feasibility check

Before declaring the package complete, verify these do not contradict each other:

| Pair | Check |
|---|---|
| Scope ↔ Architecture | Every required capability has an architectural home |
| Architecture ↔ Repository | Every component has a location |
| Architecture ↔ Contracts | Every boundary has an interface |
| Tech Stack ↔ Integration | Every technology has a place in the graph |
| Integration ↔ Contracts | Every communication path has a data contract |
| Build ↔ Tech Stack | Everything selected can actually be built |
| Testing ↔ Architecture | Every important boundary is testable |
| Plan ↔ Dependencies | Phases are in valid dependency order |

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

Any `NO` or `UNCERTAIN` gets documented. Do not hide unresolved architecture — it does not
become easier to fix once there is code sitting on top of it.

---

## §8 — Constraint: do not over-engineer

Do not optimise for hypothetical future requirements. Add an extension point only where
justified by current requirements, a known integration, a clearly identified future phase, or
a necessary boundary.

The objective is `Stable · Understandable · Buildable · Extensible · Verifiable`.
Not `Maximally abstract · Maximally flexible`.

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

`READY` only when no unresolved issue could reasonably force the baseline to be restructured —
**and only after I have read and approved the skeleton.** An unreviewed skeleton is never
`READY`, however complete it looks.

---

## Handoff

Skeleton approved is the single most important handoff trigger. Run `/handoff` to refresh
`SESSION.md`, then `/compact` or `/clear` before Stage 4 starts.

Stage 4 should work from the documents, not from this conversation. If it can't, the documents
aren't finished.
