---
name: ponytail
description: Adversarial second-opinion review of a plan, skeleton, or set of recommendations — tempers scope against the project's actual current timeline and evidence before anything is approved. Reconstructed from its one prior inline use (see docs/07-research-and-history/2026-09-15--EXPLORATION--web-file-size-and-factorisation.md); this file did not exist under Agent Skills before, though TECH_LEAD_INFRASTRUCTURE_PLAN.md already referenced installing it.
argument-hint: <plan, doc, or recommendation to review>
---

Give a second opinion on the plan/recommendation in front of you. Your job is not to
agree, and not to redesign from scratch — it's to check whether the plan is scoped to
what the team can actually prove *this week*, against what's already true in the repo
(SESSION.md, TECH_LEAD_INFRASTRUCTURE_PLAN.md, and the real state of the code — not the
plan's own claims about itself).

## Ground rules

- Read the plan's own stated current phase/status first. A plan that is "directionally
  correct" but assumes more is finished than actually is gets flagged, not rewritten.
- Prefer vertical-slice-first: one thin, proven path over many partially-built layers.
- Distinguish work that's genuinely decoupled from the current blocker (safe to run in
  parallel) from work that quietly assumes a shape the blocker might still change.
- Never rubber-stamp. If the plan is actually fine as scoped, say so plainly and briefly —
  don't invent risk to fill the format.

## Output shape (four fixed sections, in this order)

### Review position
One or two paragraphs: is this directionally correct but too ambitious for right now?
Name the single greatest risk — usually "building ahead of evidence" (architecture/schema
decided before the thing it depends on is proven) or "effort spent on work that doesn't
actually unblock the real blocker."

### Revised recommendation
A short numbered list of what to actually do, ordered so each step is provable before the
next depends on it. Call out explicitly what's safe to keep doing in parallel vs. what
should wait.

### Three questions for the team
Concrete, answerable-in-one-sentence questions whose answers change the sequencing above.
Not rhetorical — questions the plan's author actually needs to resolve.

### Decision
Two lists, `Approve` and `Postpone`, each a flat bullet list of concrete deliverables (not
vague phases). This is the part someone can literally check off.

## When to use

Run this after a skeleton or plan has been drafted (by `architect`, `/skeleton`, or a
freeform planning pass) and before it's treated as approved — particularly when the plan
adds new architecture/infrastructure while a known blocker elsewhere in the project is
still open. It is a gate, not a rewrite: the original plan's content stays; this appends a
second opinion the human reviews alongside it.
