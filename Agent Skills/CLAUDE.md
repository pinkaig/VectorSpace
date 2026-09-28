# Project Memory

## Gate — clarify before generating
Do not generate code, a skeleton, or learning material until the objective is clear:
what topic/subsystem, and which mode — learn (tutor) or build (architect/skeleton).

If it's ambiguous, don't produce output. Instead respond with:
1. A one-line restatement of what you think I'm asking, so I can correct it
2. The recommended next command (e.g. `/learn X` or `/skeleton Y`)
3. If I seem stuck (vague request, or I say so directly), 2-3 example prompts I could paste
   as-is to get moving

Keep it to those three. The full orientation checklist (agents, cost, context) lives in
`/next` — don't front-load it onto every vague opener.

This gate applies to the *first* ambiguous ask in a topic, not every follow-up — once the
objective is clear, keep working without re-litigating it every turn.

## Contract (non-negotiable)
- Never write implementation code until a skeleton has been proposed and I've approved it.
  A skeleton = module/file boundaries + responsibilities, class/interface signatures (no bodies),
  and a short note on data flow between the major pieces.
  - **Exemption for trivial changes:** a change confined to one file, adding no new
    class/function/interface, and under ~20 lines needs no skeleton — typo fixes, a debug
    print, adjusting a constant, filling in a body we already agreed on. Also exempt when I
    say "just do it." If a "trivial" change starts growing past that, stop and skeleton it.
- Prefer simple, readable code over clever code. If a "clean" solution needs a comment to explain
  a trick, prefer the less clever version instead.
- Small functions/classes with one clear responsibility. Prefer composition over inheritance
  unless inheritance clearly models the domain.
- Match the existing style/conventions of the codebase over personal preference.
- Before marking anything done, name the check that proves it works (test, build, manual repro)
  and actually run it. Don't say "this should work." See Build & verification.

## Workflow
1. Explore — understand relevant existing code first (use a subagent for anything that means
   reading many files just to answer one question).
2. Skeleton — propose module boundaries, signatures, and data flow. Use the `architect` subagent
   or `/skeleton` command for this step on anything non-trivial (3+ files or new architecture).
3. Review — I read the skeleton like a PR before any code is written. Changing a skeleton is free;
   changing code is not.
4. Implement — fill in the approved skeleton.
5. Review again — use the `code-reviewer` subagent on the change before calling it done.

### Subagents start with zero context
`tutor`, `architect`, and `code-reviewer` see none of our conversation — only the prompt they're
handed plus files they read. So when spawning one, pass it explicitly: the objective, the approved
skeleton (or point it at the topic's `SESSION.md`), and the specific files involved. A subagent
given a one-line prompt will design or review against a guess.

This is the real reason `SESSION.md` matters — it's not just a `/clear` artifact, it's the payload
handed to subagents. If it's stale, they work off the wrong plan.

### Proactive vs. ask-first
If the session is configured to not spawn subagents unless asked, that setting wins over
"use proactively" here — ask first, don't auto-route. If I say "proactive agents on," treat
that as standing authorization for the rest of the session and route without asking.

## Build & verification
"Name the check and run it" only works if the check is written down. Record the real command
per topic here as each one gets its first buildable code — don't invent a plausible-looking
compile line at review time.

- **Learning C++** — `g++ -std=c++20 -Wall -Wextra -o <out> <file>.cpp && ./<out>`
- **OS Thread Programming** — `g++ -std=c++20 -Wall -Wextra -pthread -o <out> <file>.cpp && ./<out>`
- **Networking** — TBD (record the actual command once the first target exists)

If a topic's command is still TBD and something needs verifying, propose a command, run it,
and record what worked — don't skip the verification step and don't claim success without it.

## Learning mode
I'm a student, still building breadth across backend/web/systems/data. I think in C/C++:
low-level, explicit control flow, not framework abstraction. When I'm unfamiliar with a
concept, pattern, or subsystem I'm about to build:
- Use the `tutor` subagent (or I'll type `/learn <topic>`) BEFORE the architect/skeleton step.
- I want a table of contents of the concepts involved, then a minimal, isolated C++ example
  showing the function-call flow — not the real project's code or language, just the bare
  mechanism. Compile and run it; show me real output, not a snippet that merely looks right.
  This is how I build a mental model before applying it for real.
- Don't skip straight to "how this maps onto the project" — that's the architect agent's job,
  a separate step, only once I understand the mechanism in isolation.
- Order for anything genuinely new to me: learn (tutor) → skeleton (architect) → implement →
  review (code-reviewer). For familiar territory, skip straight to skeleton.

## Cost awareness
Before starting non-trivial work, name which model tier the task actually needs — don't
default to the most expensive one "just in case":
- Learning/explaining (tutor), boilerplate, small edits → cheapest capable model
- Skeleton design, code review → mid-tier is usually enough
- Reserve the top-tier model for genuinely hard or ambiguous design decisions
- Subagent tiers are already pinned in their frontmatter (tutor/code-reviewer: sonnet,
  architect: opus). The tier note is about the *main session* model — which only I can change
  via `/model`. You recommend; you can't switch yourself, so say it plainly instead of implying
  you've handled it.
- On long sessions, remind me to run `/cost` so spend doesn't surprise me
- If a task's scope grew mid-session past what the current model tier is suited for, say so
  and suggest switching, rather than pushing on with a mismatched model

## Context management
You don't get a reliable numeric read on remaining context, so don't pretend to watch a gauge.
Use event triggers instead — recommend `/handoff` (then `/compact` or `/clear`) when any of these
happens:
- A skeleton has just been approved, before implementation starts
- A subsystem or topic is finished
- We're about to switch topic directories
- I ask to "hand this off," or I'm about to `/clear` on substantial work
- The session has clearly gone long (many files touched, several distinct sub-tasks)

Handoff file: `SESSION.md` **inside the topic directory** (`Networking/SESSION.md`,
`OS Thread Programming/SESSION.md`, `Learning C++/SESSION.md`) — not one shared file at the root,
since the topics would overwrite each other. Keep it factual and objective, no conversational
filler:
  - Objective / topic
  - Decisions made and why
  - Current skeleton/plan state — what's approved, what's pending, what's implemented
  - Build/verify command, and whether it currently passes
  - Files touched
  - Failed approaches already tried, briefly
  - Open questions
  - Next recommended step

Use `/handoff` to generate or refresh it on demand.

## Compact Instructions
When compacting this conversation, always preserve:
- The current approved skeleton/plan and which parts are implemented vs. pending
- Any architecture decisions and their rationale
- Modified files and outstanding TODOs
- Failed approaches already tried, briefly (so they aren't retried)

## Notes for small-team context
- Write code and commit messages a teammate could review without me in the room.
- Flag any non-obvious tradeoff explicitly in the skeleton stage, not buried in code comments.
