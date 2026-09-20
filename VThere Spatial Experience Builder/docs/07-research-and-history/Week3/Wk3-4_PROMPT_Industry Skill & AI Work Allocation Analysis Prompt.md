# Industry Skill, AI Work Allocation & Team Skill Planning Prompt

You are acting as a **technical career advisor + software engineering lead + project skills planner** for a 5-person university software engineering team.

Your task is to analyze our **actual baseline codebase, current project architecture, current integrations, and the Singapore software engineering job market**, and determine:

1. What industry-relevant technical skills our team can realistically gain from this project.
2. Which of those skills are currently relevant and valuable in the Singapore job market.
3. Which work should remain primarily student-owned because it provides meaningful engineering learning and portfolio value.
4. Which work is tedious, repetitive, low-learning-value, or highly mechanical and can reasonably be accelerated or completed with AI.
5. How to divide the project into **five skill-development tracks**, one primary technical capability per team member.
6. What concrete work each teammate should complete so that the trimester produces **resume-worthy engineering experience**, not merely course deliverables.

The objective is **not** to maximize the amount of AI-generated code.

The objective is:

> **Maximize student technical ownership and employable engineering skills while using AI intelligently to reduce low-value implementation work and avoid unnecessary infrastructure rework.**

---

# 1. PROJECT CONTEXT

This is a university team project.

We are a:

```text
5-person technology team
```

The project already has a **baseline architecture**.

The baseline has been deliberately constructed so that:

* major technologies and integrations are already connected
* the major application layers exist
* major infrastructure relationships are already established
* core interfaces/contracts should already exist
* the project should not require major architectural restructuring simply because a future feature is being implemented

We intentionally want to reach this state:

```text
INFRASTRUCTURE / INTEGRATION
        ↓
Already connected
        ↓
Students implement and understand
        ↓
Actual features / systems / engineering behaviour
```

We do **not** want:

```text
AI generates entire feature
        ↓
Students paste it in
        ↓
Students cannot explain it
```

We also do **not** want:

```text
Student starts feature
        ↓
Discovers missing integration
        ↓
Rebuilds architecture halfway through trimester
```

Therefore, assume the baseline's architectural integration is broadly intentional and should be preserved unless the actual repository demonstrates a concrete problem.

Do not recommend large architectural rewrites merely because another architecture would be cleaner.

---

# 2. FIRST: UNDERSTAND THE ACTUAL PROJECT

Before giving any career recommendations, inspect the repository.

Read the project's existing planning and architecture material, especially files such as:

```text
projectscope.md
techstack.md
architecture.md
README.md
```

and any other relevant specifications.

Then inspect the actual baseline source tree.

Your first task is to establish:

### What already exists?

Identify:

* programming languages
* frameworks
* libraries
* databases
* cloud services
* APIs
* authentication
* storage
* rendering
* testing
* deployment
* CI/CD if present
* project structure
* editor/runtime separation
* shared packages
* custom technical systems
* existing integrations
* existing interfaces/contracts

### What has already been integrated?

For example:

```text
Frontend
    ↕
Shared TypeScript
    ↕
Backend API
    ↕
Database
    ↕
Cloud storage

Editor
    ↕
Authoring systems
    ↕
Project model
    ↕
Serialization
    ↕
Runtime
```

Do not assume this example matches the actual codebase.

### What is currently incomplete?

Distinguish between:

```text
Infrastructure missing
Feature logic missing
UI missing
Integration missing
Testing missing
Deployment missing
Documentation missing
Performance work missing
```

This distinction is extremely important.

The goal is to identify work that students can learn from **without forcing the team to rebuild the baseline architecture**.

---

# 3. DETERMINE THE ACTUAL ENGINEERING SKILL SURFACE

Create a comprehensive list of technical skills that could reasonably be learned through this project.

Do not merely list technologies.

Separate:

## A. Technology skills

Examples:

```text
TypeScript
React
Three.js
FastAPI
Python
PostgreSQL
REST APIs
Cloud deployment
Docker
Authentication
Object storage
Testing
CI/CD
```

Only include technologies actually present or realistically usable within the existing architecture.

## B. Software engineering capabilities

Examples:

```text
API design
database design
serialization
state management
event-driven systems
undo/redo architecture
3D interaction systems
rendering pipelines
performance profiling
automated testing
integration testing
authentication/authorization
data validation
error handling
observability
deployment
release management
```

## C. Engineering practices

Examples:

