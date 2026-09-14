# Singapore IMDA / PDPA-Aligned AI Disclosure Template

Use for non-game software projects, academic submissions assessed in Singapore, or whenever no other jurisdiction is specified. Loosely mirrors the disclosure dimension of IMDA's Model AI Governance Framework for Generative AI (what was used, how it was evaluated/reviewed, what safeguards applied) plus a PDPA data-care line.

Fill every bracket. Delete any subsection that doesn't apply — don't leave placeholders in the final output.

---

## AI Disclosure

**Project:** [project name]
**Author(s):** [name(s)]
**Date:** [date]

### Summary of AI use

[One or two sentences: overall, what role did AI play in this project — e.g. "AI tools were used to generate initial scaffolding for several C++ subsystems and to assist with debugging build configuration issues. All generated code was reviewed, compiled, and tested by the author before inclusion."]

### Breakdown by component

For each distinct area where AI was used, one entry:

- **Component:** [e.g. "UBackendApiSubsystem scaffolding"]
  **Tool used:** [e.g. Claude / GitHub Copilot]
  **Nature of assistance:** [e.g. "generated initial class structure and method stubs from a written spec"]
  **Human verification:** [e.g. "reviewed line-by-line, compiled, tested navigation flow end-to-end, modified error handling before merge"]

(Repeat as needed. If AI was used uniformly across the codebase rather than in distinct components, one combined entry describing the general pattern of use is fine.)

### What was not AI-assisted

[Optional but often useful for credibility — e.g. "System architecture decisions, the subsystem interface design, and all Blueprint wiring were done manually."]

### Data care

[One of:]
- "No personal data, personally identifiable information, or other individuals' unpublished work was input into any AI tool during this project."
- "The following data was input into an AI tool: [describe]. This was [anonymised / a description without identifying details / etc.]." — only use this branch if the user has actually confirmed data went in; never assume the clean answer.

### Accountability statement

"This disclosure reflects the author's understanding of how AI was used in this project. The author has reviewed and verified all AI-assisted output included here and takes full responsibility for the final work, consistent with the expectation that AI use does not transfer accountability away from the author."

---

## Notes for the drafter (delete before finalizing)

- IMDA's Gen AI framework disclosure principle is about giving downstream reviewers (in this case, a grader or a future employer) enough information to calibrate trust — not about maximizing hedging language.
- The "human verification" field is the one graders/employers actually care about; don't let it default to something vague like "checked it."
- If this project also has a Steam-facing component (game with player-visible AI content), don't try to cover that here — use `steam-template.md` for that slice and cross-reference it.
