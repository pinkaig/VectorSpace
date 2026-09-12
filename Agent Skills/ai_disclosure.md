---
name: ai-disclosure
description: Generates and edits AI-use disclosure statements, attestations, and "AI Declaration" sections for coursework, capstone projects, and software deliverables. Use this whenever the user asks to write, add, update, or review an AI disclosure, AI attestation, "how I used AI" statement, or AI declaration — especially for DigiPen/Singapore academic submissions, README/ARCHITECTURE docs, or game vs non-game project deliverables. Also trigger when the user wants an existing document (README, submission notes, ARCHITECTURE_OVERVIEW, project report) edited to insert or refresh an AI disclosure section, or wants help deciding which disclosure standard (Singapore IMDA/PDPA, EU AI Act Article 50, or Steam-style player-facing disclosure) applies to their project. Push to use this skill even if the user just says "add an AI disclosure" or "write my AI declaration" without naming a framework.
---

# AI Disclosure & Declaration Generator

Produces two related but distinct artifacts, and edits existing documents to insert or refresh them:

1. **AI Disclosure** — a compliance-style statement describing *what* AI was used for, matched to the regulatory/platform standard that applies to the project (Singapore IMDA Gen AI framework + PDPA data-care, EU AI Act Article 50 transparency, or Steam's player-facing content policy).
2. **AI Declaration** — a short, first-person reflective statement of *how* AI was used and *what was verified*. Not a confession, not defensive — a factual record that shows understanding and ownership of the work, in the spirit of "you can't blame AI for the work; you are accountable."

## Core principle: disclosure is not incrimination

Every output from this skill follows this tone:
- State facts plainly. No hedging, no over-apologizing, no legalistic self-defense.
- Never imply the AI use itself was improper. The default assumption is that AI use is expected and normal — the disclosure exists so others can calibrate trust, not so the author can be caught out.
- Always pair *what AI did* with *what the human verified*. A disclosure without a verification statement is incomplete — the person, not the AI, is accountable for the final work.
- Keep it specific enough to be useful (which components, which tool, what kind of assistance) and short enough to be read. A few sentences to a short paragraph per component is normal; avoid padding.

## Workflow

### Step 1 — Gather the facts

Before drafting anything, get (ask the user directly if not already given in conversation — this is the one part of the process that can't be inferred):
- **What was AI used for**, broken down by component if it varies (e.g. "boilerplate subsystem scaffolding," "debugging a build error," "drafting documentation," "generating dialogue text players will see").
- **Which tool(s)** (e.g. Claude, GitHub Copilot, ChatGPT) — name-level detail is fine, version-level only if the user has it handy.
- **What was reviewed/verified by the human** — read through, tested, compiled, cross-checked against spec, rewritten, etc. This is the most important field; do not let the user skip it.
- **Whether any personal data or others' unpublished work was ever put into a prompt.** If yes, flag it — this is a PDPA (Singapore) / GDPR (EU) issue independent of AI disclosure, and the answer here changes what the data-care line of the disclosure says. Never write "no personal data was used" unless the user confirms it.
- **Project type**: game (player-facing content matters) vs non-game software vs academic assignment. This determines which template applies (Step 2).
- **Where this is going**: a standalone declaration file, a section in an existing doc (README, report, submission form), or both.

If the user has already described all of this earlier in the conversation, don't re-ask — extract it and confirm briefly before drafting.

### Step 2 — Pick the standard

Default to **Singapore IMDA + PDPA** unless the project or user points elsewhere. Use this decision order:

| Situation | Use |
|---|---|
| Non-game software project, academic submission graded in Singapore, or no stated jurisdiction | `references/singapore-imda-template.md` |
| Game shipping to Steam, or AI content players will see/hear (art, audio, dialogue, live-generated NPC text) | `references/steam-template.md` — note this only covers *player-facing* content; code-assist tools are explicitly exempt under Steam's policy, so pair it with the Singapore or declaration template for the dev-process side |
| Product/user base is EU-facing, or user explicitly asks for GDPR/EU AI Act framing | `references/eu-ai-act-template.md` |
| User wants the personal reflective statement regardless of jurisdiction | `references/ai-declaration-template.md` — this pairs with any of the above; it's not a substitute for the jurisdictional disclosure |

If the project spans categories (e.g. a game with both AI-assisted code and AI-generated player-facing art), use more than one template and say so — don't force one framework to cover content it wasn't designed for.

If genuinely unclear which applies, ask one question rather than guessing — this determines the whole document's structure.

### Step 3 — Draft or edit

**New document:** read the relevant template(s) in `references/`, fill every bracketed field from Step 1, and remove any section that doesn't apply (don't leave placeholder text in the output). Output as a markdown file by default; if the user wants `.docx` output, use the docx skill to convert after drafting the content here.

**Editing an existing document:** locate (or ask where) the file lives, read it, and insert the disclosure as a clearly labeled section (`## AI Disclosure` / `## AI Declaration`) rather than scattering AI-use notes through the body. If a disclosure section already exists, update it in place — check for stale claims (e.g. a tool no longer used, a component description that no longer matches the code) rather than only appending new ones.

### Step 4 — Sanity check before handing back

- Every claim of "verified" or "tested" should be something the user actually told you they did — don't invent verification steps.
- Read the draft back once for tone: does it read as a confident, factual record, or does it read defensive/apologetic? Fix any hedging.
- If the data-care flag from Step 1 came back "yes" (personal data or others' work was put into a prompt), make sure that's surfaced clearly rather than buried — this is the one thing that actually carries risk.

## Reference files

- `references/singapore-imda-template.md` — Singapore IMDA Gen AI framework + PDPA-aligned disclosure (default)
- `references/eu-ai-act-template.md` — EU AI Act Article 50 transparency-style disclosure
- `references/steam-template.md` — Steam player-facing AI content disclosure (pre-generated / live-generated split)
- `references/ai-declaration-template.md` — first-person reflective AI Declaration, framework-agnostic