```text
Git workflow
code review
testing strategy
debugging
profiling
documentation
API contracts
schema migration
dependency management
environment configuration
deployment
monitoring
```

## D. Domain-specialist technical skills

Identify any skills that are particularly specific to this project.

For example:

```text
browser-based 3D applications
scene graphs
spatial mathematics
transform manipulation
interactive authoring tools
runtime/editor parity
3D asset handling
spatial interaction systems
```

These may have a smaller job market than mainstream software engineering skills, but can still be valuable differentiators.

---

# 4. RESEARCH THE SINGAPORE JOB MARKET

This task requires **current external research**.

Do not rely solely on general knowledge.

Research the **Singapore technology job market using current information**, preferably from sources such as:

* Singapore employer career pages
* MyCareersFuture
* SkillsFuture / Skills Framework for ICT
* IMDA
* major Singapore job platforms
* relevant graduate / junior software engineering postings
* technology companies operating in Singapore
* engineering job descriptions from established companies

Use current information appropriate to the present year.

Focus particularly on roles relevant to a university graduate entering the workforce, such as:

```text
Software Engineer
Software Developer
Backend Engineer
Frontend Engineer
Full Stack Engineer
Cloud Engineer
DevOps Engineer
Platform Engineer
QA / Test Automation Engineer
Systems Engineer
Application Engineer
Data Engineer
Security Engineer
Graphics / Simulation Engineer
3D / Interactive Application Engineer
```

Do not assume every one of these roles is appropriate.

Use actual job postings and employer requirements as evidence.

---

# 5. DO NOT JUST COUNT TECHNOLOGIES

When determining whether a skill is valuable, analyze more than keyword frequency.

For each skill evaluate:

| Criterion              | Question                                                                      |
| ---------------------- | ----------------------------------------------------------------------------- |
| Market demand          | How commonly does this skill appear in relevant Singapore job postings?       |
| Transferability        | Can the skill transfer to many employers/roles?                               |
| Graduate accessibility | Can a student realistically demonstrate this skill at graduate level?         |
| Project fit            | Can we learn it naturally inside this project?                                |
| Portfolio evidence     | Can we show concrete evidence of using it?                                    |
| Technical depth        | Does it require genuine engineering understanding?                            |
| AI commoditization     | Is AI likely to make basic implementation of this skill less differentiating? |
| Human ownership        | Can a student meaningfully own the capability?                                |
| Time feasibility       | Can it realistically be learned and demonstrated this trimester?              |

Distinguish carefully between:

### "Commonly requested"

and:

### "Actually worth a student investing time into"

These are not always the same thing.

For example, a technology appearing frequently in job descriptions may have little learning value if the project only allows the student to make trivial changes to it.

---

# 6. IDENTIFY AI-COMMODITIZABLE WORK

Analyze the actual project backlog and architecture.

Identify work that can reasonably be delegated or accelerated by AI.

Categorize work as:

## Category A — Student-owned core engineering

AI may assist with explanation, debugging, review, or small code suggestions, but students should remain responsible for the implementation and design.

Examples may include:

```text
core interaction logic
gizmo mathematics
state management decisions
serialization design
runtime behaviour
database schema decisions
API behaviour
performance decisions
security decisions
architecture
complex algorithms
```

Only classify something here when understanding it provides meaningful engineering value.

---

## Category B — AI-assisted implementation

The student should understand and review the code, but AI can generate a substantial portion.

Examples may include:

```text
repetitive UI wiring
simple adapters
DTO conversion
boilerplate CRUD endpoints
basic validation scaffolding
repetitive tests
mock generation
documentation generation
simple configuration
standard error wrappers
```

---

## Category C — Highly mechanical / low-value work

AI can perform most of the implementation.

Examples may include:

```text
repetitive component creation
renaming / mechanical refactors
large quantities of similar test cases
documentation synchronization
simple generated types
boilerplate API clients
simple fixtures
basic mock data
repetitive configuration
```

---

## Category D — Do not delegate completely to AI

Explicitly identify work where doing so would damage student learning or ownership.

Examples may include:

```text
critical architecture
security boundaries
core feature logic
performance-critical systems
data model design
serialization contracts
interaction semantics
complex debugging
failure handling
important algorithms
```

Explain **why**.

---

# 7. USE AN "AI LEVERAGE VS LEARNING VALUE" MODEL

Create a matrix:

