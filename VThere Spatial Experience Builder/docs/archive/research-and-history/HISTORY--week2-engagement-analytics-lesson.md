# Engagement Analytics: A Lesson for the Spatial Experience Builder

**Baseline phase:** Not stage-specific — see [8-stage baseline overview](../../code/baseline-phases.md) for the full sequence.

You listed three things together. They sound like they belong in the same bucket ("analytics / tracking / integration"), but they're actually three different *kinds* of problem, and only one of them belongs in your Project 5 scope. This lesson walks through why, and what to actually build.

## The three things, sorted by category

| Item | Category | In scope? |
|---|---|---|
| Simple engagement analytics (visits, hotspot clicks) | Product analytics — your own event model | Yes |
| LMS / SCORM integration, learner progress tracking | External e-learning standard compliance | No |
| Institutional integration | IT/org plumbing (SSO, provisioning, procurement) | No |

The distinction that matters: the first is *your own design decision*. The other two mean building your app to satisfy someone else's specification or someone else's IT department — real effort, but not effort that demonstrates engineering you invented.

## Part 1: What is engagement analytics, actually?

You are not measuring "learning." You're measuring **attention and interaction** — proxies for whether a visitor engaged with what an author built. The brief names four concrete metrics (Section 6.7):

- number of visits
- time spent
- which hotspots were clicked
- which scenes were reached

All four fall out of one idea: **every meaningful moment in a visitor's session is an event, and analytics is just aggregating events afterward.**

### The event model

An event is a small record:

```
{
  sessionId: string,
  projectId: string,
  sceneId: string,
  timestamp: number,
  type: "SessionStart" | "SceneEnter" | "SceneExit" | "HotspotClick" | "ZoneEnter" | "PublishView",
  payload?: { objectId?: string }
}
```

From that one stream, every metric in the brief is a simple aggregation:

- **Visits** = count of distinct `sessionId` with a `SessionStart` event
- **Time spent** = sum of `(SceneExit.timestamp − SceneEnter.timestamp)` per session
- **Hotspot clicks** = count of `HotspotClick` events, grouped by `objectId`
- **Scenes reached** = count of distinct `SceneEnter` scenes per session

That's the entire intellectual content of "engagement analytics" for this project. It's not a data-science problem — it's an event-logging problem plus a `GROUP BY`.

### What we can actually build

Mapped onto your existing layout:

1. **Client instrumentation (`apps/runtime`)** — hook the existing `RuntimeInteraction` dispatch so that every trigger fire (click, zone enter, scene change) also emits an analytics event, buffered and flushed to the API periodically or on scene change.
2. **Ingestion (`apps/api`)** — a single append-only endpoint (`POST /projects/:id/events`) and a simple events table. No need for a real-time pipeline; a course-scale project doesn't need Kafka.
3. **Aggregation (`apps/api/services`)** — compute the four metrics on read, when an author opens the analytics view. For your scale, pre-aggregation is unnecessary engineering effort.
4. **Display (`apps/editor/ui`)** — a small panel showing per-project totals: visits, average time, top hotspots.

That's a self-contained, gradeable, custom-built slice. Small, but entirely yours.

## Part 2: Why LMS / SCORM integration doesn't belong here

**SCORM** (Sharable Content Object Reference Model) is a decades-old e-learning packaging standard that lets content report completion and score back to a Learning Management System (Moodle, Canvas, etc.), using a fixed data model (SCOs, sequencing rules, a `cmi.core` runtime API — later superseded by xAPI/Tin Can).

Two reasons this is out of scope:

- **It's compliance work, not design work.** Implementing SCORM means satisfying someone else's specification exactly, byte for byte. There's no room for your own architectural decisions — which is the opposite of what Section 10 asks you to demonstrate (a *custom-built* technical component).
- **It assumes infrastructure you don't control.** SCORM only means anything if a school already runs an LMS your published experience reports back to. That's an institutional dependency entirely outside a two-trimester student project, and it's never mentioned anywhere in the brief's "Fixed for this project" list (Section 12).

Learner progress tracking has the same problem in miniature: it implies a curriculum model (objectives, mastery, sequencing) that this brief never asks for. Your "progress" concept is just "which scenes did this visitor reach" — already covered by Part 1.

## Part 3: Why "institutional integration" is a trap

This means things like: single sign-on with a school's identity system, administrator provisioning workflows, data-residency and compliance requirements, procurement approval. It's real work, and it matters for VThere's eventual commercial rollout — but it has "no technical payoff for you" for three concrete reasons:

- It doesn't produce artifacts DigiPen grades you on — it's mostly configuration and auth-plumbing, not algorithmic or architectural decision-making.
- It's gated by external approval (a real school's IT policy, VThere's partner agreements) that your team's timeline can't control.
- The brief itself keeps this simple: accounts are "created by an administrator" (Section 6.1) — a basic internal admin flow, not real institutional SSO.

## Takeaway

**Build:** a small, self-contained event-driven analytics slice — your own schema, your own aggregation, demonstrably yours.

**Don't build:** SCORM/xAPI compliance or institutional SSO — high effort, driven entirely by someone else's spec, doesn't showcase original engineering, and isn't required anywhere in the brief.
