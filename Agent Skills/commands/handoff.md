---
description: Write or refresh the topic's SESSION.md so a fresh session or subagent can pick up cold
argument-hint: [topic dir, if not obvious from context]
---

Generate or refresh `SESSION.md` inside the topic directory we're working in
(e.g. `Networking/SESSION.md`, `OS Thread Programming/SESSION.md`) — not at the project root.
If the topic isn't clear from context or from $ARGUMENTS, ask which one before writing.

Keep it factual and objective, no conversational filler — this needs to be readable by a fresh
session or a subagent with zero prior context. Include:

- Objective / topic
- Decisions made and why
- Current skeleton/plan state — what's approved, what's pending, what's implemented
- Build/verify command for this topic, and whether it currently passes
- Files touched this session
- Failed approaches already tried, briefly (so they aren't retried)
- Open questions
- Next recommended step

After writing it, tell me in one line whether it's now safe to /clear.