```text
                    HIGH LEARNING VALUE
                           ↑
                           |
        STUDENT            |       STUDENT
        OWN                 |       OWNS +
        COMPLETELY          |       AI ASSISTS
                           |
    -----------------------+-----------------------
                           |
        AI                  |       AI
        ASSIST              |       GENERATES
        MOSTLY              |       MOSTLY
                           |
                           ↓
                    LOW LEARNING VALUE
```

Map major project work into this matrix.

The goal should be:

> **AI handles mechanical effort while students retain the engineering decisions and meaningful system implementation.**

---

# 8. IDENTIFY "RESUME-WORTHY" WORK

For each major skill, ask:

> "Could a student reasonably put this on their resume as a technical responsibility?"

A strong resume skill should ideally have:

```text
Technology
    +
Actual implementation
    +
Technical responsibility
    +
Concrete outcome
    +
Evidence
```

For example, distinguish:

### Weak evidence

> Used AWS.

from:

### Stronger evidence

> Designed and deployed a FastAPI backend on Google Cloud Run with PostgreSQL persistence and cloud object storage, including environment-based configuration and automated integration testing.

Do not fabricate achievements.

The final wording must only reflect work actually completed.

For every recommended skill, identify the **future evidence** the student should produce.

Examples:

```text
repository contribution
architecture diagram
test suite
deployment
performance measurement
API documentation
database schema
technical design document
profiling result
demo
benchmark
incident/debugging record
```

---

# 9. FIND THE FIVE BEST SKILL TRACKS FOR THIS TEAM

After analyzing the entire skill landscape, design a plan for a:

```text
5-person technology team
```

Each person should receive:

```text
1 PRIMARY TECHNICAL SKILL
+
supporting skills where naturally required
```

Do not simply divide the architecture into five arbitrary folders.

Instead, divide it into **five meaningful employable capabilities**.

For example, possible categories could include:

```text
Frontend / Application Engineering
3D / Graphics / Interactive Systems
Backend / API / Database Engineering
Cloud / DevOps / Deployment
Testing / Quality / Security / Reliability
```

But these are only examples.

You must determine the actual five tracks based on:

* the actual repository
* the remaining work
* Singapore job market evidence
* project feasibility
* technical depth
* resume value
* student ownership

Do not assign a person to a technology merely because it exists in the stack.

There must be enough meaningful work to actually develop that skill.

---

# 10. MAKE EACH TEAM MEMBER A SYSTEM OWNER

For each of the five tracks produce:

```text
TEAM MEMBER / TRACK

Primary skill:
Secondary skills:

Why this matters in industry:

Why it fits this project:

Actual systems/files they should own:

Core work they should personally implement:

Work AI may accelerate:

Work AI should NOT completely implement:

Technical concepts they should understand:

Expected engineering deliverables:

Expected resume evidence:

Expected final demonstration:

Dependencies on teammates:

What they should learn before starting:

Definition of "I genuinely know this":
```

The final section is important.

Define what knowledge would demonstrate genuine ownership.

For example:

> A teammate should be able to explain how a request travels through the API, how validation occurs, how the database transaction is performed, what failure cases exist, and why the chosen architecture was used.

This prevents "I touched the code" from being confused with "I learned the system."

---

# 11. ENSURE THE FIVE TRACKS ARE ACTUALLY DIFFERENT

Avoid assigning:

```text
Person A → React
Person B → TypeScript
Person C → frontend
```

because those are not meaningfully independent learning tracks.

Instead aim for capabilities such as:

```text
Application engineering
Backend/data engineering
Cloud/platform engineering
3D/graphics/interactive systems
Testing/reliability/security
```

or whatever the repository and market analysis genuinely support.

There may be overlap.

That is acceptable.

Each person should nevertheless have a clear area where they are the primary owner.

---

# 12. PRESERVE TEAM INTEGRATION

This is critical.

The skill plan must **not create five isolated mini-projects**.

Show:

```text
Team Skill A
     ↓
Shared architecture
     ↓
Team Skill B
     ↓
Shared project/runtime
     ↓
Team Skill C
```

For each skill track explain:

```text
What interface they consume
What interface they provide
What another teammate depends on
```

The architecture should remain:

```text
Shared contracts/interfaces
        ↓
Individual systems
        ↓
Integrated product
```

Do not recommend restructuring the baseline merely to make ownership boundaries look cleaner.

---

# 13. IDENTIFY CROSS-TEAM FOUNDATIONAL KNOWLEDGE

Even though each person has a primary skill, identify the knowledge that **every teammate should understand**.

For example:

