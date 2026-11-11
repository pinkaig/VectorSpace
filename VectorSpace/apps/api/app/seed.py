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
    AssetPack,
    Assignment,
    ClassMember,
    Classroom,
    ContentSnapshot,
    InteractionRule,
    LibraryAsset,
    MediaAsset,
    MediaLink,
    Organisation,
    PackAsset,
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

# Top of Pedestal.glb, in metres: a small exhibit stands on a pedestal at this height.
PEDESTAL_TOP = 0.75
QUARTER_TURN = 1.5708  # rotations are radians (syncArtefacts.ts sets node.rotation from them)


# ── Scenes: tiny, but the same shape the editor saves, so every project opens ──

def _scene_object(kind: str, index: int, x: float, z: float) -> dict:
    """A primitive shape (cube, sphere, cylinder)."""
    return {
        "id": f"{kind}-{index}",
        "name": f"{kind.capitalize()} {index}",
        "assetId": f"primitive-{kind}",
        "assetKind": kind,
        "visible": True,
        "enabled": True,
        "transform": {"position": [x, _HEIGHT[kind], z], "rotation": [0, 0, 0], "scale": [1, 1, 1]},
    }


def _model(label: str, object_id: str, x: float, z: float, y: float = 0.0, turn: float = 0.0,
           locked: bool = False) -> dict:
    """A bundled model from src/content/assets/. label is the catalogue name ("TRex Skull"), which
    gives the asset id the same way assets.ts does. Models are in metres with their origin at the
    centre of the base (normalise-glb.mjs), so y = 0 stands one on the floor."""
    obj = {
        "id": object_id,
        "name": label,
        "assetId": f"bundled-model-{label.lower().replace(' ', '-')}",
        "assetKind": "model",
        "visible": True,
        "enabled": True,
        "transform": {"position": [x, y, z], "rotation": [0, turn, 0], "scale": [1, 1, 1]},
    }
    if locked:
        obj["locked"] = True
    return obj


def _on_pedestal(label: str, object_id: str, x: float, z: float) -> dict:
    return _model(label, object_id, x, z, y=PEDESTAL_TOP)


# The Museum room (env-museum) is 10 x 8 m (x -5..5, z -4..4) with a 3 m ceiling and four
# pillars near x = +-3.4, z = +-2.1. The 5.9 m triceratops runs along the back between the back
# pillars, turned to lie along x; three pedestals wait at the front, inside the front pillars,
# for the student's exhibits. The template locks the triceratops and the pedestals.
PEDESTAL_X, PEDESTAL_Z = (-2.0, 0.0, 2.0), 2.2


def _museum_hall(locked: bool = False) -> list[dict]:
    return [
        _model("Triceratops", "triceratops-1", 0, -2.0, turn=QUARTER_TURN, locked=locked),
        *(_model("Pedestal", f"pedestal-{i + 1}", x, PEDESTAL_Z, locked=locked) for i, x in enumerate(PEDESTAL_X)),
    ]


