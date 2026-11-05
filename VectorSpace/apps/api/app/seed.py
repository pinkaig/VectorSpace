"""Test data: one small school with a few rows in every table, rebuilt from scratch each run.

Run from apps/api with AUTH_DEV_BYPASS=true (dry run by default, nothing is written until --apply):

    python -m app.seed            # what is there now, and what the run would make
    python -m app.seed --apply    # deletes the Demo School's rows, then makes them again

--apply wipes everything in the Demo School (slug "demo"): its people, classes, projects, saves,
assignments, media, rules and analytics, including anything made by hand while testing. Other
schools are not touched. Every table ends up with at most 10 rows from this school.

Sign in through the login picker, or send "Authorization: Bearer dev|<name>" to the API:

    dev|admin      Jasmine Ong (VThere), admin
    dev|teacher    Ms Tan Hui Min, teaches 1A Science and 2B Humanities
    dev|teacher2   Mr Rahim Ismail, teaches 2B Humanities
    dev|student1   Aisyah Rahman, 1A Science      dev|student4   Ben Carter, 2B Humanities
    dev|student2   Ethan Lim, 1A Science          dev|student5   Priya Nair, 2B Humanities
    dev|student3   Chloe Tan, 1A Science

What is in it, so each screen has something to show:
  - two published templates ("Museum hall", "Blank room")
  - Ms Tan's "Dinosaur museum" for 1A Science, assigned (task and due date) and sent to Aisyah
    (untouched copy) and Ethan (edited copy); Chloe has none yet, so Assign has someone to send to
  - Mr Rahim's "Rainforest tour" for 2B Humanities, sent to Ben, whose copy is archived
  - Aisyah's own published "My first exhibition", shown on the sign-in page, with a few
    visitor analytics events
  - on the Dinosaur museum: one media file, two YouTube links (one approved, one waiting) and
    two interaction rules

People, classes and logins go through app.provision, the same path as a real roster; only the
login maker differs (DevLogins hands out "dev|<name>" subjects instead of Auth0 accounts).
"""

from __future__ import annotations

import hashlib
import json
import sys
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import Session

from .config import get_settings
from .models import (
    Actor,
    AnalyticsEvent,
    Assignment,
    ClassMember,
    Classroom,
    ContentSnapshot,
    InteractionRule,
    MediaAsset,
    MediaLink,
    Organisation,
    Project,
    ProjectVersion,
)
from .provision import DevLogins, Row, provision

SLUG, SCHOOL = "demo", "Demo School"
SCIENCE, HUMANITIES = "1A Science", "2B Humanities"

# the logins keep the keys the sign-in picker uses (src/session/session.tsx, devSubjectFor)
ROWS = [
    Row("admin@demo.test", "Jasmine Ong (VThere)", "admin", []),
    Row("teacher@demo.test", "Ms Tan Hui Min", "teacher", [SCIENCE, HUMANITIES]),
    Row("teacher2@demo.test", "Mr Rahim Ismail", "teacher", [HUMANITIES]),
    Row("student1@demo.test", "Aisyah Rahman", "student", [SCIENCE]),
    Row("student2@demo.test", "Ethan Lim", "student", [SCIENCE]),
    Row("student3@demo.test", "Chloe Tan", "student", [SCIENCE]),
    Row("student4@demo.test", "Ben Carter", "student", [HUMANITIES]),
    Row("student5@demo.test", "Priya Nair", "student", [HUMANITIES]),
]

# every table this script fills, in the order the dry run reports them
TABLES = [
    Organisation, Actor, Classroom, ClassMember, Project, ProjectVersion, ContentSnapshot,
    Assignment, MediaAsset, MediaLink, InteractionRule, AnalyticsEvent,
]

DINOSAUR_TASK = (
    "Build a dinosaur museum. Add at least 3 exhibits with a fact card each, "
    "and one thing that reacts when visitors click."
)
RAINFOREST_TASK = "Make a rainforest tour with one room per layer of the forest."

_HEIGHT = {"cube": 0.55, "sphere": 0.65, "cylinder": 0.6}


# ── Scenes: tiny, but the same shape the editor saves, so every project opens ──

def _scene_object(kind: str, index: int, x: float, z: float) -> dict:
    return {
        "id": f"{kind}-{index}",
        "name": f"{kind.capitalize()} {index}",
        "assetId": f"primitive-{kind}",
        "assetKind": kind,
        "visible": True,
        "enabled": True,
        "transform": {"position": [x, _HEIGHT[kind], z], "rotation": [0, 0, 0], "scale": [1, 1, 1]},
    }