```text
Git
TypeScript fundamentals
project architecture
basic debugging
testing fundamentals
HTTP/API fundamentals
basic database concepts
how the editor/runtime communicate
how to run/build/test the project
```

Separate:

### Everyone must know

from:

### Specialist should own

This prevents knowledge silos.

---

# 14. CREATE A TRIMESTER LEARNING PLAN

Build a progression such as:

```text
PHASE 1 — Understand
PHASE 2 — Implement
PHASE 3 — Integrate
PHASE 4 — Test
PHASE 5 — Measure
PHASE 6 — Document
PHASE 7 — Demonstrate
```

For each teammate show what they should learn and build.

Avoid a plan where everyone spends the entire trimester merely implementing features.

The goal is:

```text
Learn technology
    ↓
Implement capability
    ↓
Integrate with team
    ↓
Test it
    ↓
Measure/validate it
    ↓
Document it
    ↓
Have something demonstrable for resume/interview
```

---

# 15. REQUIRE TECHNICAL DEPTH

For each skill, distinguish:

### Exposure

> "I used it."

### Working knowledge

> "I can implement and debug with it."

### Ownership

> "I understand its architecture, trade-offs, failure modes and integration points."

Aim for the team to reach:

```text
Working knowledge
+
meaningful ownership
```

for their primary capability.

Do not recommend a skill merely because the technology sounds impressive.

---

# 16. CREATE A "DO WITH AI / DO YOURSELF" TABLE

Create a concrete table like:

| Work                      | AI role     | Student role                  | Why                  |
| ------------------------- | ----------- | ----------------------------- | -------------------- |
| Boilerplate UI            | Generate    | Review/integrate              | Low learning value   |
| Core gizmo math           | Assist only | Implement/understand          | High technical value |
| API DTOs                  | Generate    | Verify/integrate              | Mechanical           |
| Database schema           | Assist      | Design/own                    | Architecture         |
| Unit-test scaffolding     | Generate    | Review + add meaningful tests | Mixed                |
| Performance investigation | Assist      | Investigate/decide            | High learning value  |

Base this on the actual project.

---

# 17. IDENTIFY LOW-VALUE WORK TO AUTOMATE

Explicitly identify tedious tasks that consume student time but provide poor resume value.

Examples might include:

```text
boilerplate
repetitive CRUD
test fixture generation
documentation synchronization
simple UI duplication
generated types
simple API wiring
mock data
configuration repetition
```

Then estimate:

```text
Task
Manual effort
AI suitability
Risk
Student oversight required
```

The objective is to give students more time for the difficult engineering.

---

# 18. IDENTIFY WORK THAT SHOULD NOT BE AUTOMATED

Also provide the inverse list:

```text
Do NOT outsource completely:
```

For example:

```text
architecture decisions
feature semantics
core algorithms
system design
security model
database design
performance investigation
important debugging
failure behaviour
serialization contracts
interaction engine behaviour
```

Explain the learning reason for each.

---

# 19. PRODUCE A FINAL FIVE-PERSON PROJECT MAP

End the analysis with one table:

| Person | Primary skill | Main systems owned | Main technology | Core learning outcome | Resume evidence |
| ------ | ------------- | ------------------ | --------------- | --------------------- | --------------- |

Then create a second table:

| Person | Student-owned work | AI-assisted work | Shared work |
| ------ | ------------------ | ---------------- | ----------- |

Then create:

```text
TEAM
│
├── Track 1
│
├── Track 2
│
├── Track 3
│
├── Track 4
│
└── Track 5
```

showing how the five capabilities integrate into the same application.

---

# 20. PRODUCE A "RESUME STORY" FOR EACH TRACK

For each teammate generate a template based on the actual planned work:

```text
Technology:
System owned:
Engineering responsibility:
Implementation:
Testing/validation:
Deployment/integration:
Measurable result:
```

Then produce a **non-fabricated resume bullet template**.

Do not claim achievements that have not happened.

Use placeholders where necessary:

```text
[implemented X]
[deployed to Y]
[reduced Z]
[added N tests]
```

The purpose is to show what evidence the teammate should deliberately create during the trimester.

---

# 21. IDENTIFY SKILLS THAT ARE NOT WORTH ADDING

This is equally important.

Create:

```text
Skills we should NOT deliberately add
```

Explain why.

Potential reasons:

```text
little relevance to target roles
poor project fit
too much learning overhead
duplicates another team member
low portfolio signal
AI can already perform most of the work
requires restructuring the baseline
not enough meaningful work available
```

Do not add technologies merely to make the resume look bigger.

---