def scene_data(
    project_id: uuid.UUID,
    name: str,
    rooms: list[tuple[str, str]],
    objects: list[dict],
    brief: dict | None = None,
) -> dict:
    """rooms: (name, environment id) in visit order; objects (from _model/_scene_object) go in the first room."""
    data = {
        "schemaVersion": 1,
        "id": str(project_id),
        "name": name,
        "activeSceneId": "scene-1",
        "scenes": [
            {
                "id": f"scene-{i + 1}",
                "name": room,
                "objects": list(objects) if i == 0 else [],
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
    # the library and packs are platform-wide, but each row names the person who made it (RESTRICT),
    # so files and packs made by this school's synthetic logins go with them. Their bytes stay in the
    # bucket; the seed only ever runs against local and CI data.
    people = select(Actor.id).where(Actor.organisation_id == org.id)
    files = select(LibraryAsset.id).where(LibraryAsset.uploaded_by_id.in_(people))
    db.execute(delete(PackAsset).where(PackAsset.library_asset_id.in_(files)))
    db.execute(delete(AssetPack).where(AssetPack.created_by_id.in_(people)))
    db.execute(delete(LibraryAsset).where(LibraryAsset.uploaded_by_id.in_(people)))
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
    hall = _museum_hall(locked=True)
    _save(db, museum, scene_data(museum.id, museum.name, [("Museum", "env-museum")], hall), days(30), label="First version")
    blank = _project(db, rahim, "Blank room", days(28), kind="template", status="published")
    _save(db, blank, scene_data(blank.id, blank.name, [("Empty", "env-empty")], []), days(28), label="First version")

    # Ms Tan's Dinosaur museum for 1A Science, from the Museum hall template, saved twice
    dino = _project(db, tan, "Dinosaur museum", days(10), class_id=classes[SCIENCE].id,
                    template_id=museum.id, template_revision=1)
    dino_brief = _brief(now + timedelta(days=4),
                        ["Place 3 exhibits", "Give each exhibit a fact card", "Add one reaction"],
                        ["Use facts from your research, in your own words", "Keep everything school-appropriate"])
    rooms = [("Museum", "env-museum"), ("Classroom", "env-classroom")]
    _save(db, dino, scene_data(dino.id, dino.name, rooms[:1], hall, dino_brief), days(10))
    # Ms Tan's example exhibit, the T. rex skull on the middle pedestal, then a Classroom room
    example = hall + [_on_pedestal("TRex Skull", "trex-skull-1", 0, PEDESTAL_Z)]
    _save(db, dino, scene_data(dino.id, dino.name, rooms, example, dino_brief), days(8))

    dino_assignment = Assignment(class_id=classes[SCIENCE].id, project_id=dino.id, task=DINOSAUR_TASK,
                                 due_at=(now + timedelta(days=4)).date(), created_by_id=tan.id)
    db.add(dino_assignment)
    db.flush()
    _copy_for(db, dino, aisyah, dino_assignment, days(7), tan)  # sent, not opened yet
    ethans = _copy_for(db, dino, ethan, dino_assignment, days(7), tan)
    ethan_work = example + [_on_pedestal("Ammonite", "ammonite-1", -2, PEDESTAL_Z), _on_pedestal("Trilobite", "trilobite-1", 2, PEDESTAL_Z)]
    _save(db, ethans, scene_data(ethans.id, ethans.name, rooms, ethan_work, dino_brief),
          days(2))  # and Ethan has been building since: an exhibit on each empty pedestal

    # Mr Rahim's Rainforest tour for 2B Humanities; Ben's copy is archived
    rainforest = _project(db, rahim, "Rainforest tour", days(20), class_id=classes[HUMANITIES].id,
                          template_id=blank.id, template_revision=1)
    _save(db, rainforest, scene_data(rainforest.id, rainforest.name, [("Canopy", "env-exhibition")],
                                     [_scene_object("cylinder", 1, 0, 0)]), days(20))
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
    # the Gallery room (env-highlight-exhibit) is 32 x 24 m with a 3.05 m ceiling: the one room
    # tall enough for the 3 m mammoth
    gallery = [
        _model("Mammoth", "mammoth-1", 0, 0, turn=QUARTER_TURN),
        _model("Pedestal", "pedestal-1", 4, 1),
        _on_pedestal("Dinosaur Footprint", "dinosaur-footprint-1", 4, 1),
    ]
    _save(db, own, scene_data(own.id, own.name, [("Gallery", "env-highlight-exhibit")], gallery), days(24))
    for session, event, payload, ago in [
        ("visit-1", "visit_start", None, 3),
        ("visit-1", "object_click", {"objectId": "mammoth-1"}, 3),
        ("visit-2", "visit_start", None, 2),
        ("visit-2", "object_click", {"objectId": "dinosaur-footprint-1"}, 2),
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

    # two click rules on the Dinosaur museum: the triceratops and Ms Tan's T. rex skull
    db.add(InteractionRule(project_id=dino.id, object_id="triceratops-1", triggers=["click"],
                           actions=[{"kind": "showPanel", "params": {
                               "title": "Triceratops",
                               "body": "A plant-eater with three horns and a bony frill. It lived about 68 to 66 million years ago."}}]))
    db.add(InteractionRule(project_id=dino.id, object_id="trex-skull-1", triggers=["click"],
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
    _save(db, template, scene_data(template.id, name, [("Museum", "env-museum")], _museum_hall(locked=True)), now,
          label="First version")
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