def scene_data(
    project_id: uuid.UUID,
    name: str,
    rooms: list[tuple[str, str]],
    shapes: list[tuple[str, float, float]],
    brief: dict | None = None,
) -> dict:
    """rooms: (name, environment id) in visit order; shapes go in the first room."""
    data = {
        "schemaVersion": 1,
        "id": str(project_id),
        "name": name,
        "activeSceneId": "scene-1",
        "scenes": [
            {
                "id": f"scene-{i + 1}",
                "name": room,
                "objects": [_scene_object(kind, n + 1, x, z) for n, (kind, x, z) in enumerate(shapes)] if i == 0 else [],
                "environmentId": environment,
                "startCamera": {"position": [7, 5.5, 8], "target": [0, 0.7, 0]},
                "layout": {"x": i, "z": 0},
            }
            for i, (room, environment) in enumerate(rooms)
        ],
    }
    if brief:
        data["missionBrief"] = brief
    return data


def _brief(due: datetime, todos: list[str], rules: list[str]) -> dict:
    return {
        "due": f"{due:%A}, {due.day} {due:%b}",  # "Monday, 2 Nov", as the setup page writes it
        "todos": [{"id": f"todo-{i + 1}", "text": text} for i, text in enumerate(todos)],
        "rules": [{"id": f"rule-{i + 1}", "text": text} for i, text in enumerate(rules)],
    }