# 22. PROVIDE A "SKILL INVESTMENT PRIORITY" MODEL

Classify skills into:

```text
Tier A — Strong candidate for deliberate ownership
Tier B — Useful supporting skill
Tier C — AI-assisted / incidental exposure
Tier D — Not worth spending trimester time on
```

Do not base this purely on popularity.

Explain each decision using:

```text
Singapore market evidence
project fit
technical depth
resume evidence
student ownership
time feasibility
```

---

# 23. IMPORTANT: DISTINGUISH MARKET SIGNAL FROM PERSONAL FIT

Do not assume the same skill is ideal for every person.

The final report should state:

```text
Market demand
    ≠
student suitability
    ≠
project suitability
```

The team should use the analysis to choose among technically meaningful tracks.

Do not invent personal preferences or abilities for teammates that are not provided.

---

# 24. OUTPUT FORMAT

Produce one main document:

```text
INDUSTRY_SKILLS_AND_TEAM_PLAN.md
```

Structure it as:

```text
# Industry Skills & Team Technical Skill Plan

## 1. Executive Summary

## 2. Current Baseline Assessment

## 3. Existing Technology Stack

## 4. Existing Engineering Capabilities

## 5. Applicable Skills We Can Learn

## 6. Singapore Industry Research

## 7. Skill Demand & Transferability Analysis

## 8. AI-Appropriate Work

## 9. Student-Owned Work

## 10. AI Commoditization Analysis

## 11. Resume / Portfolio Value

## 12. Recommended Five Skill Tracks

## 13. Team Skill Allocation

## 14. Per-Teammate Learning Plans

## 15. Shared Team Knowledge

## 16. Trimester Implementation Plan

## 17. AI Usage Rules

## 18. Skills We Should Not Spend Time On

## 19. Resume Evidence Plan

## 20. Final Team Skill Map
```

---

# 25. EVIDENCE REQUIREMENTS

Because the Singapore job-market section is time-sensitive:

* use current sources
* cite factual claims
* identify the date/time period of job postings
* distinguish job-posting frequency from your own inference
* distinguish employer requirements from general industry opinion
* do not treat one company as representative of the entire Singapore market
* use multiple employers and sources
* identify uncertainty where evidence is weak

Do not simply say:

> "AWS is highly demanded."

Instead show evidence such as:

```text
Skill
Relevant Singapore postings observed
Types of roles
Employer examples
Level of demand
Why it is relevant
Confidence
```

Do not fabricate job-posting numbers.

---

# 26. IMPORTANT CONSTRAINT: DO NOT DESTROY STUDENT OWNERSHIP

The final recommendation must satisfy this principle:

```text
AI should reduce implementation friction,
not remove technical responsibility.
```

A useful rule is:

```text
AI may generate code.

Student must understand the generated code.

Student must own the technical decision.

Student must be able to modify/debug the code.

Student must be able to explain the architecture.

Student must be able to demonstrate the system working.

Student must understand important failure cases.
```

For particularly important systems, require the student to implement the core mechanism themselves even if AI assists with peripheral code.

---

# 27. FINAL QUESTION THE ANALYSIS MUST ANSWER

At the end, answer this directly:

> **"We have five tech students, one trimester, an already-integrated baseline, and AI available. What five technical capabilities should we deliberately use this project to teach ourselves, what parts should AI accelerate, and what concrete work should each student complete so that we finish with genuine engineering ownership and credible Singapore-relevant resume experience?"**

The answer must be based on:

```text
ACTUAL PROJECT
+
ACTUAL BASELINE
+
CURRENT SINGAPORE JOB MARKET
+
STUDENT LEARNING VALUE
+
RESUME EVIDENCE
+
AI LEVERAGE
```

not on generic software-engineering advice.

---

# FINAL PRINCIPLE

Optimize for:

```text
BASELINE
   ↓
INTEGRATION ALREADY SOLVED
   ↓
STUDENT LEARNS A TECHNICAL CAPABILITY
   ↓
STUDENT OWNS A REAL SYSTEM
   ↓
AI REMOVES TEDIOUS WORK
   ↓
SYSTEM IS TESTED
   ↓
SYSTEM IS INTEGRATED
   ↓
SYSTEM IS DOCUMENTED
   ↓
STUDENT CAN EXPLAIN IT
   ↓
RESUME / PORTFOLIO EVIDENCE
```

The end result should be a project in which:

> **AI helped us build faster, but each teammate can still credibly say "I understand and owned this part of the system."**
