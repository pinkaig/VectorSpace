# EU AI Act (Article 50 Transparency) — AI Disclosure Template

Use only when the project is EU-facing (users, market, or the user explicitly asked for GDPR/EU AI Act framing). Article 50 of the EU AI Act covers transparency obligations for certain AI systems — informing natural persons they are interacting with an AI system, and labelling AI-generated or manipulated content. This template adapts that spirit for a software project disclosure rather than reproducing the regulation itself.

Fill every bracket. Delete subsections that don't apply.

---

## AI Disclosure (EU AI Act Article 50 — Transparency)

**Project:** [project name]
**Author(s):** [name(s)]
**Date:** [date]

### Interaction transparency

[If the product itself involves a user interacting with an AI system — e.g. a chatbot, generative feature, or automated decision element — state it plainly: "Users interacting with [feature] are interacting with an AI system." If the project has no user-facing AI interaction (AI was only a development tool), state that instead: "AI was used only as a development aid; the shipped product does not present AI-generated interaction to end users."]

### AI-generated or manipulated content

[List any content in the shipped product that was AI-generated or AI-manipulated and is exposed to end users — text, images, audio, synthetic media. For each: what it is, how it's labelled to the user, if at all.]

### Development-process AI use (not end-user-facing)

[Same breakdown-by-component structure as the Singapore template — what AI assisted with during development, tool used, human verification performed. Article 50 doesn't require this, but pairing it in keeps one document as the single source of truth.]

### Data protection note

[State whether any personal data of an identifiable person was processed through an AI tool during development, and if so, the lawful basis / anonymisation approach used. Only fill the "yes" branch if the user has confirmed it — default to "No personal data was processed" only when actually confirmed.]

### Accountability statement

"This disclosure reflects the author's understanding of AI use in this project, consistent with EU AI Act transparency expectations for informing users and labelling AI-generated content. The author has reviewed and verified all AI-assisted output and retains full responsibility for the final work."

---

## Notes for the drafter (delete before finalizing)

- Don't reach for this template by default — GDPR/EU AI Act only bites if the project actually targets EU users or the user specifically wants this framing for comparison purposes.
- If unsure whether the project is EU-facing, ask rather than assume; a Singapore capstone with no EU distribution plan doesn't need this.
