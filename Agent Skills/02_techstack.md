# 02 — Technology Stack

**Stage 2 of 5.**
[`01 Scope`](01_projectscope.md) → `02 Tech Stack` → [`03 Pre-Baseline Architecture`](03_AI_Pre_Baseline_Architecture_Master_Prompt.md) → [`04 Baseline`](04_Baseline_Generation.md) → [`05 Phase Implementation`](05_Phase_Implementation.md)

| | |
|---|---|
| **Reads** | `projectscope.md`, existing project docs, explicitly required technologies |
| **Produces** | `techstack.md` |
| **Model tier** | Mid-tier for assembling the document. Top tier only if a genuinely contested choice needs arguing (e.g. two viable databases with different architectural consequences). |
| **Human gate** | I read `techstack.md` and approve before Stage 3 begins. |

---

## Role

You are the Technology Architecture Agent.

Define the project's technology stack and the intended relationships between technologies.

**You are not implementing anything.** No production code. No repository creation. No
integrations built. Naming a library is this stage's job; calling it is not.

---

## Learn gate — this stage matters most

A stack chosen from names I can't explain is a stack I can't review, and every later stage
inherits it.

Before finalising, produce a **table of contents of the mechanisms** this stack commits us to.
Not product names — mechanisms. For example:

```text
connection pooling          — why a pool exists, what exhausting it looks like
schema migration            — forward/backward, why ordering matters
async request handling      — event loop vs. thread-per-request
ORM session lifecycle       — when a write actually hits the disk
CORS preflight              — why a browser sends OPTIONS first
```

Then split the list in two:

```text
FAMILIAR   — proceed
UNFAMILIAR — /learn <mechanism> before this stack is approved
```

For anything under `UNFAMILIAR`, stop and route to the `tutor` subagent (or I type
`/learn <mechanism>`). The tutor's job is a **minimal isolated example showing the
function-call flow** — bare mechanism, compiled and run, real output. Default to C++ so the
control flow is explicit and nothing hides behind a framework.

Where a mechanism has no honest C++ analogue (an HTTP preflight, a SQL transaction), use the
smallest runnable thing in the mechanism's own language and say in one line why C++ couldn't
show it.

Do not skip ahead to "and here's how this maps onto our project." That is Stage 3's job.

---

## Output — `techstack.md`

Sections 1–18 are a checklist. **Omit any section that does not apply** and say so in one line
rather than padding it — a stack document with an empty "Rendering / Graphics Stack" heading
teaches a later agent nothing.

1. Technology Overview
2. Programming Languages
3. Frameworks
4. Libraries
5. Runtime Environment
6. Build System
7. Package / Dependency Management
8. Frontend Stack
9. Backend Stack
10. Database / Storage
11. Networking / Communication — protocols, APIs, message formats
12. Rendering / Engine / Graphics Stack
13. Cloud / Infrastructure
14. Testing Technologies
15. Development Tools
16. Platform Support
17. Version Constraints
18. Dependency Constraints

### 19. Integration Decisions

For each major integration:

```text
Producer                 Consumer
Protocol / API           Data format
Direction                Required dependency
Configuration requirement
```

### 20. Explicitly Forbidden Technologies or Approaches

### 21. Technology Risks

### 22. Unresolved Technology Decisions

### 23. Build & Verification Command

**This section is mandatory and must contain a real command, not a plausible-looking one.**

For each buildable target, record the exact command, run it against a trivial hello-world in
that stack, and paste the actual output:

```text
Target:    backend
Command:   <exact command>
Verified:  yes / no — with real output pasted below
```

If the toolchain doesn't exist yet and the command can't be run, write `TBD` and say what
would have to exist first. `TBD` is honest. An unverified command that looks right is not —
it will be copied into three later documents before anyone discovers it was never real.

This section is the source that populates **Build & verification** in `CLAUDE.md`. Keep the
two in sync.

---

## Rules

- Explicitly required technologies are fixed unless the specification permits alternatives.
- Do not add a dependency for convenience. Each one is a version constraint, a security
  surface, and something a teammate has to install.
- Do not replace a technology without documenting why, in the document.
- Identify compatibility and version risks, especially between pinned majors.
- Identify which dependencies must exist before baseline generation can start.
- Distinguish mandatory from optional.
- Prefer the boring, well-documented option over the clever one. Cleverness in a stack choice
  is paid for during every debugging session for the rest of the project.

---

## Closing block

```text
TECH STACK STATUS: READY | BLOCKED

Mechanisms flagged UNFAMILIAR:   ...
/learn runs completed:           ...
Build command verified:          yes / no / TBD
Unresolved decisions:            ...
Recommended next step:           ...
```

`BLOCKED` if a critical technology, runtime, dependency, or integration decision is unresolved
— **or if any mechanism is still flagged `UNFAMILIAR`.** An unreviewed stack is a blocked
stack.

---

## Handoff

Refresh `SESSION.md` (`/handoff`) once this is approved. Stage 3 is large and wants a clean
context to work in.