def _checksum(data: dict) -> str:
    return hashlib.sha256(json.dumps(data, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


# ── Writing rows ──

def _project(db: Session, owner: Actor, name: str, when: datetime, **fields) -> Project:
    project = Project(
        organisation_id=owner.organisation_id, created_by_id=owner.id, name=name,
        slug=f"{name.lower().replace(' ', '-')}-{uuid.uuid4().hex[:8]}", created_at=when, **fields,
    )
    db.add(project)
    db.flush()
    return project


def _save(db: Session, project: Project, data: dict, when: datetime, author: Actor | None = None, label: str | None = None) -> ProjectVersion:
    """One save: a snapshot and the next revision, made current. author defaults to the owner."""
    snapshot = ContentSnapshot(project_id=project.id, data={**data, "id": str(project.id), "name": project.name},
                               checksum="", created_at=when)
    snapshot.checksum = _checksum(snapshot.data)
    db.add(snapshot)
    db.flush()
    revision = (db.get(ProjectVersion, project.current_version_id).revision + 1) if project.current_version_id else 1
    version = ProjectVersion(
        project_id=project.id, revision=revision, created_by_id=(author or project.created_by).id,
        content_snapshot_id=snapshot.id, label=label, created_at=when,
    )
    db.add(version)
    db.flush()
    # updated_at in the same statement, so the column's automatic refresh does not overwrite it
    project.current_version_id, project.updated_at = version.id, when
    db.flush()
    return version


def _copy_for(db: Session, source: Project, student: Actor, assignment: Assignment, sent: datetime, teacher: Actor) -> Project:
    """What the teacher's Assign makes: the student's own copy, first saved by the teacher."""
    copy = _project(db, student, source.name, sent, class_id=assignment.class_id, assignment_id=assignment.id,
                    template_id=source.template_id, template_revision=source.template_revision)
    latest = db.get(ProjectVersion, source.current_version_id)
    _save(db, copy, latest.content_snapshot.data, sent, author=teacher, label=f"Sent by {teacher.display_name}")
    return copy


# ── Clearing the school ──

def clear_school(db: Session, slug: str = SLUG) -> None:
    """Deletes every row that belongs to the school, children first. Other schools are untouched."""
    org = db.scalar(select(Organisation).where(Organisation.slug == slug))
    if org is None:
        return
    projects = select(Project.id).where(Project.organisation_id == org.id)
    classes = select(Classroom.id).where(Classroom.organisation_id == org.id)
    # projects point at their current save and their assignment; let go of those first
    db.execute(update(Project).where(Project.organisation_id == org.id)
               .values(current_version_id=None, assignment_id=None, template_id=None))
    for model in (InteractionRule, AnalyticsEvent, MediaLink, MediaAsset):
        db.execute(delete(model).where(model.project_id.in_(projects)))
    db.execute(delete(Assignment).where(Assignment.class_id.in_(classes)))
    db.execute(delete(ProjectVersion).where(ProjectVersion.project_id.in_(projects)))
    db.execute(delete(ContentSnapshot).where(ContentSnapshot.project_id.in_(projects)))
    db.execute(delete(Project).where(Project.organisation_id == org.id))
    db.execute(delete(ClassMember).where(ClassMember.class_id.in_(classes)))
    db.execute(delete(Classroom).where(Classroom.organisation_id == org.id))
    db.execute(delete(Actor).where(Actor.organisation_id == org.id))
    db.execute(delete(Organisation).where(Organisation.id == org.id))
    db.flush()


# ── Building it ──

def seed(db: Session) -> None:
    """Clears the Demo School and builds it again. Commits."""
    clear_school(db)
    provision(db, DevLogins(), SLUG, SCHOOL, ROWS)
    org = db.scalar(select(Organisation).where(Organisation.slug == SLUG))
    people = {a.email.split("@")[0]: a for a in db.scalars(select(Actor).where(Actor.organisation_id == org.id))}
    classes = {c.name: c for c in db.scalars(select(Classroom).where(Classroom.organisation_id == org.id))}
    tan, rahim = people["teacher"], people["teacher2"]
    aisyah, ethan, ben = people["student1"], people["student2"], people["student4"]

    now = datetime.now(UTC).replace(microsecond=0)
    days = lambda n: now - timedelta(days=n)

    # two published templates
    museum = _project(db, tan, "Museum hall", days(30), kind="template", status="published")
    plinths = [("cube", -3, 0), ("cube", 0, -3), ("cube", 3, 0)]
    _save(db, museum, scene_data(museum.id, museum.name, [("Museum", "env-museum")], plinths), days(30), label="First version")
    blank = _project(db, rahim, "Blank room", days(28), kind="template", status="published")
    _save(db, blank, scene_data(blank.id, blank.name, [("Empty", "env-empty")], []), days(28), label="First version")

    # Ms Tan's Dinosaur museum for 1A Science, from the Museum hall template, saved twice
    dino = _project(db, tan, "Dinosaur museum", days(10), class_id=classes[SCIENCE].id,
                    template_id=museum.id, template_revision=1)
    dino_brief = _brief(now + timedelta(days=4),
                        ["Place 3 exhibits", "Give each exhibit a fact card", "Add one reaction"],
                        ["Use facts from your research, in your own words", "Keep everything school-appropriate"])
    rooms = [("Museum", "env-museum"), ("Classroom", "env-classroom")]
    _save(db, dino, scene_data(dino.id, dino.name, rooms[:1], plinths, dino_brief), days(10))
    _save(db, dino, scene_data(dino.id, dino.name, rooms, plinths + [("sphere", 0, 3)], dino_brief), days(8))

    dino_assignment = Assignment(class_id=classes[SCIENCE].id, project_id=dino.id, task=DINOSAUR_TASK,
                                 due_at=(now + timedelta(days=4)).date(), created_by_id=tan.id)
    db.add(dino_assignment)
    db.flush()
    _copy_for(db, dino, aisyah, dino_assignment, days(7), tan)  # sent, not opened yet
    ethans = _copy_for(db, dino, ethan, dino_assignment, days(7), tan)
    _save(db, ethans, scene_data(ethans.id, ethans.name, rooms, plinths + [("sphere", 0, 3), ("cylinder", 2, 2)], dino_brief),
          days(2))  # and Ethan has been building since

    # Mr Rahim's Rainforest tour for 2B Humanities; Ben's copy is archived
    rainforest = _project(db, rahim, "Rainforest tour", days(20), class_id=classes[HUMANITIES].id,
                          template_id=blank.id, template_revision=1)
    _save(db, rainforest, scene_data(rainforest.id, rainforest.name, [("Canopy", "env-exhibition")], [("cylinder", 0, 0)]), days(20))
    rainforest_assignment = Assignment(class_id=classes[HUMANITIES].id, project_id=rainforest.id, task=RAINFOREST_TASK,
                                       due_at=days(5).date(), created_by_id=rahim.id)
    db.add(rainforest_assignment)
    db.flush()
    bens = _copy_for(db, rainforest, ben, rainforest_assignment, days(18), rahim)
    bens.status = "archived"

    # Aisyah's own published museum, and a few visits to it
    # filed under her class, so Ms Tan sees it on Review (a project with no class is the student's alone)
    own = _project(db, aisyah, "My first exhibition", days(25), status="published", showcase=True,
                   class_id=classes[SCIENCE].id, template_id=blank.id, template_revision=1)
    _save(db, own, scene_data(own.id, own.name, [("Gallery", "env-highlight-exhibit")], [("cube", 0, 0), ("sphere", 2, 1)]), days(24))
    for session, event, payload, ago in [
        ("visit-1", "visit_start", None, 3),
        ("visit-1", "object_click", {"objectId": "cube-1"}, 3),
        ("visit-2", "visit_start", None, 2),
        ("visit-2", "object_click", {"objectId": "sphere-2"}, 2),
        ("visit-3", "visit_start", None, 1),
    ]:
        db.add(AnalyticsEvent(project_id=own.id, session_id=session, event_type=event, payload=payload,
                              occurred_at=days(ago)))

    # media on the Dinosaur museum: a file (no bytes in storage, so it stays pending) and two YouTube links
    db.add(MediaAsset(project_id=dino.id, uploaded_by_id=tan.id, kind="image",
                      storage_key=f"projects/{dino.id}/media/{uuid.uuid4()}/t-rex.png",
                      content_type="image/png", size_bytes=245_760, status="pending"))
    db.add(MediaLink(project_id=dino.id, created_by_id=tan.id, kind="video", provider="youtube", provider_id="aqz-KE-bpKQ",
                     url="https://www.youtube.com/watch?v=aqz-KE-bpKQ", approval="approved", approved_by_id=tan.id,
                     approved_at=days(8)))
    db.add(MediaLink(project_id=dino.id, created_by_id=tan.id, kind="video", provider="youtube", provider_id="dQw4w9WgXcQ",
                     url="https://www.youtube.com/watch?v=dQw4w9WgXcQ", approval="pending"))

    # two click rules on the Dinosaur museum's first plinth and the new sphere
    db.add(InteractionRule(project_id=dino.id, object_id="cube-1", triggers=["click"],
                           actions=[{"kind": "showPanel", "params": {"title": "T. rex", "body": "The king of the dinosaurs."}}]))
    db.add(InteractionRule(project_id=dino.id, object_id="sphere-4", triggers=["click"],
                           actions=[{"kind": "playAudio", "params": {"assetId": "roar"}}], priority=1))
    db.commit()


def add_template(db: Session, slug: str, name: str = "Museum hall") -> Project | None:
    """One published template in an already provisioned school, owned by its first teacher. Commits.

    For a school whose people have real logins (app.provision with Auth0), where seed() cannot run:
    it makes no people and wipes nothing. None if the school already has a template by that name.
    """
    org = db.scalar(select(Organisation).where(Organisation.slug == slug))
    if org is None:
        raise ValueError(f"No school '{slug}': provision its people first")
    if db.scalar(select(Project).where(Project.organisation_id == org.id, Project.kind == "template", Project.name == name)):
        return None
    teacher = db.scalar(select(Actor).where(Actor.organisation_id == org.id, Actor.role == "teacher").order_by(Actor.email))
    if teacher is None:
        raise ValueError(f"School '{slug}' has no teacher to own the template")
    now = datetime.now(UTC).replace(microsecond=0)
    template = _project(db, teacher, name, now, kind="template", status="published")
    plinths = [("cube", -3, 0), ("cube", 0, -3), ("cube", 3, 0)]
    _save(db, template, scene_data(template.id, name, [("Museum", "env-museum")], plinths), now, label="First version")
    db.commit()
    return template


def counts(db: Session, slug: str = SLUG) -> dict[str, int]:
    """Rows per table that belong to the school (0s when it does not exist yet)."""
    org = db.scalar(select(Organisation).where(Organisation.slug == slug))
    if org is None:
        return {model.__tablename__: 0 for model in TABLES}
    projects = select(Project.id).where(Project.organisation_id == org.id)
    classes = select(Classroom.id).where(Classroom.organisation_id == org.id)
    where = {
        Organisation: Organisation.id == org.id,
        Actor: Actor.organisation_id == org.id,
        Classroom: Classroom.organisation_id == org.id,
        ClassMember: ClassMember.class_id.in_(classes),
        Project: Project.organisation_id == org.id,
        Assignment: Assignment.class_id.in_(classes),
    }
    # the rest hang off a project
    for model in (ProjectVersion, ContentSnapshot, MediaAsset, MediaLink, InteractionRule, AnalyticsEvent):
        where[model] = model.project_id.in_(projects)
    return {model.__tablename__: db.scalar(select(func.count()).select_from(model).where(where[model])) for model in TABLES}


def main() -> None:
    apply = "--apply" in sys.argv[1:]
    if "--template" in sys.argv[1:]:
        # python -m app.seed --template <school slug> [--apply]: no logins made, so no bypass needed
        slug = sys.argv[sys.argv.index("--template") + 1]
        if not apply:
            print(f"Dry run only. --apply adds one published 'Museum hall' template to '{slug}' if it has none.",
                  file=sys.stderr)
            return
        from .db import SessionLocal

        with SessionLocal() as db:
            made = add_template(db, slug)
            print(f"created template {made.name} ({made.slug})" if made else f"'{slug}' already has that template")
        return
    if not get_settings().auth_dev_bypass:
        sys.exit("Refusing to seed: set AUTH_DEV_BYPASS=true (local only). These logins would not work otherwise.")

    from .db import SessionLocal

    with SessionLocal() as db:
        before = counts(db)
        if apply:
            seed(db)
        after = counts(db)
    print(f"{'table':20} {'now' if not apply else 'before':>7} {'after' if apply else '':>7}")
    for table in before:
        print(f"{table:20} {before[table]:>7} {after[table] if apply else '':>7}")
    if apply:
        print("\nSign in as dev|admin, dev|teacher, dev|teacher2 or dev|student1 ... dev|student5.")
    else:
        print("\nDry run only. --apply deletes the Demo School's rows above and builds the test data again.", file=sys.stderr)


if __name__ == "__main__":
    main()
